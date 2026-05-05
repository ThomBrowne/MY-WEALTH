"""
Double-Entry Ledger Engine
모든 거래는 반드시 차변(Debit) 합계 == 대변(Credit) 합계
"""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List
from uuid import uuid4

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from core.models import Account, AccountType, Journal, JournalEntry


DEBIT_NORMAL = {AccountType.ASSET, AccountType.EXPENSE}
CREDIT_NORMAL = {AccountType.LIABILITY, AccountType.EQUITY, AccountType.REVENUE}


@dataclass
class EntryInput:
    account_id: str
    amount: Decimal
    entry_type: str  # "debit" | "credit"
    memo: str = ""


class LedgerError(Exception):
    pass


def _round(amount: Decimal) -> Decimal:
    return amount.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def post_journal(
    db: Session,
    date: datetime,
    description: str,
    entries: List[EntryInput],
    reference: str = "",
    household_id: str | None = None,
    created_by: str | None = None,
) -> Journal:
    if len(entries) < 2:
        raise LedgerError("전표는 최소 차변·대변 각 1개 이상의 항목이 필요합니다.")

    total_debit = _round(sum((e.amount for e in entries if e.entry_type == "debit"), Decimal("0")))
    total_credit = _round(sum((e.amount for e in entries if e.entry_type == "credit"), Decimal("0")))

    if total_debit != total_credit:
        raise LedgerError(f"전표 불균형: 차변 {total_debit} ≠ 대변 {total_credit}")

    journal = Journal(
        id=str(uuid4()),
        date=date,
        description=description,
        reference=reference,
        is_balanced=True,
        household_id=household_id,
        created_by=created_by,
    )
    db.add(journal)
    db.flush()

    for e in entries:
        db.add(JournalEntry(
            id=str(uuid4()),
            journal_id=journal.id,
            account_id=e.account_id,
            amount=e.amount,
            entry_type=e.entry_type,
            memo=e.memo,
        ))

    db.commit()
    db.refresh(journal)
    return journal


def get_account_balance(db: Session, account_id: str) -> Decimal:
    """단일 계정 잔액 — SQL SUM 집계 1회 쿼리."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise LedgerError(f"계정을 찾을 수 없습니다: {account_id}")

    signed_amount = case(
        (JournalEntry.entry_type == "debit", JournalEntry.amount),
        else_=-JournalEntry.amount,
    )
    if account.account_type not in DEBIT_NORMAL:
        signed_amount = case(
            (JournalEntry.entry_type == "credit", JournalEntry.amount),
            else_=-JournalEntry.amount,
        )

    result = (
        db.query(func.sum(signed_amount))
        .filter(JournalEntry.account_id == account_id)
        .scalar()
    )
    return _round(Decimal(str(result or 0)))


def get_balances_by_type(db: Session) -> dict[AccountType, Decimal]:
    """
    전체 계정 잔액을 AccountType별로 집계한다.
    단일 SQL 쿼리로 N+1 완전 제거.
    """
    # 정상 방향(Normal Balance) 기준으로 부호 결정
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
        .filter(Account.is_active == True)
        .group_by(Account.account_type)
        .all()
    )

    totals: dict[AccountType, Decimal] = {t: Decimal("0") for t in AccountType}
    for account_type, balance in rows:
        totals[AccountType(account_type)] = _round(Decimal(str(balance or 0)))
    return totals


def get_net_worth(db: Session) -> dict:
    """순자산 계산 — 단일 쿼리로 전체 집계."""
    totals = get_balances_by_type(db)
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


def get_balances_by_category(
    db: Session,
    account_type: AccountType,
) -> dict[str, Decimal]:
    """특정 AccountType 내 카테고리별 잔액 집계 — 단일 쿼리."""
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
        .filter(Account.account_type == account_type, Account.is_active == True)
        .group_by(Account.category)
        .all()
    )

    return {
        cat.value if hasattr(cat, "value") else str(cat): _round(Decimal(str(bal or 0)))
        for cat, bal in rows
    }


def sum_entries_since(
    db: Session,
    account_type: AccountType,
    since: datetime,
) -> Decimal:
    """기간 내 특정 타입 합계 — SQL SUM 집계."""
    normal_side = "debit" if account_type in DEBIT_NORMAL else "credit"

    result = (
        db.query(func.sum(JournalEntry.amount))
        .join(Account, Account.id == JournalEntry.account_id)
        .join(Journal, Journal.id == JournalEntry.journal_id)
        .filter(
            Account.account_type == account_type,
            Account.is_active == True,
            JournalEntry.entry_type == normal_side,
            Journal.date >= since,
        )
        .scalar()
    )
    return _round(Decimal(str(result or 0)))


def create_opening_balance(
    db: Session,
    account_id: str,
    amount: Decimal,
    date: datetime,
    household_id: str | None = None,
) -> Journal:
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise LedgerError(f"계정을 찾을 수 없습니다: {account_id}")

    hid = household_id or account.household_id
    obe = db.query(Account).filter(
        Account.account_type == AccountType.EQUITY,
        Account.category == "equity_opening",
        Account.household_id == hid,
    ).first()
    if not obe:
        raise LedgerError("Opening Balance Equity 계정이 존재하지 않습니다.")

    if account.account_type in DEBIT_NORMAL:
        entries = [
            EntryInput(account_id=account_id, amount=amount, entry_type="debit"),
            EntryInput(account_id=obe.id, amount=amount, entry_type="credit"),
        ]
    else:
        entries = [
            EntryInput(account_id=obe.id, amount=amount, entry_type="debit"),
            EntryInput(account_id=account_id, amount=amount, entry_type="credit"),
        ]

    return post_journal(
        db=db,
        date=date,
        description=f"초기 잔액: {account.name}",
        entries=entries,
        reference="OBE",
        household_id=hid,
    )
