"""
Kelionės informacija (trip info) for one destination and date range:

* public holidays – Nager.Date API (free, no key)
* live events      – Ticketmaster Discovery API, only if TICKETMASTER_API_KEY is set
* yearly events    – well-known festivals from places.py
* country situation – UK Foreign Office travel advice (GOV.UK content API, free, no key)

plus the documents a traveller needs, based on their nationality.
External answers are cached so the page stays fast and the APIs aren't hammered.
"""

import html
import json
import os
import re
import time
from datetime import date, timedelta

import requests
from fastapi import APIRouter, HTTPException, Query

from countries import COUNTRIES, document_requirements
from places import PLACES, YEARLY_EVENTS

router = APIRouter(prefix="/travel", tags=["travel"])

TIMEOUT = 8
_cache = {}  # key -> (value, expires_at)


def cached(key, seconds, load):
    hit = _cache.get(key)
    if hit and hit[1] > time.time():
        return hit[0]
    value = load()
    _cache[key] = (value, time.time() + seconds)
    return value


def _place(destination):
    place = PLACES.get(destination)
    if place is None:
        raise HTTPException(404, "Unknown destination")
    return place


def _check_range(start, end):
    if end < start:
        raise HTTPException(400, "end_date is before start_date")
    if (end - start).days > 120:
        raise HTTPException(400, "Date range is too long")


# ---------- public holidays ----------

def _holidays_for_year(iso, year):
    r = requests.get(f"https://date.nager.at/api/v3/PublicHolidays/{year}/{iso}", timeout=TIMEOUT)
    r.raise_for_status()
    return json.loads(r.content.decode("utf-8"))  # the API doesn't always declare its charset


def holidays(iso, start, end):
    out = []
    for year in range(start.year, end.year + 1):
        for h in cached(("holidays", iso, year), 24 * 3600, lambda: _holidays_for_year(iso, year)):
            if start.isoformat() <= h["date"] <= end.isoformat() and h.get("global", True):
                out.append({"date": h["date"], "name": h["name"], "local_name": h["localName"]})
    return out


# ---------- yearly festivals ----------

def _in_range(month_day, start, end):
    """Is the (month, day) between two dates? Works across year boundaries."""
    d = start
    while d <= end:
        if (d.month, d.day) == month_day:
            return True
        d += timedelta(days=1)
    return False


def yearly_events(destination, start, end):
    out = []
    for name, first, last in YEARLY_EVENTS.get(destination, []):
        # build the event's dates in every year the trip touches and check for overlap
        for year in range(start.year - 1, end.year + 1):
            ev_start = date(year, *first)
            ev_end = date(year + (1 if last < first else 0), *last)
            if ev_start <= end and ev_end >= start:
                out.append({"name": name, "start_date": ev_start.isoformat(), "end_date": ev_end.isoformat()})
                break
    return out


# ---------- live events (Ticketmaster) ----------

def live_events(place, start, end):
    key = os.environ.get("TICKETMASTER_API_KEY")
    if not key:
        return None  # not configured

    def load():
        r = requests.get(
            "https://app.ticketmaster.com/discovery/v2/events.json",
            params={
                "apikey": key,
                "city": place["city"],
                "countryCode": place["iso"],
                "startDateTime": f"{start.isoformat()}T00:00:00Z",
                "endDateTime": f"{end.isoformat()}T23:59:59Z",
                "sort": "date,asc",
                "size": 20,
            },
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        events = []
        for e in r.json().get("_embedded", {}).get("events", []):
            venue = (e.get("_embedded", {}).get("venues") or [{}])[0]
            classification = (e.get("classifications") or [{}])[0]
            events.append({
                "name": e.get("name"),
                "date": e.get("dates", {}).get("start", {}).get("localDate"),
                "time": e.get("dates", {}).get("start", {}).get("localTime"),
                "venue": venue.get("name"),
                "category": (classification.get("segment") or {}).get("name"),
                "url": e.get("url"),
            })
        return events

    return cached(("live", place["iso"], place["city"], start, end), 30 * 60, load)


# ---------- country situation (GOV.UK travel advice) ----------

TAG = re.compile(r"<[^>]+>")


def _text(fragment):
    return " ".join(html.unescape(TAG.sub(" ", fragment)).split())


def _sections(body, limit):
    """Split an advice page into its h2 sections, keeping each section's first paragraph."""
    out = []
    for m in re.finditer(r"<h2[^>]*>(.*?)</h2>(.*?)(?=<h2|\Z)", body, re.S):
        title = _text(m.group(1))
        first_p = re.search(r"<p>(.*?)</p>", m.group(2), re.S)
        if title and first_p:
            out.append({"title": title, "text": _text(first_p.group(1))[:400]})
        if len(out) >= limit:
            break
    return out


def advisory(place):
    def load():
        url = f"https://www.gov.uk/api/content/foreign-travel-advice/{place['govuk']}"
        r = requests.get(url, timeout=TIMEOUT)
        r.raise_for_status()
        details = r.json()["details"]
        parts = {p["slug"]: p for p in details.get("parts", [])}
        safety = parts.get("safety-and-security", {}).get("body", "")
        return {
            "updated_at": details.get("updated_at") or r.json().get("public_updated_at"),
            "latest_change": _text(details.get("change_description") or ""),
            "alerts": details.get("alert_status") or [],
            "safety": _sections(safety, 6),
            "source": "UK Foreign, Commonwealth & Development Office",
            "url": f"https://www.gov.uk/foreign-travel-advice/{place['govuk']}",
        }

    return cached(("advice", place["govuk"]), 6 * 3600, load)


# ---------- endpoints ----------

@router.get("/info")
def trip_info(destination: str, start_date: date, end_date: date):
    place = _place(destination)
    _check_range(start_date, end_date)
    result = {
        "destination": destination,
        "city": place["city"],
        "country": place["country"],
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "yearly_events": yearly_events(destination, start_date, end_date),
        "errors": [],
    }
    try:
        result["holidays"] = holidays(place["iso"], start_date, end_date)
    except requests.RequestException:
        result["holidays"] = []
        result["errors"].append("Public holidays are unavailable right now")
    try:
        result["live_events"] = live_events(place, start_date, end_date)
    except requests.RequestException:
        result["live_events"] = []
        result["errors"].append("Live events are unavailable right now")
    try:
        result["advisory"] = advisory(place)
    except (requests.RequestException, KeyError, ValueError):
        result["advisory"] = None
        result["errors"].append("Travel advice is unavailable right now")
    return result


@router.get("/countries")
def list_countries():
    from countries import LANGUAGES
    return {
        "countries": sorted(({"code": c, "name": n} for c, n in COUNTRIES.items()), key=lambda c: c["name"]),
        "languages": sorted(({"code": c, "name": n} for c, n in LANGUAGES.items()), key=lambda l: l["name"]),
    }


@router.get("/documents")
def documents(
    nationality: str,
    start_date: date,
    end_date: date,
    destinations: list[str] = Query(min_length=1),
):
    _check_range(start_date, end_date)
    isos = [_place(d)["iso"] for d in destinations]
    try:
        result = document_requirements(nationality.upper(), start_date, end_date, isos)
    except ValueError:
        raise HTTPException(400, "Unknown nationality")
    result["nationality"] = nationality.upper()
    result["nationality_name"] = COUNTRIES[nationality.upper()]
    return result
