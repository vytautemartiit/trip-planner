"""
Kelionės patvirtinimas (trip verification).

Before someone can appear in the chat or ask a local to meet, they prove the trip is real by
uploading the booking confirmation / e-ticket / boarding pass PDF they got from the airline.

The server reads the PDF's text and checks that it mentions every city of the trip (by name or
airport code) and the departure date. The file itself is NOT stored – only its SHA-256 fingerprint,
so the same document can't be used to verify a trip on a second account.

Limits (be honest about them): this proves the person holds a ticket document for that route and
date. It doesn't prove the name on it is theirs, and a forged PDF would pass. Scanned images
(no text layer) can't be read.
"""

import hashlib
import io
import json
import re
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, TypeAdapter
from pypdf import PdfReader
from pypdf.errors import PdfReadError

import db as database
from auth import current_user
from places import PLACES

router = APIRouter(prefix="/trips", tags=["verification"])

MAX_FILES = 4
MAX_BYTES = 5 * 1024 * 1024
MAX_PAGES = 20
MAX_STAY_DAYS = 60

MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september",
          "october", "november", "december"]


class Stay(BaseModel):
    destination: str
    start_date: date
    end_date: date


STAYS = TypeAdapter(list[Stay])


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def check_stays(stays):
    if not 1 <= len(stays) <= len(PLACES):
        raise HTTPException(400, "A trip needs 1–8 stops")
    for s in stays:
        if s.destination not in PLACES:
            raise HTTPException(400, f"Unknown destination: {s.destination}")
        if s.end_date < s.start_date:
            raise HTTPException(400, "end_date is before start_date")
        if (s.end_date - s.start_date).days > MAX_STAY_DAYS:
            raise HTTPException(400, f"A stay can't be longer than {MAX_STAY_DAYS} days")


def stays_json(stays):
    return json.dumps([{"destination": s.destination, "start_date": s.start_date.isoformat(),
                        "end_date": s.end_date.isoformat()} for s in stays], ensure_ascii=False)


# ---------- reading the document ----------

def pdf_text(data):
    if not data.startswith(b"%PDF"):
        raise HTTPException(400, "Please upload the PDF you got from the airline or travel agency")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise HTTPException(400, "This PDF is password-protected")
        return "\n".join((page.extract_text() or "") for page in reader.pages[:MAX_PAGES])
    except PdfReadError:
        raise HTTPException(400, "This PDF can't be read")


def _normalise(text):
    # lower-case, remove accents we care about, collapse whitespace
    table = str.maketrans("óöáéíúůčřšžėłńśćżąęį", "ooaeiuucrszelnsczaei")
    return " ".join(text.lower().translate(table).split())


def date_variants(d):
    """The ways airlines write a date: 2026-12-10, 10.12.2026, 10/12/2026, 10 Dec 2026, Dec 10, 10DEC…"""
    mon, month = MONTHS[d.month - 1][:3], MONTHS[d.month - 1]
    day, dd, mm, yyyy, yy = str(d.day), f"{d.day:02d}", f"{d.month:02d}", str(d.year), str(d.year)[2:]
    out = {
        f"{yyyy}-{mm}-{dd}", f"{dd}.{mm}.{yyyy}", f"{day}.{d.month}.{yyyy}", f"{dd}/{mm}/{yyyy}",
        f"{mm}/{dd}/{yyyy}", f"{dd}.{mm}.{yy}", f"{dd}/{mm}/{yy}", f"{dd}-{mm}-{yyyy}",
    }
    for m in (mon, month):
        out |= {f"{day} {m}", f"{dd} {m}", f"{m} {day}", f"{m} {dd}", f"{dd}{m}", f"{day}{m}"}
    return out


def mentions_date(text, d):
    compact = text.replace(" ", "")
    for v in date_variants(d):
        pattern = r"(?<![0-9])" + re.escape(v) + r"(?![0-9])"
        if re.search(pattern, text) or re.search(pattern, compact):
            return True
    return False


def mentions_place(text, destination):
    for name in PLACES[destination]["names"]:
        n = _normalise(name)
        if len(n) == 3:  # airport code: must be a separate word, written in capitals in the original
            continue
        if n in text:
            return True
    return False


def mentions_code(raw_text, destination):
    codes = [n for n in PLACES[destination]["names"] if len(n) == 3 and n.isupper()]
    return any(re.search(rf"(?<![A-Z]){c}(?![A-Z])", raw_text) for c in codes)


