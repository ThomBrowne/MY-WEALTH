export const COLORS = {
  // Claude warm coral-orange palette
  primary: '#C96442',
  primaryLight: '#EDCCC0',
  primaryMid: '#D99480',
  primaryDark: '#1C1713',
  primaryDarker: '#8B3E25',

  success: '#2A7A50',
  successBg: '#EDF7F2',
  danger: '#B83232',
  dangerBg: '#FDECEA',
  info: '#2B5FA0',
  infoBg: '#EBF2FA',

  // Warm typography
  text: '#1C1713',
  textMuted: '#6B5E54',
  textLight: '#9C8E86',
  textInverse: '#FAF9F7',

  // Claude warm cream surfaces
  bg: '#FAF9F7',
  surface: '#FFFFFF',
  border: '#E5DED6',
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: '자산',
  liability: '부채',
  equity: '자본',
  revenue: '수익',
  expense: '비용',
};

export const CATEGORY_LABELS: Record<string, string> = {
  bank: '은행',
  cash: '현금',
  investment: '주식',
  crypto: '암호화폐',
  real_estate: '부동산',
  other_asset: '기타 자산',
  credit_card: '신용카드',
  loan: '대출금',
  mortgage: '담보대출',
  other_liability: '기타 부채',
  salary: '급여',
  investment_income: '투자수익',
  business_income: '사업수익',
  other_revenue: '기타수익',
  food: '식비',
  transport: '교통비',
  housing: '주거비',
  entertainment: '여가',
  health: '의료',
  education: '교육',
  shopping: '쇼핑',
  other_expense: '기타지출',
};

export const INSIGHT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  positive: { bg: COLORS.successBg, border: COLORS.success, text: COLORS.success },
  warning:  { bg: COLORS.dangerBg,  border: COLORS.danger,  text: COLORS.danger  },
  tip:      { bg: COLORS.infoBg,    border: COLORS.info,    text: COLORS.info    },
};

export const KRW = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

export function formatAmount(amount: number, currency = 'KRW'): string {
  if (currency === 'KRW') return KRW.format(amount);
  return `$${amount.toLocaleString()}`;
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
