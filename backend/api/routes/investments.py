"""
투자 자산 실시간 가격 조회 (yfinance)
주식, ETF, 암호화폐 티커를 입력하면 현재가·수익률을 반환한다.
"""
from datetime import datetime, UTC
import json
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from core.auth import get_current_user, get_household_id
from core.models import Account, AccountCategory, AccountType, Household
from core.models import User
from core.ledger import get_account_balance, post_journal, EntryInput

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

try:
    import requests as _requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

router = APIRouter(prefix="/investments", tags=["investments"])


class TickerInfo(BaseModel):
    ticker: str
    name: str
    current_price: float
    currency: str
    change_pct: float
    market_cap: Optional[float]


class PortfolioPosition(BaseModel):
    account_id: str
    account_name: str
    ticker: str
    quantity: float
    avg_price: float
    current_price: float
    current_value: float
    gain_loss: float
    gain_loss_pct: float


class InvestmentAccountCreate(BaseModel):
    name: str
    ticker: str
    quantity: float
    avg_price: float


def _parse_position_description(description: str | None) -> tuple[str | None, float, float]:
    ticker, qty, avg = None, 0.0, 0.0
    for part in (description or "").split(","):
        k, _, v = part.partition("=")
        if k == "ticker":
            ticker = v.strip().upper() or None
        elif k == "qty":
            qty = float(v) if v else 0.0
        elif k == "avg":
            avg = float(v) if v else 0.0
    return ticker, qty, avg


def _investment_accounts(db: Session, household_id: str) -> list[Account]:
    household = db.query(Household).filter(Household.id == household_id).first()
    query = db.query(Account).filter(
        Account.account_type == AccountType.ASSET,
        Account.category == AccountCategory.INVESTMENT,
        Account.household_id == household_id,
        Account.is_active.is_(True),
    )
    if household:
        query = query.filter(Account.created_at >= household.created_at)
    return query.all()


# 한국 주요 종목 로컬 테이블 (Yahoo Finance가 한국어 검색을 지원하지 않으므로)
_KR_STOCKS = [
    ("삼성전자", "005930.KS", "Samsung Electronics"),
    ("sk하이닉스", "000660.KS", "SK Hynix"),
    ("하이닉스", "000660.KS", "SK Hynix"),
    ("현대차", "005380.KS", "Hyundai Motor"),
    ("현대자동차", "005380.KS", "Hyundai Motor"),
    ("lg에너지솔루션", "373220.KS", "LG Energy Solution"),
    ("삼성바이오로직스", "207940.KS", "Samsung Biologics"),
    ("삼성sdi", "006400.KS", "Samsung SDI"),
    ("셀트리온", "068270.KS", "Celltrion"),
    ("카카오", "035720.KS", "Kakao"),
    ("네이버", "035420.KS", "NAVER"),
    ("kb금융", "105560.KS", "KB Financial"),
    ("신한지주", "055550.KS", "Shinhan Financial"),
    ("하나금융지주", "086790.KS", "Hana Financial"),
    ("기아", "000270.KS", "Kia"),
    ("포스코홀딩스", "005490.KS", "POSCO Holdings"),
    ("lg화학", "051910.KS", "LG Chem"),
    ("현대모비스", "012330.KS", "Hyundai Mobis"),
    ("삼성물산", "028260.KS", "Samsung C&T"),
    ("sk이노베이션", "096770.KS", "SK Innovation"),
    ("카카오뱅크", "323410.KS", "Kakao Bank"),
    ("크래프톤", "259960.KS", "Krafton"),
    ("고려아연", "010130.KS", "Korea Zinc"),
]


def _search_kr_local(q: str) -> list[dict]:
    q_lower = q.lower().replace(" ", "")
    results = []
    seen = set()
    for ko_name, ticker, en_name in _KR_STOCKS:
        if q_lower in ko_name.replace(" ", "") or q_lower in en_name.lower().replace(" ", ""):
            if ticker not in seen:
                seen.add(ticker)
                results.append({"ticker": ticker, "name": en_name, "exchange": "KSC", "type": "EQUITY"})
    return results


