"""
자동 분류 Rule Engine
거래 설명(description)을 보고 적합한 to_account 카테고리를 추천한다.
"""
import re
from dataclasses import dataclass
from core.models import AccountCategory

@dataclass
class ClassifyResult:
    category: AccountCategory
    confidence: float  # 0.0 ~ 1.0
    matched_rule: str


_RULES: list[tuple[list[str], AccountCategory, str]] = [
    # 식비
    (["편의점", "cj", "gs25", "seven", "세븐", "이마트24", "식당", "음식", "카페", "스타벅스",
      "맥도날드", "버거킹", "롯데리아", "kfc", "배달", "요기요", "배민", "쿠팡이츠",
      "점심", "저녁", "아침", "식비", "커피", "베이커리"], AccountCategory.FOOD, "식비"),

    # 교통
    (["지하철", "버스", "택시", "카카오택시", "t-money", "티머니", "교통", "ktx", "srt",
      "기차", "항공", "주차", "톨게이트", "하이패스"], AccountCategory.TRANSPORT, "교통비"),

    # 쇼핑
    (["쿠팡", "11번가", "g마켓", "옥션", "네이버쇼핑", "올리브영", "다이소", "이케아",
      "코스트코", "walmart", "amazon", "무신사", "쇼핑", "구매", "주문"], AccountCategory.SHOPPING, "쇼핑"),

    # 의료/건강
    (["병원", "약국", "의원", "클리닉", "헬스", "gym", "피트니스", "건강", "치과",
      "안과", "약", "medical", "health"], AccountCategory.HEALTH, "의료/건강"),

    # 교육
    (["학원", "수강", "교육", "강의", "유데미", "udemy", "coursera", "책", "교재",
      "학습", "tuition", "education"], AccountCategory.EDUCATION, "교육"),

    # 여가/문화
    (["영화", "cgv", "롯데시네마", "메가박스", "넷플릭스", "유튜브", "스포티파이",
      "게임", "steam", "놀이", "여행", "호텔", "숙박", "콘서트", "공연"], AccountCategory.ENTERTAINMENT, "여가/문화"),

    # 주거
    (["월세", "관리비", "전기", "가스", "수도", "인터넷", "통신", "핸드폰", "kt",
      "skt", "lg유플러스", "통신비", "주거"], AccountCategory.HOUSING, "주거비"),

    # 급여/수익
    (["급여", "월급", "salary", "payroll", "보너스", "상여"], AccountCategory.SALARY, "급여"),
    (["투자수익", "배당", "dividend", "이자수입", "이자"], AccountCategory.INVESTMENT_INCOME, "투자수익"),

    # 투자
    (["주식", "etf", "펀드", "코인", "비트코인", "매수", "매도", "증권"], AccountCategory.INVESTMENT, "투자"),
]


def classify(description: str) -> ClassifyResult | None:
    """
    거래 설명을 보고 카테고리를 추론한다.
    매칭되지 않으면 None 반환.
    """
    desc_lower = description.lower().strip()

    for keywords, category, rule_name in _RULES:
        for kw in keywords:
            if kw.lower() in desc_lower:
                # 정확히 포함되면 confidence 0.85, 부분 매칭이면 0.7
                confidence = 0.9 if kw.lower() == desc_lower else 0.75
                return ClassifyResult(
                    category=category,
                    confidence=confidence,
                    matched_rule=rule_name,
                )

    return None


def classify_batch(descriptions: list[str]) -> list[ClassifyResult | None]:
    return [classify(d) for d in descriptions]
