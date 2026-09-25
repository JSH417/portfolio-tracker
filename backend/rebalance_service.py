"""Rebalancing calculation service (buy-only, no sell)."""

import math
import logging
import sqlite3

import crud
import price_service
import schemas

logger = logging.getLogger(__name__)


def _get_portfolio_values(
    holdings: list,
    exchange_rate: float,
) -> dict[int, float]:
    return {
        h.id: price_service.get_holding_value_krw(h, exchange_rate)
        for h in holdings
    }


def _current_value_for_ticker(
    ticker: str | None,
    holdings: list,
    values: dict[int, float],
) -> float:
    if ticker is None:
        return 0.0
    return sum(values[h.id] for h in holdings if h.ticker == ticker)


def _current_value_for_category(
    category: str,
    holdings: list,
    values: dict[int, float],
) -> float:
    return sum(values[h.id] for h in holdings if h.category == category)


def compute_rebalance_plan(
    db: sqlite3.Connection,
    budget_krw: float,
) -> schemas.RebalancePlan:
    """Compute a buy-only rebalance plan.

    Algorithm
    ---------
    1. Fetch current holdings and prices.
    2. total_after = total_krw + budget_krw
    3. For every top-level target:
       - Compute target_value = total_after * (target_pct / 100)
       - If it has sub-targets, distribute proportionally by sub target_pct
       - Match each leaf target to its current value (by ticker or category)
    4. Collect shortfalls where target_value > current_value
    5. Allocate budget_krw proportionally to shortfalls, capped at each shortfall
    6. For ETFs: buy_quantity = floor(allocated / price_per_unit)
       For dollar_rp / cash: buy_quantity = 0 (amount-based, not share-based)
    7. Sum actual spend, compute remaining.
    """
    holdings = crud.get_holdings(db)
    all_targets = crud.get_targets(db)
    exchange_rate = price_service.get_usd_krw_rate()

    values = _get_portfolio_values(holdings, exchange_rate)
    total_krw = sum(values.values())
    total_after = total_krw + budget_krw

    # Separate top-level and build children map
    top_level = [t for t in all_targets if t.parent_id is None]
    children_map: dict[int, list] = {}
    for t in all_targets:
        if t.parent_id is not None:
            children_map.setdefault(t.parent_id, []).append(t)

    leaf_targets: list[dict] = []

    for top in top_level:
        top_target_value = total_after * (top.target_pct / 100.0)
        children = children_map.get(top.id, [])

        if children:
            total_sub_pct = sum(c.target_pct for c in children)
            for child in children:
                child_value = (
                    top_target_value * (child.target_pct / total_sub_pct)
                    if total_sub_pct > 0 else 0.0
                )
                current_val = _current_value_for_ticker(child.ticker, holdings, values)
                price = price_service.get_korean_etf_price(child.ticker) if child.ticker else None

                leaf_targets.append({
                    "name": child.name,
                    "ticker": child.ticker,
                    "category": child.category,
                    "sub_category": child.sub_category,
                    "target_value_krw": child_value,
                    "current_value_krw": current_val,
                    "price_per_unit_krw": price,
                    "target_pct_effective": (child_value / total_after * 100.0) if total_after > 0 else 0.0,
                })
        else:
            current_val = _current_value_for_category(top.category, holdings, values)
            price: float | None = None
            if top.ticker:
                price = price_service.get_korean_etf_price(top.ticker)
            elif top.category == "dollar_rp":
                price = exchange_rate
            elif top.category in ("cash_krw", "cash"):
                price = 1.0

            leaf_targets.append({
                "name": top.name,
                "ticker": top.ticker,
                "category": top.category,
                "sub_category": top.sub_category,
                "target_value_krw": top_target_value,
                "current_value_krw": current_val,
                "price_per_unit_krw": price,
                "target_pct_effective": top.target_pct,
            })

    # Compute shortfalls (buy-only: ignore over-allocation)
    total_shortfall = sum(
        max(0.0, leaf["target_value_krw"] - leaf["current_value_krw"])
        for leaf in leaf_targets
    )

    items: list[schemas.RebalanceItem] = []
    total_buy_krw = 0.0

    for leaf in leaf_targets:
        current_pct = (leaf["current_value_krw"] / total_after * 100.0) if total_after > 0 else 0.0
        target_pct = leaf["target_pct_effective"]
        gap_pct = target_pct - current_pct
        shortfall = max(0.0, leaf["target_value_krw"] - leaf["current_value_krw"])

        if shortfall <= 0 or total_shortfall <= 0:
            allocated = 0.0
        else:
            proportional = budget_krw * (shortfall / total_shortfall)
            allocated = min(proportional, shortfall)

        price = leaf["price_per_unit_krw"]
        if price and price > 0 and leaf["ticker"]:
            buy_qty = math.floor(allocated / price)
            actual_spend = buy_qty * price
        else:
            buy_qty = 0.0
            actual_spend = allocated

        total_buy_krw += actual_spend

        items.append(schemas.RebalanceItem(
            name=leaf["name"],
            ticker=leaf["ticker"],
            category=leaf["category"],
            sub_category=leaf["sub_category"],
            current_pct=round(current_pct, 4),
            target_pct=round(target_pct, 4),
            gap_pct=round(gap_pct, 4),
            buy_amount_krw=round(actual_spend, 2),
            buy_quantity=buy_qty,
            price_per_unit_krw=price,
        ))

    remaining_krw = budget_krw - total_buy_krw

    return schemas.RebalancePlan(
        budget_krw=budget_krw,
        items=items,
        remaining_krw=round(remaining_krw, 2),
        total_buy_krw=round(total_buy_krw, 2),
    )