def _search_yfinance(q: str) -> list[dict]:
    if not YFINANCE_AVAILABLE:
        return []
    try:
        from yfinance import Search
        hits = Search(q, max_results=8).quotes
        results = []
        for item in hits:
            symbol = item.get("symbol", "")
            name = item.get("shortname") or item.get("longname") or symbol
            qtype = item.get("quoteType", "")
            if not symbol or qtype in ("MUTUALFUND", "CURRENCY"):
                continue
            results.append({"ticker": symbol, "name": name, "exchange": item.get("exchange", ""), "type": qtype})
        return results
    except Exception:
        return []


@router.get("/search")
def search_ticker(q: str = Query(..., min_length=1)):
    """종목명 또는 티커로 검색"""
    q_stripped = q.strip()
    # 한국어 포함 여부 확인
    has_korean = any('가' <= c <= '힣' or 'ᄀ' <= c <= 'ᇿ' for c in q_stripped)
    if has_korean:
        local = _search_kr_local(q_stripped)
        if local:
            return local
        # 한국어이지만 로컬에 없으면 빈 결과
        return []
    return _search_yfinance(q_stripped)


@router.get("/quotes")
def get_multiple_quotes(tickers: str = Query(..., description="콤마 구분 티커 (예: AAPL,MSFT,005930.KS)")):
    """여러 티커 일괄 조회 (52주 고/저가, 시총 포함)"""
    if not YFINANCE_AVAILABLE:
        raise HTTPException(status_code=503, detail="yfinance가 설치되지 않았습니다.")

    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    results = []
    for ticker in ticker_list:
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="2d")
            if hist.empty:
                continue
            info = t.fast_info
            current = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current
            change_pct = round((current - prev) / prev * 100, 2) if prev else 0
            results.append({
                "ticker": ticker,
                "current_price": current,
                "change_pct": change_pct,
                "week52_high": getattr(info, "fifty_two_week_high", None),
                "week52_low": getattr(info, "fifty_two_week_low", None),
                "market_cap": getattr(info, "market_cap", None),
            })
        except Exception:
            results.append({"ticker": ticker, "current_price": None, "change_pct": 0})

    return results


