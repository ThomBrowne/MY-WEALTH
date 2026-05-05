from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from core.auth import get_current_user, get_household_id
from core.ledger import EntryInput, post_journal, LedgerError, DEBIT_NORMAL
from core.models import Journal, JournalEntry, Account, User
from db.database import get_db

router = APIRouter(prefix="/transactions", tags=["transactions"])


class EntryInputSchema(BaseModel):
    account_id: str
    amount: Decimal
    entry_type: str
    memo: str = ""

    @field_validator("entry_type")
    @classmethod
    def validate_entry_type(cls, v):
        if v not in ("debit", "credit"):
            raise ValueError("entry_type은 'debit' 또는 'credit'이어야 합니다.")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("금액은 0보다 커야 합니다.")
        return v


class TransactionCreate(BaseModel):
    date: datetime
    description: str
    entries: list[EntryInputSchema]
    reference: str = ""


class SimpleTransactionCreate(BaseModel):
    date: datetime
    description: str
    from_account_id: str
    to_account_id: str
    amount: Decimal
    memo: str = ""

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("금액은 0보다 커야 합니다.")
        return v


class EntryResponse(BaseModel):
    id: str
    account_id: str
    account_name: str
    amount: Decimal
    entry_type: str
    memo: str


class TransactionResponse(BaseModel):
    id: str
    date: datetime
    description: str
    reference: str
    entries: list[EntryResponse]
    created_at: datetime


def _build_responses(journals: list[Journal], db: Session) -> list[TransactionResponse]:
    """N+1 없이 account명을 한 번에 JOIN해서 응답 빌드."""
    if not journals:
        return []

    journal_ids = [j.id for j in journals]
    rows = (
        db.query(JournalEntry, Account.name)
        .join(Account, Account.id == JournalEntry.account_id)
        .filter(JournalEntry.journal_id.in_(journal_ids))
        .all()
    )

    entries_by_journal: dict[str, list[EntryResponse]] = {}
    for entry, account_name in rows:
        entries_by_journal.setdefault(entry.journal_id, []).append(
            EntryResponse(
                id=entry.id,
                account_id=entry.account_id,
                account_name=account_name,
                amount=Decimal(str(entry.amount)),
                entry_type=entry.entry_type,
                memo=entry.memo or "",
            )
        )

    return [
        TransactionResponse(
            id=j.id,
            date=j.date,
            description=j.description,
            reference=j.reference or "",
            entries=entries_by_journal.get(j.id, []),
            created_at=j.created_at,
        )
        for j in journals
    ]


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(
    limit: int = 50,
    offset: int = 0,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    journals = (
        db.query(Journal)
        .filter(Journal.household_id == household_id)
        .order_by(Journal.date.desc(), Journal.created_at.desc())
        .offset(offset).limit(limit).all()
    )
    return _build_responses(journals, db)


@router.post("/simple", response_model=TransactionResponse, status_code=201)
def create_simple_transaction(
    body: SimpleTransactionCreate,
    current_user: User = Depends(get_current_user),
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    from_acc = db.query(Account).filter(
        Account.id == body.from_account_id, Account.household_id == household_id
    ).first()
    to_acc = db.query(Account).filter(
        Account.id == body.to_account_id, Account.household_id == household_id
    ).first()

    if not from_acc or not to_acc:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

    entries = [
        EntryInput(account_id=body.from_account_id, amount=body.amount, entry_type="credit", memo=body.memo),
        EntryInput(account_id=body.to_account_id, amount=body.amount, entry_type="debit", memo=body.memo),
    ]

    try:
        journal = post_journal(
            db=db, date=body.date, description=body.description, entries=entries,
            household_id=household_id, created_by=current_user.id,
        )
    except LedgerError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _build_responses([journal], db)[0]


@router.post("/advanced", response_model=TransactionResponse, status_code=201)
def create_advanced_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    account_ids = list({e.account_id for e in body.entries})
    valid_ids = {
        row.id for row in db.query(Account.id).filter(
            Account.id.in_(account_ids),
            Account.household_id == household_id,
        ).all()
    }
    if len(valid_ids) < len(account_ids):
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

    entries = [
        EntryInput(account_id=e.account_id, amount=e.amount, entry_type=e.entry_type, memo=e.memo)
        for e in body.entries
    ]
    try:
        journal = post_journal(
            db=db, date=body.date, description=body.description,
            entries=entries, reference=body.reference,
            household_id=household_id, created_by=current_user.id,
        )
    except LedgerError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _build_responses([journal], db)[0]


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: str,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    journal = db.query(Journal).filter(
        Journal.id == transaction_id, Journal.household_id == household_id
    ).first()
    if not journal:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")
    return _build_responses([journal], db)[0]
