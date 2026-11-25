PRAHA = "Praha, Čekija"
STAY = [{"destination": PRAHA, "start_date": "2027-05-01", "end_date": "2027-05-04"}]


def guide(client, signup, name="Petr"):
    petr = signup(name, chat_consent=False, home_country="CZ", languages=("cs", "en"))
    r = client.put("/locals/me", headers=petr, json={"city": PRAHA, "bio": "I love showing people the hidden courtyards."})
    assert r.status_code == 200, r.text
    me = client.get("/auth/me", headers=petr).json()
    return petr, me["id"]


def ask(client, headers, local_id, day="2027-05-02", message="Hi! First time in Prague, would love a walk."):
    return client.post("/meet/requests", headers=headers,
                       json={"local_id": local_id, "city": PRAHA, "date": day, "message": message})


def test_full_meeting_flow(client, signup, verify):
    petr, petr_id = guide(client, signup)
    ana = signup("Ana", chat_consent=False)
    assert verify(ana, STAY).status_code == 200

    locals_ = client.get("/locals", headers=ana, params={"city": PRAHA}).json()["locals"]
    assert [(l["name"], l["home_country"], l["languages"]) for l in locals_] == [("Petr", "CZ", ["cs", "en"])]

    r = ask(client, ana, petr_id)
    assert r.status_code == 200
    request_id = r.json()["id"]
    # no messages before the local accepts
    assert client.post(f"/meet/requests/{request_id}/messages", headers=ana, json={"text": "hello?"}).status_code == 403

    incoming = client.get("/meet/requests", headers=petr).json()["incoming"]
    assert incoming[0]["traveller"]["name"] == "Ana" and incoming[0]["date"] == "2027-05-02"
    assert client.post(f"/meet/requests/{request_id}/answer", headers=ana, json={"accept": True}).status_code == 403
    assert client.post(f"/meet/requests/{request_id}/answer", headers=petr, json={"accept": True}).json()["status"] == "accepted"

    client.post(f"/meet/requests/{request_id}/messages", headers=ana, json={"text": "See you at the clock!"})
    msgs = client.get(f"/meet/requests/{request_id}/messages", headers=petr).json()["messages"]
    assert [(m["name"], m["mine"]) for m in msgs] == [("Ana", False)]


def test_locals_need_a_verified_trip(client, signup):
    _, petr_id = guide(client, signup)
    ana = signup("Ana", chat_consent=False)
    assert client.get("/locals", headers=ana, params={"city": PRAHA}).status_code == 403
    assert ask(client, ana, petr_id).status_code == 403


def test_request_must_be_on_a_day_of_the_stay(client, signup, verify):
    _, petr_id = guide(client, signup)
    ana = signup("Ana", chat_consent=False)
    verify(ana, STAY)
    assert ask(client, ana, petr_id, day="2027-05-09").status_code == 400
    assert ask(client, ana, petr_id, message="hi").status_code == 400
    assert ask(client, ana, petr_id).status_code == 200
    assert ask(client, ana, petr_id).status_code == 409  # already asked


def test_guides_must_live_in_that_country(client, signup):
    ana = signup("Ana", chat_consent=False)  # from Lithuania
    r = client.put("/locals/me", headers=ana, json={"city": PRAHA, "bio": "I have been to Prague five times."})
    assert r.status_code == 400
    petr, _ = guide(client, signup)
    # moving abroad removes the guide profile
    client.patch("/auth/me", headers=petr, json={"home_country": "DE"})
    assert client.get("/locals/me", headers=petr).json()["guide"] is None


def test_strangers_cannot_read_a_meeting(client, signup, verify):
    petr, petr_id = guide(client, signup)
    ana, eve = signup("Ana", chat_consent=False), signup("Eve", chat_consent=False)
    verify(ana, STAY)
    request_id = ask(client, ana, petr_id).json()["id"]
    client.post(f"/meet/requests/{request_id}/answer", headers=petr, json={"accept": True})
    assert client.get(f"/meet/requests/{request_id}/messages", headers=eve).status_code == 404
    assert client.post(f"/meet/requests/{request_id}/cancel", headers=eve).status_code == 404
    assert client.post(f"/meet/requests/{request_id}/cancel", headers=ana).status_code == 200
    assert client.get("/meet/requests", headers=petr).json()["incoming"] == []
