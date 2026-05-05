import { ParsedCardSms } from './types';

const CARD_NAMES = [
  '신한카드', 'KB국민카드', '국민카드', '삼성카드', '현대카드',
  '하나카드', '롯데카드', '우리카드', 'BC카드', 'NH농협카드',
  '농협카드', 'IBK기업카드', '씨티카드', '카카오페이', '토스뱅크',
];

export function isCardSms(text: string): boolean {
  return CARD_NAMES.some(k => text.includes(k)) && text.includes('승인');
}

export function parseCardSms(text: string, id: string, date: number): ParsedCardSms | null {
  if (!isCardSms(text)) return null;

  // 금액: 첫 번째 숫자+원 패턴
  const amountMatch = text.match(/([0-9,]+)원/);
  if (!amountMatch) return null;
  const amount = parseInt(amountMatch[1].replace(/,/g, ''), 10);
  if (!amount || amount <= 0) return null;

  // 카드사명
  const bracketMatch = text.match(/\[([^\]]+)\]/);
  const cardName = bracketMatch?.[1] ?? (CARD_NAMES.find(k => text.includes(k)) ?? '카드');

  // 가맹점: 노이즈 제거 후 남은 첫 단어
  const cleaned = text
    .replace(/\[[^\]]+\]/g, '')             // [카드명]
    .replace(/[0-9,]+원[^\s]*/g, '')        // 금액
    .replace(/[0-9]{4}-[0-9*\-]{4,}/g, '') // 카드번호
    .replace(/승인|일시불|취소|결제|잔액\S*/g, '')
    .replace(/[0-9]+개월/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && /[가-힣A-Za-z]/.test(w));
  const merchant = words[0] ?? '알 수 없음';

  return { id, amount, merchant, cardName, rawText: text, date };
}
