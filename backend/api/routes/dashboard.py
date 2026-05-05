from datetime import datetime, UTC
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from core.accounts import init_default_accounts
from core.auth import get_household_id
from core.models import AccountType, Account, Journal, JournalEntry
from db.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DEBIT_NORMAL = {AccountType.ASSET, AccountType.EXPENSE}


def _get_net_worth(db: Session, household_id: str) -> dict:
    debit_types = [t.value for t in DEBIT_NORMAL]
    signed = case(
        (
            Account.account_type.in_(debit_types),
            case(
                (JournalEntry.entry_type == "debit", JournalEntry.amount),
                else_=-JournalEntry.amount,
            ),
        ),
        else_=case(
            (JournalEntry.entry_type == "credit", JournalEntry.amount),
            else_=-JournalEntry.amount,
        ),
    )
    rows = (
        db.query(Account.account_type, func.sum(signed).label("balance"))
        .outerjoin(JournalEntry, JournalEntry.account_id == Account.id)
        .filter(Account.household_id == household_id, Account.is_active == True)
        .group_by(Account.account_type)
        .all()
    )
    totals = {t: Decimal("0") for t in AccountType}
    for account_type, balance in rows:
        totals[AccountType(account_type)] = Decimal(str(balance or 0))
    assets = totals[AccountType.ASSET]
    liabilities = totals[AccountType.LIABILITY]
    return {
        "assets": assets,
        "liabilities": liabilities,
        "equity": totals[AccountType.EQUITY],
        "revenue": totals[AccountType.REVENUE],
        "expenses": totals[AccountType.EXPENSE],
        "net_worth": assets - liabilities,
    }


def _sum_entries_since(db: Session, household_id: str, account_type: AccountType, since: datetime) -> Decimal:
    normal_side = "debit" if account_type in DEBIT_NORMAL else "credit"
    result = (
        db.query(func.sum(JournalEntry.amount))
        .join(Account, Account.id == JournalEntry.account_id)
        .join(Journal, Journal.id == JournalEntry.journal_id)
        .filter(
            Account.household_id == household_id,
            Account.account_type == account_type,
            Account.is_active == True,
            JournalEntry.entry_type == normal_side,
            Journal.date >= since,
        )
        .scalar()
    )
    return Decimal(str(result or 0))


def _get_balances_by_category(db: Session, household_id: str, account_type: AccountType) -> dict:
    is_debit_normal = account_type in DEBIT_NORMAL
    signed = case(
        (JournalEntry.entry_type == "debit", JournalEntry.amount),
        else_=-JournalEntry.amount,
    ) if is_debit_normal else case(
        (JournalEntry.entry_type == "credit", JournalEntry.amount),
        else_=-JournalEntry.amount,
    )
    rows = (
        db.query(Account.category, func.sum(signed).label("balance"))
        .outerjoin(JournalEntry, JournalEntry.account_id == Account.id)
        .filter(Account.household_id == household_id, Account.account_type == account_type, Account.is_active == True)
        .group_by(Account.category)
        .all()
    )
    return {
        cat.value if hasattr(cat, "value") else str(cat): Decimal(str(bal or 0))
        for cat, bal in rows
    }


