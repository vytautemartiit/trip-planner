from datetime import date

import pytest

import travel
from countries import document_requirements

PRAHA = "Praha, Čekija"


def titles(result):
    return [i["title"] for i in result["items"]]


def test_eu_citizens_can_use_an_id_card():
    r = document_requirements("LT", date(2027, 5, 1), date(2027, 5, 7), ["CZ"])
    assert r["group"] == "eu"
    assert "Valid passport or national ID card" in titles(r)
    assert not any("visa (" in t.lower() for t in titles(r))


def test_visa_free_travellers_need_a_passport_valid_3_months_after():
    r = document_requirements("US", date(2027, 5, 1), date(2027, 5, 7), ["CZ"])
    passport = next(i for i in r["items"] if i["title"] == "Passport")
    assert "2027-08-07" in passport["detail"]
    assert "ETIAS travel authorisation" in titles(r)


def test_visa_required_and_long_trips():
    r = document_requirements("IN", date(2027, 1, 1), date(2027, 4, 15), ["CZ", "HU"])
    assert "Schengen visa (type C)" in titles(r)
    assert any(i["level"] == "warning" for i in r["items"])  # over 90 days
    assert "Biometric passport" in titles(document_requirements("UA", date(2027, 1, 1), date(2027, 1, 5), ["CZ"]))


def test_documents_endpoint(client):
    r = client.get("/travel/documents", params={
        "nationality": "gb", "start_date": "2027-05-01", "end_date": "2027-05-07", "destinations": [PRAHA]})
    assert r.status_code == 200 and r.json()["nationality_name"] == "United Kingdom"
    bad = client.get("/travel/documents", params={
        "nationality": "XX", "start_date": "2027-05-01", "end_date": "2027-05-07", "destinations": [PRAHA]})
    assert bad.status_code == 400


def test_yearly_events_across_new_year():
    names = [e["name"] for e in travel.yearly_events(PRAHA, date(2027, 1, 2), date(2027, 1, 4))]
    assert names == ["Christmas markets on Old Town Square"]
    assert travel.yearly_events(PRAHA, date(2027, 3, 1), date(2027, 3, 5)) == []


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self.data

    @property
    def content(self):
        import json
        return json.dumps(self.data).encode()


ADVICE = {"public_updated_at": "2026-08-11", "details": {
    "updated_at": "2026-08-11T10:18:36+01:00",
    "change_description": "Updated <b>EES</b> information",
    "alert_status": [],
    "parts": [
        {"slug": "safety-and-security", "body": "<h2>Crime</h2><p>Watch for pickpockets &amp; scams.</p><h2>Protests</h2><p>Avoid them.</p>"},
        {"slug": "warnings-and-insurance", "body": "<h2>Before you travel</h2><p>Get insurance.</p>"},
    ]}}


def test_trip_info_combines_sources(client, monkeypatch):
    def fake_get(url, params=None, timeout=None):
        if "nager" in url:
            return FakeResponse([
                {"date": "2027-05-01", "name": "Labour Day", "localName": "Svátek práce", "global": True},
                {"date": "2027-07-05", "name": "Saints Cyril and Methodius", "localName": "x", "global": True},
            ])
        if "gov.uk" in url:
            return FakeResponse(ADVICE)
        raise AssertionError(url)

    monkeypatch.setattr(travel.requests, "get", fake_get)
    monkeypatch.delenv("TICKETMASTER_API_KEY", raising=False)
    r = client.get("/travel/info", params={"destination": PRAHA, "start_date": "2027-04-30", "end_date": "2027-05-03"})
    data = r.json()
    assert [h["name"] for h in data["holidays"]] == ["Labour Day"]
    assert data["live_events"] is None  # Ticketmaster not configured
    assert data["advisory"]["safety"][0] == {"title": "Crime", "text": "Watch for pickpockets & scams."}
    assert data["advisory"]["latest_change"] == "Updated EES information"
    assert data["errors"] == []


def test_trip_info_survives_api_failures(client, monkeypatch):
    def broken(*a, **kw):
        raise travel.requests.ConnectionError("offline")

    monkeypatch.setattr(travel.requests, "get", broken)
    r = client.get("/travel/info", params={"destination": PRAHA, "start_date": "2027-05-01", "end_date": "2027-05-03"})
    assert r.status_code == 200
    assert r.json()["advisory"] is None and len(r.json()["errors"]) == 2


@pytest.mark.parametrize("params", [
    {"destination": "Paris", "start_date": "2027-05-01", "end_date": "2027-05-03"},
    {"destination": PRAHA, "start_date": "2027-05-05", "end_date": "2027-05-03"},
])
def test_trip_info_validation(client, params):
    assert client.get("/travel/info", params=params).status_code in (400, 404)
