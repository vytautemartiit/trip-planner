import json
from datetime import date

import pytest
from fastapi.testclient import TestClient

import auth
import chat
import db
import meet
import travel
from pdf_testing import make_pdf
from main import app


@pytest.fixture
def client(tmp_path):
    db.set_db_path(str(tmp_path / "test.db"))
    auth.PBKDF2_ITERATIONS = 1_000  # keep tests fast; production uses 600 000
    auth._failed_logins.clear()
    chat.MIN_SECONDS_BETWEEN_MESSAGES = 0
    meet.MIN_SECONDS_BETWEEN_MESSAGES = 0
    travel._cache.clear()
    return TestClient(app)


@pytest.fixture
def signup(client):
    def _signup(name, password="correct horse 1", chat_consent=True, home_country="LT", languages=("lt", "en")):
        r = client.post("/auth/register", json={
            "accept_terms": True,
            "username": name.lower(), "password": password, "display_name": name,
            "home_country": home_country, "languages": list(languages),
        })
        assert r.status_code == 200, r.text
        headers = {"Authorization": f"Bearer {r.json()['token']}"}
        if chat_consent:
            assert client.post("/chat/consent", headers=headers).status_code == 200
        return headers
    return _signup


CODES = {"Praha, Čekija": "PRG", "Roma, Italija": "FCO", "Budapeštas, Vengrija": "BUD"}


@pytest.fixture
def verify(client):
    """Verify a trip by uploading a fake e-ticket that mentions the airports and the departure date."""
    counter = iter(range(10_000))

    def _verify(headers, stays, key="ticket-1", text=None):
        first = date.fromisoformat(stays[0]["start_date"])
        route = " ".join(f"VNO-{CODES[s['destination']]}" for s in stays)
        text = text or f"E-TICKET {next(counter)} Passenger X Flight FR 1234 {route} Date {first.strftime('%d %b %Y')}"
        return client.post(
            "/trips/verify",
            headers=headers,
            data={"ticket_key": key, "stays": json.dumps(stays)},
            files=[("files", ("ticket.pdf", make_pdf(text), "application/pdf"))],
        )
    return _verify