def check_document(raw_text, stays):
    """Returns a list of problems; empty means the document matches the trip."""
    text = _normalise(raw_text)
    problems = []
    for s in stays:
        if not (mentions_place(text, s.destination) or mentions_code(raw_text, s.destination)):
            problems.append(f"{PLACES[s.destination]['city']} isn't mentioned")
    if not mentions_date(text, stays[0].start_date):
        problems.append(f"the departure date ({stays[0].start_date.strftime('%d %b %Y')}) isn't mentioned")
    return problems


# ---------- endpoints ----------

@router.post("/verify")
async def verify_trip(
    ticket_key: str = Form(min_length=1, max_length=300),
    stays: str = Form(),
    files: list[UploadFile] = File(),
    user=Depends(current_user),
):
    try:
        trip = STAYS.validate_json(stays)
    except ValueError:
        raise HTTPException(400, "Invalid trip data")
    check_stays(trip)
    trip.sort(key=lambda s: s.start_date)
    if trip[-1].end_date < date.today():
        raise HTTPException(400, "This trip is already over")
    if not 1 <= len(files) <= MAX_FILES:
        raise HTTPException(400, f"Upload 1–{MAX_FILES} documents")

    texts, hashes = [], []
    for f in files:
        data = await f.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(400, "Each file must be under 5 MB")
        hashes.append(hashlib.sha256(data).hexdigest())
        texts.append(pdf_text(data))

    combined = "\n".join(texts)
    if len(combined.strip()) < 20:
        raise HTTPException(400, "No text found in the PDF. Scanned photos can't be checked — "
                                 "use the PDF from your booking email")
    problems = check_document(combined, trip)
    if problems:
        raise HTTPException(422, "We couldn't match the document to this trip: " + "; ".join(problems))

    with database.db() as conn:
        marks = ",".join("?" * len(hashes))
        other = conn.execute(
            f"SELECT 1 FROM verification_files WHERE file_hash IN ({marks}) AND user_id != ?", [*hashes, user["id"]]
        ).fetchone()
        if other:
            raise HTTPException(409, "This document was already used to verify a trip on another account")
        conn.executemany("INSERT OR IGNORE INTO verification_files (file_hash, user_id) VALUES (?, ?)",
                         [(h, user["id"]) for h in hashes])
        conn.execute(
            """INSERT INTO verifications (user_id, ticket_key, stays, verified_at) VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id, ticket_key) DO UPDATE SET stays = excluded.stays, verified_at = excluded.verified_at""",
            (user["id"], ticket_key, stays_json(trip), _now()),
        )
    return {"ticket_key": ticket_key, "verified": True, "stays": json.loads(stays_json(trip))}


@router.get("/verified")
def list_verified(user=Depends(current_user)):
    with database.db() as conn:
        rows = conn.execute("SELECT ticket_key, stays, verified_at FROM verifications WHERE user_id = ?",
                            (user["id"],)).fetchall()
    return {"trips": [{"ticket_key": r["ticket_key"], "stays": json.loads(r["stays"]), "verified_at": r["verified_at"]}
                      for r in rows]}


@router.delete("/verified", status_code=204)
def remove_verification(ticket_key: str = Query(min_length=1), user=Depends(current_user)):
    with database.db() as conn:
        conn.execute("DELETE FROM verifications WHERE user_id = ? AND ticket_key = ?", (user["id"], ticket_key))
        conn.execute("DELETE FROM stays WHERE traveller_id = ? AND ticket_key = ?", (user["id"], ticket_key))
    return Response(status_code=204)


# ---------- used by chat.py and meet.py ----------

def is_verified(conn, user_id, ticket_key, stays):
    """True if this exact trip (same cities, same dates) was verified for this ticket."""
    row = conn.execute("SELECT stays FROM verifications WHERE user_id = ? AND ticket_key = ?",
                       (user_id, ticket_key)).fetchone()
    return row is not None and json.loads(row["stays"]) == json.loads(stays_json(sorted(stays, key=lambda s: s.start_date)))


def verified_stays(conn, user_id, city=None):
    """All verified stays of a user that haven't ended yet, optionally in one city."""
    today = date.today().isoformat()
    out = []
    for r in conn.execute("SELECT stays FROM verifications WHERE user_id = ?", (user_id,)):
        for s in json.loads(r["stays"]):
            if s["end_date"] >= today and (city is None or s["destination"] == city):
                out.append(s)
    return out
