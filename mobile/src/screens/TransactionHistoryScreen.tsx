import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { transactionsApi, Transaction, dashboardApi, CashflowData, investmentsApi } from '../services/api';
import { LoadingView, ErrorView } from '../components/LoadingView';
import { COLORS, formatAmount } from '../constants';
import { getTxMeta } from '../utils/transactionMeta';
import { formatDateHeader } from '../utils/dateFormatting';

const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type ViewMode = 'day' | 'week' | 'month';

// ─── 날짜 유틸 ───────────────────────────────────────────────────────────────

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(d.getDate() - d.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getCalendarGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const grid: (Date | null)[] = Array(first.getDay()).fill(null);
  const d = new Date(first);
  while (d.getMonth() === month) {
    grid.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── TxRow ───────────────────────────────────────────────────────────────────

const TxRow = React.memo(function TxRow({ tx }: { tx: Transaction }) {
  const meta = getTxMeta(tx);
  const amtColor = meta.type === 'income' ? COLORS.success : meta.type === 'expense' ? COLORS.danger : COLORS.textMuted;
  const prefix   = meta.type === 'income' ? '+' : meta.type === 'expense' ? '-' : '';
  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: amtColor + '18' }]}>
        <Text style={styles.iconText}>{meta.icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowDesc} numberOfLines={1}>{tx.description}</Text>
        <Text style={styles.rowLabel} numberOfLines={1}>{meta.label}</Text>
      </View>
      <Text style={[styles.rowAmount, { color: amtColor }]}>{prefix}{formatAmount(meta.amount)}</Text>
    </View>
  );
});

interface Section { key: string; date: Date; dayIncome: number; dayExpense: number; data: Transaction[] }

const SectionHeader = React.memo(function SectionHeader({ section }: { section: Section }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionDate}>{formatDateHeader(section.date)}</Text>
      <View style={styles.sectionBadges}>
        {section.dayExpense > 0 && <View style={styles.badgeExpense}><Text style={styles.badgeExpenseText}>-{formatAmount(section.dayExpense)}</Text></View>}
        {section.dayIncome  > 0 && <View style={styles.badgeIncome}><Text style={styles.badgeIncomeText}>+{formatAmount(section.dayIncome)}</Text></View>}
      </View>
    </View>
  );
});

// ─── 캘린더 네비게이션 헤더 ──────────────────────────────────────────────────

