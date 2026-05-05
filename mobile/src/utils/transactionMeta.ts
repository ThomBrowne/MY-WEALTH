/**
 * 거래 분류 유틸리티
 *
 * 거래 entry를 분석해 카테고리 아이콘, 타입(수입/지출/이체), 표시 레이블을 결정합니다.
 * TransactionHistoryScreen과 DashboardScreen에서 공통으로 사용합니다.
 */

import type { Transaction } from '../services/api';

export type TxType = 'income' | 'expense' | 'transfer';

export interface TxMeta {
  type:      TxType;
  icon:      string;
  label:     string;   // 표시할 계정/카테고리명
  amount:    number;
  filterKey: string;   // FILTERS 배열의 key와 매칭
}

// 수입으로 분류되는 계정 키워드
const INCOME_KEYWORDS = [
  '급여', '수익', '이자', '배당', '사업수익', '매출', 'salary', 'revenue',
];

// 카테고리별 아이콘 + 필터 키 매핑
const ICON_MAP: Array<{ keys: string[]; icon: string; filterKey: string }> = [
  { keys: ['식비', '식사', '음식', '카페', '편의점', '배달', 'food'],         icon: '🍽',  filterKey: 'food'          },
  { keys: ['교통', '버스', '지하철', '택시', '주유', '주차', 'transport'],    icon: '🚌',  filterKey: 'transport'     },
  { keys: ['쇼핑', '의류', '마트', '온라인', 'shopping'],                     icon: '🛍',  filterKey: 'shopping'      },
  { keys: ['의료', '병원', '약국', '헬스'],                                   icon: '🏥',  filterKey: 'health'        },
  { keys: ['주거', '월세', '관리비', '공과금'],                               icon: '🏠',  filterKey: 'housing'       },
  { keys: ['교육', '학원', '도서', '강의'],                                   icon: '📚',  filterKey: 'education'     },
  { keys: ['여가', '취미', '영화', '게임', '여행'],                           icon: '🎬',  filterKey: 'entertainment'  },
  { keys: ['투자', '주식', '펀드', '코인', 'investment'],                     icon: '📈',  filterKey: 'investment'    },
];

export function getTxMeta(tx: Transaction): TxMeta {
  const debit  = tx.entries.find((e) => e.entry_type === 'debit');
  const credit = tx.entries.find((e) => e.entry_type === 'credit');
  const debitName  = debit?.account_name  ?? '';
  const creditName = credit?.account_name ?? '';
  const amount  = debit?.amount ?? 0;
  const allText = `${debitName} ${creditName} ${tx.description}`.toLowerCase();

  // 1. 수입: credit 계정이 수익 계정
  if (INCOME_KEYWORDS.some((k) => creditName.toLowerCase().includes(k))) {
    return { type: 'income', icon: '💰', label: creditName, amount, filterKey: 'salary' };
  }

  // 2. 지출: 카테고리 키워드 매칭
  for (const { keys, icon, filterKey } of ICON_MAP) {
    if (keys.some((k) => allText.includes(k))) {
      return { type: 'expense', icon, label: debitName || creditName, amount, filterKey };
    }
  }

  // 3. 이체 or 기타 지출
  const isTransfer = Boolean(debitName && creditName && debitName !== creditName);
  return {
    type:      isTransfer ? 'transfer' : 'expense',
    icon:      isTransfer ? '↔️' : '💸',
    label:     isTransfer ? `${creditName} → ${debitName}` : (debitName || creditName),
    amount,
    filterKey: 'other',
  };
}
