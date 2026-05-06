import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { accountsApi, transactionsApi, classifyApi, Account, ReceiptScanResult, Transaction } from '../services/api';
import { ReceiptScanButton } from '../components/ReceiptScanner';
import SmsImportButton from '../components/SmsImportButton';
import { ParsedCardSms } from '../services/smsReader';
import { LoadingView } from '../components/LoadingView';
import { COLORS, CATEGORY_LABELS } from '../constants';

type Props = NativeStackScreenProps<any, 'AddTransactionHome'>;
type TxType = 'expense' | 'income' | 'transfer';
type DateMode = 'today' | 'yesterday' | 'custom';

interface QuickTemplate {
  description: string;
  amount: string;
  fromAccountId: string;
  toAccountId: string;
  category: string;
  count: number;
}

const EXPENSE_CATS = [
  { key: 'food',          icon: '🍽', hint: '식비'   },
  { key: 'transport',     icon: '🚌', hint: '교통'   },
  { key: 'shopping',      icon: '🛍', hint: '쇼핑'   },
  { key: 'health',        icon: '💊', hint: '의료'   },
  { key: 'education',     icon: '📚', hint: '교육'   },
  { key: 'entertainment', icon: '🎮', hint: '여가'   },
  { key: 'housing',       icon: '🏠', hint: '주거'   },
  { key: 'other_expense', icon: '📦', hint: ''       },
] as const;

// ─── 날짜 유틸 ───────────────────────────────────────────────────────────────

function getDateISO(mode: DateMode, custom: string): string {
  if (mode === 'today')     return new Date().toISOString();
  if (mode === 'yesterday') {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString();
  }
  const parsed = new Date(custom);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseQuickInput(value: string): { description: string; amount: string } | null {
  const compact = value.replace(/,/g, '').trim();
  const match = compact.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*(만원|만|천원|천|원)?$/);
  if (!match) return null;

  const unit = match[3] ?? '';
  let amount = Number(match[2]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === '만원' || unit === '만') amount *= 10000;
  if (unit === '천원' || unit === '천') amount *= 1000;

  const description = match[1].trim();
  if (!description) return null;
  return { description, amount: String(Math.round(amount)) };
}

function expenseCategoryFromTx(tx: Transaction): string {
  const debit = tx.entries.find((e) => e.entry_type === 'debit');
  const text = `${tx.description} ${debit?.account_name ?? ''}`.toLowerCase();
  const map: Array<{ key: string; words: string[] }> = [
    { key: 'food', words: ['식비', '식사', '카페', '커피', '편의점', '배달', 'food'] },
    { key: 'transport', words: ['교통', '버스', '지하철', '택시', '주차', 'transport'] },
    { key: 'shopping', words: ['쇼핑', '마트', '쿠팡', '구매', 'shopping'] },
    { key: 'health', words: ['의료', '병원', '약국', '헬스', 'health'] },
    { key: 'education', words: ['교육', '학원', '강의', '도서', 'education'] },
    { key: 'entertainment', words: ['여가', '영화', '게임', '여행', 'entertainment'] },
    { key: 'housing', words: ['주거', '월세', '관리비', '통신', 'housing'] },
  ];
  return map.find(({ words }) => words.some((w) => text.includes(w)))?.key ?? 'other_expense';
}

