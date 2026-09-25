"""FastAPI application entry point for the portfolio tracker."""

import logging
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import crud
import price_service
import rebalance_service
import schemas
from database import init_db, get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create all database tables on startup."""
    init_db()
    logger.info("Database tables created (or already exist).")
    yield

app = FastAPI(
    title="Portfolio Tracker API",
    description="Backend for a personal Korean ETF / Dollar RP / KRW portfolio tracker.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    """Create all database tables on startup if they don't exist."""
    init_db()
    logger.info("Database tables created (or already exist).")


# FastAPI dependency that yields a sqlite3 connection
def db_dep() -> Generator[sqlite3.Connection, None, None]:
    with get_db() as conn:
        yield conn


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Exchange rate
# ---------------------------------------------------------------------------


@app.get("/api/exchange-rate", tags=["market"])
def get_exchange_rate() -> dict:
    rate = price_service.get_usd_krw_rate()
    return {"usd_krw": rate, "updated_at": datetime.now(timezone.utc)}


# ---------------------------------------------------------------------------
# Portfolio summary
# ---------------------------------------------------------------------------


@app.get("/api/portfolio", response_model=schemas.PortfolioSummary, tags=["portfolio"])
def get_portfolio(conn: sqlite3.Connection = Depends(db_dep)) -> schemas.PortfolioSummary:
    holdings = crud.get_holdings(conn)
    exchange_rate = price_service.get_usd_krw_rate()

    holding_values: list[schemas.HoldingWithValue] = []
    total_krw = 0.0

    for h in holdings:
        value_krw = price_service.get_holding_value_krw(h, exchange_rate)
        price_krw = price_service.get_holding_price_krw(h, exchange_rate)
        total_krw += value_krw
        holding_values.append(
            schemas.HoldingWithValue(
                id=h.id,
                name=h.name,
                ticker=h.ticker,
                asset_type=h.asset_type,
                quantity=h.quantity,
                category=h.category,
                created_at=h.created_at or datetime.now(timezone.utc).isoformat(),
                current_price_krw=price_krw,
                total_value_krw=value_krw,
                percentage=0.0,
            )
        )

    for hv in holding_values:
        hv.percentage = (hv.total_value_krw / total_krw * 100.0) if total_krw > 0 else 0.0

    category_map: dict[str, list[schemas.HoldingWithValue]] = defaultdict(list)
    for hv in holding_values:
        for h in holdings:
            if h.id == hv.id:
                category_map[h.category].append(hv)
                break

    by_category: list[schemas.CategorySummary] = []
    for category, cat_holdings in sorted(category_map.items()):
        cat_total_krw = sum(hv.total_value_krw for hv in cat_holdings)
        cat_total_usd = cat_total_krw / exchange_rate if exchange_rate > 0 else 0.0
        cat_pct = (cat_total_krw / total_krw * 100.0) if total_krw > 0 else 0.0
        by_category.append(
            schemas.CategorySummary(
                category=category,
                total_krw=round(cat_total_krw, 2),
                total_usd=round(cat_total_usd, 4),
                percentage=round(cat_pct, 4),
                holdings=cat_holdings,
            )
        )

    total_usd = total_krw / exchange_rate if exchange_rate > 0 else 0.0

    return schemas.PortfolioSummary(
        total_krw=round(total_krw, 2),
        total_usd=round(total_usd, 4),
        exchange_rate=exchange_rate,
        by_category=by_category,
        holdings=holding_values,
    )


# ---------------------------------------------------------------------------
# Holdings CRUD
# ---------------------------------------------------------------------------


@app.get("/api/holdings", response_model=list[schemas.HoldingResponse], tags=["holdings"])
def list_holdings(conn: sqlite3.Connection = Depends(db_dep)):
    return [
        schemas.HoldingResponse(
            id=h.id, name=h.name, ticker=h.ticker, asset_type=h.asset_type,
            quantity=h.quantity, category=h.category,
            created_at=h.created_at or datetime.now(timezone.utc).isoformat()
        )
        for h in crud.get_holdings(conn)
    ]


