"""
Blocking and reporting other people.

Blocking works both ways: once either person blocks the other, they stop seeing each other in the
travellers chat (people list and messages) and in Meet a local (locals list and requests), and any
open meet-up between them is called off.

Reports are stored for the site's admin. GET /safety/reports needs the ADMIN_TOKEN environment
variable to be set and sent back in the X-Admin-Token header.
"""

import os
import secrets
import time
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

import db as database
from auth import current_user

router = APIRouter(prefix="/safety")

MAX_REPORTS_PER_DAY = 10
REASONS = ("spam", "harassment", "inappropriate", "scam", "fake_trip", "underage", "other")


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def blocked_ids(conn, user_id):
    """Everyone this user blocked or was blocked by."""
    rows = conn.execute(
        "SELECT blocked_id FROM blocks WHERE blocker_id = ? UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?",
        (user_id, user_id),
    )
    return {r[0] for r in rows}


def is_blocked(conn, a, b):
    return conn.execute(
        "SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
        (a, b, b, a),
    ).fetchone() is not None


def _block(conn, me, other):
    conn.execute(
        "INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)", (me, other, _now())
    )
    # call off any meet-up between the two and delete its conversation
    ids = [r[0] for r in conn.execute(
        """SELECT id FROM meet_requests WHERE status IN ('pending', 'accepted')
           AND ((traveller_id = ? AND local_id = ?) OR (traveller_id = ? AND local_id = ?))""",
        (me, other, other, me),
    )]
    for request_id in ids:
        conn.execute("UPDATE meet_requests SET status = 'cancelled' WHERE id = ?", (request_id,))
        conn.execute("DELETE FROM meet_messages WHERE request_id = ?", (request_id,))


def _other_user(conn, me, user_id):
    if user_id == me["id"]:
        raise HTTPException(400, "That's you")
    row = conn.execute("SELECT id, display_name FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "User not found")
    return row


class BlockIn(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)


class ReportIn(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    reason: Literal[REASONS]
    details: str = Field(default="", max_length=1000)
    where: Literal["chat", "meet"]
    block: bool = True


@router.get("/blocks")
def my_blocks(me=Depends(current_user)):
    with database.db() as conn:
        rows = conn.execute(
            """SELECT u.id, u.display_name, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id
               WHERE b.blocker_id = ? ORDER BY b.created_at DESC""",
            (me["id"],),
        ).fetchall()
    return {"blocked": [{"id": r["id"], "name": r["display_name"], "since": r["created_at"]} for r in rows]}


@router.post("/blocks", status_code=201)
def block_user(body: BlockIn, me=Depends(current_user)):
    with database.db() as conn:
        _other_user(conn, me, body.user_id)
        _block(conn, me["id"], body.user_id)
    return {"blocked": body.user_id}


@router.delete("/blocks/{user_id}", status_code=204)
def unblock_user(user_id: str, me=Depends(current_user)):
    with database.db() as conn:
        conn.execute("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?", (me["id"], user_id))


@router.post("/reports", status_code=201)
def report_user(body: ReportIn, me=Depends(current_user)):
    details = " ".join(body.details.split())
    if body.reason == "other" and len(details) < 10:
        raise HTTPException(400, "Tell us in a few words what happened")
    day_ago = datetime.fromtimestamp(time.time() - 86400, timezone.utc).isoformat(timespec="seconds")
    with database.db() as conn:
        _other_user(conn, me, body.user_id)
        recent = conn.execute(
            "SELECT COUNT(*) FROM reports WHERE reporter_id = ? AND created_at > ?", (me["id"], day_ago)
        ).fetchone()[0]
        if recent >= MAX_REPORTS_PER_DAY:
            raise HTTPException(429, "You've sent a lot of reports today. Try again tomorrow")
        conn.execute(
            """INSERT INTO reports (reporter_id, reported_id, reason, details, place, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (me["id"], body.user_id, body.reason, details, body.where, _now()),
        )
        if body.block:
            _block(conn, me["id"], body.user_id)
    return {"reported": True, "blocked": body.block}


@router.get("/reports")
def list_reports(x_admin_token: str = Header(default="")):
    """For the site's admin only."""
    expected = os.environ.get("ADMIN_TOKEN", "")
    if not expected or not secrets.compare_digest(x_admin_token, expected):
        raise HTTPException(403, "Admins only")
    with database.db() as conn:
        rows = conn.execute(
            """SELECT r.id, r.reason, r.details, r.place, r.created_at,
                      r.reported_id, u.display_name AS reported_name, u.username AS reported_username
               FROM reports r LEFT JOIN users u ON u.id = r.reported_id ORDER BY r.id DESC LIMIT 500"""
        ).fetchall()
    return {"reports": [dict(r) for r in rows]}
