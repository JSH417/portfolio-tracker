"""ORM-free data models as plain Python dataclasses."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Holding:
    id: int
    name: str
    asset_type: str   # etf_kr | dollar_rp | cash_krw
    quantity: float
    category: str     # stock | bond | gold | dollar_rp | cash
    ticker: Optional[str] = None
    created_at: str = ""


@dataclass
class Target:
    id: int
    category: str
    name: str
    target_pct: float
    sub_category: Optional[str] = None
    ticker: Optional[str] = None
    parent_id: Optional[int] = None
