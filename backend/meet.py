"""
Susitikimai su vietiniais (meet a local).

People can offer to show visitors around a city in their home country. Only travellers with a
verified trip to that city (see verify.py) can see the locals there and ask to meet on a day of
their stay. The local accepts or declines; after accepting, the two get a private conversation.
"""

import json
import time
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

import db as database
from auth import clean_languages, current_user, languages_of
from safety import blocked_ids, is_blocked
from places import PLACES
from verify import verified_stays

router = APIRouter(tags=["meet a local"])

MAX_PENDING = 5
MIN_SECONDS_BETWEEN_MESSAGES = 1.0


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def guide_city_country(city):
    return PLACES[city]["iso"] if city in PLACES else None


class GuideIn(BaseModel):
    city: str
    bio: str = Field(max_length=1000)
    languages: list[str] | None = Field(default=None, max_length=20)


class RequestIn(BaseModel):
    local_id: str = Field(max_length=40)
    city: str
    date: date
    message: str = Field(max_length=2000)


class AnswerIn(BaseModel):
    accept: bool


class TextIn(BaseModel):
    text: str = Field(max_length=2000)


def _person(row, prefix=""):
    return {
        "id": row[f"{prefix}id"],
        "name": row[f"{prefix}display_name"],
        "home_country": row[f"{prefix}home_country"],
        "languages": languages_of({"languages": row[f"{prefix}languages"]}),
    }


# ---------- being a local guide ----------

@router.get("/locals/me")
def my_guide_profile(user=Depends(current_user)):
    with database.db() as conn:
        row = conn.execute("SELECT city, bio, created_at FROM local_guides WHERE user_id = ?", (user["id"],)).fetchone()
    return {"guide": dict(row) if row else None}


@router.put("/locals/me")
def become_guide(body: GuideIn, user=Depends(current_user)):
    if body.city not in PLACES:
        raise HTTPException(400, "Unknown city")
    if guide_city_country(body.city) != user["home_country"]:
        raise HTTPException(400, "You can only show people around a city in your home country")
    bio = " ".join(body.bio.split())
    if not 20 <= len(bio) <= 400:
        raise HTTPException(400, "Write 20–400 characters about what you'd like to show")
    with database.db() as conn:
        if body.languages is not None:
            conn.execute("UPDATE users SET languages = ? WHERE id = ?",
                         (json.dumps(clean_languages(body.languages)), user["id"]))
        conn.execute(
            """INSERT INTO local_guides (user_id, city, bio, created_at) VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET city = excluded.city, bio = excluded.bio""",
            (user["id"], body.city, bio, _now()),
        )
        if body.city:  # requests for another city can no longer be answered
            conn.execute("UPDATE meet_requests SET status = 'cancelled' WHERE local_id = ? AND city != ? AND status = 'pending'",
                         (user["id"], body.city))
    return {"guide": {"city": body.city, "bio": bio}}


@router.delete("/locals/me", status_code=204)
def stop_guiding(user=Depends(current_user)):
    with database.db() as conn:
        conn.execute("DELETE FROM local_guides WHERE user_id = ?", (user["id"],))
        conn.execute("UPDATE meet_requests SET status = 'cancelled' WHERE local_id = ? AND status = 'pending'",
                     (user["id"],))
    return Response(status_code=204)


# ---------- finding locals ----------

def _require_trip(conn, user_id, city, on_day=None):
    stays = verified_stays(conn, user_id, city)
    if not stays:
        raise HTTPException(403, "Verify a trip to this city first")
    if on_day is not None and not any(s["start_date"] <= on_day.isoformat() <= s["end_date"] for s in stays):
        raise HTTPException(400, "Pick a day when you are in this city")
    return stays


@router.get("/locals")
def find_locals(city: str = Query(), user=Depends(current_user)):
    if city not in PLACES:
        raise HTTPException(404, "Unknown city")
    with database.db() as conn:
        stays = _require_trip(conn, user["id"], city)
        rows = conn.execute(
            """SELECT u.id, u.display_name, u.home_country, u.languages, g.bio
               FROM local_guides g JOIN users u ON u.id = g.user_id
               WHERE g.city = ? AND g.user_id != ? ORDER BY g.created_at""",
            (city, user["id"]),
        ).fetchall()
        hidden = blocked_ids(conn, user["id"])
        rows = [r for r in rows if r["id"] not in hidden]
        mine = {
            r["local_id"]: r["status"]
            for r in conn.execute(
                "SELECT local_id, status FROM meet_requests WHERE traveller_id = ? AND city = ? AND status IN ('pending','accepted')",
                (user["id"], city),
            )
        }
    return {
        "city": city,
        "my_stays": stays,
        "locals": [{**_person(r), "bio": r["bio"], "request_status": mine.get(r["id"])} for r in rows],
    }


# ---------- requests ----------

REQUEST_SELECT = """
SELECT r.*, t.id AS t_id, t.display_name AS t_display_name, t.home_country AS t_home_country, t.languages AS t_languages,
       l.id AS l_id, l.display_name AS l_display_name, l.home_country AS l_home_country, l.languages AS l_languages,
       (SELECT MAX(id) FROM meet_messages m WHERE m.request_id = r.id) AS last_message_id
FROM meet_requests r JOIN users t ON t.id = r.traveller_id JOIN users l ON l.id = r.local_id
"""


def _request_out(row, me_id):
    return {
        "id": row["id"],
        "city": row["city"],
        "date": row["meet_date"],
        "message": row["message"],
        "status": row["status"],
        "created_at": row["created_at"],
        "role": "local" if row["local_id"] == me_id else "traveller",
        "traveller": _person(row, "t_"),
        "local": _person(row, "l_"),
        "last_message_id": row["last_message_id"] or 0,
    }


