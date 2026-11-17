"""
Kelionių pokalbiai (travel buddy chat).

Logged-in users who agree to chat share, per saved ticket, which destination they will be in
and when. For every country there is one chat room, but each person only sees the people and
the messages of travellers whose stay in that country overlaps their own.
"""

import time
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

import db as database
from auth import current_user, languages_of
from safety import blocked_ids
from data import destinations
from verify import is_verified

router = APIRouter(prefix="/chat", tags=["chat"])

MIN_SECONDS_BETWEEN_MESSAGES = 1.0
MAX_STAY_DAYS = 60
HISTORY_LIMIT = 100

# "Praha, Čekija" -> "Čekija": only destinations the planner knows can be shared
DESTINATION_COUNTRY = {d["name"]: d["name"].split(",")[1].strip() for d in destinations}
COUNTRIES = set(DESTINATION_COUNTRY.values())


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def chat_user(user=Depends(current_user)):
    if not user["chat_consent_at"]:
        raise HTTPException(403, "Turn on Meet travellers first")
    return user


# ---------- models ----------

class StayIn(BaseModel):
    destination: str
    start_date: date
    end_date: date


class StaysIn(BaseModel):
    ticket_key: str = Field(min_length=1, max_length=300)
    stays: list[StayIn] = Field(min_length=1, max_length=len(destinations))


class MessageIn(BaseModel):
    text: str = Field(max_length=2000)


# ---------- helpers ----------

def _my_stays(conn, user_id, country=None):
    sql = "SELECT destination, country, start_date, end_date FROM stays WHERE traveller_id = ?"
    args = [user_id]
    if country:
        sql += " AND country = ?"
        args.append(country)
    return [dict(r) for r in conn.execute(sql + " ORDER BY start_date", args)]


def _overlapping_people(conn, user_id, country, my_stays):
    """Other travellers whose stay in `country` overlaps at least one of mine."""
    if not my_stays:
        return []
    overlap = " OR ".join("(s.start_date <= ? AND s.end_date >= ?)" for _ in my_stays)
    args = [country, user_id]
    for s in my_stays:
        args += [s["end_date"], s["start_date"]]
    rows = conn.execute(
        f"""SELECT u.id, u.display_name, u.home_country, u.languages, s.destination, s.start_date, s.end_date
            FROM stays s JOIN users u ON u.id = s.traveller_id
            WHERE s.country = ? AND s.traveller_id != ? AND u.chat_consent_at IS NOT NULL AND ({overlap})
            ORDER BY s.start_date""",
        args,
    )
    hidden = blocked_ids(conn, user_id)
    people = {}
    for r in rows:
        if r["id"] in hidden:
            continue
        p = people.setdefault(r["id"], {
            "traveller_id": r["id"], "name": r["display_name"], "home_country": r["home_country"],
            "languages": languages_of(r), "verified": True, "stays": [],
        })
        p["stays"].append({"destination": r["destination"], "start_date": r["start_date"], "end_date": r["end_date"]})
    return list(people.values())


def _visible_authors(conn, me, country):
    my_stays = _my_stays(conn, me["id"], country)
    if not my_stays:
        raise HTTPException(403, "You haven't shared a trip to this country")
    people = _overlapping_people(conn, me["id"], country, my_stays)
    return [me["id"]] + [p["traveller_id"] for p in people]


def _check_country(country):
    if country not in COUNTRIES:
        raise HTTPException(404, "Unknown country")


MESSAGE_SELECT = """SELECT m.id, m.text, m.created_at, m.traveller_id, u.display_name AS name
                    FROM messages m JOIN users u ON u.id = m.traveller_id"""


def _message_out(row, me_id):
    return {
        "id": row["id"],
        "text": row["text"],
        "created_at": row["created_at"],
        "traveller_id": row["traveller_id"],
        "name": row["name"],
        "mine": row["traveller_id"] == me_id,
    }


# ---------- consent ----------

@router.post("/consent")
def give_consent(user=Depends(current_user)):
    with database.db() as conn:
        conn.execute("UPDATE users SET chat_consent_at = ? WHERE id = ?", (_now(), user["id"]))
    return {"chat_consent": True}


@router.delete("/consent", status_code=204)
def withdraw_consent(user=Depends(current_user)):
    """Išjungia pokalbius: ištrina visas pasidalintas keliones ir visas žinutes."""
    with database.db() as conn:
        conn.execute("DELETE FROM stays WHERE traveller_id = ?", (user["id"],))
        conn.execute("DELETE FROM messages WHERE traveller_id = ?", (user["id"],))
        conn.execute("UPDATE users SET chat_consent_at = NULL WHERE id = ?", (user["id"],))
    return Response(status_code=204)


