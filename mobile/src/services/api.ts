import axios from 'axios';
import { Platform } from 'react-native';
import { authStorage } from './authStorage';

function getWebApiHost() {
  if (typeof window === 'undefined' || !window.location.hostname) return '127.0.0.1';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1') return '127.0.0.1';
  return host;
}

function normalizeApiBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const BASE_URL = configuredApiBaseUrl
  ? normalizeApiBaseUrl(configuredApiBaseUrl)
  : Platform.OS === 'web'
    ? `http://${getWebApiHost()}:8000/api/v1`
    : 'http://192.168.1.89:8000/api/v1';

const publicApi = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await authStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 강제 로그아웃 콜백 — AuthContext에서 등록
let _forceLogout: (() => void) | null = null;
export function setForceLogoutCallback(cb: () => void) {
  _forceLogout = cb;
}

// 동시 401 race condition 방지 — refresh는 한 번만 실행
let _refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        if (!_refreshPromise) {
          _refreshPromise = (async () => {
            const refresh = await authStorage.getRefreshToken();
            if (!refresh) throw new Error('no refresh token');
            const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
            await authStorage.saveTokens(data.access_token, data.refresh_token);
            return data.access_token as string;
          })().finally(() => { _refreshPromise = null; });
        }
        const newToken = await _refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        _refreshPromise = null;
        await authStorage.clearTokens();
        _forceLogout?.();
      }
    }
    return Promise.reject(error);
  },
);

// ── 타입 ─────────────────────────────────────────────

export interface DashboardSummary {
  net_worth: number;
  assets: number;
  liabilities: number;
  this_month: { revenue: number; expense: number; savings: number };
  updated_at: string;
}

export interface AssetsBreakdown {
  total: number;
  breakdown: Array<{ category: string; amount: number; percentage: number }>;
}

export interface CashflowCategory {
  category: string;
  label: string;
  icon: string;
  amount: number;
}

export interface CashflowData {
  year: number;
  month: number;
  income: CashflowCategory[];
  expense: CashflowCategory[];
  total_income: number;
  total_expense: number;
  net_flow: number;
}

export interface RecentTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  tx_type: 'income' | 'expense' | 'transfer';
}

export interface Account {
  id: string;
  name: string;
  account_type: string;
  category: string;
  currency: string;
  balance: number;
  is_active: boolean;
}

export interface TransactionEntry {
  id: string;
  account_id: string;
  account_name: string;
  amount: number;
  entry_type: string;
  memo: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  reference: string;
  entries: TransactionEntry[];
  created_at: string;
}

export interface SimpleTransactionInput {
  date: string;
  description: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  memo?: string;
}

export interface ClassifyResult {
  description: string;
  suggested_category: string | null;
  suggested_account_id: string | null;
  suggested_account_name: string | null;
  confidence: number;
}

export interface BudgetItem {
  id: string;
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
  usage_pct: number;
  year: number;
  month: number;
}

export interface BudgetOverview {
  year: number;
  month: number;
  total_budgeted: number;
  total_spent: number;
  total_remaining: number;
  overall_usage_pct: number;
  categories: BudgetItem[];
}

export interface QuoteInfo {
  ticker: string;
  current_price: number;
  change_pct: number;
}

export interface EnhancedQuote {
  ticker: string;
  current_price: number | null;
  change_pct: number;
  week52_high: number | null;
  week52_low: number | null;
  market_cap: number | null;
}

export interface RiskMetrics {
  beta: number | null;
  volatility: number | null;
  sharpe: number | null;
  mdd: number | null;
  diversification_score: number | null;
  position_count: number;
}

export interface PortfolioPosition {
  account_id: string;
  account_name: string;
  ticker: string | null;
  quantity: number;
  avg_price: number;
  cost_basis: number;
  current_price: number | null;
  current_value: number;
  gain_loss: number;
  gain_loss_pct: number;
  change_pct?: number;
}

export interface PortfolioSummary {
  total_cost: number;
  total_value: number;
  total_gain_loss: number;
  total_gain_loss_pct: number;
}

export interface Portfolio {
  positions: PortfolioPosition[];
  summary: PortfolioSummary;
}

export interface InvestmentAccountInput {
  name: string;
  ticker: string;
  quantity: number;
  avg_price: number;
}

// ── API 함수들 ────────────────────────────────────────

