"""Pydantic schemas for request/response validation."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Holding schemas
# ---------------------------------------------------------------------------


class HoldingCreate(BaseModel):
    name: str
    ticker: Optional[str] = None
    asset_type: str  # "etf_kr" | "dollar_rp" | "cash_krw"
    quantity: float
    category: str  # "stock" | "bond" | "gold" | "dollar_rp" | "cash"


class HoldingUpdate(BaseModel):
    name: Optional[str] = None
    ticker: Optional[str] = None
    asset_type: Optional[str] = None
    quantity: Optional[float] = None
    category: Optional[str] = None


class HoldingResponse(BaseModel):
    id: int
    name: str
    ticker: Optional[str] = None
    asset_type: str
    quantity: float
    category: str
    created_at: str  # ISO string from SQLite TEXT column

    model_config = {"from_attributes": True}


class HoldingWithValue(HoldingResponse):
    """HoldingResponse extended with current market value fields."""

    current_price_krw: Optional[float] = None
    total_value_krw: float
    percentage: float  # share of total portfolio value in %


# ---------------------------------------------------------------------------
# Portfolio summary schemas
# ---------------------------------------------------------------------------


class CategorySummary(BaseModel):
    category: str
    total_krw: float
    total_usd: float
    percentage: float  # share of total portfolio value in %
    holdings: list[HoldingWithValue]


class PortfolioSummary(BaseModel):
    total_krw: float
    total_usd: float
    exchange_rate: float
    by_category: list[CategorySummary]
    holdings: list[HoldingWithValue]


# ---------------------------------------------------------------------------
# Target schemas
# ---------------------------------------------------------------------------


class TargetCreate(BaseModel):
    category: str
    sub_category: Optional[str] = None
    name: str
    ticker: Optional[str] = None
    target_pct: float = Field(..., ge=0, le=100)
    parent_id: Optional[int] = None


class TargetUpdate(BaseModel):
    category: Optional[str] = None
    sub_category: Optional[str] = None
    name: Optional[str] = None
    ticker: Optional[str] = None
    target_pct: Optional[float] = Field(None, ge=0, le=100)
    parent_id: Optional[int] = None


class TargetResponse(BaseModel):
    id: int
    category: str
    sub_category: Optional[str] = None
    name: str
    ticker: Optional[str] = None
    target_pct: float
    parent_id: Optional[int] = None
    children: list["TargetResponse"] = []

    model_config = {"from_attributes": True}


# Allow self-referential type resolution
TargetResponse.model_rebuild()


# ---------------------------------------------------------------------------
# Rebalance schemas
# ---------------------------------------------------------------------------


class RebalanceRequest(BaseModel):
    budget_krw: float = Field(..., gt=0)


class RebalanceItem(BaseModel):
    name: str
    ticker: Optional[str] = None
    category: str
    sub_category: Optional[str] = None
    current_pct: float
    target_pct: float
    gap_pct: float  # target_pct - current_pct
    buy_amount_krw: float
    buy_quantity: float  # floored shares (or 0 for non-ETF)
    price_per_unit_krw: Optional[float] = None


class RebalancePlan(BaseModel):
    budget_krw: float
    items: list[RebalanceItem]
    remaining_krw: float
    total_buy_krw: float
