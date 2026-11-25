"""
Paskyros (accounts): sign up, log in, log out, and syncing saved tickets.

Passwords are stored as salted PBKDF2-SHA256 hashes. Logging in returns a random session
token that the browser sends as "Authorization: Bearer <token>"; only its hash is stored.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field

import db as database
from countries import COUNTRIES, LANGUAGES

router = APIRouter(tags=["account"])

PBKDF2_ITERATIONS = 600_000
SESSION_SECONDS = 30 * 24 * 3600
MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 60
MAX_TICKETS = 200
MAX_TICKETS_BYTES = 500_000

USERNAME_RE = re.compile(r"^[a-z0-9_.-]{3,30}$")
_failed_logins = {}  # username -> (count, locked_until)


# ---------- helpers ----------

def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password):
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password, stored):
    try:
        _, iterations, salt, digest = stored.split("$")
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(check.hex(), digest)
    except (ValueError, TypeError):
        return False


def clean_display_name(name):
    name = " ".join(name.split())
    if not 2 <= len(name) <= 30:
        raise HTTPException(400, "Display name must be 2–30 characters")
    return name


def _clean_username(username):
    username = username.strip().lower()
    if not USERNAME_RE.match(username):
        raise HTTPException(400, "Username must be 3–30 characters: letters, numbers, . _ or -")
    return username


def _check_password(password):
    if not 8 <= len(password) <= 128:
        raise HTTPException(400, "Password must be at least 8 characters")


def clean_country(code):
    code = (code or "").strip().upper()
    if code not in COUNTRIES:
        raise HTTPException(400, "Choose the country you are from")
    return code


def clean_languages(codes):
    codes = list(dict.fromkeys(c.strip().lower() for c in codes))
    if not 1 <= len(codes) <= 10 or any(c not in LANGUAGES for c in codes):
        raise HTTPException(400, "Choose 1–10 languages you speak")
    return codes


def languages_of(user):
    try:
        return json.loads(user["languages"] or "[]")
    except (KeyError, ValueError):
        return []


def _public(user):
    return {
        "id": user["id"],
        "username": user["username"],
        "display_name": user["display_name"],
        "home_country": user["home_country"],
        "languages": languages_of(user),
        "chat_consent": bool(user["chat_consent_at"]),
    }


def _new_session(conn, user_id):
    token = secrets.token_urlsafe(32)
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (_hash_token(token), user_id, time.time() + SESSION_SECONDS),
    )
    return token


def _token_from(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Please log in")
    return authorization[7:].strip()


def current_user(authorization: str | None = Header(default=None)):
    token = _token_from(authorization)
    with database.db() as conn:
        row = conn.execute(
            """SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
               WHERE s.token_hash = ? AND s.expires_at > ?""",
            (_hash_token(token), time.time()),
        ).fetchone()
    if row is None:
        raise HTTPException(401, "Your session has expired. Please log in again")
    return dict(row)


# ---------- models ----------

class SignUpIn(BaseModel):
    username: str = Field(max_length=60)
    password: str = Field(max_length=200)
    display_name: str = Field(max_length=60)
    home_country: str = Field(max_length=2)
    languages: list[str] = Field(max_length=20)
    accept_terms: bool = False  # "I'm 18 or older and agree to the Terms and Privacy policy"


class LogInIn(BaseModel):
    username: str = Field(max_length=60)
    password: str = Field(max_length=200)


class ProfileIn(BaseModel):
    display_name: str | None = Field(default=None, max_length=60)
    home_country: str | None = Field(default=None, max_length=2)
    languages: list[str] | None = Field(default=None, max_length=20)


class PasswordIn(BaseModel):
    password: str = Field(max_length=200)


class TicketsIn(BaseModel):
    tickets: list[dict]


# ---------- endpoints ----------

@router.post("/auth/register")
def register(body: SignUpIn):
    if not body.accept_terms:
        raise HTTPException(400, "Please confirm you're 18 or older and agree to the Terms and Privacy policy")
    username = _clean_username(body.username)
    _check_password(body.password)
    display_name = clean_display_name(body.display_name)
    home_country = clean_country(body.home_country)
    languages = clean_languages(body.languages)
    user_id = secrets.token_hex(8)
    with database.db() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
            raise HTTPException(409, "That username is taken")
        conn.execute(
            """INSERT INTO users (id, username, display_name, password_hash, created_at, home_country, languages,
                                  terms_accepted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, username, display_name, hash_password(body.password), _now(), home_country,
             json.dumps(languages), _now()),
        )
        token = _new_session(conn, user_id)
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"token": token, "user": _public(user)}


