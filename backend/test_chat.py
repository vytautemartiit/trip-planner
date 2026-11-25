import pytest

import chat

PRAHA = "Praha, Čekija"
ROMA = "Roma, Italija"


FUTURE = "2027"


def share(client, headers, destination, start, end, key="ticket-1", verify=None):
    stays = [{"destination": destination, "start_date": start, "end_date": end}]
    if verify:
        assert verify(headers, stays, key).status_code == 200
    r = client.put("/chat/stays", headers=headers, json={"ticket_key": key, "stays": stays})
    assert r.status_code == 200, r.text


def room(client, headers, country="Čekija"):
    rooms = client.get("/chat/rooms", headers=headers).json()["rooms"]
    return next((r for r in rooms if r["country"] == country), None)


def test_overlapping_travellers_see_each_other_and_messages(client, signup, verify):
    ana, ben = signup("Ana"), signup("Ben")
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    share(client, ben, PRAHA, "2027-05-03", "2027-05-08", verify=verify)

    assert [p["name"] for p in room(client, ana)["people"]] == ["Ben"]

    r = client.post("/chat/rooms/Čekija/messages", headers=ana, json={"text": "Labas! Anyone up for the castle?"})
    assert r.status_code == 200 and r.json()["mine"] is True

    msgs = client.get("/chat/rooms/Čekija/messages", headers=ben).json()["messages"]
    assert [(m["name"], m["mine"]) for m in msgs] == [("Ana", False)]


def test_travellers_on_other_dates_are_invisible(client, signup, verify):
    ana, cid = signup("Ana"), signup("Cid")
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    share(client, cid, PRAHA, "2027-05-05", "2027-05-09", verify=verify)  # arrives the day after Ana leaves

    client.post("/chat/rooms/Čekija/messages", headers=cid, json={"text": "hello"})

    assert room(client, ana)["people"] == []
    assert client.get("/chat/rooms/Čekija/messages", headers=ana).json()["messages"] == []


def test_other_countries_are_not_matched(client, signup, verify):
    ana, dan = signup("Ana"), signup("Dan")
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    share(client, dan, ROMA, "2027-05-01", "2027-05-04", verify=verify)
    assert room(client, ana)["people"] == []
    assert room(client, dan, "Čekija") is None


def test_chat_needs_login_and_consent(client, signup, verify):
    assert client.get("/chat/rooms").status_code == 401
    shy = signup("Shy", chat_consent=False)
    assert client.get("/chat/rooms", headers=shy).status_code == 403
    r = client.put("/chat/stays", headers=shy, json={
        "ticket_key": "t", "stays": [{"destination": PRAHA, "start_date": "2027-05-01", "end_date": "2027-05-02"}]})
    assert r.status_code == 403


def test_turning_sharing_off_removes_you(client, signup, verify):
    ana, ben = signup("Ana"), signup("Ben")
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    share(client, ben, PRAHA, "2027-05-02", "2027-05-03", verify=verify)

    assert client.delete("/chat/stays", headers=ben, params={"ticket_key": "ticket-1"}).status_code == 204
    assert room(client, ana)["people"] == []
    assert client.get("/chat/rooms/Čekija/messages", headers=ben).status_code == 403
    assert client.post("/chat/rooms/Čekija/messages", headers=ben, json={"text": "hi"}).status_code == 403


def test_withdrawing_consent_deletes_stays_and_messages(client, signup, verify):
    ana, ben = signup("Ana"), signup("Ben")
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    share(client, ben, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    client.post("/chat/rooms/Čekija/messages", headers=ben, json={"text": "bye soon"})

    assert client.delete("/chat/consent", headers=ben).status_code == 204
    assert room(client, ana)["people"] == []
    assert client.get("/chat/rooms/Čekija/messages", headers=ana).json()["messages"] == []
    assert client.get("/chat/rooms", headers=ben).status_code == 403


@pytest.mark.parametrize("stay", [
    {"destination": "Paris, France", "start_date": "2027-05-01", "end_date": "2027-05-02"},
    {"destination": PRAHA, "start_date": "2027-05-05", "end_date": "2027-05-01"},
    {"destination": PRAHA, "start_date": "2027-05-01", "end_date": "2027-09-01"},
])
def test_invalid_stays_are_rejected(client, signup, verify, stay):
    ana = signup("Ana")
    r = client.put("/chat/stays", headers=ana, json={"ticket_key": "t", "stays": [stay]})
    assert r.status_code == 400


def test_messages_are_validated(client, signup, verify):
    ana = signup("Ana")
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    assert client.post("/chat/rooms/Čekija/messages", headers=ana, json={"text": "   "}).status_code == 400
    assert client.post("/chat/rooms/Čekija/messages", headers=ana, json={"text": "x" * 501}).status_code == 400


def test_rate_limit(client, signup, verify):
    ana = signup("Ana")
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    chat.MIN_SECONDS_BETWEEN_MESSAGES = 60
    assert client.post("/chat/rooms/Čekija/messages", headers=ana, json={"text": "one"}).status_code == 200
    assert client.post("/chat/rooms/Čekija/messages", headers=ana, json={"text": "two"}).status_code == 429


def test_unverified_trip_cannot_be_shared(client, signup, verify):
    ana = signup("Ana")
    stays = [{"destination": PRAHA, "start_date": "2027-05-01", "end_date": "2027-05-04"}]
    r = client.put("/chat/stays", headers=ana, json={"ticket_key": "t", "stays": stays})
    assert r.status_code == 403
    # verified for other dates doesn't count either
    verify(ana, [{"destination": PRAHA, "start_date": "2027-06-01", "end_date": "2027-06-04"}], "t")
    assert client.put("/chat/stays", headers=ana, json={"ticket_key": "t", "stays": stays}).status_code == 403


def test_people_show_home_country_and_languages(client, signup, verify):
    ana, ben = signup("Ana"), signup("Ben", home_country="DE", languages=("de", "en"))
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    share(client, ben, PRAHA, "2027-05-02", "2027-05-03", verify=verify)
    person = room(client, ana)["people"][0]
    assert (person["home_country"], person["languages"], person["verified"]) == ("DE", ["de", "en"], True)
