import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const POS_CARD_WIDTH = SCREEN_WIDTH - 56;
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  investmentsApi, Portfolio, PortfolioPosition, EnhancedQuote, RiskMetrics, TickerSearchResult,
} from '../services/api';
import { LoadingView, ErrorView } from '../components/LoadingView';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { COLORS, formatAmount } from '../constants';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DEFAULT_WATCHLIST = ['005930.KS', '000660.KS', 'AAPL', 'MSFT', 'SPY', 'QQQ'];

const KR_STOCKS: TickerSearchResult[] = [
  { ticker: '005930.KS', name: '삼성전자', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '000660.KS', name: 'SK하이닉스', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '005380.KS', name: '현대차', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '373220.KS', name: 'LG에너지솔루션', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '207940.KS', name: '삼성바이오로직스', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '006400.KS', name: '삼성SDI', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '068270.KS', name: '셀트리온', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '035720.KS', name: '카카오', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '035420.KS', name: 'NAVER', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '105560.KS', name: 'KB금융', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '055550.KS', name: '신한지주', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '086790.KS', name: '하나금융지주', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '000270.KS', name: '기아', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '005490.KS', name: '포스코홀딩스', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '051910.KS', name: 'LG화학', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '012330.KS', name: '현대모비스', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '096770.KS', name: 'SK이노베이션', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '323410.KS', name: '카카오뱅크', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '259960.KS', name: '크래프톤', exchange: 'KSC', type: 'EQUITY' },
  { ticker: '010130.KS', name: '고려아연', exchange: 'KSC', type: 'EQUITY' },
];

function searchLocal(q: string): TickerSearchResult[] {
  const q2 = q.toLowerCase().replace(/\s/g, '');
  if (!q2) return [];
  return KR_STOCKS.filter(s =>
    s.name.toLowerCase().replace(/\s/g, '').includes(q2) ||
    s.ticker.toLowerCase().includes(q2)
  ).slice(0, 5);
}

const ALLOC_COLORS: Record<string, string> = {
  domestic: COLORS.primary,
  us:       COLORS.info,
  other:    COLORS.textMuted,
};

type AllocKey = 'domestic' | 'us' | 'other';