@router.post("/auth/login")
def login(body: LogInIn):
    username = body.username.strip().lower()
    count, locked_until = _failed_logins.get(username, (0, 0))
    if locked_until > time.time():
        raise HTTPException(429, "Too many attempts. Try again in a minute")

    with database.db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if user is None or not verify_password(body.password, user["password_hash"]):
            count += 1
            _failed_logins[username] = (
                (0, time.time() + LOCKOUT_SECONDS) if count >= MAX_FAILED_LOGINS else (count, 0)
            )
            raise HTTPException(401, "Wrong username or password")
        _failed_logins.pop(username, None)
        token = _new_session(conn, user["id"])
    return {"token": token, "user": _public(user)}


@router.post("/auth/logout", status_code=204)
def logout(authorization: str | None = Header(default=None)):
    token = _token_from(authorization)
    with database.db() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))
    return Response(status_code=204)


@router.get("/auth/me")
def me(user=Depends(current_user)):
    return _public(user)


@router.patch("/auth/me")
def update_me(body: ProfileIn, user=Depends(current_user)):
    changes = {}
    if body.display_name is not None:
        changes["display_name"] = clean_display_name(body.display_name)
    if body.home_country is not None:
        changes["home_country"] = clean_country(body.home_country)
    if body.languages is not None:
        changes["languages"] = json.dumps(clean_languages(body.languages))
    with database.db() as conn:
        for column, value in changes.items():
            conn.execute(f"UPDATE users SET {column} = ? WHERE id = ?", (value, user["id"]))
        if "home_country" in changes:
            # a local guide can only show people around their home country
            from meet import guide_city_country
            guide = conn.execute("SELECT city FROM local_guides WHERE user_id = ?", (user["id"],)).fetchone()
            if guide and guide_city_country(guide["city"]) != changes["home_country"]:
                conn.execute("DELETE FROM local_guides WHERE user_id = ?", (user["id"],))
    return _public({**user, **changes})


@router.post("/auth/delete-account", status_code=204)
def delete_account(body: PasswordIn, user=Depends(current_user)):
    """Ištrina paskyrą, bilietus, pasidalintas keliones ir žinutes. Reikia patvirtinti slaptažodžiu."""
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Wrong password")
    with database.db() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    return Response(status_code=204)


@router.get("/account/tickets")
def get_tickets(user=Depends(current_user)):
    with database.db() as conn:
        row = conn.execute("SELECT data, updated_at FROM saved_tickets WHERE user_id = ?", (user["id"],)).fetchone()
    if row is None:
        return {"tickets": [], "updated_at": None}
    return {"tickets": json.loads(row["data"]), "updated_at": row["updated_at"]}


@router.put("/account/tickets")
def put_tickets(body: TicketsIn, user=Depends(current_user)):
    if len(body.tickets) > MAX_TICKETS:
        raise HTTPException(400, f"You can save up to {MAX_TICKETS} tickets")
    data = json.dumps(body.tickets, ensure_ascii=False)
    if len(data.encode()) > MAX_TICKETS_BYTES:
        raise HTTPException(400, "Too much ticket data")
    updated = _now()
    with database.db() as conn:
        conn.execute(
            """INSERT INTO saved_tickets (user_id, data, updated_at) VALUES (?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at""",
            (user["id"], data, updated),
        )
    return {"saved": len(body.tickets), "updated_at": updated}
