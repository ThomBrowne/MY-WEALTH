from pathlib import Path
import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_PATH = Path(__file__).resolve().parents[1] / "finance.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_PATH.as_posix()}")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_database():
    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns():
    with engine.begin() as conn:
        inspector = inspect(conn)
        tables = set(inspector.get_table_names())

        if "accounts" in tables:
            account_columns = {col["name"] for col in inspector.get_columns("accounts")}
            if "household_id" not in account_columns:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN household_id VARCHAR(36)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_accounts_household_id ON accounts (household_id)"))

        if "journals" in tables:
            journal_columns = {col["name"] for col in inspector.get_columns("journals")}
            if "household_id" not in journal_columns:
                conn.execute(text("ALTER TABLE journals ADD COLUMN household_id VARCHAR(36)"))
            if "created_by" not in journal_columns:
                conn.execute(text("ALTER TABLE journals ADD COLUMN created_by VARCHAR(36)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_journals_household_id ON journals (household_id)"))

        if "households" in tables:
            hh_columns = {col["name"] for col in inspector.get_columns("households")}
            if "watchlist_tickers" not in hh_columns:
                conn.execute(text("ALTER TABLE households ADD COLUMN watchlist_tickers TEXT"))

        if "budgets" in tables:
            budget_columns = {col["name"] for col in inspector.get_columns("budgets")}
            if "household_id" not in budget_columns:
                conn.execute(text("ALTER TABLE budgets ADD COLUMN household_id VARCHAR(36)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_budgets_household_id ON budgets (household_id)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
