import json
from datetime import date

import pytest

from pdf_testing import make_pdf
from verify import mentions_date

PRAHA = "Praha, Čekija"
BUDA = "Budapeštas, Vengrija"
TRIP = [{"destination": PRAHA, "start_date": "2027-05-01", "end_date": "2027-05-03"},
        {"destination": BUDA, "start_date": "2027-05-04", "end_date": "2027-05-06"}]


def upload(client, headers, text, stays=TRIP, key="t1"):
    return client.post("/trips/verify", headers=headers, data={"ticket_key": key, "stays": json.dumps(stays)},
                       files=[("files", ("ticket.pdf", make_pdf(text), "application/pdf"))])


def test_matching_ticket_verifies_the_trip(client, signup):
    ana = signup("Ana", chat_consent=False)
    r = upload(client, ana, "Booking ABC123 Vilnius (VNO) - Prague (PRG) 01 May 2027 / PRG - BUD 04 May 2027")
    assert r.status_code == 200, r.text
    trips = client.get("/trips/verified", headers=ana).json()["trips"]
    assert trips[0]["ticket_key"] == "t1" and trips[0]["stays"] == TRIP


@pytest.mark.parametrize("text, missing", [
    ("Vilnius - Prague 01 May 2027", "Budapest"),              # second city missing
    ("VNO-PRG PRG-BUD 02 May 2027", "departure date"),          # wrong date
    ("Photos from our summer holiday at the seaside", "Prague"),
])
def test_ticket_that_does_not_match_is_rejected(client, signup, text, missing):
    ana = signup("Ana", chat_consent=False)
    r = upload(client, ana, text)
    assert r.status_code == 422 and missing in r.json()["detail"]


def test_same_document_cannot_verify_two_accounts(client, signup):
    ana, ben = signup("Ana", chat_consent=False), signup("Ben", chat_consent=False)
    text = "VNO PRG BUD 2027-05-01"
    assert upload(client, ana, text).status_code == 200
    assert upload(client, ana, text, key="t2").status_code == 200  # same person, fine
    assert upload(client, ben, text).status_code == 409


def test_not_a_pdf_and_past_trips(client, signup):
    ana = signup("Ana", chat_consent=False)
    r = client.post("/trips/verify", headers=ana, data={"ticket_key": "t", "stays": json.dumps(TRIP)},
                    files=[("files", ("x.jpg", b"\xff\xd8\xff photo", "image/jpeg"))])
    assert r.status_code == 400
    past = [{"destination": PRAHA, "start_date": "2020-01-01", "end_date": "2020-01-02"}]
    assert upload(client, ana, "PRG 01 Jan 2020", stays=past).status_code == 400
    assert client.post("/trips/verify", data={"ticket_key": "t", "stays": "[]"}).status_code == 401


def test_removing_verification_also_unshares(client, signup, verify):
    ana = signup("Ana")
    stays = TRIP[:1]
    assert verify(ana, stays).status_code == 200
    client.put("/chat/stays", headers=ana, json={"ticket_key": "ticket-1", "stays": stays})
    assert client.delete("/trips/verified", headers=ana, params={"ticket_key": "ticket-1"}).status_code == 204
    assert client.get("/chat/rooms", headers=ana).json()["rooms"] == []


@pytest.mark.parametrize("text", ["2027-05-01", "01.05.2027", "1 May 2027", "May 1, 2027", "01MAY", "Sat, 1 May"])
def test_date_formats(text):
    assert mentions_date(text.lower(), date(2027, 5, 1))


@pytest.mark.parametrize("text", ["2027-05-011", "11 May 2027", "flight 2401may"])
def test_date_lookalikes_do_not_match(text):
    assert not mentions_date(text.lower(), date(2027, 5, 1))
