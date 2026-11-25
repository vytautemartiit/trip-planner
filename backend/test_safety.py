from test_chat import PRAHA, room, share
from test_meet import STAY, ask, guide


def user_id(client, headers):
    return client.get("/auth/me", headers=headers).json()["id"]


def test_blocking_hides_people_and_messages_both_ways(client, signup, verify):
    ana, ben = signup("Ana"), signup("Ben")
    share(client, ana, PRAHA, "2027-05-01", "2027-05-04", verify=verify)
    share(client, ben, PRAHA, "2027-05-03", "2027-05-08", verify=verify)
    client.post("/chat/rooms/Čekija/messages", headers=ben, json={"text": "Hello from Ben"})
    assert [p["name"] for p in room(client, ana)["people"]] == ["Ben"]

    ben_id = user_id(client, ben)
    assert client.post("/safety/blocks", headers=ana, json={"user_id": ben_id}).status_code == 201

    assert room(client, ana)["people"] == [] and room(client, ben)["people"] == []
    assert client.get("/chat/rooms/Čekija/messages", headers=ana).json()["messages"] == []
    assert [b["name"] for b in client.get("/safety/blocks", headers=ana).json()["blocked"]] == ["Ben"]
    assert client.get("/safety/blocks", headers=ben).json()["blocked"] == []  # Ben isn't told

    assert client.delete(f"/safety/blocks/{ben_id}", headers=ana).status_code == 204
    assert [p["name"] for p in room(client, ana)["people"]] == ["Ben"]


def test_blocking_a_local_calls_off_the_meetup(client, signup, verify):
    petr, petr_id = guide(client, signup)
    ana = signup("Ana", chat_consent=False)
    assert verify(ana, STAY).status_code == 200
    request_id = ask(client, ana, petr_id).json()["id"]
    client.post(f"/meet/requests/{request_id}/answer", headers=petr, json={"accept": True})

    client.post("/safety/blocks", headers=petr, json={"user_id": user_id(client, ana)})

    assert client.get("/locals", headers=ana, params={"city": PRAHA}).json()["locals"] == []
    assert client.get("/meet/requests", headers=ana).json()["outgoing"] == []
    assert client.get("/meet/requests", headers=petr).json()["incoming"] == []
    assert ask(client, ana, petr_id).status_code == 404  # looks like the local just isn't there
    assert client.post(f"/meet/requests/{request_id}/messages", headers=ana, json={"text": "hi"}).status_code in (403, 404)


def test_reports(client, signup, monkeypatch):
    ana, ben = signup("Ana", chat_consent=False), signup("Ben", chat_consent=False)
    ben_id = user_id(client, ben)

    r = client.post("/safety/reports", headers=ana, json={"user_id": ben_id, "reason": "spam", "where": "chat"})
    assert r.status_code == 201 and r.json() == {"reported": True, "blocked": True}
    assert client.get("/safety/blocks", headers=ana).json()["blocked"][0]["id"] == ben_id

    bad = [
        {"user_id": ben_id, "reason": "other", "where": "chat"},  # "other" needs details
        {"user_id": ben_id, "reason": "nonsense", "where": "chat"},
        {"user_id": user_id(client, ana), "reason": "spam", "where": "chat"},  # yourself
        {"user_id": "nobody", "reason": "spam", "where": "meet"},
    ]
    assert [client.post("/safety/reports", headers=ana, json=b).status_code for b in bad] == [400, 422, 400, 404]
    assert client.post("/safety/reports", json={"user_id": ben_id, "reason": "spam", "where": "chat"}).status_code == 401

    # only the admin can read reports
    assert client.get("/safety/reports").status_code == 403
    monkeypatch.setenv("ADMIN_TOKEN", "s3cret-admin")
    assert client.get("/safety/reports", headers={"X-Admin-Token": "wrong"}).status_code == 403
    reports = client.get("/safety/reports", headers={"X-Admin-Token": "s3cret-admin"}).json()["reports"]
    assert [(x["reported_name"], x["reason"]) for x in reports] == [("Ben", "spam")]


def test_report_limit(client, signup):
    ana, ben = signup("Ana", chat_consent=False), signup("Ben", chat_consent=False)
    ben_id = user_id(client, ben)
    body = {"user_id": ben_id, "reason": "spam", "where": "chat", "block": False}
    codes = [client.post("/safety/reports", headers=ana, json=body).status_code for _ in range(11)]
    assert codes == [201] * 10 + [429]
