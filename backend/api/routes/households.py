import random
import string
from datetime import datetime, UTC
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.auth import get_current_user, get_household_id
from core.accounts import init_default_accounts
from core.models import User, Household, HouseholdMember, Account, Journal
from db.database import get_db

router = APIRouter(prefix="/households", tags=["households"])


def _gen_invite_code(db: Session) -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(chars, k=6))
        if not db.query(Household).filter(Household.invite_code == code).first():
            return code


class HouseholdCreate(BaseModel):
    name: str


class HouseholdResponse(BaseModel):
    id: str
    name: str
    invite_code: str
    members: list[dict]


class JoinRequest(BaseModel):
    invite_code: str


@router.post("/", response_model=HouseholdResponse, status_code=201)
def create_household(
    body: HouseholdCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 이미 가계부에 속해 있으면 거부
    existing = db.query(HouseholdMember).filter(HouseholdMember.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 가계부에 속해 있습니다.")

    household = Household(
        id=str(uuid4()),
        name=body.name.strip(),
        invite_code=_gen_invite_code(db),
    )
    db.add(household)
    db.flush()

    member = HouseholdMember(
        id=str(uuid4()),
        household_id=household.id,
        user_id=current_user.id,
        role="admin",
    )
    db.add(member)

    db.commit()
    db.refresh(household)

    # 기본 계정 생성 (없으면)
    init_default_accounts(db, household.id)

    return _household_response(household, db)


@router.get("/me", response_model=HouseholdResponse)
def get_my_household(
    household_id: str = Depends(get_household_id),
    db: Session = Depends(get_db),
):
    household = db.query(Household).filter(Household.id == household_id).first()
    return _household_response(household, db)


@router.post("/join", response_model=HouseholdResponse)
def join_household(
    body: JoinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(HouseholdMember).filter(HouseholdMember.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 가계부에 속해 있습니다.")

    household = db.query(Household).filter(
        Household.invite_code == body.invite_code.upper().strip()
    ).first()
    if not household:
        raise HTTPException(status_code=404, detail="초대 코드가 유효하지 않습니다.")

    member_count = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household.id
    ).count()
    if member_count >= 5:
        raise HTTPException(status_code=400, detail="가계부 정원(5명)이 초과되었습니다.")

    db.add(HouseholdMember(
        id=str(uuid4()),
        household_id=household.id,
        user_id=current_user.id,
        role="member",
    ))
    db.commit()

    return _household_response(household, db)


@router.post("/regenerate-invite")
def regenerate_invite(
    household_id: str = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == current_user.id,
        HouseholdMember.role == "admin",
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="관리자만 초대 코드를 변경할 수 있습니다.")

    household = db.query(Household).filter(Household.id == household_id).first()
    household.invite_code = _gen_invite_code(db)
    db.commit()
    return {"invite_code": household.invite_code}


def _household_response(household: Household, db: Session) -> HouseholdResponse:
    members = db.query(HouseholdMember, User).join(
        User, User.id == HouseholdMember.user_id
    ).filter(HouseholdMember.household_id == household.id).all()

    return HouseholdResponse(
        id=household.id,
        name=household.name,
        invite_code=household.invite_code,
        members=[
            {"id": u.id, "name": u.name, "email": u.email, "role": m.role}
            for m, u in members
        ],
    )
