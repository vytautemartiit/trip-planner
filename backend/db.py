"""Duomenų bazė (SQLite): paskyros, sesijos, išsaugoti bilietai ir pokalbiai."""

import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.environ.get("APP_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "trip_planner.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    chat_consent_at TEXT,
    last_message_at REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_tickets (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    traveller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_key TEXT NOT NULL,
    destination TEXT NOT NULL,
    country TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS stays_by_country ON stays(country, start_date, end_date);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT NOT NULL,
    traveller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_by_country ON messages(country, id);
CREATE TABLE IF NOT EXISTS verifications (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_key TEXT NOT NULL,
    stays TEXT NOT NULL,
    verified_at TEXT NOT NULL,
    PRIMARY KEY (user_id, ticket_key)
);
CREATE TABLE IF NOT EXISTS verification_files (
    file_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS local_guides (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    city TEXT NOT NULL,
    bio TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meet_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    traveller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    local_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city TEXT NOT NULL,
    meet_date TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meet_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES meet_requests(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reported_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""

# Columns added after the first version; older databases get them on start-up
NEW_COLUMNS = {
    "users": {"home_country": "TEXT", "languages": "TEXT NOT NULL DEFAULT '[]'", "terms_accepted_at": "TEXT"},
}


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db() as conn:
        conn.executescript(SCHEMA)
        for table, columns in NEW_COLUMNS.items():
            have = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
            for name, kind in columns.items():
                if name not in have:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {kind}")


def set_db_path(path):
    """Naudojama testuose – kiekvienas testas gauna savo duomenų bazę."""
    global DB_PATH
    DB_PATH = path
    init_db()