function buildQuickTemplates(txs: Transaction[]): QuickTemplate[] {
  const grouped = new Map<string, QuickTemplate>();
  for (const tx of txs) {
    const debit = tx.entries.find((e) => e.entry_type === 'debit');
    const credit = tx.entries.find((e) => e.entry_type === 'credit');
    if (!debit || !credit || !tx.description.trim()) continue;

    const key = tx.description.trim().toLowerCase();
    const prev = grouped.get(key);
    if (prev) {
      prev.count += 1;
      continue;
    }
    grouped.set(key, {
      description: tx.description.trim(),
      amount: String(Math.round(Number(debit.amount))),
      fromAccountId: credit.account_id,
      toAccountId: debit.account_id,
      category: expenseCategoryFromTx(tx),
      count: 1,
    });
  }

  return [...grouped.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ─── TypeTab ─────────────────────────────────────────────────────────────────

const TX_ICONS: Record<TxType, string> = { expense: '💸', income: '💰', transfer: '↔️' };
const TX_COLORS: Record<TxType, { color: string; bg: string; dark: string }> = {
  expense:  { color: COLORS.danger,  bg: COLORS.dangerBg,  dark: '#7a1f1f' },
  income:   { color: COLORS.success, bg: COLORS.successBg, dark: '#1a4a32' },
  transfer: { color: COLORS.info,    bg: COLORS.infoBg,    dark: '#1a3a6a' },
};

function TypeTab({ value, onChange }: { value: TxType; onChange: (t: TxType) => void }) {
  const { t } = useTranslation();
  const TX_TYPES: TxType[] = ['expense', 'income', 'transfer'];
  const TX_LABELS: Record<TxType, string> = {
    expense: t('tx.expense'), income: t('tx.income'), transfer: t('tx.transfer'),
  };
  return (
    <View style={tab.wrap}>
      {TX_TYPES.map((type) => {
        const active = value === type;
        return (
          <TouchableOpacity
            key={type}
            style={[tab.btn, active && { backgroundColor: TX_COLORS[type].color }]}
            onPress={() => onChange(type)}
            activeOpacity={0.75}
          >
            <Text style={tab.icon}>{TX_ICONS[type]}</Text>
            <Text style={[tab.label, active && tab.labelActive]}>{TX_LABELS[type]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tab = StyleSheet.create({
  wrap:        { flexDirection: 'row', margin: 16, backgroundColor: COLORS.border, borderRadius: 14, padding: 4 },
  btn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderRadius: 11 },
  icon:        { fontSize: 16 },
  label:       { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
  labelActive: { color: '#fff' },
});

// ─── AmountCard ──────────────────────────────────────────────────────────────

function AmountCard({ raw, onChangeRaw, color }: { raw: string; onChangeRaw: (v: string) => void; color: string }) {
  const { t } = useTranslation();
  const display = raw ? Number(raw).toLocaleString('ko-KR') : '';
  return (
    <View style={[amt.card, { borderColor: color + '55' }]}>
      <Text style={[amt.currency, { color }]}>₩</Text>
      <TextInput
        style={[amt.input, { color: raw ? COLORS.text : COLORS.textLight }]}
        value={display}
        onChangeText={(v) => onChangeRaw(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder={t('tx.amount')}
        placeholderTextColor={COLORS.textLight}
        selectTextOnFocus
      />
    </View>
  );
}

const amt = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.surface, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 4, borderWidth: 2 },
  currency: { fontSize: 28, fontWeight: '700', marginRight: 6 },
  input:    { flex: 1, fontSize: 36, fontWeight: '800', paddingVertical: 14 },
});

// ─── DateSelector ────────────────────────────────────────────────────────────

function DateSelector({ mode, custom, onMode, onCustom }: {
  mode: DateMode; custom: string; onMode: (m: DateMode) => void; onCustom: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={ds.wrap}>
      {(['today', 'yesterday', 'custom'] as DateMode[]).map((m) => {
        const label = m === 'today' ? t('tx.today') : m === 'yesterday' ? t('tx.yesterday') : t('tx.pickDate');
        return (
          <TouchableOpacity
            key={m}
            style={[ds.chip, mode === m && ds.chipActive]}
            onPress={() => onMode(m)}
            activeOpacity={0.7}
          >
            <Text style={[ds.chipText, mode === m && ds.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
      {mode === 'custom' && (
        <TextInput
          style={ds.dateInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.textLight}
          value={custom}
          onChangeText={onCustom}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      )}
    </View>
  );
}

const ds = StyleSheet.create({
  wrap:          { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4 },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive:    { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  chipText:      { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  chipTextActive:{ color: '#fff' },
  dateInput:     { flex: 1, minWidth: 120, fontSize: 13, color: COLORS.text, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
});

// ─── DescriptionField ────────────────────────────────────────────────────────

function DescriptionField({ value, onChange, txType, onScanResult }: {
  value: string; onChange: (v: string) => void;
  txType: TxType; onScanResult: (r: ReceiptScanResult) => void;
}) {
  const { t } = useTranslation();
  const QUICK_DESCS: Record<TxType, string[]> = {
    expense:  [t('tx.qConvenience'), t('tx.qCafe'), t('tx.qRestaurant'), t('tx.qMart'), t('tx.qDelivery'), t('tx.qGas')],
    income:   [t('tx.qSalary'), t('tx.qInterest'), t('tx.qDividend'), t('tx.qRefund'), t('tx.qAllowance')],
    transfer: [t('tx.qSavings'), t('tx.qLiving'), t('tx.qInvestment')],
  };
  const chips = QUICK_DESCS[txType];
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t('tx.description')}</Text>
      <View style={df.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={t('tx.descPh')}
          placeholderTextColor={COLORS.textLight}
          value={value}
          onChangeText={onChange}
          returnKeyType="next"
        />
        {txType === 'expense' && (
          <View style={df.scanWrap}>
            <ReceiptScanButton onResult={onScanResult} compact />
          </View>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={df.chips} contentContainerStyle={df.chipsContent}>
        {chips.map((c) => (
          <TouchableOpacity key={c} style={df.chip} onPress={() => onChange(c)} activeOpacity={0.7}>
            <Text style={df.chipText}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const df = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanWrap:     { marginLeft: 4 },
  chips:        { flexGrow: 0, marginTop: 10 },
  chipsContent: { gap: 8 },
  chip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  chipText:     { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
});

function TemplateChips({ templates, onSelect }: {
  templates: QuickTemplate[];
  onSelect: (template: QuickTemplate) => void;
}) {
  if (templates.length === 0) return null;
  return (
    <View style={styles.card}>
      <View style={tpl.header}>
        <Text style={styles.cardLabel}>자주 쓰는 거래</Text>
        <Text style={tpl.hint}>한 번 누르면 자동 입력</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tpl.row}>
        {templates.map((template) => (
          <TouchableOpacity
            key={`${template.description}-${template.fromAccountId}-${template.toAccountId}`}
            style={tpl.chip}
            onPress={() => onSelect(template)}
            activeOpacity={0.75}
          >
            <Text style={tpl.name} numberOfLines={1}>{template.description}</Text>
            <Text style={tpl.amount}>₩{Number(template.amount).toLocaleString('ko-KR')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const tpl = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  hint: { fontSize: 11, color: COLORS.textLight, fontWeight: '500' },
  row: { gap: 8, paddingBottom: 2 },
  chip: {
    width: 128,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  name: { fontSize: 13, color: COLORS.text, fontWeight: '700', marginBottom: 4 },
  amount: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
});

function SuggestionBanner({ category, accountName, confidence, onApply }: {
  category: string;
  accountName: string;
  confidence: number;
  onApply: () => void;
}) {
  const label = CATEGORY_LABELS[category] ?? category;
  return (
    <TouchableOpacity style={sg.card} onPress={onApply} activeOpacity={0.78}>
      <View>
        <Text style={sg.title}>자동 추천</Text>
        <Text style={sg.body}>{label}{accountName ? ` · ${accountName}` : ''}</Text>
      </View>
      <Text style={sg.conf}>{Math.round(confidence * 100)}%</Text>
    </TouchableOpacity>
  );
}

const sg = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.success,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 11, color: COLORS.success, fontWeight: '800', marginBottom: 3 },
  body: { fontSize: 13, color: COLORS.text, fontWeight: '700' },
  conf: { fontSize: 12, color: COLORS.success, fontWeight: '800' },
});

// ─── CategoryGrid (지출 항목) ─────────────────────────────────────────────────

function CategoryGrid({ selected, onSelect, color }: {
  selected: string; onSelect: (key: string) => void; color: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t('tx.category')}</Text>
      <View style={cg.grid}>
        {EXPENSE_CATS.map(({ key, icon }) => {
          const active = selected === key;
          const label = key === 'other_expense' ? t('tx.cat_other') : t(`tx.cat_${key}`);
          return (
            <TouchableOpacity
              key={key}
              style={[cg.item, active && { backgroundColor: color + '18', borderColor: color }]}
              onPress={() => onSelect(key)}
              activeOpacity={0.7}
            >
              <Text style={cg.icon}>{icon}</Text>
              <Text style={[cg.label, active && { color, fontWeight: '700' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const cg = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item:  { width: '22%', aspectRatio: 1, borderRadius: 14, backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', gap: 4 },
  icon:  { fontSize: 22 },
  label: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
});

// ─── AccountRow (간결한 계좌 선택) ───────────────────────────────────────────

function AccountRow({ label, accounts, selectedId, onSelect }: {
  label: string; accounts: Account[]; selectedId: string; onSelect: (id: string) => void;
}) {
  if (accounts.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ar.row}>
        {accounts.map((acc) => {
          const selected = acc.id === selectedId;
          return (
            <TouchableOpacity
              key={acc.id}
              style={[ar.chip, selected && ar.chipSelected]}
              onPress={() => onSelect(acc.id)}
              activeOpacity={0.75}
            >
              <Text style={ar.accIcon}>{accIcon(acc.category)}</Text>
              <Text style={[ar.name, selected && ar.nameSelected]} numberOfLines={1}>
                {acc.name}
              </Text>
              {selected && <Text style={ar.check}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function accIcon(category: string) {
  const map: Record<string, string> = {
    bank: '🏦', cash: '💵', credit_card: '💳',
    investment: '📈', loan: '🏧', salary: '💼',
    investment_income: '📊', other_revenue: '💹',
  };
  return map[category] ?? '💰';
}

const ar = StyleSheet.create({
  row:          { gap: 8, paddingBottom: 4 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, maxWidth: 160 },
  chipSelected: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  accIcon:      { fontSize: 16 },
  name:         { fontSize: 13, fontWeight: '600', color: COLORS.text },
  nameSelected: { color: '#fff' },
  check:        { fontSize: 12, color: COLORS.primaryLight, marginLeft: 2 },
});

// ─── TransferArrow (이체 시각화) ──────────────────────────────────────────────

function TransferArrow() {
  return (
    <View style={ta.wrap}>
      <View style={ta.line} />
      <View style={ta.arrowCircle}>
        <Text style={ta.arrow}>→</Text>
      </View>
      <View style={ta.line} />
    </View>
  );
}

const ta = StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: -4 },
  line:        { flex: 1, height: 1, backgroundColor: COLORS.border },
  arrowCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  arrow:       { fontSize: 16, color: COLORS.info, fontWeight: '700' },
});

// ─── ScanBanner ──────────────────────────────────────────────────────────────

function ScanBanner({ result, onDismiss }: { result: ReceiptScanResult; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={sb.card}>
      <View style={sb.header}>
        <Text style={sb.title}>{t('tx.receiptTitle')}</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={sb.close}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={sb.merchant}>{result.merchant ?? t('tx.unknownMerchant')}</Text>
      {result.items.length > 0 && <Text style={sb.items}>{result.items.join(' · ')}</Text>}
      <Text style={sb.conf}>{t('tx.confidence', { pct: Math.round(result.confidence * 100) })}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  card:     { marginHorizontal: 16, marginBottom: 4, backgroundColor: COLORS.infoBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.info },
  header:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  title:    { fontSize: 12, fontWeight: '700', color: COLORS.info },
  close:    { fontSize: 15, color: COLORS.textMuted },
  merchant: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  items:    { fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  conf:     { fontSize: 10, color: COLORS.textLight },
});

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function AddTransactionScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const routeScanResult = (route.params as any)?.initialScanResult as ReceiptScanResult | undefined;
  const [txType, setTxType]             = useState<TxType>('expense');
  const [amountRaw, setAmountRaw]       = useState('');
  const [description, setDescription]   = useState('');
  const [memo, setMemo]                 = useState('');
  const [dateMode, setDateMode]         = useState<DateMode>('today');
  const [customDate, setCustomDate]     = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId]   = useState('');
  const [selectedCat, setSelectedCat]   = useState('');
  const [showMemo, setShowMemo]         = useState(false);
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [quickTemplates, setQuickTemplates] = useState<QuickTemplate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [scanResult, setScanResult]     = useState<ReceiptScanResult | null>(null);
  const [suggestion, setSuggestion]     = useState<{
    category: string;
    accountId: string;
    accountName: string;
    confidence: number;
  } | null>(null);
  const [error, setError]               = useState('');
  // 대시보드 퀵 스캔에서 전달된 결과 (마운트 시 1회만 적용)
  const initialScanRef = useRef<ReceiptScanResult | null>(routeScanResult ?? null);

  useEffect(() => {
    Promise.all([
      accountsApi.list(),
      transactionsApi.list(120).catch(() => ({ data: [] as Transaction[] })),
    ])
      .then(([accountsRes, txsRes]) => {
        setAccounts(accountsRes.data);
        setQuickTemplates(buildQuickTemplates(txsRes.data));
        // 대시보드에서 스캔 결과를 넘겨받은 경우 자동 적용
        const scan = initialScanRef.current;
        if (scan) {
          initialScanRef.current = null;
          if (scan.description) setDescription(scan.description);
          if (scan.amount != null) setAmountRaw(String(Math.round(scan.amount)));
          setScanResult(scan);
          setTxType('expense');
          const payAccts = accountsRes.data.filter((a: Account) => ['bank', 'cash', 'credit_card'].includes(a.category));
          const bank = payAccts.find((a: Account) => a.category === 'bank') ?? payAccts[0];
          if (bank) setFromAccountId(bank.id);
        }
      })
      .catch(() => setError(t('tx.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  // 계좌 분류
  const paymentAccounts = useMemo(
    () => accounts.filter(a => ['bank', 'cash', 'credit_card'].includes(a.category)),
    [accounts],
  );
  const assetAccounts = useMemo(
    () => accounts.filter(a => a.account_type === 'asset' && ['bank', 'cash'].includes(a.category)),
    [accounts],
  );
  const revenueAccounts = useMemo(
    () => accounts.filter(a => a.account_type === 'revenue'),
    [accounts],
  );
  const expenseAccounts = useMemo(
    () => accounts.filter(a => a.account_type === 'expense'),
    [accounts],
  );

  useEffect(() => {
    if (!routeScanResult) return;
    setTxType('expense');
    if (routeScanResult.description) setDescription(routeScanResult.description);
    if (routeScanResult.amount != null) setAmountRaw(String(Math.round(routeScanResult.amount)));
    setScanResult(routeScanResult);
    if (routeScanResult.category) {
      const matched = expenseAccounts.find((a) => a.category === routeScanResult.category);
      setSelectedCat(routeScanResult.category);
      if (matched) setToAccountId(matched.id);
    }
    if (!fromAccountId) {
      const bank = paymentAccounts.find((a) => a.category === 'bank') ?? paymentAccounts[0];
      if (bank) setFromAccountId(bank.id);
    }
  }, [expenseAccounts, fromAccountId, paymentAccounts, routeScanResult]);

  useEffect(() => {
    if (txType !== 'expense') {
      setSuggestion(null);
      return;
    }
    const q = description.trim();
    if (q.length < 2) {
      setSuggestion(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await classifyApi.classify(q);
        if (cancelled) return;
        const data = res.data;
        if (!data.suggested_category || data.confidence < 0.5) {
          setSuggestion(null);
          return;
        }

        const matchedAccount = data.suggested_account_id
          ? expenseAccounts.find((a) => a.id === data.suggested_account_id)
          : expenseAccounts.find((a) => a.category === data.suggested_category);

        setSuggestion({
          category: data.suggested_category,
          accountId: matchedAccount?.id ?? '',
          accountName: matchedAccount?.name ?? data.suggested_account_name ?? '',
          confidence: data.confidence,
        });

        if (!selectedCat || data.confidence >= 0.75) {
          setSelectedCat(data.suggested_category);
          if (matchedAccount) setToAccountId(matchedAccount.id);
        }
      } catch {
        if (!cancelled) setSuggestion(null);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [description, expenseAccounts, selectedCat, txType]);

  // 타입 변경 시 계좌 초기화
  const handleTypeChange = useCallback((t: TxType) => {
    setTxType(t);
    setFromAccountId('');
    setToAccountId('');
    setSelectedCat('');
    setSuggestion(null);
  }, []);

  // 카테고리 선택 → 지출 계정 자동 매핑
  const handleCatSelect = useCallback((key: string) => {
    setSelectedCat(key);
    const cat = EXPENSE_CATS.find(c => c.key === key);
    const match = expenseAccounts.find(a => a.category === key) ?? expenseAccounts.find(a =>
      cat?.hint && (a.name.includes(cat.hint) || (CATEGORY_LABELS[a.category] ?? '').includes(cat.hint))
    ) ?? expenseAccounts[0];
    if (match) setToAccountId(match.id);
  }, [expenseAccounts]);

  const applySuggestion = useCallback(() => {
    if (!suggestion) return;
    setSelectedCat(suggestion.category);
    if (suggestion.accountId) setToAccountId(suggestion.accountId);
  }, [suggestion]);

  const handleDescriptionChange = useCallback((value: string) => {
    const parsed = parseQuickInput(value);
    if (parsed && !amountRaw) {
      setDescription(parsed.description);
      setAmountRaw(parsed.amount);
      return;
    }
    setDescription(value);
  }, [amountRaw]);

  const handleTemplateSelect = useCallback((template: QuickTemplate) => {
    setTxType('expense');
    setDescription(template.description);
    setAmountRaw(template.amount);
    setFromAccountId(template.fromAccountId);
    setToAccountId(template.toAccountId);
    setSelectedCat(template.category);
    setSuggestion(null);
  }, []);

  // 카드 문자 자동입력 (Android 전용)
  const handleSmsImport = useCallback((parsed: ParsedCardSms) => {
    setTxType('expense');
    setAmountRaw(String(parsed.amount));
    setDescription(parsed.merchant);
    if (!fromAccountId) {
      const card = paymentAccounts.find(a => a.category === 'credit_card')
        ?? paymentAccounts.find(a => a.category === 'bank');
      if (card) setFromAccountId(card.id);
    }
  }, [fromAccountId, paymentAccounts]);

  // 영수증 스캔 결과 적용
  const handleScanResult = useCallback((r: ReceiptScanResult) => {
    setScanResult(r);
    if (r.description) setDescription(r.description);
    if (r.amount != null) setAmountRaw(String(Math.round(r.amount)));
    if (r.category) {
      const cat = EXPENSE_CATS.find(c => c.key === r.category);
      if (cat) handleCatSelect(cat.key);
    }
    if (!fromAccountId) {
      const bank = paymentAccounts.find(a => a.category === 'bank');
      if (bank) setFromAccountId(bank.id);
    }
  }, [fromAccountId, paymentAccounts, handleCatSelect]);

  const meta = { color: TX_COLORS[txType].color, icon: TX_ICONS[txType] };

  const validate = (): string | null => {
    if (!description.trim()) return t('tx.descRequired');
    const n = Number(amountRaw);
    if (!amountRaw || isNaN(n) || n <= 0) return t('tx.amountRequired');
    if (!fromAccountId) return txType === 'expense' ? t('tx.paymentRequired') : txType === 'income' ? t('tx.incomeSrcRequired') : t('tx.fromRequired');
    if (!toAccountId) return txType === 'expense' ? t('tx.categoryRequired') : txType === 'income' ? t('tx.toRequired') : t('tx.toRequired2');
    if (fromAccountId === toAccountId) return t('tx.sameAccount');
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);
    try {
      await transactionsApi.createSimple({
        date: getDateISO(dateMode, customDate),
        description: description.trim(),
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: Number(amountRaw),
        memo: memo.trim() || undefined,
      });
      // 성공 → 초기화 후 뒤로
      setAmountRaw(''); setDescription(''); setMemo('');
      setFromAccountId(''); setToAccountId(''); setSelectedCat('');
      setScanResult(null); setDateMode('today');
      navigation.goBack();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? t('tx.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <View style={styles.screen}>
      {/* 거래 유형 탭 */}
      <TypeTab value={txType} onChange={handleTypeChange} />

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 카드 문자 자동입력 (Android 전용) */}
        <SmsImportButton onSelect={handleSmsImport} />

        {/* 금액 입력 */}
        <AmountCard raw={amountRaw} onChangeRaw={setAmountRaw} color={meta.color} />

        {/* 날짜 선택 */}
        <DateSelector mode={dateMode} custom={customDate} onMode={setDateMode} onCustom={setCustomDate} />

        {/* 영수증 스캔 결과 */}
        {scanResult && <ScanBanner result={scanResult} onDismiss={() => setScanResult(null)} />}

        {/* 에러 메시지 */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        ) : null}

        {/* 내용 입력 */}
        <DescriptionField
          value={description}
          onChange={handleDescriptionChange}
          txType={txType}
          onScanResult={handleScanResult}
        />

        {txType === 'expense' && suggestion && (
          <SuggestionBanner
            category={suggestion.category}
            accountName={suggestion.accountName}
            confidence={suggestion.confidence}
            onApply={applySuggestion}
          />
        )}

        {txType === 'expense' && (
          <TemplateChips templates={quickTemplates} onSelect={handleTemplateSelect} />
        )}

        {/* ── 지출 ── */}
        {txType === 'expense' && (
          <>
            <AccountRow
              label={t('tx.payment')}
              accounts={paymentAccounts}
              selectedId={fromAccountId}
              onSelect={setFromAccountId}
            />
            <CategoryGrid
              selected={selectedCat}
              onSelect={handleCatSelect}
              color={meta.color}
            />
          </>
        )}

        {/* ── 수입 ── */}
        {txType === 'income' && (
          <>
            <AccountRow
              label={t('tx.incomeType')}
              accounts={revenueAccounts}
              selectedId={fromAccountId}
              onSelect={setFromAccountId}
            />
            <AccountRow
              label={t('tx.toAccount')}
              accounts={assetAccounts}
              selectedId={toAccountId}
              onSelect={setToAccountId}
            />
          </>
        )}

        {/* ── 이체 ── */}
        {txType === 'transfer' && (
          <>
            <AccountRow
              label={t('tx.fromAccount')}
              accounts={assetAccounts}
              selectedId={fromAccountId}
              onSelect={setFromAccountId}
            />
            <TransferArrow />
            <AccountRow
              label={t('tx.receiveAccount')}
              accounts={assetAccounts.filter(a => a.id !== fromAccountId)}
              selectedId={toAccountId}
              onSelect={setToAccountId}
            />
          </>
        )}

        {/* 메모 (접기/펼치기) */}
        <TouchableOpacity style={styles.memoToggle} onPress={() => setShowMemo(v => !v)} activeOpacity={0.7}>
          <Text style={styles.memoToggleText}>{showMemo ? t('tx.memoClose') : t('tx.memoAdd')}</Text>
        </TouchableOpacity>
        {showMemo && (
          <View style={[styles.card, { marginTop: 0 }]}>
            <TextInput
              style={[styles.input, styles.memoInput]}
              placeholder={t('tx.memoPh')}
              placeholderTextColor={COLORS.textLight}
              value={memo}
              onChangeText={setMemo}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* 제출 버튼 */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: meta.color }, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitIcon}>{meta.icon}</Text>
              <Text style={styles.submitText}>{t('tx.submit', { type: t(`tx.${txType}`) })}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── 공용 스타일 ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },

  card: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 12 },

  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: COLORS.text,
  },
  memoInput: { height: 80, textAlignVertical: 'top' },

  errorBanner: { marginHorizontal: 16, marginTop: 8, backgroundColor: COLORS.dangerBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.danger },
  errorText:   { fontSize: 13, color: COLORS.danger, fontWeight: '600' },

  memoToggle:     { alignSelf: 'center', marginTop: 14, marginBottom: 2, paddingVertical: 6, paddingHorizontal: 16 },
  memoToggleText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 20,
    borderRadius: 16, paddingVertical: 17,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitIcon: { fontSize: 20 },
  submitText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
