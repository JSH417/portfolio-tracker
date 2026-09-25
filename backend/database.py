"""SQLite database setup using Python built-in sqlite3."""

import os
import sqlite3
from contextlib import contextmanager
from typing import Generator

# On Render: use persistent disk at /data. Locally: current directory.
_db_path = "/data/portfolio.db" if os.path.isdir("/data") else "./portfolio.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path)
    conn.row_factory = sqlite3.Row  # rows as dict-like objects
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create all tables if they do not exist."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS holdings (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                ticker      TEXT,
                asset_type  TEXT    NOT NULL,
                quantity    REAL    NOT NULL,
                category    TEXT    NOT NULL,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS targets (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                category     TEXT    NOT NULL,
                sub_category TEXT,
                name         TEXT    NOT NULL,
                ticker       TEXT,
                target_pct   REAL    NOT NULL,
                parent_id    INTEGER REFERENCES targets(id) ON DELETE CASCADE
            );
        """)
