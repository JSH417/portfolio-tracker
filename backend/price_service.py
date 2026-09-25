"""Price fetching service using yfinance with TTL caching."""

import logging

import yfinance as yf
from cachetools import TTLCache, cached

import models

logger = logging.getLogger(__name__)

# Cache for ETF prices: up to 256 tickers, 15-minute TTL
_etf_cache: TTLCache = TTLCache(maxsize=256, ttl=900)

# Cache for exchange rate: single entry, 5-minute TTL
_fx_cache: TTLCache = TTLCache(maxsize=1, ttl=300)

_FX_FALLBACK = 1350.0


@cached(cache=_etf_cache)
def get_korean_etf_price(ticker_code: str) -> float | None:
    """Fetch the latest closing price of a Korean ETF listed on KRX.

    Args:
        ticker_code: Numeric ticker string, e.g. ``"379800"``.

    Returns:
        Latest closing price in KRW, or ``None`` if unavailable.
    """
    symbol = f"{ticker_code}.KS"
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5d")["Close"].dropna()
        if hist.empty:
            logger.warning("No price data returned for %s", symbol)
            return None
        return float(hist.iloc[-1])
    except Exception:
        logger.exception("Failed to fetch price for %s", symbol)
        return None


@cached(cache=_fx_cache)
def get_usd_krw_rate() -> float:
    """Fetch the current USD/KRW exchange rate.

    Returns:
        Exchange rate as a float. Falls back to :data:`_FX_FALLBACK` on error.
    """
    try:
        ticker = yf.Ticker("USDKRW=X")
        hist = ticker.history(period="5d")["Close"].dropna()
        if hist.empty:
            logger.warning("No USD/KRW data returned; using fallback %s", _FX_FALLBACK)
            return _FX_FALLBACK
        return float(hist.iloc[-1])
    except Exception:
        logger.exception("Failed to fetch USD/KRW rate; using fallback %s", _FX_FALLBACK)
        return _FX_FALLBACK


def get_holding_value_krw(holding: models.Holding, exchange_rate: float) -> float:
    """Calculate the current KRW value of a holding.

    Args:
        holding: ORM ``Holding`` instance.
        exchange_rate: Current USD → KRW rate.

    Returns:
        Total value in KRW.
    """
    if holding.asset_type == "etf_kr":
        if holding.ticker is None:
            return 0.0
        price = get_korean_etf_price(holding.ticker)
        if price is None:
            return 0.0
        return price * holding.quantity

    if holding.asset_type == "dollar_rp":
        # quantity is denominated in USD
        return holding.quantity * exchange_rate

    if holding.asset_type == "cash_krw":
        # quantity is already KRW
        return holding.quantity

    logger.warning("Unknown asset_type '%s' for holding id=%s", holding.asset_type, holding.id)
    return 0.0


def get_holding_price_krw(holding: models.Holding, exchange_rate: float) -> float | None:
    """Return the price of a single unit of the holding in KRW.

    For ETFs this is the share price; for dollar_rp it is the exchange rate
    (1 USD in KRW); for cash_krw it is 1.0.

    Args:
        holding: ORM ``Holding`` instance.
        exchange_rate: Current USD → KRW rate.

    Returns:
        Price per unit in KRW, or ``None`` if the price cannot be determined.
    """
    if holding.asset_type == "etf_kr":
        if holding.ticker is None:
            return None
        return get_korean_etf_price(holding.ticker)

    if holding.asset_type == "dollar_rp":
        return exchange_rate

    if holding.asset_type == "cash_krw":
        return 1.0

    return None
