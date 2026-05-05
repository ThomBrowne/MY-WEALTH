import { useState, useCallback } from 'react';
import { dashboardApi, DashboardSummary, RecentTransaction } from '../services/api';

interface BreakdownItem {
  category: string;
  amount: number;
  percentage: number;
}

interface DashboardState {
  summary: DashboardSummary | null;
  recent: RecentTransaction[];
  breakdown: BreakdownItem[];
  loading: boolean;
  refreshing: boolean;
  error: string;
}

export function useDashboard() {
  const [state, setState] = useState<DashboardState>({
    summary: null,
    recent: [],
    breakdown: [],
    loading: true,
    refreshing: false,
    error: '',
  });

  const load = useCallback(async (isRefresh = false) => {
    setState((s) => ({ ...s, refreshing: isRefresh, loading: !isRefresh }));
    try {
      const [s, r, b] = await Promise.all([
        dashboardApi.getSummary(),
        dashboardApi.getRecentTransactions(5),
        dashboardApi.getAssetsBreakdown(),
      ]);
      setState({
        summary: s.data,
        recent: r.data,
        breakdown: b.data.breakdown,
        loading: false,
        refreshing: false,
        error: '',
      });
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        refreshing: false,
        error: '서버에 연결할 수 없습니다.\n백엔드 서버를 확인하세요.',
      }));
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  return { ...state, load, refresh };
}
