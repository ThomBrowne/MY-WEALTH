"""
예산 추적 — 카테고리별 월 예산 설정 및 소진율 조회
"""
from datetime import datetime, UTC
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, String, Numeric, Integer, or_
from sqlalchemy.orm import Session

from db.database import Base, get_db, engine
from core.auth import get_household_id
from core.models import AccountType, Account, AccountCategory, Journal, JournalEntry


class Budget(Base):
    __tablename__ = "budgets"
    id = Column(String(36), primary_key=True)
    household_id = Column(String(36), nullable=True, index=True)
    category = Column(String(50), nullable=False)
    amount = Column(Numeric(20, 4), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)


Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/budget", tags=["budget"])


class BudgetCreate(BaseModel):
    category: str
    amount: Decimal
    year: int | None = None
    month: int | None = None


class BudgetResponse(BaseModel):
    id: str
    category: str
    budgeted: float
    spent: float
    remaining: float
    usage_pct: float
    year: int
    month: int


@router.get("/", response_model=list[BudgetResponse])
def list_budgets(
    year: int | None = None,
    month: int | None = None,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    now = datetime.now(UTC)
    year = year or now.year
    month = month or now.month

    budgets = db.query(Budget).filter(
        or_(Budget.household_id == household_id, Budget.household_id.is_(None)),
        Budget.year == year,
        Budget.month == month,
    ).all()

    month_start = datetime(year, month, 1, tzinfo=UTC)

    result = []
    for b in budgets:
        if b.household_id is None:
            b.household_id = household_id
        try:
            cat = AccountCategory(b.category)
        except ValueError:
            continue

        spent = _get_category_expense_since(db, household_id, b.category, month_start)
        budgeted = Decimal(str(b.amount))
        remaining = budgeted - spent
        usage_pct = round(float(spent / budgeted * 100), 1) if budgeted > 0 else 0

        result.append(BudgetResponse(
            id=b.id,
            category=b.category,
            budgeted=float(budgeted),
            spent=float(spent),
            remaining=float(remaining),
            usage_pct=usage_pct,
            year=year,
            month=month,
        ))

    db.commit()
    return result


@router.post("/", response_model=BudgetResponse, status_code=201)
def create_or_update_budget(
    body: BudgetCreate,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    now = datetime.now(UTC)
    year = body.year or now.year
    month = body.month or now.month

    existing = db.query(Budget).filter(
        or_(Budget.household_id == household_id, Budget.household_id.is_(None)),
        Budget.category == body.category,
        Budget.year == year,
        Budget.month == month,
    ).first()

    if existing:
        existing.household_id = household_id
        existing.amount = body.amount
        db.commit()
        budget = existing
    else:
        budget = Budget(
            id=str(uuid4()),
            household_id=household_id,
            category=body.category,
            amount=body.amount,
            year=year,
            month=month,
        )
        db.add(budget)
        db.commit()

    month_start = datetime(year, month, 1, tzinfo=UTC)
    spent = _get_category_expense_since(db, household_id, body.category, month_start)
    budgeted = Decimal(str(body.amount))

    return BudgetResponse(
        id=budget.id,
        category=body.category,
        budgeted=float(budgeted),
        spent=float(spent),
        remaining=float(budgeted - spent),
        usage_pct=round(float(spent / budgeted * 100), 1) if budgeted > 0 else 0,
        year=year,
        month=month,
    )


@router.get("/overview")
def budget_overview(
    year: int | None = None,
    month: int | None = None,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    now = datetime.now(UTC)
    year = year or now.year
    month = month or now.month

    budgets = list_budgets(year=year, month=month, household_id=household_id, db=db)
    total_budgeted = sum(b.budgeted for b in budgets)
    total_spent = sum(b.spent for b in budgets)

    return {
        "year": year,
        "month": month,
        "total_budgeted": total_budgeted,
        "total_spent": total_spent,
        "total_remaining": total_budgeted - total_spent,
        "overall_usage_pct": round(total_spent / total_budgeted * 100, 1) if total_budgeted > 0 else 0,
        "categories": budgets,
    }


def _get_expense_since(db: Session, household_id: str, account_id: str, since: datetime) -> Decimal:
    from sqlalchemy import func
    result = (
        db.query(func.sum(JournalEntry.amount))
        .join(Journal, Journal.id == JournalEntry.journal_id)
        .filter(
            JournalEntry.account_id == account_id,
            JournalEntry.entry_type == "debit",
            Journal.date >= since,
            Journal.household_id == household_id,
        ).scalar()
    )
    return Decimal(str(result or 0))


def _get_category_expense_since(db: Session, household_id: str, category: str, since: datetime) -> Decimal:
    try:
        cat = AccountCategory(category)
    except ValueError:
        return Decimal("0")

    accounts = db.query(Account).filter(
        Account.household_id == household_id,
        Account.category == cat,
        Account.account_type == AccountType.EXPENSE,
        Account.is_active == True,
    ).all()

    total = Decimal("0")
    for acc in accounts:
        total += _get_expense_since(db, household_id, acc.id, since)
    return total
