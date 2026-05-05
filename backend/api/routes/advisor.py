"""
AI 재무 코치 — Claude를 활용한 재무 분석 및 채팅
"""
import os
from pathlib import Path
from datetime import datetime, UTC
from decimal import Decimal

_ENV_FILE = Path(__file__).resolve().parent.parent.parent.parent / ".env"


def _get_api_key() -> str:
    """환경변수 우선, 없으면 .env 파일에서 직접 읽기."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if key:
        return key
    if _ENV_FILE.exists():
        for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip()
    return ""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from core.ledger import get_net_worth, get_balances_by_category, sum_entries_since
from core.models import AccountType, Account, Journal, JournalEntry

router = APIRouter(prefix="/advisor", tags=["advisor"])


def _build_finance_context(db: Session) -> dict:
    """현재 재무 스냅샷을 딕셔너리로 반환."""
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    nw = get_net_worth(db)
    month_revenue = sum_entries_since(db, AccountType.REVENUE, month_start)
    month_expense = sum_entries_since(db, AccountType.EXPENSE, month_start)
    category_balances = get_balances_by_category(db, AccountType.ASSET)

    # 최근 10개 거래
    journals = (
        db.query(Journal)
        .order_by(Journal.date.desc())
        .limit(10)
        .all()
    )
    recent_txs = [{"date": j.date.strftime("%m/%d"), "desc": j.description} for j in journals]

    # 지출 카테고리별 이번 달 합계
    expense_accounts = (
        db.query(Account)
        .filter(Account.account_type == AccountType.EXPENSE, Account.is_active == True)
        .all()
    )
    from sqlalchemy import func
    expense_by_cat: dict[str, float] = {}
    for acc in expense_accounts:
        result = (
            db.query(func.sum(JournalEntry.amount))
            .join(Journal, Journal.id == JournalEntry.journal_id)
            .filter(
                JournalEntry.account_id == acc.id,
                JournalEntry.entry_type == "debit",
                Journal.date >= month_start,
            ).scalar()
        )
        if result:
            expense_by_cat[acc.category] = expense_by_cat.get(acc.category, 0) + float(result)

    savings_rate = 0.0
    if month_revenue > 0:
        savings_rate = round(float((month_revenue - month_expense) / month_revenue) * 100, 1)

    return {
        "net_worth": float(nw["net_worth"]),
        "assets": float(nw["assets"]),
        "liabilities": float(nw["liabilities"]),
        "this_month": {
            "revenue": float(month_revenue),
            "expense": float(month_expense),
            "savings": float(month_revenue - month_expense),
            "savings_rate": savings_rate,
        },
        "asset_breakdown": {k: float(v) for k, v in category_balances.items() if v > 0},
        "expense_breakdown": expense_by_cat,
        "recent_transactions": recent_txs,
        "as_of": now.strftime("%Y년 %m월 %d일"),
    }


def _format_krw(amount: float) -> str:
    return f"₩{amount:,.0f}"


def _build_system_prompt(ctx: dict) -> str:
    lines = [
        "당신은 친절하고 통찰력 있는 한국어 개인 재무 코치입니다.",
        "아래는 사용자의 현재 재무 현황입니다. 이 데이터를 기반으로 구체적이고 실용적인 조언을 하세요.",
        "",
        f"[재무 현황 — {ctx['as_of']}]",
        f"- 순자산: {_format_krw(ctx['net_worth'])} (자산 {_format_krw(ctx['assets'])}, 부채 {_format_krw(ctx['liabilities'])})",
        f"- 이번 달 수익: {_format_krw(ctx['this_month']['revenue'])}",
        f"- 이번 달 지출: {_format_krw(ctx['this_month']['expense'])}",
        f"- 이번 달 저축: {_format_krw(ctx['this_month']['savings'])} (저축률 {ctx['this_month']['savings_rate']}%)",
        "",
    ]

    if ctx["asset_breakdown"]:
        lines.append("[자산 구성]")
        for cat, amt in ctx["asset_breakdown"].items():
            lines.append(f"  - {cat}: {_format_krw(amt)}")
        lines.append("")

    if ctx["expense_breakdown"]:
        lines.append("[이번 달 카테고리별 지출]")
        for cat, amt in ctx["expense_breakdown"].items():
            lines.append(f"  - {cat}: {_format_krw(amt)}")
        lines.append("")

    if ctx["recent_transactions"]:
        lines.append("[최근 거래]")
        for tx in ctx["recent_transactions"][:5]:
            lines.append(f"  - {tx['date']}: {tx['desc']}")
        lines.append("")

    lines += [
        "답변 지침:",
        "- 한국어로 간결하게 답변하세요 (3-5문장 권장).",
        "- 구체적인 수치를 인용하며 실질적인 조언을 주세요.",
        "- 마크다운 헤더(#)는 사용하지 마세요. 필요하면 **굵게**만 사용하세요.",
        "- 긍정적이지만 솔직하게 이야기하세요.",
    ]

    return "\n".join(lines)


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
    context_snapshot: dict


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db)):
    """Claude와 재무 데이터 기반 채팅."""
    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic 패키지가 설치되지 않았습니다.")

    api_key = _get_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY가 설정되지 않았습니다.")

    ctx = _build_finance_context(db)
    system_prompt = _build_system_prompt(ctx)

    client = anthropic.Anthropic(api_key=api_key)

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )

    reply = response.content[0].text
    return ChatResponse(reply=reply, context_snapshot=ctx)


class InsightsResponse(BaseModel):
    insights: list[dict]


@router.get("/insights", response_model=InsightsResponse)
def get_insights(db: Session = Depends(get_db)):
    """재무 데이터를 분석해 자동 인사이트 3개를 반환."""
    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic 패키지가 설치되지 않았습니다.")

    api_key = _get_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY가 설정되지 않았습니다.")

    ctx = _build_finance_context(db)

    prompt = f"""아래 재무 데이터를 분석해 인사이트 정확히 3개를 JSON으로 반환하세요.

데이터:
- 순자산: {_format_krw(ctx['net_worth'])}
- 이번 달 수익: {_format_krw(ctx['this_month']['revenue'])}
- 이번 달 지출: {_format_krw(ctx['this_month']['expense'])}
- 저축률: {ctx['this_month']['savings_rate']}%
- 지출 내역: {ctx['expense_breakdown']}

응답 형식 (JSON만, 다른 텍스트 없이):
[
  {{"type": "positive|warning|tip", "icon": "이모지1개", "title": "짧은제목", "body": "1-2문장설명"}},
  {{"type": "positive|warning|tip", "icon": "이모지1개", "title": "짧은제목", "body": "1-2문장설명"}},
  {{"type": "positive|warning|tip", "icon": "이모지1개", "title": "짧은제목", "body": "1-2문장설명"}}
]

type 선택 기준:
- positive: 잘하고 있는 점
- warning: 주의가 필요한 점
- tip: 개선 제안
"""

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = response.content[0].text.strip()
    # JSON 블록 추출
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    try:
        insights = json.loads(text)
    except json.JSONDecodeError:
        insights = [
            {"type": "tip", "icon": "💡", "title": "재무 데이터 분석 중", "body": "충분한 거래 데이터가 쌓이면 맞춤 인사이트를 받을 수 있어요."},
        ]

    return InsightsResponse(insights=insights)