function NavHeader({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={cal.navHeader}>
      <TouchableOpacity onPress={onPrev} style={cal.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={cal.navArrow}>‹</Text>
      </TouchableOpacity>
      <Text style={cal.navLabel}>{label}</Text>
      <TouchableOpacity onPress={onNext} style={cal.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={cal.navArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── 일 뷰: 월 캘린더 그리드 ─────────────────────────────────────────────────

interface DayStats { income: number; expense: number }

function CalendarGrid({ year, month, selectedDate, today, dayStats, dayNames, onSelect }: {
  year: number; month: number; selectedDate: Date; today: Date;
  dayStats: Record<string, DayStats>; dayNames: string[]; onSelect: (d: Date) => void;
}) {
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month]);

  return (
    <View style={cal.grid}>
      <View style={cal.gridRow}>
        {dayNames.map((n, i) => (
          <View key={n} style={cal.cell}>
            <Text style={[cal.dayName, i === 0 && { color: COLORS.danger }, i === 6 && { color: COLORS.info }]}>{n}</Text>
          </View>
        ))}
      </View>

      {chunk(grid, 7).map((week, wi) => (
        <View key={wi} style={cal.gridRow}>
          {week.map((d, di) => {
            if (!d) return <View key={di} style={cal.cell} />;
            const key = toKey(d);
            const stats = dayStats[key];
            const selected = sameDay(d, selectedDate);
            const isToday  = sameDay(d, today);
            const sun = di === 0, sat = di === 6;
            return (
              <TouchableOpacity key={di} style={cal.cell} onPress={() => onSelect(d)} activeOpacity={0.7}>
                <View style={[cal.circle, selected && cal.circleSelected, isToday && !selected && cal.circleToday]}>
                  <Text style={[
                    cal.cellNum,
                    selected && { color: '#fff', fontWeight: '700' },
                    !selected && isToday && { color: COLORS.primary, fontWeight: '700' },
                    !selected && sun && { color: COLORS.danger },
                    !selected && sat && { color: COLORS.info },
                  ]}>{d.getDate()}</Text>
                </View>
                <View style={cal.dots}>
                  {stats?.income  > 0 && <View style={[cal.dot, { backgroundColor: COLORS.success }]} />}
                  {stats?.expense > 0 && <View style={[cal.dot, { backgroundColor: COLORS.danger  }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── 주 뷰: 7일 스트립 ───────────────────────────────────────────────────────

function WeekStrip({ weekStart, selectedDate, today, dayStats, dayNames, onSelect }: {
  weekStart: Date; selectedDate: Date; today: Date;
  dayStats: Record<string, DayStats>; dayNames: string[]; onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const maxExp = useMemo(() => Math.max(...days.map(d => dayStats[toKey(d)]?.expense ?? 0), 1), [days, dayStats]);

  return (
    <View style={cal.weekStrip}>
      {days.map((d, i) => {
        const key      = toKey(d);
        const stats    = dayStats[key];
        const selected = sameDay(d, selectedDate);
        const isToday  = sameDay(d, today);
        const sun = i === 0, sat = i === 6;
        const barH = stats?.expense ? Math.max(4, (stats.expense / maxExp) * 36) : 0;

        return (
          <TouchableOpacity key={i} style={cal.weekDay} onPress={() => onSelect(d)} activeOpacity={0.7}>
            <Text style={[cal.weekDayName, sun && { color: COLORS.danger }, sat && { color: COLORS.info }]}>
              {dayNames[i]}
            </Text>
            <View style={[cal.weekCircle, selected && cal.circleSelected, isToday && !selected && cal.circleToday]}>
              <Text style={[
                cal.weekNum,
                selected && { color: '#fff', fontWeight: '700' },
                !selected && isToday && { color: COLORS.primary, fontWeight: '700' },
              ]}>{d.getDate()}</Text>
            </View>
            <View style={cal.miniBarWrap}>
              {barH > 0 && <View style={[cal.miniBar, { height: barH, backgroundColor: COLORS.danger + '99' }]} />}
            </View>
            <View style={{ height: 6, alignItems: 'center', justifyContent: 'center' }}>
              {stats?.income ? <View style={[cal.dot, { backgroundColor: COLORS.success }]} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── 월 뷰: 요약 카드 ────────────────────────────────────────────────────────

function MonthSummaryCard({ txs }: { txs: Transaction[] }) {
  const { t } = useTranslation();
  const { income, expense, breakdown } = useMemo(() => {
    let inc = 0, exp = 0;
    const cats: Record<string, number> = {};
    for (const tx of txs) {
      const m = getTxMeta(tx);
      if (m.type === 'income')  inc += m.amount;
      if (m.type === 'expense') { exp += m.amount; cats[m.filterKey] = (cats[m.filterKey] ?? 0) + m.amount; }
    }
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    const bd = Object.entries(cats)
      .map(([key, amount]) => ({ key, amount, pct: total > 0 ? Math.round(amount / total * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount).slice(0, 5);
    return { income: inc, expense: exp, breakdown: bd };
  }, [txs]);

  const savings = income - expense;

  return (
    <View style={cal.monthCard}>
      <View style={cal.monthTotalsRow}>
        {[
          { label: t('history.income'),  value: income,  color: COLORS.success },
          { label: t('history.expense'), value: expense, color: COLORS.danger  },
          { label: t('history.savings'), value: savings, color: savings >= 0 ? COLORS.info : COLORS.danger },
        ].map(({ label, value, color }) => (
          <View key={label} style={cal.monthTotalItem}>
            <Text style={[cal.monthTotalLabel, { color }]}>{label}</Text>
            <Text style={[cal.monthTotalValue, { color }]}>{formatAmount(value)}</Text>
          </View>
        ))}
      </View>

      {breakdown.length > 0 && (
        <View style={cal.catBlock}>
          <Text style={cal.catTitle}>{t('history.expenseAnalysis')}</Text>
          {breakdown.map(({ key, amount, pct }) => (
            <View key={key} style={cal.catRow}>
              <Text style={cal.catLabel}>{(t as any)(`history.${key}`, { defaultValue: key })}</Text>
              <View style={cal.catBarBg}>
                <View style={[cal.catBarFill, { flex: pct }]} />
                <View style={{ flex: Math.max(1, 100 - pct) }} />
              </View>
              <Text style={cal.catAmt}>{formatAmount(amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── 현금 흐름 다이어그램 ─────────────────────────────────────────────────────

function CashFlowDiagram({ year, month }: { year: number; month: number }) {
  const { t } = useTranslation();
  const [data, setData] = useState<CashflowData | null>(null);
  const [investPnl, setInvestPnl] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setData(null);
    Promise.all([
      dashboardApi.getCashflow(year, month),
      investmentsApi.getPortfolio().catch(() => null),
    ]).then(([cfRes, portRes]) => {
      if (cancelled) return;
      setData(cfRes.data);
      setInvestPnl(portRes?.data?.summary?.total_gain_loss ?? null);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [year, month]);

  if (!loaded) return null;
  if (!data || (data.income.length === 0 && data.expense.length === 0)) {
    return (
      <View style={cf.card}>
        <Text style={cf.heading}>{t('history.cashflow')}</Text>
        <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: 'center', paddingVertical: 12 }}>
          {t('history.noCashflow')}
        </Text>
      </View>
    );
  }

  const maxAmt = Math.max(
    ...data.income.map(i => i.amount),
    ...data.expense.map(e => e.amount),
    1,
  );
  const barPct = (amount: number): `${number}%` =>
    `${Math.max(2, Math.round(amount / maxAmt * 100))}%`;

  const netWithInvest = data.net_flow + (investPnl ?? 0);

  return (
    <View style={cf.card}>
      <Text style={cf.heading}>{t('history.cashflow')}</Text>

      {data.income.length > 0 && (
        <View style={cf.section}>
          <Text style={cf.sectionTitle}>{t('history.income')}  {formatAmount(data.total_income)}</Text>
          {data.income.map(item => (
            <View key={item.category} style={cf.row}>
              <Text style={cf.rowIcon}>{item.icon}</Text>
              <Text style={cf.rowLabel} numberOfLines={1}>{item.label}</Text>
              <View style={cf.barBg}>
                <View style={[cf.bar, { width: barPct(item.amount), backgroundColor: COLORS.success }]} />
              </View>
              <Text style={[cf.rowAmt, { color: COLORS.success }]}>+{formatAmount(item.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {data.expense.length > 0 && (
        <View style={cf.section}>
          <Text style={cf.sectionTitle}>{t('history.expense')}  {formatAmount(data.total_expense)}</Text>
          {data.expense.map(item => (
            <View key={item.category} style={cf.row}>
              <Text style={cf.rowIcon}>{item.icon}</Text>
              <Text style={cf.rowLabel} numberOfLines={1}>{item.label}</Text>
              <View style={cf.barBg}>
                <View style={[cf.bar, { width: barPct(item.amount), backgroundColor: COLORS.danger }]} />
              </View>
              <Text style={[cf.rowAmt, { color: COLORS.danger }]}>-{formatAmount(item.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {investPnl !== null && investPnl !== 0 && (
        <View style={cf.section}>
          <Text style={cf.sectionTitle}>{t('history.invPnL')}</Text>
          <View style={cf.row}>
            <Text style={cf.rowIcon}>📈</Text>
            <Text style={cf.rowLabel}>{t('history.unrealizedPnL')}</Text>
            <View style={cf.barBg} />
            <Text style={[cf.rowAmt, { color: investPnl >= 0 ? COLORS.success : COLORS.danger }]}>
              {investPnl >= 0 ? '+' : ''}{formatAmount(Math.abs(investPnl))}
            </Text>
          </View>
        </View>
      )}

      <View style={cf.divider} />
      <View style={cf.netRow}>
        <Text style={cf.netLabel}>{t('history.netCashflow')}</Text>
        <Text style={[cf.netVal, { color: netWithInvest >= 0 ? COLORS.success : COLORS.danger }]}>
          {netWithInvest >= 0 ? '+' : ''}{formatAmount(Math.abs(netWithInvest))}
        </Text>
      </View>
    </View>
  );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function TransactionHistoryScreen() {
  const { t } = useTranslation();
  const today = useMemo(() => new Date(), []);

  const dayNames = useMemo(
    () => t('history.dayNames', { returnObjects: true }) as string[],
    [t],
  );

  const FILTERS = useMemo(() => [
    { key: 'all',        label: t('history.all'),        icon: '📋' },
    { key: 'food',       label: t('history.food'),       icon: '🍽' },
    { key: 'transport',  label: t('history.transport'),  icon: '🚌' },
    { key: 'shopping',   label: t('history.shopping'),   icon: '🛍' },
    { key: 'salary',     label: t('history.salary'),     icon: '💰' },
    { key: 'investment', label: t('history.investment'), icon: '📈' },
  ], [t]);

  const [txs, setTxs]               = useState<Transaction[]>([]);
  const [loading, setLoading]        = useState(true);
  const [refreshing, setRefreshing]  = useState(false);
  const [error, setError]            = useState('');
  const [viewMode, setViewMode]      = useState<ViewMode>('day');
  const [cursor, setCursor]          = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(today));
  const [search, setSearch]          = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const navigation = useNavigation<any>();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await transactionsApi.list(300);
      setTxs(res.data);
      setError('');
    } catch {
      setError(t('history.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dayStats = useMemo(() => {
    const map: Record<string, DayStats> = {};
    for (const tx of txs) {
      const key = tx.date.slice(0, 10);
      if (!map[key]) map[key] = { income: 0, expense: 0 };
      const m = getTxMeta(tx);
      if (m.type === 'income')  map[key].income  += m.amount;
      if (m.type === 'expense') map[key].expense += m.amount;
    }
    return map;
  }, [txs]);

  const visibleTxs = useMemo(() => {
    let result: Transaction[];

    if (viewMode === 'day') {
      const key = toKey(selectedDate);
      result = txs.filter(tx => tx.date.slice(0, 10) === key);
    } else if (viewMode === 'week') {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      result = txs.filter(tx => {
        const d = new Date(tx.date);
        return d >= ws && d <= we;
      });
    } else {
      const y = cursor.getFullYear(), m = cursor.getMonth();
      result = txs.filter(tx => {
        const d = new Date(tx.date);
        return d.getFullYear() === y && d.getMonth() === m;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(tx =>
        tx.description.toLowerCase().includes(q) ||
        tx.entries.some(e => e.account_name.toLowerCase().includes(q))
      );
    }
    if (activeFilter !== 'all') {
      result = result.filter(tx => getTxMeta(tx).filterKey === activeFilter);
    }

    return result;
  }, [txs, viewMode, selectedDate, cursor, search, activeFilter]);

  const sections = useMemo<Section[]>(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of visibleTxs) {
      const key = tx.date.slice(0, 10);
      (groups[key] ??= []).push(tx);
    }
    return Object.entries(groups)
      .map(([key, data]) => {
        let dayIncome = 0, dayExpense = 0;
        for (const tx of data) {
          const m = getTxMeta(tx);
          if (m.type === 'income')  dayIncome  += m.amount;
          if (m.type === 'expense') dayExpense += m.amount;
        }
        return { key, date: new Date(data[0].date), data, dayIncome, dayExpense };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [visibleTxs]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const tx of visibleTxs) {
      const m = getTxMeta(tx);
      if (m.type === 'income')  income  += m.amount;
      if (m.type === 'expense') expense += m.amount;
    }
    return { income, expense, count: visibleTxs.length };
  }, [visibleTxs]);

  const navLabel = useMemo(() => {
    if (viewMode === 'day') {
      return t('history.navDay', {
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        monthName: MONTH_NAMES_EN[selectedDate.getMonth()],
        day: selectedDate.getDate(),
        dayName: dayNames[selectedDate.getDay()] ?? '',
      });
    }
    if (viewMode === 'week') {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      const wsM = ws.getMonth() + 1, weM = we.getMonth() + 1;
      if (wsM === weM) {
        return t('history.navWeekSame', {
          year: ws.getFullYear(),
          month: wsM,
          monthName: MONTH_NAMES_EN[ws.getMonth()],
          start: ws.getDate(),
          end: we.getDate(),
        });
      }
      return t('history.navWeekCross', {
        startMonth: wsM,
        startMonthName: MONTH_NAMES_EN[ws.getMonth()],
        start: ws.getDate(),
        endMonth: weM,
        endMonthName: MONTH_NAMES_EN[we.getMonth()],
        end: we.getDate(),
      });
    }
    return t('history.navMonth', {
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      monthName: MONTH_NAMES_EN[cursor.getMonth()],
    });
  }, [viewMode, cursor, selectedDate, dayNames, t]);

  const movePrev = useCallback(() => {
    if (viewMode === 'day') {
      const prev = addDays(selectedDate, -1);
      setSelectedDate(prev);
      setCursor(new Date(prev.getFullYear(), prev.getMonth(), 1));
    } else if (viewMode === 'week') {
      setCursor(c => addDays(c, -7));
    } else {
      setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1));
    }
  }, [viewMode, selectedDate]);

  const moveNext = useCallback(() => {
    if (viewMode === 'day') {
      const next = addDays(selectedDate, 1);
      setSelectedDate(next);
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    } else if (viewMode === 'week') {
      setCursor(c => addDays(c, 7));
    } else {
      setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1));
    }
  }, [viewMode, selectedDate]);

  const handleSelectDate = useCallback((d: Date) => {
    setSelectedDate(d);
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    if (viewMode === 'month') setViewMode('day');
  }, [viewMode]);

  const handleModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode !== 'week') {
      setCursor(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    } else {
      setCursor(new Date(selectedDate));
    }
  }, [selectedDate]);

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />,
    [refreshing, load],
  );

  if (loading) return <LoadingView message={t('history.loading')} />;
  if (error)   return <ErrorView message={error} onRetry={() => load()} />;

  const VIEW_MODES: { key: ViewMode; label: string }[] = [
    { key: 'day',   label: t('history.day') },
    { key: 'week',  label: t('history.week') },
    { key: 'month', label: t('history.month') },
  ];

  return (
    <View style={styles.screen}>
      {/* ── 뷰 모드 탭 ── */}
      <View style={styles.modeTabRow}>
        {VIEW_MODES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.modeTab, viewMode === key && styles.modeTabActive]}
            onPress={() => handleModeChange(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeTabText, viewMode === key && styles.modeTabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 캘린더 영역 ── */}
        <View style={cal.container}>
          <NavHeader label={navLabel} onPrev={movePrev} onNext={moveNext} />

          {viewMode === 'month' && (
            <>
              <MonthSummaryCard txs={visibleTxs} />
              <CalendarGrid
                year={cursor.getFullYear()}
                month={cursor.getMonth()}
                selectedDate={selectedDate}
                today={today}
                dayStats={dayStats}
                dayNames={dayNames}
                onSelect={handleSelectDate}
              />
            </>
          )}

          {viewMode === 'week' && (
            <WeekStrip
              weekStart={weekStart}
              selectedDate={selectedDate}
              today={today}
              dayStats={dayStats}
              dayNames={dayNames}
              onSelect={handleSelectDate}
            />
          )}
        </View>

        {viewMode === 'month' && (
          <CashFlowDiagram year={cursor.getFullYear()} month={cursor.getMonth() + 1} />
        )}

        {/* ── 검색 + 필터 ── */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('history.search')}
            placeholderTextColor={COLORS.textLight}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.filterScroll} contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={active ? styles.filterChipActive : styles.filterChip}
                onPress={() => setActiveFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={styles.filterIcon}>{f.icon}</Text>
                <Text style={active ? styles.filterLabelActive : styles.filterLabel}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── 요약 바 ── */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryCount}>{t('history.txCount', { count: totals.count })}</Text>
          <View style={styles.summaryAmounts}>
            {totals.expense > 0 && (
              <Text style={styles.summaryExpense}>{t('history.expense')} {formatAmount(totals.expense)}</Text>
            )}
            {totals.income  > 0 && (
              <Text style={styles.summaryIncome}>{t('history.income')} {formatAmount(totals.income)}</Text>
            )}
          </View>
        </View>

        {/* ── 거래 목록 ── */}
        {sections.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>{search || activeFilter !== 'all' ? '🔍' : '📭'}</Text>
            <Text style={styles.emptyTitle}>
              {search || activeFilter !== 'all' ? t('history.noResults') : t('history.noTx')}
            </Text>
            <Text style={styles.emptyDesc}>
              {viewMode === 'day'
                ? t('history.noTxDay', { month: selectedDate.getMonth() + 1, date: selectedDate.getDate() })
                : viewMode === 'week'
                  ? t('history.noTxWeek')
                  : t('history.noTxMonth', { month: cursor.getMonth() + 1 })}
            </Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.key}>
              <SectionHeader section={section} />
              {section.data.map((tx, i) => (
                <React.Fragment key={tx.id}>
                  <TxRow tx={tx} />
                  {i < section.data.length - 1 && <View style={styles.sep} />}
                </React.Fragment>
              ))}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('거래')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── 캘린더 스타일 ────────────────────────────────────────────────────────────

const cal = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginTop: 8,
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },

  navHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  navBtn:   { padding: 4 },
  navArrow: { fontSize: 22, color: COLORS.primary, fontWeight: '600', lineHeight: 26 },
  navLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  grid:    { paddingHorizontal: 8, paddingBottom: 10 },
  gridRow: { flexDirection: 'row' },
  cell:    { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayName: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginBottom: 2 },
  circle:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  circleSelected: { backgroundColor: COLORS.primary },
  circleToday:    { backgroundColor: COLORS.primaryLight },
  cellNum: { fontSize: 13, color: COLORS.text },
  dots:    { flexDirection: 'row', gap: 2, marginTop: 2, height: 6, alignItems: 'center' },
  dot:     { width: 5, height: 5, borderRadius: 3 },

  weekStrip: {
    flexDirection: 'row', paddingHorizontal: 8,
    paddingTop: 12, paddingBottom: 8,
  },
  weekDay:     { flex: 1, alignItems: 'center', gap: 6 },
  weekDayName: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  weekCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  weekNum:     { fontSize: 14, color: COLORS.text },
  miniBarWrap: { height: 40, justifyContent: 'flex-end', alignItems: 'center' },
  miniBar:     { width: 6, borderRadius: 3 },

  monthCard: { padding: 16 },
  monthTotalsRow: { flexDirection: 'row', marginBottom: 16 },
  monthTotalItem: { flex: 1, alignItems: 'center' },
  monthTotalLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  monthTotalValue: { fontSize: 14, fontWeight: '700' },
  catBlock: { gap: 10 },
  catTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  catRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLabel: { width: 36, fontSize: 12, color: COLORS.text },
  catBarBg: { flex: 1, flexDirection: 'row', height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  catBarFill: { backgroundColor: COLORS.primary, borderRadius: 4 },
  catAmt:   { fontSize: 11, color: COLORS.textMuted, minWidth: 72, textAlign: 'right' },
});

// ─── 현금 흐름 스타일 ─────────────────────────────────────────────────────────

const cf = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  heading:      { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  section:      { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginBottom: 8, letterSpacing: 0.4 },
  row:          { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 6 },
  rowIcon:      { fontSize: 14, width: 20, textAlign: 'center' },
  rowLabel:     { fontSize: 11, color: COLORS.text, width: 50 },
  barBg:        { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  bar:          { height: 8, borderRadius: 4 },
  rowAmt:       { fontSize: 11, fontWeight: '700', width: 78, textAlign: 'right' },
  divider:      { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  netRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netLabel:     { fontSize: 13, fontWeight: '700', color: COLORS.text },
  netVal:       { fontSize: 14, fontWeight: '700' },
});

// ─── 화면 스타일 ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1 },

  modeTabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: COLORS.border, borderRadius: 12, padding: 3,
  },
  modeTab:         { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  modeTabActive:   { backgroundColor: COLORS.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  modeTabText:     { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  modeTabTextActive: { color: COLORS.primary },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon:  { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: COLORS.text },
  clearBtn:    { fontSize: 14, color: COLORS.textLight, padding: 4 },

  filterScroll:  { flexGrow: 0, marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.primary, borderWidth: 1, borderColor: COLORS.primary,
  },
  filterIcon:        { fontSize: 13 },
  filterLabel:       { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  filterLabelActive: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },

  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, marginBottom: 4,
  },
  summaryCount:   { fontSize: 12, color: COLORS.textMuted },
  summaryAmounts: { flexDirection: 'row', gap: 12 },
  summaryExpense: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  summaryIncome:  { fontSize: 12, fontWeight: '700', color: COLORS.success },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8,
  },
  sectionDate:   { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.2 },
  sectionBadges: { flexDirection: 'row', gap: 6 },
  badgeExpense:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: COLORS.dangerBg },
  badgeIncome:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: COLORS.successBg },
  badgeExpenseText: { fontSize: 11, fontWeight: '700', color: COLORS.danger },
  badgeIncomeText:  { fontSize: 11, fontWeight: '700', color: COLORS.success },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: COLORS.surface,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconText:   { fontSize: 20 },
  rowBody:    { flex: 1, marginRight: 10 },
  rowDesc:    { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 3 },
  rowLabel:   { fontSize: 11, color: COLORS.textLight },
  rowAmount:  { fontSize: 15, fontWeight: '700' },
  sep:        { height: 1, backgroundColor: COLORS.border, marginLeft: 72 },

  emptyWrap:  { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptyDesc:  { fontSize: 13, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