export const dashboardApi = {
  getSummary: () => api.get<DashboardSummary>('/dashboard/summary'),
  getAssetsBreakdown: () => api.get<AssetsBreakdown>('/dashboard/assets-breakdown'),
  getRecentTransactions: (limit = 10) =>
    api.get<RecentTransaction[]>(`/dashboard/recent-transactions?limit=${limit}`),
  getCashflow: (year?: number, month?: number) => {
    const p = new URLSearchParams();
    if (year)  p.append('year',  String(year));
    if (month) p.append('month', String(month));
    return api.get<CashflowData>(`/dashboard/cashflow?${p}`);
  },
};

export const accountsApi = {
  list: (accountType?: string) => {
    const params = accountType ? `?account_type=${accountType}` : '';
    return api.get<Account[]>(`/accounts/${params}`);
  },
  get: (id: string) => api.get<Account>(`/accounts/${id}`),
  create: (data: Partial<Account> & { opening_balance?: number }) =>
    api.post<Account>('/accounts/', data),
};

export const transactionsApi = {
  list: (limit = 50, offset = 0) =>
    api.get<Transaction[]>(`/transactions/?limit=${limit}&offset=${offset}`),
  createSimple: (data: SimpleTransactionInput) =>
    api.post<Transaction>('/transactions/simple', data),
};

export const classifyApi = {
  classify: (description: string) =>
    api.post<ClassifyResult>('/classify/', { description }),
};

export const budgetApi = {
  list: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    return api.get<BudgetItem[]>(`/budget/?${params}`);
  },
  overview: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    return api.get<BudgetOverview>(`/budget/overview?${params}`);
  },
  create: (data: { category: string; amount: number; year?: number; month?: number }) =>
    api.post<BudgetItem>('/budget/', data),
};

export interface ReceiptScanResult {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  description: string | null;
  items: string[];
  confidence: number;
}

export const receiptsApi = {
  scan: (imageUri: string, mimeType: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: 'receipt.jpg',
    } as any);
    return api.post<ReceiptScanResult>('/receipts/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },
};

export interface TickerSearchResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

export const investmentsApi = {
  getQuote: (ticker: string) => api.get<QuoteInfo>(`/investments/quote/${ticker}`),
  getMultipleQuotes: (tickers: string[]) =>
    api.get<EnhancedQuote[]>(`/investments/quotes?tickers=${tickers.join(',')}`),
  getPortfolio: () => api.get<Portfolio>('/investments/portfolio'),
  getRiskMetrics: () => api.get<RiskMetrics>('/investments/risk-metrics'),
  createAccount: (data: InvestmentAccountInput) =>
    api.post('/investments/account', data),
  deleteAccount: (accountId: string) =>
    api.delete(`/investments/account/${accountId}`),
  search: (q: string) => api.get<TickerSearchResult[]>(`/investments/search?q=${encodeURIComponent(q)}`),
  getWatchlist: () => api.get<{ tickers: string[] }>('/investments/watchlist'),
  setWatchlist: (tickers: string[]) => api.put<{ tickers: string[] }>('/investments/watchlist', { tickers }),
};

// ── AI Advisor ──────────────────────────────────────
export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AdvisorChatResponse {
  reply: string;
  context_snapshot: Record<string, unknown>;
}

export interface AdvisorInsight {
  type: 'positive' | 'warning' | 'tip';
  icon: string;
  title: string;
  body: string;
}

export interface AdvisorInsightsResponse {
  insights: AdvisorInsight[];
}

export const advisorApi = {
  chat: (messages: AdvisorMessage[]) =>
    api.post<AdvisorChatResponse>('/advisor/chat', { messages }, { timeout: 30000 }),
  getInsights: () =>
    api.get<AdvisorInsightsResponse>('/advisor/insights', { timeout: 30000 }),
};

// ── Auth ──────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface HouseholdInfo {
  id: string;
  name: string;
  invite_code: string;
  members: HouseholdMember[];
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    publicApi.post<TokenResponse>('/auth/register', { name, email, password }),
  login: (email: string, password: string) =>
    publicApi.post<TokenResponse>('/auth/login', { email, password }),
  me: () => api.get<UserInfo>('/auth/me'),
  meWithToken: (token: string) =>
    publicApi.get<UserInfo>('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
};

export const householdsApi = {
  create: (name: string) => api.post<HouseholdInfo>('/households/', { name }),
  me: () => api.get<HouseholdInfo>('/households/me'),
  join: (invite_code: string) => api.post<HouseholdInfo>('/households/join', { invite_code }),
  regenerateInvite: () => api.post<{ invite_code: string }>('/households/regenerate-invite'),
};
