from datetime import datetime, UTC
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Numeric, DateTime, ForeignKey,
    Enum, Text, Boolean, Integer, CheckConstraint
)
from sqlalchemy.orm import relationship

from db.database import Base


# ── 인증 / 가계부 공유 ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)

    memberships = relationship("HouseholdMember", back_populates="user")


class Household(Base):
    __tablename__ = "households"

    id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    invite_code = Column(String(8), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    watchlist_tickers = Column(Text, nullable=True)  # JSON array 문자열

    members = relationship("HouseholdMember", back_populates="household")


class HouseholdMember(Base):
    __tablename__ = "household_members"

    id = Column(String(36), primary_key=True)
    household_id = Column(String(36), ForeignKey("households.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    role = Column(String(10), nullable=False, default="member")  # admin | member
    joined_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)

    household = relationship("Household", back_populates="members")
    user = relationship("User", back_populates="memberships")


class AccountType(str, PyEnum):
    ASSET = "asset"           # 자산 (차변 증가)
    LIABILITY = "liability"   # 부채 (대변 증가)
    EQUITY = "equity"         # 자본 (대변 증가)
    REVENUE = "revenue"       # 수익 (대변 증가)
    EXPENSE = "expense"       # 비용 (차변 증가)


class AccountCategory(str, PyEnum):
    # 자산
    CASH = "cash"
    BANK = "bank"
    INVESTMENT = "investment"
    REAL_ESTATE = "real_estate"
    CRYPTO = "crypto"
    RECEIVABLE = "receivable"
    OTHER_ASSET = "other_asset"
    # 부채
    CREDIT_CARD = "credit_card"
    LOAN = "loan"
    MORTGAGE = "mortgage"
    OTHER_LIABILITY = "other_liability"
    # 자본
    EQUITY_OPENING = "equity_opening"
    RETAINED_EARNINGS = "retained_earnings"
    # 수익
    SALARY = "salary"
    INVESTMENT_INCOME = "investment_income"
    BUSINESS_INCOME = "business_income"
    OTHER_REVENUE = "other_revenue"
    # 비용
    FOOD = "food"
    TRANSPORT = "transport"
    HOUSING = "housing"
    ENTERTAINMENT = "entertainment"
    HEALTH = "health"
    EDUCATION = "education"
    SHOPPING = "shopping"
    OTHER_EXPENSE = "other_expense"


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True)
    household_id = Column(String(36), ForeignKey("households.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    account_type = Column(Enum(AccountType), nullable=False)
    category = Column(Enum(AccountCategory), nullable=False)
    currency = Column(String(3), default="KRW", nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    entries = relationship("JournalEntry", back_populates="account")


class Journal(Base):
    """거래 묶음 — 항상 차변 합계 == 대변 합계"""
    __tablename__ = "journals"

    id = Column(String(36), primary_key=True)
    household_id = Column(String(36), ForeignKey("households.id"), nullable=True, index=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    date = Column(DateTime, nullable=False)
    description = Column(Text, nullable=False)
    reference = Column(String(100), nullable=True)
    is_balanced = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)

    entries = relationship("JournalEntry", back_populates="journal", cascade="all, delete-orphan")


class JournalEntry(Base):
    """복식부기 개별 항목 — Debit 또는 Credit"""
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True)
    journal_id = Column(String(36), ForeignKey("journals.id"), nullable=False)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    amount = Column(Numeric(20, 4), nullable=False)
    entry_type = Column(String(6), nullable=False)  # "debit" | "credit"
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)

    journal = relationship("Journal", back_populates="entries")
    account = relationship("Account", back_populates="entries")

    __table_args__ = (
        CheckConstraint("amount > 0", name="positive_amount"),
        CheckConstraint("entry_type IN ('debit', 'credit')", name="valid_entry_type"),
    )
