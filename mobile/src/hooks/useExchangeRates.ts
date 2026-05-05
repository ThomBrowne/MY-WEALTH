import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface RatesResponse {
  base: string;
  rates: Record<string, number>;
  updated_at: string | null;
}

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<RatesResponse>('/currencies/rates')
      .then((res) => setRates(res.data.rates))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toKRW = (amount: number, currency: string): number => {
    if (currency === 'KRW') return amount;
    const key = `${currency.toUpperCase()}_TO_KRW`;
    return amount * (rates[key] ?? 1);
  };

  const formatFx = (amount: number, currency: string): string => {
    if (currency === 'KRW') {
      return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
    }
    const sym: Record<string, string> = { USD: '$', EUR: '€', JPY: '¥', GBP: '£', CNY: '¥' };
    const prefix = sym[currency.toUpperCase()] ?? currency + ' ';
    return `${prefix}${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };

  return { rates, loading, toKRW, formatFx };
}
