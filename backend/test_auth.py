import auth


def test_sign_up_log_in_and_out(client):
    r = client.post("/auth/register", json={"username": "Vita", "password": "secret-pass", "display_name": "Vita", "home_country": "LT", "languages": ["lt"], "accept_terms": True})
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "vita"  # usernames are case-insensitive

    r = client.post("/auth/login", json={"username": "VITA", "password": "secret-pass"})
    assert r.status_code == 200
    headers = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/auth/me", headers=headers).json()["display_name"] == "Vita"

    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_passwords_are_not_stored_in_plain_text(client):
    client.post("/auth/register", json={"username": "vita", "password": "secret-pass", "display_name": "Vita", "home_country": "LT", "languages": ["lt"], "accept_terms": True})
    import db
    with db.db() as conn:
        stored = conn.execute("SELECT password_hash FROM users").fetchone()[0]
    assert "secret-pass" not in stored and stored.startswith("pbkdf2_sha256$")


def test_wrong_password_and_lockout(client):
    client.post("/auth/register", json={"username": "vita", "password": "secret-pass", "display_name": "Vita", "home_country": "LT", "languages": ["lt"], "accept_terms": True})
    for _ in range(auth.MAX_FAILED_LOGINS):
        assert client.post("/auth/login", json={"username": "vita", "password": "nope-nope"}).status_code == 401
    # locked now, even with the right password
    assert client.post("/auth/login", json={"username": "vita", "password": "secret-pass"}).status_code == 429


def test_sign_up_validation(client):
    def sign_up(**kw):
        body = {"username": "vita", "password": "secret-pass", "display_name": "Vita",
                "home_country": "LT", "languages": ["lt", "en"], "accept_terms": True, **kw}
        return client.post("/auth/register", json=body).status_code

    assert sign_up(username="a!") == 400
    assert sign_up(password="short") == 400
    assert sign_up(display_name=" ") == 400
    assert sign_up(home_country="XX") == 400
    assert sign_up(languages=[]) == 400
    assert sign_up(languages=["klingon"]) == 400
    assert sign_up(accept_terms=False) == 400  # must be 18+ and accept the terms
    assert sign_up() == 200
    assert sign_up() == 409  # username taken


def test_tickets_sync_between_devices(client, signup):
    laptop = signup("Vita", chat_consent=False)
    tickets = [{"key": "Praha, Čekija", "days": 5, "stops": [{"destination": "Praha, Čekija", "days": 5}]}]
    assert client.put("/account/tickets", headers=laptop, json={"tickets": tickets}).status_code == 200

    r = client.post("/auth/login", json={"username": "vita", "password": "correct horse 1"})
    phone = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/account/tickets", headers=phone).json()["tickets"] == tickets


def test_tickets_are_private(client, signup):
    vita, ben = signup("Vita", chat_consent=False), signup("Ben", chat_consent=False)
    client.put("/account/tickets", headers=vita, json={"tickets": [{"key": "secret"}]})
    assert client.get("/account/tickets", headers=ben).json()["tickets"] == []
    assert client.get("/account/tickets").status_code == 401


def test_delete_account_needs_password_and_removes_everything(client, signup):
    vita = signup("Vita")
    client.put("/account/tickets", headers=vita, json={"tickets": [{"key": "x"}]})
    assert client.post("/auth/delete-account", headers=vita, json={"password": "wrong"}).status_code == 401
    assert client.post("/auth/delete-account", headers=vita, json={"password": "correct horse 1"}).status_code == 204
    assert client.get("/auth/me", headers=vita).status_code == 401
    assert client.post("/auth/login", json={"username": "vita", "password": "correct horse 1"}).status_code == 401


def test_profile_has_home_country_and_languages(client, signup):
    vita = signup("Vita", chat_consent=False, home_country="lt", languages=("LT", "en", "lt"))
    me = client.get("/auth/me", headers=vita).json()
    assert (me["home_country"], me["languages"]) == ("LT", ["lt", "en"])
    r = client.patch("/auth/me", headers=vita, json={"home_country": "PL", "languages": ["pl"]})
    assert (r.json()["home_country"], r.json()["languages"], r.json()["display_name"]) == ("PL", ["pl"], "Vita")