@router.get("/risk-metrics")
def get_risk_metrics(
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    """포트폴리오 리스크 지표: 베타, 변동성, 샤프지수, MDD, 분산투자 점수"""
    if not YFINANCE_AVAILABLE:
        raise HTTPException(status_code=503, detail="yfinance not available")

    accounts = _investment_accounts(db, household_id)

    ticker_costs: dict = {}
    total_cost = 0.0
    for acc in accounts:
        ticker, _, _ = _parse_position_description(acc.description)
        if ticker:
            cost = float(get_account_balance(db, acc.id))
            ticker_costs[ticker] = ticker_costs.get(ticker, 0.0) + cost
            total_cost += cost

    if not ticker_costs or total_cost == 0:
        return {"beta": None, "volatility": None, "sharpe": None, "mdd": None,
                "diversification_score": None, "position_count": 0}

    weights = {t: v / total_cost for t, v in ticker_costs.items()}

    try:
        download_list = list(ticker_costs.keys()) + ["SPY"]
        data = yf.download(download_list, period="1y", auto_adjust=True, progress=False)["Close"]
        if data.empty:
            raise ValueError("empty data")
        returns = data.pct_change().dropna()

        valid = [t for t in ticker_costs if t in returns.columns]
        if not valid:
            raise ValueError("no valid tickers")

        w_sum = sum(weights[t] for t in valid)
        port_ret = sum(returns[t] * (weights[t] / w_sum) for t in valid)

        volatility = round(float(port_ret.std()) * (252 ** 0.5) * 100, 1)

        beta = None
        if "SPY" in returns.columns:
            cov = float(port_ret.cov(returns["SPY"]))
            var_spy = float(returns["SPY"].var())
            if var_spy > 0:
                beta = round(cov / var_spy, 2)

        annual_ret = float(port_ret.mean()) * 252
        sharpe = round((annual_ret - 0.05) / (volatility / 100), 2) if volatility > 0 else None

        cum = (1 + port_ret).cumprod()
        mdd = round(float(((cum - cum.cummax()) / cum.cummax()).min()) * 100, 1)

        n = len(weights)
        hhi = sum(w ** 2 for w in weights.values())
        div_score = round((1 - hhi) / (1 - 1 / n) * 100) if n > 1 else 0

        return {"beta": beta, "volatility": volatility, "sharpe": sharpe,
                "mdd": mdd, "diversification_score": div_score, "position_count": n}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리스크 계산 실패: {str(e)}")


@router.get("/quote/{ticker}", response_model=TickerInfo)
def get_quote(ticker: str):
    """실시간 주가·ETF·코인 시세 조회"""
    if not YFINANCE_AVAILABLE:
        raise HTTPException(status_code=503, detail="yfinance 라이브러리가 설치되지 않았습니다.")

    try:
        t = yf.Ticker(ticker.upper())
        info = t.fast_info
        hist = t.history(period="2d")

        if hist.empty:
            raise HTTPException(status_code=404, detail=f"티커 '{ticker}'를 찾을 수 없습니다.")

        current = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current
        change_pct = round((current - prev) / prev * 100, 2) if prev else 0

        return TickerInfo(
            ticker=ticker.upper(),
            name=getattr(info, "exchange", ticker.upper()),
            current_price=current,
            currency=getattr(info, "currency", "USD"),
            change_pct=change_pct,
            market_cap=getattr(info, "market_cap", None),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시세 조회 실패: {str(e)}")


def _is_krw_ticker(ticker: str) -> bool:
    t = ticker.upper()
    return t.endswith(".KS") or t.endswith(".KQ") or t.endswith(".KN")


def _get_usd_krw() -> float:
    """USD/KRW 환율 조회. 실패 시 보수적 기본값 반환."""
    if not YFINANCE_AVAILABLE:
        return 1350.0
    try:
        rate = float(yf.Ticker("USDKRW=X").fast_info.last_price)
        return rate if 900 < rate < 2000 else 1350.0
    except Exception:
        return 1350.0


@router.get("/portfolio")
def get_portfolio(
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    """투자 계정 전체 + 실시간 시세·손익 (모든 금액 KRW 기준)"""
    from core.ledger import get_account_balance

    accounts = _investment_accounts(db, household_id)

    # 외화 종목이 있을 경우에만 환율 조회
    tickers_needed = [_parse_position_description(a.description)[0] for a in accounts]
    needs_fx = any(t and not _is_krw_ticker(t) for t in tickers_needed)
    usd_krw = _get_usd_krw() if needs_fx else 1.0

    positions = []
    total_cost = 0.0
    total_value = 0.0

    for acc in accounts:
        ticker, qty, avg = _parse_position_description(acc.description)
        cost = float(get_account_balance(db, acc.id))
        if not ticker and cost == 0:
            continue

        total_cost += cost

        pos: dict = {
            "account_id": acc.id,
            "account_name": acc.name,
            "ticker": ticker,
            "quantity": qty,
            "avg_price": avg,
            "cost_basis": cost,
            "current_price": None,
            "current_value": cost,
            "gain_loss": 0.0,
            "gain_loss_pct": 0.0,
        }

        if ticker and YFINANCE_AVAILABLE:
            try:
                t = yf.Ticker(ticker)
                hist = t.history(period="2d")
                if not hist.empty:
                    cur_native = float(hist["Close"].iloc[-1])
                    prev_native = float(hist["Close"].iloc[-2]) if len(hist) > 1 else cur_native
                    # 외화 → KRW 변환
                    fx = 1.0 if _is_krw_ticker(ticker) else usd_krw
                    cur_krw  = cur_native * fx
                    prev_krw = prev_native * fx
                    cur_val  = cur_krw * qty if qty else cost
                    gl = cur_val - cost
                    pos.update(
                        current_price=cur_krw,
                        current_value=cur_val,
                        gain_loss=gl,
                        gain_loss_pct=round(gl / cost * 100, 2) if cost else 0.0,
                        change_pct=round((cur_krw - prev_krw) / prev_krw * 100, 2) if prev_krw else 0.0,
                    )
                    total_value += cur_val
                else:
                    total_value += cost
            except Exception:
                total_value += cost
        else:
            total_value += cost

        positions.append(pos)

    return {
        "positions": positions,
        "summary": {
            "total_cost": total_cost,
            "total_value": total_value,
            "total_gain_loss": total_value - total_cost,
            "total_gain_loss_pct": round((total_value - total_cost) / total_cost * 100, 2) if total_cost else 0.0,
        },
    }


@router.delete("/account/{account_id}", status_code=200)
def delete_investment_account(
    account_id: str,
    household_id: str = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """투자 종목 삭제 — 잔액 역분개 후 비활성화"""
    from core.ledger import get_account_balance, post_journal, EntryInput
    from core.accounts import get_obe_account

    acc = db.query(Account).filter(
        Account.id == account_id,
        Account.household_id == household_id,
        Account.category == AccountCategory.INVESTMENT,
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다.")

    balance = get_account_balance(db, acc.id)
    if balance > 0:
        obe = get_obe_account(db, household_id)
        if obe:
            post_journal(
                db=db,
                date=datetime.now(UTC),
                description=f"투자 종목 삭제: {acc.name}",
                entries=[
                    EntryInput(account_id=obe.id,  amount=balance, entry_type="debit"),
                    EntryInput(account_id=acc.id,   amount=balance, entry_type="credit"),
                ],
                reference="DEL",
                household_id=household_id,
                created_by=current_user.id,
            )

    acc.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/account", status_code=201)
def create_investment_account(
    body: InvestmentAccountCreate,
    household_id: str = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    투자 계정 생성 + 초기 잔액 설정
    avg_price × quantity = 취득원가를 OBE로 기록
    """
    from uuid import uuid4
    from core.accounts import get_obe_account

    account = Account(
        id=str(uuid4()),
        household_id=household_id,
        name=body.name,
        account_type=AccountType.ASSET,
        category=AccountCategory.INVESTMENT,
        description=f"ticker={body.ticker.upper().strip()},qty={body.quantity},avg={body.avg_price}",
        currency="KRW",
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    cost = Decimal(str(body.avg_price * body.quantity))
    obe = get_obe_account(db, household_id)
    if obe and cost > 0:
        post_journal(
            db=db,
            date=datetime.now(UTC),
            description=f"투자 초기 잔액: {body.name}",
            entries=[
                EntryInput(account_id=account.id, amount=cost, entry_type="debit"),
                EntryInput(account_id=obe.id, amount=cost, entry_type="credit"),
            ],
            reference="OBE",
            household_id=household_id,
            created_by=current_user.id,
        )

    balance = get_account_balance(db, account.id)
    return {
        "id": account.id,
        "name": account.name,
        "ticker": body.ticker,
        "quantity": body.quantity,
        "cost_basis": float(cost),
        "current_balance": float(balance),
    }


DEFAULT_WATCHLIST = ["005930.KS", "000660.KS", "AAPL", "MSFT", "SPY", "QQQ"]


@router.get("/watchlist")
def get_watchlist(
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    hh = db.query(Household).filter(Household.id == household_id).first()
    if not hh or not hh.watchlist_tickers:
        return {"tickers": DEFAULT_WATCHLIST}
    return {"tickers": json.loads(hh.watchlist_tickers)}


@router.put("/watchlist")
def set_watchlist(
    body: dict,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    tickers: List[str] = body.get("tickers", [])
    if not isinstance(tickers, list):
        raise HTTPException(status_code=422, detail="tickers must be a list")
    tickers = [str(t).strip().upper() for t in tickers if str(t).strip()][:30]
    hh = db.query(Household).filter(Household.id == household_id).first()
    if not hh:
        raise HTTPException(status_code=404, detail="Household not found")
    hh.watchlist_tickers = json.dumps(tickers)
    db.commit()
    return {"tickers": tickers}
