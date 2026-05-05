"""
영수증 이미지 → 거래 데이터 자동 추출 (Claude Vision API)
"""
import base64
import json
import os
import re
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter(prefix="/receipts", tags=["receipts"])

SUPPORTED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_SIZE_MB = 5


class ReceiptScanResult(BaseModel):
    merchant: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    items: list[str] = []
    confidence: float = 0.0
    raw_text: Optional[str] = None


CATEGORY_MAP = {
    "food": "식비",
    "transport": "교통비",
    "shopping": "쇼핑",
    "health": "의료/건강",
    "education": "교육",
    "entertainment": "여가/문화",
    "housing": "주거비",
    "other_expense": "기타지출",
}

PROMPT = """이 영수증 이미지를 분석해서 다음 JSON을 반환하세요. JSON만 반환하고 다른 텍스트는 없어야 합니다.

{
  "merchant": "상점/업체명 (없으면 null)",
  "amount": 최종 결제 금액 숫자만 (원화 기준, 없으면 null),
  "date": "YYYY-MM-DD 형식 날짜 (없으면 null)",
  "category": "food|transport|shopping|health|education|entertainment|housing|other_expense 중 가장 적합한 것",
  "description": "한 줄 거래 설명 (상점명 + 주요 내용, 20자 이내)",
  "items": ["주요 품목 최대 3개 리스트"],
  "confidence": 0.0~1.0 사이 추출 신뢰도
}

분석 기준:
- amount: 합계/결제금액/total 항목의 숫자 (원화 단위)
- category: 음식점/카페=food, 대중교통/주유=transport, 마트/편의점/쇼핑몰=shopping, 병원/약국=health
- confidence: 영수증이 명확하면 0.9, 흐리거나 부분만 보이면 0.5 이하"""


def _extract_json(text: str) -> dict:
    """LLM 응답에서 JSON 추출 (마크다운 코드블록 처리)"""
    text = text.strip()
    # ```json ... ``` 블록 제거
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        text = match.group(1)
    return json.loads(text)


@router.post("/scan", response_model=ReceiptScanResult)
async def scan_receipt(file: UploadFile = File(...)):
    """영수증 이미지 업로드 → Claude Vision으로 거래 데이터 추출"""

    if file.content_type not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"지원 형식: jpeg, png, gif, webp. 현재: {file.content_type}",
        )

    image_data = await file.read()
    if len(image_data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"파일 크기가 {MAX_SIZE_MB}MB를 초과합니다.")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.",
        )

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        image_b64 = base64.standard_b64encode(image_data).decode()

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": file.content_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": PROMPT},
                    ],
                }
            ],
        )

        raw = message.content[0].text
        data = _extract_json(raw)

        return ReceiptScanResult(
            merchant=data.get("merchant"),
            amount=float(data["amount"]) if data.get("amount") is not None else None,
            date=data.get("date"),
            category=data.get("category", "other_expense"),
            description=data.get("description"),
            items=data.get("items", []),
            confidence=float(data.get("confidence", 0.7)),
            raw_text=raw,
        )

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"AI 응답 파싱 실패: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"영수증 스캔 실패: {e}")
