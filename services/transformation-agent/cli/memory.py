"""SQLite-backed persistent memory for Morph."""

import json
import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "morph_memory.db")


class MemoryStore:
    """Per-user persistent memory store backed by SQLite."""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()

    def _conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(user_id, key)
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    session_data TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            """)

    def set(self, user_id: str, key: str, value: str):
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO memories (user_id, key, value, updated_at)
                   VALUES (?, ?, ?, datetime('now'))
                   ON CONFLICT(user_id, key) DO UPDATE SET
                       value = excluded.value,
                       updated_at = datetime('now')""",
                (user_id, key, value),
            )

    def get(self, user_id: str, key: str) -> str | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT value FROM memories WHERE user_id = ? AND key = ?",
                (user_id, key),
            ).fetchone()
        return row[0] if row else None

    def list(self, user_id: str) -> list[tuple[str, str]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT key, value FROM memories WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        return rows

    def delete(self, user_id: str, key: str):
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM memories WHERE user_id = ? AND key = ?",
                (user_id, key),
            )

    def save_session(self, user_id: str, data: dict):
        with self._conn() as conn:
            row = conn.execute(
                "SELECT id FROM sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
                (user_id,),
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE sessions SET session_data = ?, updated_at = datetime('now') WHERE id = ?",
                    (json.dumps(data), row[0]),
                )
            else:
                conn.execute(
                    "INSERT INTO sessions (user_id, session_data) VALUES (?, ?)",
                    (user_id, json.dumps(data)),
                )

    def load_session(self, user_id: str) -> dict:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT session_data FROM sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
                (user_id,),
            ).fetchone()
        return json.loads(row[0]) if row else {}