# ---------- sharing tickets ----------

@router.put("/stays")
def share_ticket(body: StaysIn, me=Depends(chat_user)):
    rows = []
    for stay in body.stays:
        country = DESTINATION_COUNTRY.get(stay.destination)
        if country is None:
            raise HTTPException(400, f"Unknown destination: {stay.destination}")
        if stay.end_date < stay.start_date:
            raise HTTPException(400, "end_date is before start_date")
        if (stay.end_date - stay.start_date).days > MAX_STAY_DAYS:
            raise HTTPException(400, f"A stay can't be longer than {MAX_STAY_DAYS} days")
        rows.append((me["id"], body.ticket_key, stay.destination, country,
                     stay.start_date.isoformat(), stay.end_date.isoformat()))
    with database.db() as conn:
        # only trips proven with a ticket document can be shared (see verify.py)
        if not is_verified(conn, me["id"], body.ticket_key, body.stays):
            raise HTTPException(403, "Verify this trip with your ticket first")
        conn.execute("DELETE FROM stays WHERE traveller_id = ? AND ticket_key = ?", (me["id"], body.ticket_key))
        conn.executemany(
            "INSERT INTO stays (traveller_id, ticket_key, destination, country, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
    return {"ticket_key": body.ticket_key, "shared": len(rows)}


@router.delete("/stays", status_code=204)
def unshare_ticket(ticket_key: str = Query(min_length=1), me=Depends(current_user)):
    with database.db() as conn:
        conn.execute("DELETE FROM stays WHERE traveller_id = ? AND ticket_key = ?", (me["id"], ticket_key))
    return Response(status_code=204)


# ---------- rooms & messages ----------

@router.get("/rooms")
def rooms(me=Depends(chat_user)):
    with database.db() as conn:
        by_country = {}
        for s in _my_stays(conn, me["id"]):
            by_country.setdefault(s["country"], []).append(s)

        result = []
        for country, my_stays in by_country.items():
            people = _overlapping_people(conn, me["id"], country, my_stays)
            authors = [me["id"]] + [p["traveller_id"] for p in people]
            marks = ",".join("?" * len(authors))
            last = conn.execute(
                f"SELECT MAX(id) FROM messages WHERE country = ? AND traveller_id IN ({marks})",
                [country, *authors],
            ).fetchone()[0]
            result.append({
                "country": country,
                "my_stays": [{k: s[k] for k in ("destination", "start_date", "end_date")} for s in my_stays],
                "people": people,
                "last_message_id": last or 0,
            })
    result.sort(key=lambda r: r["my_stays"][0]["start_date"])
    return {"rooms": result}


@router.get("/rooms/{country}/messages")
def get_messages(country: str, after: int = 0, me=Depends(chat_user)):
    _check_country(country)
    with database.db() as conn:
        authors = _visible_authors(conn, me, country)
        marks = ",".join("?" * len(authors))
        base = f"{MESSAGE_SELECT} WHERE m.country = ? AND m.traveller_id IN ({marks})"
        if after > 0:
            rows = conn.execute(base + " AND m.id > ? ORDER BY m.id LIMIT 200", [country, *authors, after]).fetchall()
        else:
            rows = conn.execute(base + " ORDER BY m.id DESC LIMIT ?", [country, *authors, HISTORY_LIMIT]).fetchall()
            rows.reverse()
    return {"messages": [_message_out(r, me["id"]) for r in rows]}


@router.post("/rooms/{country}/messages")
def send_message(country: str, body: MessageIn, me=Depends(chat_user)):
    _check_country(country)
    text = body.text.strip()
    if not 1 <= len(text) <= 500:
        raise HTTPException(400, "Messages must be 1–500 characters")
    if time.time() - me["last_message_at"] < MIN_SECONDS_BETWEEN_MESSAGES:
        raise HTTPException(429, "You're sending messages too fast")
    with database.db() as conn:
        _visible_authors(conn, me, country)  # only travellers with a stay there may post
        cur = conn.execute(
            "INSERT INTO messages (country, traveller_id, text, created_at) VALUES (?, ?, ?, ?)",
            (country, me["id"], text, _now()),
        )
        conn.execute("UPDATE users SET last_message_at = ? WHERE id = ?", (time.time(), me["id"]))
        row = conn.execute(f"{MESSAGE_SELECT} WHERE m.id = ?", (cur.lastrowid,)).fetchone()
    return _message_out(row, me["id"])
