import os
from datetime import datetime, timedelta, UTC
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from db.database import get_db
from core.models import User, HouseholdMember

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-before-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(UTC) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "access"}, SECRET_KEY, ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "refresh"}, SECRET_KEY, ALGORITHM)


def _decode_token(token: str, expected_type: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            raise HTTPException(status_code=401, detail="토큰 타입이 잘못되었습니다.")
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 만료되었거나 유효하지 않습니다.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    user_id = _decode_token(credentials.credentials, "access")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


def get_household_id(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> str:
    member = db.query(HouseholdMember).filter(
        HouseholdMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="먼저 가계부를 생성하거나 참여해야 합니다.")
    return member.household_id


def decode_refresh_token(token: str) -> str:
    return _decode_token(token, "refresh")
