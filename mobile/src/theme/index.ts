/**
 * 디자인 토큰 - 앱 전체에서 일관된 스타일 기준점
 *
 * 사용법:
 *   import { COLORS, spacing, typography, radius, shadow } from '../theme';
 */

export { COLORS } from '../constants';

// ─── 간격 ────────────────────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
} as const;

// ─── 타이포그래피 ─────────────────────────────────────────────────────────────
export const typography = {
  h1:      { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2:      { fontSize: 22, fontWeight: '700' as const },
  h3:      { fontSize: 18, fontWeight: '700' as const },
  title:   { fontSize: 15, fontWeight: '700' as const },
  body:    { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  small:   { fontSize: 11, fontWeight: '400' as const },
} as const;

// ─── 모서리 반경 ──────────────────────────────────────────────────────────────
export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 9999,
} as const;

// ─── 그림자 (플랫폼 공통) ─────────────────────────────────────────────────────
export const shadow = {
  sm: {
    shadowColor: '#1C1713',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1C1713',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1C1713',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
} as const;
