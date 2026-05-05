from pathlib import Path
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# .env 로드 — backend/.env 우선, 없으면 상위 trading/.env
try:
    from dotenv import load_dotenv
    _env = Path(__file__).parent / ".env"
    if not _env.exists():
        _env = Path(__file__).parent.parent / ".env"
    load_dotenv(_env)
except ImportError:
    pass

from db.database import init_database
from api.routes import accounts, transactions, dashboard, investments, classify, budget, receipts, currencies, advisor, auth, households

init_database()


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "*").strip()
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]

app = FastAPI(
    title="Finance Platform API",
    description="복식부기 기반 개인 재무 관리 플랫폼",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(households.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(investments.router, prefix="/api/v1")
app.include_router(classify.router, prefix="/api/v1")
app.include_router(budget.router, prefix="/api/v1")
app.include_router(receipts.router, prefix="/api/v1")
app.include_router(currencies.router, prefix="/api/v1")
app.include_router(advisor.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"status": "ok", "message": "Finance Platform API v0.2.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
