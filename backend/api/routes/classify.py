from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.rules import classify
from core.auth import get_household_id
from core.models import Account
from db.database import get_db

router = APIRouter(prefix="/classify", tags=["classify"])


class ClassifyRequest(BaseModel):
    description: str


class ClassifyResponse(BaseModel):
    description: str
    suggested_category: str | None
    suggested_account_id: str | None
    suggested_account_name: str | None
    confidence: float


@router.post("/", response_model=ClassifyResponse)
def classify_transaction(
    body: ClassifyRequest,
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    """거래 설명 → 자동 계정 분류 추천"""
    result = classify(body.description)

    if result is None:
        return ClassifyResponse(
            description=body.description,
            suggested_category=None,
            suggested_account_id=None,
            suggested_account_name=None,
            confidence=0.0,
        )

    account = db.query(Account).filter(
        Account.household_id == household_id,
        Account.category == result.category,
        Account.is_active == True,
    ).first()

    return ClassifyResponse(
        description=body.description,
        suggested_category=result.category.value,
        suggested_account_id=account.id if account else None,
        suggested_account_name=account.name if account else None,
        confidence=result.confidence,
    )


@router.post("/batch")
def classify_batch_transactions(
    bodies: list[ClassifyRequest],
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    return [classify_transaction(b, household_id, db) for b in bodies]
