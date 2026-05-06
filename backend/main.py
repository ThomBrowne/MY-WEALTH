from pathlib import Path
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from dotenv import load_dotenv

    _env = Path(__file__).parent / ".env"
    if not _env.exists():
        _env = Path(__file__).parent.parent / ".env"
    load_dotenv(_env)
except ImportError:
    pass

from db.database import init_database
from api.router import include_api_routes

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

include_api_routes(app)


@app.get("/")
def root():
    return {"status": "ok", "message": "Finance Platform API v0.2.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