@router.get("/summary")
def get_summary(
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    init_default_accounts(db, household_id)
    nw = _get_net_worth(db, household_id)

    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    month_revenue = _sum_entries_since(db, household_id, AccountType.REVENUE, month_start)
    month_expense = _sum_entries_since(db, household_id, AccountType.EXPENSE, month_start)

    return {
        "net_worth": float(nw["net_worth"]),
        "assets": float(nw["assets"]),
        "liabilities": float(nw["liabilities"]),
        "this_month": {
            "revenue": float(month_revenue),
            "expense": float(month_expense),
            "savings": float(month_revenue - month_expense),
        },
        "updated_at": now.isoformat(),
    }


@router.get("/assets-breakdown")
def get_assets_breakdown(
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    init_default_accounts(db, household_id)
    category_balances = _get_balances_by_category(db, household_id, AccountType.ASSET)

    total = sum((v for v in category_balances.values() if v > 0), Decimal("0"))
    breakdown = [
        {
            "category": k,
            "amount": float(v),
            "percentage": round(float(v) / float(total) * 100, 1) if total > 0 else 0,
        }
        for k, v in sorted(category_balances.items(), key=lambda x: -x[1])
        if v > 0
    ]

    return {"total": float(total), "breakdown": breakdown}


@router.get("/cashflow")
def get_cashflow(
    year: int | None = None,
    month: int | None = None,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    now = datetime.now(UTC)
    year = year or now.year
    month = month or now.month
    month_start = datetime(year, month, 1, tzinfo=UTC)
    month_end = datetime(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1, tzinfo=UTC)

    LABELS = {
        "salary": "급여", "investment_income": "투자수익", "business_income": "사업수익", "other_revenue": "기타수익",
        "food": "식비", "transport": "교통비", "housing": "주거비", "entertainment": "여가/문화",
        "health": "의료/건강", "education": "교육비", "shopping": "쇼핑", "other_expense": "기타지출",
    }
    ICONS = {
        "salary": "💼", "investment_income": "📈", "business_income": "🏢", "other_revenue": "💰",
        "food": "🍽", "transport": "🚌", "housing": "🏠", "entertainment": "🎬",
        "health": "🏥", "education": "📚", "shopping": "🛍", "other_expense": "💸",
    }

    def _by_category(account_type: AccountType, entry_side: str):
        rows = (
            db.query(Account.category, func.sum(JournalEntry.amount))
            .join(JournalEntry, JournalEntry.account_id == Account.id)
            .join(Journal, Journal.id == JournalEntry.journal_id)
            .filter(
                Account.household_id == household_id,
                Account.account_type == account_type,
                Account.is_active == True,
                JournalEntry.entry_type == entry_side,
                Journal.date >= month_start,
                Journal.date < month_end,
            )
            .group_by(Account.category)
            .all()
        )
        result, total = [], 0.0
        for cat, amount in rows:
            cat_str = cat.value if hasattr(cat, "value") else str(cat)
            amt = float(amount or 0)
            if amt > 0:
                result.append({"category": cat_str, "label": LABELS.get(cat_str, cat_str),
                                "icon": ICONS.get(cat_str, "💰"), "amount": amt})
                total += amt
        return sorted(result, key=lambda x: -x["amount"]), total

    income, total_income = _by_category(AccountType.REVENUE, "credit")
    expense, total_expense = _by_category(AccountType.EXPENSE, "debit")

    return {
        "year": year, "month": month,
        "income": income, "expense": expense,
        "total_income": total_income, "total_expense": total_expense,
        "net_flow": total_income - total_expense,
    }


@router.get("/recent-transactions")
def get_recent_transactions(
    limit: int = 10,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    journals = (
        db.query(Journal)
        .filter(Journal.household_id == household_id)
        .order_by(Journal.date.desc(), Journal.created_at.desc())
        .limit(limit)
        .all()
    )
    if not journals:
        return []

    journal_ids = [j.id for j in journals]
    entries = (
        db.query(JournalEntry, Account.account_type)
        .join(Account, Account.id == JournalEntry.account_id)
        .filter(JournalEntry.journal_id.in_(journal_ids))
        .all()
    )

    journal_types: dict[str, set] = {}
    journal_amounts: dict[str, Decimal] = {}
    for entry, account_type in entries:
        jid = entry.journal_id
        journal_types.setdefault(jid, set()).add(account_type)
        if entry.entry_type == "debit":
            journal_amounts[jid] = journal_amounts.get(jid, Decimal("0")) + Decimal(str(entry.amount))

    def tx_type(types: set) -> str:
        if AccountType.REVENUE in types:
            return "income"
        if AccountType.EXPENSE in types:
            return "expense"
        return "transfer"

    return [
        {
            "id": j.id,
            "date": j.date.isoformat(),
            "description": j.description,
            "amount": float(journal_amounts.get(j.id, Decimal("0"))),
            "tx_type": tx_type(journal_types.get(j.id, set())),
        }
        for j in journals
    ]