@app.post("/api/holdings", response_model=schemas.HoldingResponse, status_code=201, tags=["holdings"])
def create_holding(holding: schemas.HoldingCreate, conn: sqlite3.Connection = Depends(db_dep)):
    h = crud.create_holding(conn, holding)
    return schemas.HoldingResponse(
        id=h.id, name=h.name, ticker=h.ticker, asset_type=h.asset_type,
        quantity=h.quantity, category=h.category,
        created_at=h.created_at or datetime.now(timezone.utc).isoformat()
    )


@app.put("/api/holdings/{holding_id}", response_model=schemas.HoldingResponse, tags=["holdings"])
def update_holding(
    holding_id: int, data: schemas.HoldingUpdate,
    conn: sqlite3.Connection = Depends(db_dep)
):
    h = crud.update_holding(conn, holding_id, data)
    if h is None:
        raise HTTPException(status_code=404, detail=f"Holding {holding_id} not found.")
    return schemas.HoldingResponse(
        id=h.id, name=h.name, ticker=h.ticker, asset_type=h.asset_type,
        quantity=h.quantity, category=h.category,
        created_at=h.created_at or datetime.now(timezone.utc).isoformat()
    )


@app.delete("/api/holdings/{holding_id}", tags=["holdings"])
def delete_holding(holding_id: int, conn: sqlite3.Connection = Depends(db_dep)) -> dict:
    deleted = crud.delete_holding(conn, holding_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Holding {holding_id} not found.")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------------


@app.get("/api/targets", response_model=list[schemas.TargetResponse], tags=["targets"])
def list_targets(conn: sqlite3.Connection = Depends(db_dep)):
    targets = crud.get_targets(conn)
    # Build hierarchy: top-level first, then attach children
    top_level = [t for t in targets if t.parent_id is None]
    children_map: dict[int, list] = defaultdict(list)
    for t in targets:
        if t.parent_id is not None:
            children_map[t.parent_id].append(
                schemas.TargetResponse(
                    id=t.id, category=t.category, sub_category=t.sub_category,
                    name=t.name, ticker=t.ticker, target_pct=t.target_pct,
                    parent_id=t.parent_id, children=[]
                )
            )
    return [
        schemas.TargetResponse(
            id=t.id, category=t.category, sub_category=t.sub_category,
            name=t.name, ticker=t.ticker, target_pct=t.target_pct,
            parent_id=t.parent_id, children=children_map.get(t.id, [])
        )
        for t in top_level
    ]


@app.post("/api/targets", response_model=list[schemas.TargetResponse], tags=["targets"])
def replace_targets(
    targets: list[schemas.TargetCreate],
    conn: sqlite3.Connection = Depends(db_dep),
):
    saved = crud.upsert_targets(conn, targets)
    top_level = [t for t in saved if t.parent_id is None]
    children_map: dict[int, list] = defaultdict(list)
    for t in saved:
        if t.parent_id is not None:
            children_map[t.parent_id].append(
                schemas.TargetResponse(
                    id=t.id, category=t.category, sub_category=t.sub_category,
                    name=t.name, ticker=t.ticker, target_pct=t.target_pct,
                    parent_id=t.parent_id, children=[]
                )
            )
    return [
        schemas.TargetResponse(
            id=t.id, category=t.category, sub_category=t.sub_category,
            name=t.name, ticker=t.ticker, target_pct=t.target_pct,
            parent_id=t.parent_id, children=children_map.get(t.id, [])
        )
        for t in top_level
    ]


# ---------------------------------------------------------------------------
# Rebalancing
# ---------------------------------------------------------------------------


@app.post("/api/rebalance", response_model=schemas.RebalancePlan, tags=["rebalance"])
def calculate_rebalance(
    request: schemas.RebalanceRequest,
    conn: sqlite3.Connection = Depends(db_dep),
) -> schemas.RebalancePlan:
    return rebalance_service.compute_rebalance_plan(conn, request.budget_krw)
