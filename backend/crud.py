"""CRUD operations using Python built-in sqlite3."""

import sqlite3
from typing import Optional

from models import Holding, Target
from schemas import HoldingCreate, HoldingUpdate, TargetCreate


# ── Helpers ──────────────────────────────────────────────────────────────────

def _row_to_holding(row: sqlite3.Row) -> Holding:
    return Holding(
        id=row["id"],
        name=row["name"],
        ticker=row["ticker"],
        asset_type=row["asset_type"],
        quantity=row["quantity"],
        category=row["category"],
        created_at=row["created_at"],
    )


def _row_to_target(row: sqlite3.Row) -> Target:
    return Target(
        id=row["id"],
        category=row["category"],
        sub_category=row["sub_category"],
        name=row["name"],
        ticker=row["ticker"],
        target_pct=row["target_pct"],
        parent_id=row["parent_id"],
    )


# ── Holdings ─────────────────────────────────────────────────────────────────

def get_holdings(conn: sqlite3.Connection) -> list[Holding]:
    rows = conn.execute(
        "SELECT * FROM holdings ORDER BY created_at"
    ).fetchall()
    return [_row_to_holding(r) for r in rows]


def create_holding(conn: sqlite3.Connection, data: HoldingCreate) -> Holding:
    cur = conn.execute(
        """INSERT INTO holdings (name, ticker, asset_type, quantity, category)
           VALUES (?, ?, ?, ?, ?)""",
        (data.name, data.ticker, data.asset_type, data.quantity, data.category),
    )
    row = conn.execute(
        "SELECT * FROM holdings WHERE id = ?", (cur.lastrowid,)
    ).fetchone()
    return _row_to_holding(row)


def update_holding(
    conn: sqlite3.Connection, holding_id: int, data: HoldingUpdate
) -> Optional[Holding]:
    existing = conn.execute(
        "SELECT * FROM holdings WHERE id = ?", (holding_id,)
    ).fetchone()
    if existing is None:
        return None

    current = _row_to_holding(existing)
    new_name = data.name if data.name is not None else current.name
    new_ticker = data.ticker if data.ticker is not None else current.ticker
    new_asset_type = data.asset_type if data.asset_type is not None else current.asset_type
    new_quantity = data.quantity if data.quantity is not None else current.quantity
    new_category = data.category if data.category is not None else current.category

    conn.execute(
        """UPDATE holdings
           SET name=?, ticker=?, asset_type=?, quantity=?, category=?
           WHERE id=?""",
        (new_name, new_ticker, new_asset_type, new_quantity, new_category, holding_id),
    )
    row = conn.execute(
        "SELECT * FROM holdings WHERE id = ?", (holding_id,)
    ).fetchone()
    return _row_to_holding(row)


def delete_holding(conn: sqlite3.Connection, holding_id: int) -> bool:
    cur = conn.execute("DELETE FROM holdings WHERE id = ?", (holding_id,))
    return cur.rowcount > 0


# ── Targets ───────────────────────────────────────────────────────────────────

def get_targets(conn: sqlite3.Connection) -> list[Target]:
    rows = conn.execute(
        "SELECT * FROM targets ORDER BY parent_id NULLS FIRST, id"
    ).fetchall()
    return [_row_to_target(r) for r in rows]


def upsert_targets(
    conn: sqlite3.Connection, targets: list[TargetCreate]
) -> list[Target]:
    """Replace all targets. Sub-targets use parent_id as the index in this list."""
    conn.execute("DELETE FROM targets")

    # First pass: insert top-level targets (parent_id is None)
    id_map: dict[int, int] = {}  # original index -> new DB id
    for idx, t in enumerate(targets):
        if t.parent_id is None:
            cur = conn.execute(
                """INSERT INTO targets (category, sub_category, name, ticker, target_pct, parent_id)
                   VALUES (?, ?, ?, ?, ?, NULL)""",
                (t.category, t.sub_category, t.name, t.ticker, t.target_pct),
            )
            id_map[idx] = cur.lastrowid  # type: ignore[assignment]

    # Second pass: insert sub-targets
    for idx, t in enumerate(targets):
        if t.parent_id is not None:
            real_parent_id = id_map.get(t.parent_id)
            cur = conn.execute(
                """INSERT INTO targets (category, sub_category, name, ticker, target_pct, parent_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (t.category, t.sub_category, t.name, t.ticker, t.target_pct, real_parent_id),
            )
            id_map[idx] = cur.lastrowid  # type: ignore[assignment]

    return get_targets(conn)
