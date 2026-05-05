"""
기본 계정 체계(Chart of Accounts) 초기화
신규 사용자 가입 시 표준 계정들을 자동 생성한다.
"""
from uuid import uuid4
from sqlalchemy.orm import Session

from core.models import Account, AccountType, AccountCategory


DEFAULT_ACCOUNTS = [
    # ── 자산 ──────────────────────────────────────────
    {"name": "현금",           "account_type": AccountType.ASSET,     "category": AccountCategory.CASH},
    {"name": "은행 계좌",       "account_type": AccountType.ASSET,     "category": AccountCategory.BANK},
    {"name": "주식 투자",       "account_type": AccountType.ASSET,     "category": AccountCategory.INVESTMENT},
    {"name": "암호화폐",        "account_type": AccountType.ASSET,     "category": AccountCategory.CRYPTO},
    {"name": "부동산",          "account_type": AccountType.ASSET,     "category": AccountCategory.REAL_ESTATE},
    {"name": "기타 자산",       "account_type": AccountType.ASSET,     "category": AccountCategory.OTHER_ASSET},
    # ── 부채 ──────────────────────────────────────────
    {"name": "신용카드",        "account_type": AccountType.LIABILITY,  "category": AccountCategory.CREDIT_CARD},
    {"name": "대출금",          "account_type": AccountType.LIABILITY,  "category": AccountCategory.LOAN},
    {"name": "주택담보대출",     "account_type": AccountType.LIABILITY,  "category": AccountCategory.MORTGAGE},
    {"name": "기타 부채",       "account_type": AccountType.LIABILITY,  "category": AccountCategory.OTHER_LIABILITY},
    # ── 자본 ──────────────────────────────────────────
    {"name": "초기 자본 (OBE)", "account_type": AccountType.EQUITY,    "category": AccountCategory.EQUITY_OPENING},
    {"name": "이익잉여금",       "account_type": AccountType.EQUITY,    "category": AccountCategory.RETAINED_EARNINGS},
    # ── 수익 ──────────────────────────────────────────
    {"name": "급여",            "account_type": AccountType.REVENUE,   "category": AccountCategory.SALARY},
    {"name": "투자 수익",        "account_type": AccountType.REVENUE,   "category": AccountCategory.INVESTMENT_INCOME},
    {"name": "사업 수익",        "account_type": AccountType.REVENUE,   "category": AccountCategory.BUSINESS_INCOME},
    {"name": "기타 수익",        "account_type": AccountType.REVENUE,   "category": AccountCategory.OTHER_REVENUE},
    # ── 비용 ──────────────────────────────────────────
    {"name": "식비",            "account_type": AccountType.EXPENSE,   "category": AccountCategory.FOOD},
    {"name": "교통비",           "account_type": AccountType.EXPENSE,   "category": AccountCategory.TRANSPORT},
    {"name": "주거비",           "account_type": AccountType.EXPENSE,   "category": AccountCategory.HOUSING},
    {"name": "여가/문화",        "account_type": AccountType.EXPENSE,   "category": AccountCategory.ENTERTAINMENT},
    {"name": "의료/건강",        "account_type": AccountType.EXPENSE,   "category": AccountCategory.HEALTH},
    {"name": "교육비",           "account_type": AccountType.EXPENSE,   "category": AccountCategory.EDUCATION},
    {"name": "쇼핑",            "account_type": AccountType.EXPENSE,   "category": AccountCategory.SHOPPING},
    {"name": "기타 지출",        "account_type": AccountType.EXPENSE,   "category": AccountCategory.OTHER_EXPENSE},
]


def init_default_accounts(db: Session, household_id: str) -> list[Account]:
    """가계부에 계정이 없을 때 기본 계정 체계를 생성한다."""
    existing = db.query(Account).filter(Account.household_id == household_id).count()
    if existing > 0:
        return db.query(Account).filter(Account.household_id == household_id).all()

    accounts = []
    for data in DEFAULT_ACCOUNTS:
        account = Account(
            id=str(uuid4()),
            household_id=household_id,
            name=data["name"],
            account_type=data["account_type"],
            category=data["category"],
            currency="KRW",
        )
        db.add(account)
        accounts.append(account)

    db.commit()
    return accounts


def get_obe_account(db: Session, household_id: str | None = None) -> Account | None:
    """Opening Balance Equity 계정을 반환한다."""
    query = db.query(Account).filter(
        Account.category == AccountCategory.EQUITY_OPENING
    )
    if household_id is not None:
        query = query.filter(Account.household_id == household_id)
    return query.first()
