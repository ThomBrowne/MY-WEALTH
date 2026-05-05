"""
환율 조회 (frankfurter.app — 무료, 인증 불필요)
"""
from datetime import datetime, UTC, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/currencies", tags=["currencies"])

# 인메모리 캐시 (1시간)
_cache: dict = {"rates": {}, "updated_at": None, "source": "fallback"}
_CACHE_TTL = timedelta(hours=1)

# 폴백 환율 (네트워크 불가 시 사용, 대략적 기준값)
_FALLBACK_RATES: dict[str, float] = {
    "KRW": 1.0,
    "USD": 0.000725,   # 1 KRW ≈ 0.000725 USD
    "EUR": 0.000669,
    "JPY": 0.1097,
    "GBP": 0.000574,
    "CNY": 0.00527,
    "USD_TO_KRW": 1380.0,
    "EUR_TO_KRW": 1495.0,
    "JPY_TO_KRW": 9.12,
    "GBP_TO_KRW": 1742.0,
    "CNY_TO_KRW": 189.8,
}


async def _fetch_rates() -> dict[str, float]:
    now = datetime.now(UTC)
    if _cache["updated_at"] and now - _cache["updated_at"] < _CACHE_TTL:
        return _cache["rates"]

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                "https://api.frankfurter.app/latest",
                params={"base": "USD", "symbols": "KRW,EUR,JPY,GBP,CNY"},
            )
            resp.raise_for_status()
            data = resp.json()
            usd_to_krw = data["rates"]["KRW"]

            rates: dict[str, float] = {"KRW": 1.0}
            for currency, usd_rate in data["rates"].items():
                if currency == "KRW":
                    continue
                rates[currency] = round(usd_rate / usd_to_krw, 8)

            for currency, usd_rate in data["rates"].items():
                if currency == "KRW":
                    continue
                rates[f"{currency}_TO_KRW"] = round(usd_to_krw / usd_rate, 4)
            rates["USD_TO_KRW"] = round(usd_to_krw, 4)

            _cache["rates"] = rates
            _cache["updated_at"] = now
            _cache["source"] = "frankfurter.app"
            return rates

    except Exception:
        # 네트워크 불가 시 폴백 사용
        if not _cache["rates"]:
            _cache["rates"] = _FALLBACK_RATES.copy()
            _cache["updated_at"] = now
            _cache["source"] = "fallback (offline)"
        return _cache["rates"]


@router.get("/rates")
async def get_rates():
    """KRW 기준 주요 통화 환율 (1시간 캐시)"""
    rates = await _fetch_rates()
    return {
        "base": "KRW",
        "rates": rates,
        "updated_at": _cache["updated_at"].isoformat() if _cache["updated_at"] else None,
        "source": _cache.get("source", "unknown"),
    }


@router.get("/convert")
async def convert(amount: float, from_currency: str, to_currency: str = "KRW"):
    """금액 환산 (예: 100 USD → KRW)"""
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    if from_currency == to_currency:
        return {"amount": amount, "from": from_currency, "to": to_currency, "result": amount, "rate": 1.0}

    rates = await _fetch_rates()
    key = f"{from_currency}_TO_KRW"
    if from_currency != "KRW" and key not in rates:
        raise HTTPException(status_code=404, detail=f"지원하지 않는 통화: {from_currency}")

    if from_currency == "KRW":
        rate = rates.get(to_currency, 1.0)
        result = amount * rate
    else:
        krw_amount = amount * rates[key]
        if to_currency == "KRW":
            result = krw_amount
            rate = rates[key]
        else:
            rate_to = rates.get(to_currency, 1.0)
            result = krw_amount * rate_to
            rate = rate_to * rates[key]

    return {
        "amount": amount,
        "from": from_currency,
        "to": to_currency,
        "result": round(result, 2),
        "rate": round(rate, 6),
    }