@router.post("/meet/requests")
def ask_to_meet(body: RequestIn, user=Depends(current_user)):
    message = " ".join(body.message.split())
    if not 10 <= len(message) <= 500:
        raise HTTPException(400, "Write 10–500 characters: who you are and what you'd like to see")
    if body.local_id == user["id"]:
        raise HTTPException(400, "That's you")
    with database.db() as conn:
        _require_trip(conn, user["id"], body.city, body.date)
        guide = conn.execute("SELECT 1 FROM local_guides WHERE user_id = ? AND city = ?",
                             (body.local_id, body.city)).fetchone()
        if not guide or is_blocked(conn, user["id"], body.local_id):
            raise HTTPException(404, "This local isn't showing people around this city any more")
        open_requests = conn.execute(
            "SELECT local_id FROM meet_requests WHERE traveller_id = ? AND status = 'pending'", (user["id"],)
        ).fetchall()
        if any(r["local_id"] == body.local_id for r in open_requests):
            raise HTTPException(409, "You already asked this local — wait for an answer")
        if len(open_requests) >= MAX_PENDING:
            raise HTTPException(429, f"You can have up to {MAX_PENDING} open requests")
        cur = conn.execute(
            "INSERT INTO meet_requests (traveller_id, local_id, city, meet_date, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user["id"], body.local_id, body.city, body.date.isoformat(), message, _now()),
        )
        row = conn.execute(REQUEST_SELECT + " WHERE r.id = ?", (cur.lastrowid,)).fetchone()
    return _request_out(row, user["id"])


@router.get("/meet/requests")
def my_requests(user=Depends(current_user)):
    with database.db() as conn:
        rows = conn.execute(
            REQUEST_SELECT + " WHERE (r.traveller_id = ? OR r.local_id = ?) AND r.status != 'cancelled' ORDER BY r.id DESC",
            (user["id"], user["id"]),
        ).fetchall()
        hidden = blocked_ids(conn, user["id"])
    out = [_request_out(r, user["id"]) for r in rows if r["traveller_id"] not in hidden and r["local_id"] not in hidden]
    return {"incoming": [r for r in out if r["role"] == "local"], "outgoing": [r for r in out if r["role"] == "traveller"]}


def _load_request(conn, request_id, user):
    row = conn.execute(REQUEST_SELECT + " WHERE r.id = ?", (request_id,)).fetchone()
    if row is None or user["id"] not in (row["traveller_id"], row["local_id"]):
        raise HTTPException(404, "Request not found")
    return row


@router.post("/meet/requests/{request_id}/answer")
def answer_request(request_id: int, body: AnswerIn, user=Depends(current_user)):
    with database.db() as conn:
        row = _load_request(conn, request_id, user)
        if row["local_id"] != user["id"]:
            raise HTTPException(403, "Only the local can answer")
        if row["status"] != "pending":
            raise HTTPException(409, "This request was already answered")
        status = "accepted" if body.accept else "declined"
        conn.execute("UPDATE meet_requests SET status = ? WHERE id = ?", (status, request_id))
        row = _load_request(conn, request_id, user)
    return _request_out(row, user["id"])


@router.post("/meet/requests/{request_id}/cancel")
def cancel_request(request_id: int, user=Depends(current_user)):
    """Either side can call off a meeting; the conversation is deleted."""
    with database.db() as conn:
        _load_request(conn, request_id, user)
        conn.execute("UPDATE meet_requests SET status = 'cancelled' WHERE id = ?", (request_id,))
        conn.execute("DELETE FROM meet_messages WHERE request_id = ?", (request_id,))
    return {"cancelled": True}


# ---------- private conversation after accepting ----------

def _accepted(conn, request_id, user):
    row = _load_request(conn, request_id, user)
    if row["status"] != "accepted":
        raise HTTPException(403, "You can message each other once the local accepts")
    return row


MSG_SELECT = """SELECT m.id, m.text, m.created_at, m.sender_id, u.display_name AS name
                FROM meet_messages m JOIN users u ON u.id = m.sender_id"""


def _msg_out(r, me_id):
    return {"id": r["id"], "text": r["text"], "created_at": r["created_at"], "traveller_id": r["sender_id"],
            "name": r["name"], "mine": r["sender_id"] == me_id}


@router.get("/meet/requests/{request_id}/messages")
def meet_messages(request_id: int, after: int = 0, user=Depends(current_user)):
    with database.db() as conn:
        _accepted(conn, request_id, user)
        rows = conn.execute(MSG_SELECT + " WHERE m.request_id = ? AND m.id > ? ORDER BY m.id LIMIT 200",
                            (request_id, after)).fetchall()
    return {"messages": [_msg_out(r, user["id"]) for r in rows]}


@router.post("/meet/requests/{request_id}/messages")
def send_meet_message(request_id: int, body: TextIn, user=Depends(current_user)):
    text = body.text.strip()
    if not 1 <= len(text) <= 500:
        raise HTTPException(400, "Messages must be 1–500 characters")
    if time.time() - user["last_message_at"] < MIN_SECONDS_BETWEEN_MESSAGES:
        raise HTTPException(429, "You're sending messages too fast")
    with database.db() as conn:
        _accepted(conn, request_id, user)
        cur = conn.execute("INSERT INTO meet_messages (request_id, sender_id, text, created_at) VALUES (?, ?, ?, ?)",
                           (request_id, user["id"], text, _now()))
        conn.execute("UPDATE users SET last_message_at = ? WHERE id = ?", (time.time(), user["id"]))
        row = conn.execute(MSG_SELECT + " WHERE m.id = ?", (cur.lastrowid,)).fetchone()
    return _msg_out(row, user["id"])
