/**
 * 날짜 포맷 유틸리티 - 앱 전체에서 일관된 날짜 표시
 */

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 거래 내역 섹션 헤더용 날짜 문자열
 * - 오늘 → "오늘"
 * - 어제 → "어제"
 * - 7일 이내 → "화요일"
 * - 이전 → "4월 15일 (화)"
 */
export function formatDateHeader(date: Date): string {
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today))     return '오늘';
  if (sameDay(date, yesterday)) return '어제';

  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) return `${DAY_KO[date.getDay()]}요일`;

  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_KO[date.getDay()]})`;
}

/**
 * 짧은 날짜 표시: "4/15"
 */
export function formatShortDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
