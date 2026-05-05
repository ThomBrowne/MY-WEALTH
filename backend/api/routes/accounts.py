from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.accounts import init_default_accounts
from core.auth import get_household_id
from core.ledger import create_opening_balance, get_account_balance, LedgerError
from core.models import Account, AccountType, AccountCategory
from db.database import get_db

router = APIRouter(prefix="/accounts", tags=["accounts"])


class AccountCreate(BaseModel):
    name: str
    account_type: AccountType
    category: AccountCategory
    currency: str = "KRW"
    description: Optional[str] = None
    opening_balance: Optional[Decimal] = None


class AccountResponse(BaseModel):
    id: str
    name: str
    account_type: AccountType
    category: AccountCategory
    currency: str
    description: Optional[str]
    is_active: bool
    balance: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


def _to_response(acc: Account, db: Session) -> AccountResponse:
    return AccountResponse(
        id=acc.id,
        name=acc.name,
        account_type=acc.account_type,
        category=acc.category,
        currency=acc.currency,
        description=acc.description,
        is_active=acc.is_active,
        balance=get_account_balance(db, acc.id),
        created_at=acc.created_at,
    )


@router.get("/", response_model=list[AccountResponse])
def list_accounts(
    account_type: Optional[AccountType] = None,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    init_default_accounts(db, household_id)
    q = db.query(Account).filter(Account.household_id == household_id, Account.is_active == True)
    if account_type:
        q = q.filter(Account.account_type == account_type)
    return [_to_response(acc, db) for acc in q.order_by(Account.account_type, Account.name).all()]


@router.post("/", response_model=AccountResponse, status_code=201)
def create_account(
    body: AccountCreate,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    account = Account(
        id=str(uuid4()),
        household_id=household_id,
        name=body.name,
        account_type=body.account_type,
        category=body.category,
        currency=body.currency,
        description=body.description,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    if body.opening_balance and body.opening_balance > 0:
        try:
            create_opening_balance(db, account.id, body.opening_balance, datetime.now(UTC))
        except LedgerError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return _to_response(account, db)


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: str,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    account = db.query(Account).filter(
        Account.id == account_id, Account.household_id == household_id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")
    return _to_response(account, db)