function getCategory(ticker: string | null): AllocKey {
  if (!ticker) return 'other';
  if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return 'domestic';
  return 'us';
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

function TickerSearchDropdown({
  results,
  onSelect,
}: {
  results: TickerSearchResult[];
  onSelect: (item: TickerSearchResult) => void;
}) {
  if (results.length === 0) return null;
  return (
    <View style={styles.dropdown}>
      {results.map((item, i) => (
        <TouchableOpacity
          key={item.ticker}
          style={[styles.dropdownItem, i < results.length - 1 && styles.dropdownSep]}
          onPress={() => onSelect(item)}
        >
          <View style={styles.dropdownLeft}>
            <Text style={styles.dropdownName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.dropdownExchange}>{item.exchange} · {item.type}</Text>
          </View>
          <Text style={styles.dropdownTicker}>{item.ticker}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AddInvestmentModal({
  visible,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; ticker: string; quantity: number; avg_price: number }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setName('');
    setTicker('');
    setQuantity('');
    setAvgPrice('');
    setSearchResults([]);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = text.trim();
    if (trimmed.length < 1) { setSearchResults([]); return; }
    const local = searchLocal(trimmed);
    setSearchResults(local);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await investmentsApi.search(trimmed);
        if (data.length > 0) setSearchResults(data.slice(0, 6));
      } catch {}
      finally { setSearching(false); }
    }, 400);
  };

  const handleSelect = (item: TickerSearchResult) => {
    setName(item.name);
    setTicker(item.ticker);
    setSearchResults([]);
  };

  const submit = async () => {
    const parsedQuantity = Number(quantity.replace(/,/g, ''));
    const parsedAvgPrice = Number(avgPrice.replace(/,/g, ''));
    if (!name.trim() || !ticker.trim() || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0
      || !Number.isFinite(parsedAvgPrice) || parsedAvgPrice <= 0) {
      Alert.alert(t('common.error'), t('inv.validationError'));
      return;
    }
    await onSubmit({
      name: name.trim(),
      ticker: ticker.trim().toUpperCase(),
      quantity: parsedQuantity,
      avg_price: parsedAvgPrice,
    });
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={close} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('inv.addModal')}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>
              {t('inv.searchLabel')}
              {searching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 6 }} />}
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={handleNameChange}
              placeholder={t('inv.searchPh')}
              placeholderTextColor={COLORS.textLight}
              editable={!saving}
              autoCorrect={false}
              returnKeyType="search"
            />
            <TickerSearchDropdown results={searchResults} onSelect={handleSelect} />

            <Text style={styles.inputLabel}>{t('inv.tickerLabel')}</Text>
            <TextInput
              style={styles.input}
              value={ticker}
              onChangeText={(v) => setTicker(v)}
              placeholder={t('inv.tickerPh')}
              placeholderTextColor={COLORS.textLight}
              editable={!saving}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.inputLabel}>{t('inv.quantityLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder={t('inv.quantityPh')}
                  placeholderTextColor={COLORS.textLight}
                  editable={!saving}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.inputLabel}>{t('inv.priceLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={avgPrice}
                  onChangeText={setAvgPrice}
                  placeholder={t('inv.pricePh')}
                  placeholderTextColor={COLORS.textLight}
                  editable={!saving}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={close} disabled={saving}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t('common.add')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── SummaryCard ─────────────────────────────────────────────────────────────

function SummaryCard({
  summary, positions,
}: {
  summary: Portfolio['summary'];
  positions: PortfolioPosition[];
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'today' | 'total'>('total');
  const [hidden, setHidden] = useState(true);

  const todayPct = useMemo(() => {
    const tv = summary.total_value;
    if (tv === 0) return 0;
    return positions.reduce((acc, p) => acc + (p.change_pct ?? 0) * (p.current_value / tv), 0);
  }, [positions, summary.total_value]);

  const isGain  = mode === 'total' ? summary.total_gain_loss >= 0 : todayPct >= 0;
  const glColor  = isGain ? COLORS.success : COLORS.danger;
  const prefix   = isGain ? '+' : '';
  const dispAmt  = mode === 'total'
    ? summary.total_gain_loss
    : summary.total_value * todayPct / 100;
  const dispPct  = mode === 'total' ? summary.total_gain_loss_pct : todayPct;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View style={styles.summaryTitleRow}>
          <Text style={styles.summaryTitle}>{t('inv.portfolio')}</Text>
          <TouchableOpacity onPress={() => setHidden(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.summaryEye}>{hidden ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modeToggle}>
          {(['today', 'total'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                {m === 'today' ? t('inv.today') : t('inv.total')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.summaryValue}>
        {hidden ? '●●●●●' : formatAmount(summary.total_value)}
      </Text>
      <View style={styles.glRow}>
        <Text style={[styles.glAmt, { color: hidden ? COLORS.primaryLight : glColor }]}>
          {hidden ? '●●●' : `${prefix}${formatAmount(dispAmt)}`}
        </Text>
        {!hidden && (
          <View style={[styles.glBadge, { backgroundColor: isGain ? '#1a4a32' : '#4a1a1a' }]}>
            <Text style={[styles.glBadgeText, { color: glColor }]}>
              {prefix}{dispPct.toFixed(2)}%
            </Text>
          </View>
        )}
      </View>

      <View style={styles.summaryMetaRow}>
        <View style={styles.summaryMetaItem}>
          <Text style={styles.summaryMetaLabel}>{t('inv.principal')}</Text>
          <Text style={styles.summaryMetaValue}>
            {hidden ? '●●●●' : formatAmount(summary.total_cost)}
          </Text>
        </View>
        <View style={styles.summaryMetaDivider} />
        <View style={styles.summaryMetaItem}>
          <Text style={styles.summaryMetaLabel}>{t('inv.value')}</Text>
          <Text style={styles.summaryMetaValue}>
            {hidden ? '●●●●' : formatAmount(summary.total_value)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── AllocationChart ──────────────────────────────────────────────────────────

function AllocationChart({ positions }: { positions: PortfolioPosition[] }) {
  const { t } = useTranslation();
  const alloc = useMemo(() => {
    const groups: Partial<Record<AllocKey, number>> = {};
    let total = 0;
    for (const p of positions) {
      const cat = getCategory(p.ticker);
      groups[cat] = (groups[cat] ?? 0) + p.current_value;
      total += p.current_value;
    }
    if (total === 0) return [];
    return (Object.entries(groups) as [AllocKey, number][])
      .map(([cat, value]) => ({
        cat,
        value,
        pct: Math.round((value / total) * 100),
        color: ALLOC_COLORS[cat],
      }))
      .sort((a, b) => b.value - a.value);
  }, [positions]);

  if (alloc.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('inv.allocation')}</Text>
      <View style={styles.allocCard}>
        <View style={styles.allocBar}>
          {alloc.map(({ cat, pct, color }, i) => (
            <View
              key={cat}
              style={[
                styles.allocSegment,
                { flex: pct, backgroundColor: color },
                i === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                i === alloc.length - 1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
              ]}
            />
          ))}
        </View>
        <View style={styles.allocLegend}>
          {alloc.map(({ cat, pct, color, value }) => (
            <View key={cat} style={styles.allocLegendItem}>
              <View style={[styles.allocDot, { backgroundColor: color }]} />
              <View style={styles.allocLegendText}>
                <Text style={styles.allocLabel}>{t(`inv.${cat}` as any)}</Text>
                <Text style={styles.allocPct}>{pct}%</Text>
              </View>
              <Text style={styles.allocAmt}>{formatAmount(value)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── RiskPanel ────────────────────────────────────────────────────────────────

function RiskPanel({ metrics, loading }: { metrics: RiskMetrics | null; loading: boolean }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('inv.risk')}</Text>
        <View style={[styles.riskCard, styles.riskLoading]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.riskLoadingText}>{t('inv.riskLoading')}</Text>
        </View>
      </View>
    );
  }
  if (!metrics) return null;

  const grid = [
    {
      label: t('inv.beta'),
      value: metrics.beta != null ? metrics.beta.toFixed(2) : '—',
      sub: t('inv.betaSub'),
      color: metrics.beta != null && metrics.beta > 1.2 ? COLORS.danger : COLORS.text,
    },
    {
      label: t('inv.volatility'),
      value: metrics.volatility != null ? `${metrics.volatility}%` : '—',
      sub: t('inv.volatilitySub'),
      color: metrics.volatility != null && metrics.volatility > 25 ? COLORS.danger : COLORS.text,
    },
    {
      label: t('inv.sharpe'),
      value: metrics.sharpe != null ? metrics.sharpe.toFixed(2) : '—',
      sub: t('inv.sharpeSub'),
      color: metrics.sharpe != null
        ? metrics.sharpe >= 1 ? COLORS.success : metrics.sharpe >= 0 ? COLORS.text : COLORS.danger
        : COLORS.text,
    },
    {
      label: t('inv.mdd'),
      value: metrics.mdd != null ? `${metrics.mdd}%` : '—',
      sub: t('inv.mddSub'),
      color: metrics.mdd != null && metrics.mdd < -20 ? COLORS.danger : COLORS.text,
    },
  ];

  const divScore = metrics.diversification_score ?? 0;
  const divColor = divScore >= 70 ? COLORS.success : divScore >= 40 ? COLORS.primary : COLORS.danger;
  const divLabel = divScore >= 70 ? t('inv.divGood') : divScore >= 40 ? t('inv.divOk') : t('inv.divPoor');

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('inv.risk')}</Text>
      <View style={styles.riskCard}>
        <View style={styles.riskGrid}>
          {grid.map(({ label, value, sub, color }) => (
            <View key={label} style={styles.riskItem}>
              <Text style={styles.riskLabel}>{label}</Text>
              <Text style={[styles.riskValue, { color }]}>{value}</Text>
              <Text style={styles.riskSub}>{sub}</Text>
            </View>
          ))}
        </View>

        {metrics.diversification_score != null && (
          <View style={styles.divScoreBlock}>
            <View style={styles.divScoreHeader}>
              <Text style={styles.divScoreLabel}>{t('inv.diversification')}</Text>
              <Text style={[styles.divScoreNum, { color: divColor }]}>
                {divScore} / 100
              </Text>
            </View>
            <View style={styles.divBarBg}>
              <View style={[styles.divBarFill, { flex: divScore, backgroundColor: divColor }]} />
              <View style={{ flex: 100 - divScore }} />
            </View>
            <Text style={styles.divHint}>
              {t('inv.positions', { count: metrics.position_count })} · {divLabel}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── PositionCard ─────────────────────────────────────────────────────────────

function PositionCard({
  pos, totalValue, onDelete,
}: {
  pos: PortfolioPosition; totalValue: number; onDelete: (accountId: string) => void;
}) {
  const { t } = useTranslation();
  const isGain      = (pos.gain_loss ?? 0) >= 0;
  const glColor     = isGain ? COLORS.success : COLORS.danger;
  const changeColor = (pos.change_pct ?? 0) >= 0 ? COLORS.success : COLORS.danger;
  const weight      = totalValue > 0 ? ((pos.current_value / totalValue) * 100).toFixed(1) : '0';
  const glPrefix    = isGain ? '+' : '';

  return (
    <View style={styles.posCard}>
      <View style={styles.posHeader}>
        <View style={styles.posLeft}>
          <Text style={styles.posName}>{pos.account_name}</Text>
          {pos.ticker && <Text style={styles.posTicker}>{pos.ticker}</Text>}
        </View>
        <View style={styles.posRight}>
          <TouchableOpacity style={styles.posDeleteBtn} onPress={() => onDelete(pos.account_id)}>
            <Text style={styles.posDeleteText}>{t('common.delete')}</Text>
          </TouchableOpacity>
          {pos.current_price != null ? (
            <>
              <Text style={styles.posPrice}>{formatAmount(pos.current_price)}</Text>
              <Text style={[styles.posChange, { color: changeColor }]}>
                {(pos.change_pct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(pos.change_pct ?? 0).toFixed(2)}%
              </Text>
            </>
          ) : (
            <Text style={styles.posPrice}>—</Text>
          )}
        </View>
      </View>

      <View style={styles.posDivider} />

      <View style={styles.posDetailRow}>
        <View style={styles.posDetailItem}>
          <Text style={styles.posDetailLabel}>{t('inv.avgPrice')}</Text>
          <Text style={styles.posDetailValue}>{formatAmount(pos.avg_price)}</Text>
        </View>
        <View style={styles.posDetailItem}>
          <Text style={styles.posDetailLabel}>{t('inv.quantity')}</Text>
          <Text style={styles.posDetailValue}>{pos.quantity > 0 ? `${pos.quantity}` : '—'}</Text>
        </View>
        <View style={styles.posDetailItem}>
          <Text style={styles.posDetailLabel}>{t('inv.weight')}</Text>
          <Text style={styles.posDetailValue}>{weight}%</Text>
        </View>
      </View>

      <View style={[styles.posGlBar, { backgroundColor: isGain ? COLORS.successBg : COLORS.dangerBg }]}>
        <Text style={[styles.posGlText, { color: glColor }]}>
          {t('inv.unrealizedPnL')}  {glPrefix}{formatAmount(pos.gain_loss ?? 0)}  ({glPrefix}{(pos.gain_loss_pct ?? 0).toFixed(2)}%)
        </Text>
      </View>
    </View>
  );
}

// ─── WatchItem ────────────────────────────────────────────────────────────────

function WatchItem({
  item, toKRW,
  onRemove,
}: {
  item: EnhancedQuote;
  toKRW: (amount: number, currency: string) => number;
  onRemove: (ticker: string) => void;
}) {
  const { t } = useTranslation();
  const isForeign   = !item.ticker.endsWith('.KS') && !item.ticker.endsWith('.KQ');
  const changeColor = item.change_pct >= 0 ? COLORS.success : COLORS.danger;

  const displayPrice = item.current_price == null
    ? '—'
    : isForeign
      ? `${formatAmount(toKRW(item.current_price, 'USD'))} ($${item.current_price.toFixed(2)})`
      : formatAmount(item.current_price);

  const rangePos = (item.current_price != null && item.week52_high != null && item.week52_low != null
    && item.week52_high > item.week52_low)
    ? Math.max(0, Math.min(100, Math.round(
        ((item.current_price - item.week52_low) / (item.week52_high - item.week52_low)) * 100
      )))
    : null;

  return (
    <View style={styles.watchItem}>
      <View style={styles.watchTop}>
        <Text style={styles.watchTicker}>{item.ticker}</Text>
        <View style={styles.watchPriceBlock}>
          <Text style={styles.watchPrice}>{displayPrice}</Text>
          <View style={styles.watchActionRow}>
            <Text style={[styles.watchChange, { color: changeColor }]}>
              {item.change_pct >= 0 ? '▲' : '▼'} {Math.abs(item.change_pct).toFixed(2)}%
            </Text>
            <TouchableOpacity style={styles.watchRemoveBtn} onPress={() => onRemove(item.ticker)}>
              <Text style={styles.watchRemoveText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {rangePos != null && (
        <View style={styles.watch52Row}>
          <Text style={styles.watch52Edge}>
            {isForeign ? `$${item.week52_low?.toFixed(0)}` : formatAmount(item.week52_low!)}
          </Text>
          <View style={styles.watch52BarWrap}>
            <View style={{ flex: rangePos, height: 3, backgroundColor: COLORS.primary, borderRadius: 2 }} />
            <View style={[styles.watch52Dot, { backgroundColor: COLORS.primary }]} />
            <View style={{ flex: 100 - rangePos, height: 3, backgroundColor: COLORS.border, borderRadius: 2 }} />
          </View>
          <Text style={styles.watch52Edge}>
            {isForeign ? `$${item.week52_high?.toFixed(0)}` : formatAmount(item.week52_high!)}
          </Text>
        </View>
      )}

      {item.market_cap != null && (
        <Text style={styles.watchMktCap}>{t('inv.mktCap')} {formatMarketCap(item.market_cap)}</Text>
      )}
    </View>
  );
}

function AddWatchTickerModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (ticker: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => {
    setQuery('');
    setSearchResults([]);
    onClose();
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = text.trim();
    if (!trimmed) { setSearchResults([]); return; }
    const local = searchLocal(trimmed);
    setSearchResults(local);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await investmentsApi.search(trimmed);
        if (data.length > 0) setSearchResults(data.slice(0, 6));
      } catch {}
      finally { setSearching(false); }
    }, 400);
  };

  const handleSelect = (item: TickerSearchResult) => {
    setQuery('');
    setSearchResults([]);
    onSubmit(item.ticker);
  };

  const submit = () => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      Alert.alert(t('common.error'), t('inv.watchRequired'));
      return;
    }
    setQuery('');
    setSearchResults([]);
    onSubmit(normalized);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={close} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('inv.watchModal')}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>
              {t('inv.watchQueryLabel')}
              {searching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 6 }} />}
            </Text>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={handleQueryChange}
              placeholder={t('inv.watchQueryPh')}
              placeholderTextColor={COLORS.textLight}
              autoCorrect={false}
              returnKeyType="search"
            />
            <TickerSearchDropdown results={searchResults} onSelect={handleSelect} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submit}>
                <Text style={styles.saveText}>{t('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function InvestmentScreen() {
  const { t } = useTranslation();
  const [portfolio, setPortfolio]       = useState<Portfolio | null>(null);
  const [watchlist, setWatchlist]       = useState<EnhancedQuote[]>([]);
  const [watchTickers, setWatchTickers] = useState<string[]>(DEFAULT_WATCHLIST);
  const [riskMetrics, setRiskMetrics]   = useState<RiskMetrics | null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [riskLoading, setRiskLoading]   = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const { toKRW } = useExchangeRates();

  const persistWatchTickers = useCallback(async (tickers: string[]) => {
    setWatchTickers(tickers);
    try { await investmentsApi.setWatchlist(tickers); } catch {}
  }, []);

  const loadWatchTickers = useCallback(async () => {
    try {
      const { data } = await investmentsApi.getWatchlist();
      return data.tickers.length > 0 ? data.tickers : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const tickers = await loadWatchTickers();
      setWatchTickers(tickers);
      const [portfolioRes, watchRes] = await Promise.all([
        investmentsApi.getPortfolio(),
        investmentsApi.getMultipleQuotes(tickers).catch(() => ({ data: [] as EnhancedQuote[] })),
      ]);
      setPortfolio(portfolioRes.data);
      setWatchlist(watchRes.data);
      setError('');

      setRiskLoading(true);
      investmentsApi.getRiskMetrics()
        .then((r) => setRiskMetrics(r.data))
        .catch(() => setRiskMetrics(null))
        .finally(() => setRiskLoading(false));
    } catch {
      setError(t('inv.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadWatchTickers, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreateInvestment = useCallback(async (data: {
    name: string;
    ticker: string;
    quantity: number;
    avg_price: number;
  }) => {
    setSaving(true);
    try {
      await investmentsApi.createAccount(data);
      setShowAddModal(false);
      await load(true);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? t('inv.addError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSaving(false);
    }
  }, [load, t]);

  const handleDeletePosition = useCallback(async (accountId: string) => {
    Alert.alert(t('inv.deleteTitle'), t('inv.deleteDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await investmentsApi.deleteAccount(accountId);
            await load(true);
          } catch (e: any) {
            Alert.alert(t('common.error'), e?.response?.data?.detail ?? t('inv.deleteError'));
          }
        },
      },
    ]);
  }, [load, t]);

  const handleAddWatchTicker = useCallback(async (ticker: string) => {
    if (watchTickers.includes(ticker)) {
      Alert.alert(t('common.confirm'), t('inv.alreadyWatched'));
      return;
    }
    const next = [...watchTickers, ticker];
    await persistWatchTickers(next);
    setShowWatchModal(false);
    await load(true);
  }, [load, persistWatchTickers, watchTickers, t]);

  const handleRemoveWatchTicker = useCallback(async (ticker: string) => {
    const next = watchTickers.filter((item) => item !== ticker);
    await persistWatchTickers(next);
    setWatchlist((items) => items.filter((item) => item.ticker !== ticker));
  }, [persistWatchTickers, watchTickers]);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />,
    [refreshing, load],
  );

  if (loading) return <LoadingView message={t('inv.loading')} />;
  if (error)   return <ErrorView message={error} onRetry={() => load()} />;

  const hasPositions = (portfolio?.positions?.length ?? 0) > 0;
  const totalValue   = portfolio?.summary.total_value ?? 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={refreshControl}
    >
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>{t('inv.title')}</Text>
          <Text style={styles.pageSubtitle}>{t('inv.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.headerAddBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.headerAddText}>＋</Text>
        </TouchableOpacity>
      </View>

      {portfolio && hasPositions && (
        <SummaryCard summary={portfolio.summary} positions={portfolio.positions} />
      )}

      <View style={styles.holdingsSection}>
        <View style={styles.holdingsHeader}>
          <Text style={styles.sectionTitle}>{t('inv.holdings')}</Text>
          {hasPositions && (
            <Text style={styles.holdingsCount}>{portfolio?.positions.length}</Text>
          )}
        </View>
        {!hasPositions ? (
          <View style={[styles.emptyCard, { marginHorizontal: 16 }]}>
            <Text style={styles.emptyTitle}>{t('inv.noHoldings')}</Text>
            <Text style={styles.emptyBody}>{t('inv.noHoldingsDesc')}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyBtnText}>{t('inv.addFirst')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={POS_CARD_WIDTH + 12}
            snapToAlignment="start"
            contentContainerStyle={styles.posCarousel}
          >
            {portfolio?.positions.map((pos) => (
              <PositionCard key={pos.account_id} pos={pos} totalValue={totalValue} onDelete={handleDeletePosition} />
            ))}
          </ScrollView>
        )}
      </View>

      {hasPositions && portfolio && (
        <AllocationChart positions={portfolio.positions} />
      )}

      {hasPositions && (
        <RiskPanel metrics={riskMetrics} loading={riskLoading} />
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('inv.market')}</Text>
          <TouchableOpacity style={styles.smallAddBtn} onPress={() => setShowWatchModal(true)}>
            <Text style={styles.smallAddText}>{t('inv.addTicker')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.watchCard}>
          {watchlist.length === 0 ? (
            <View style={styles.watchEmpty}>
              <Text style={styles.watchEmptyText}>{t('inv.watchEmpty')}</Text>
            </View>
          ) : (
            watchlist.map((item, i) => (
              <React.Fragment key={item.ticker}>
                <WatchItem item={item} toKRW={toKRW} onRemove={handleRemoveWatchTicker} />
                {i < watchlist.length - 1 && <View style={styles.watchSep} />}
              </React.Fragment>
            ))
          )}
        </View>
      </View>

      <View style={{ height: 40 }} />
      <AddInvestmentModal
        visible={showAddModal}
        saving={saving}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreateInvestment}
      />
      <AddWatchTickerModal
        visible={showWatchModal}
        onClose={() => setShowWatchModal(false)}
        onSubmit={handleAddWatchTicker}
      />
    </ScrollView>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 2,
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  pageSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  headerAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddText: { color: COLORS.textInverse, fontSize: 24, lineHeight: 28 },

  // ── Summary ──
  summaryCard: {
    margin: 16, padding: 24,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 8,
  },
  summaryTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryTitle:   { color: COLORS.primaryLight, fontSize: 12, letterSpacing: 0.8, fontWeight: '600' },
  summaryEye:     { fontSize: 14 },
  modeToggle:     { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 2 },
  modeBtn:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  modeBtnActive:  { backgroundColor: 'rgba(255,255,255,0.18)' },
  modeBtnText:    { fontSize: 11, color: COLORS.primaryMid, fontWeight: '600' },
  modeBtnTextActive: { color: COLORS.textInverse },
  summaryValue:   { color: COLORS.textInverse, fontSize: 30, fontWeight: '800', marginBottom: 6 },
  glRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  glAmt:          { fontSize: 15, fontWeight: '600' },
  glBadge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  glBadgeText:    { fontSize: 12, fontWeight: '700' },
  summaryMetaRow: { flexDirection: 'row', alignItems: 'center' },
  summaryMetaItem:{ flex: 1, alignItems: 'center' },
  summaryMetaLabel: { color: COLORS.primaryMid, fontSize: 11, marginBottom: 4 },
  summaryMetaValue: { color: COLORS.textInverse, fontSize: 13, fontWeight: '600' },
  summaryMetaDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.12)' },

  // ── Section ──
  section:        { marginHorizontal: 16, marginTop: 16 },
  holdingsSection:{ marginTop: 16 },
  holdingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  holdingsCount:  { fontSize: 12, color: COLORS.textMuted, fontWeight: '700', marginBottom: 10 },
  posCarousel:    { paddingHorizontal: 16, gap: 12, paddingRight: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  smallAddBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallAddText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  // ── Allocation ──
  allocCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  allocBar:        { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 16 },
  allocSegment:    { height: '100%' },
  allocLegend:     { gap: 10 },
  allocLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  allocDot:        { width: 10, height: 10, borderRadius: 5 },
  allocLegendText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  allocLabel:      { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  allocPct:        { fontSize: 13, color: COLORS.textMuted },
  allocAmt:        { fontSize: 13, color: COLORS.text, fontWeight: '600' },

  // ── Risk ──
  riskCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  riskLoading:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  riskLoadingText:{ fontSize: 13, color: COLORS.textMuted },
  riskGrid:       { flexDirection: 'row', flexWrap: 'wrap' },
  riskItem:       { width: '50%', paddingVertical: 12, paddingHorizontal: 4 },
  riskLabel:      { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.4, marginBottom: 4 },
  riskValue:      { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  riskSub:        { fontSize: 10, color: COLORS.textLight },
  divScoreBlock:  { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  divScoreHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  divScoreLabel:  { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  divScoreNum:    { fontSize: 12, fontWeight: '700' },
  divBarBg:       { flexDirection: 'row', height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  divBarFill:     { borderRadius: 4 },
  divHint:        { fontSize: 11, color: COLORS.textLight },

  // ── Position ──
  posCard: {
    width: POS_CARD_WIDTH,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  posHeader:      { flexDirection: 'row', justifyContent: 'space-between', padding: 14, paddingBottom: 12 },
  posLeft:        { flex: 1 },
  posRight:       { alignItems: 'flex-end' },
  posName:        { fontSize: 15, fontWeight: '700', color: COLORS.text },
  posTicker:      { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  posPrice:       { fontSize: 16, fontWeight: '700', color: COLORS.text },
  posChange:      { fontSize: 12, fontWeight: '600', marginTop: 3 },
  posDivider:     { height: 1, backgroundColor: COLORS.border, marginHorizontal: 14 },
  posDetailRow:   { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12 },
  posDetailItem:  { flex: 1, alignItems: 'center' },
  posDetailLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 4, letterSpacing: 0.3 },
  posDetailValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  posGlBar:       { paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  posGlText:      { fontSize: 13, fontWeight: '700' },
  posDeleteBtn:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: COLORS.dangerBg, marginBottom: 6 },
  posDeleteText:  { fontSize: 10, color: COLORS.danger, fontWeight: '700' },

  // ── Watchlist ──
  watchCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  watchItem:       { paddingHorizontal: 16, paddingVertical: 12 },
  watchTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  watchTicker:     { fontSize: 14, fontWeight: '700', color: COLORS.text },
  watchPriceBlock: { alignItems: 'flex-end' },
  watchPrice:      { fontSize: 14, fontWeight: '600', color: COLORS.text },
  watchChange:     { fontSize: 12, fontWeight: '600', marginTop: 2 },
  watchActionRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  watchRemoveBtn:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: COLORS.dangerBg },
  watchRemoveText: { fontSize: 10, color: COLORS.danger, fontWeight: '700' },
  watch52Row:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  watch52Edge:     { fontSize: 9, color: COLORS.textLight, minWidth: 36 },
  watch52BarWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center' },
  watch52Dot:      { width: 8, height: 8, borderRadius: 4, marginHorizontal: -4, zIndex: 1 },
  watchMktCap:     { fontSize: 10, color: COLORS.textLight },
  watchSep:        { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  watchEmpty:      { padding: 18, alignItems: 'center' },
  watchEmptyText:  { fontSize: 13, color: COLORS.textLight, textAlign: 'center' },

  // ── Empty ──
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 30,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6 },
  emptyBody:  { fontSize: 13, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  emptyBtnText: { color: COLORS.textInverse, fontSize: 14, fontWeight: '700' },

  dropdown: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownSep: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropdownLeft: { flex: 1, marginRight: 8 },
  dropdownName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  dropdownExchange: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  dropdownTicker: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 0,
  },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    zIndex: 1,
    maxHeight: '85%' as any,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  saveText: { color: COLORS.textInverse, fontSize: 14, fontWeight: '700' },
});
