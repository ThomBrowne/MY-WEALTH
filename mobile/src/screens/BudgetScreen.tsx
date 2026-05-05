import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { budgetApi, BudgetOverview, BudgetItem } from '../services/api';
import { LoadingView, ErrorView } from '../components/LoadingView';
import { COLORS, CATEGORY_LABELS, formatAmount } from '../constants';

const BUDGET_CATEGORY_KEYS = ['food', 'transport', 'shopping', 'health', 'education', 'entertainment', 'housing'] as const;
type BudgetCatKey = typeof BUDGET_CATEGORY_KEYS[number];

// ─── 서브 컴포넌트 (React.memo) ───────────────────────────────────────────────
const UsageBar = React.memo(function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? COLORS.danger : pct >= 70 ? '#F59E0B' : COLORS.success;
  const width = `${Math.min(pct, 100)}%` as any;
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width, backgroundColor: color }]} />
    </View>
  );
});

const BudgetCard = React.memo(function BudgetCard({ item }: { item: BudgetItem }) {
  const { t } = useTranslation();
  const label      = CATEGORY_LABELS[item.category] ?? item.category;
  const overBudget = item.spent > item.budgeted;
  const pctColor   = overBudget ? COLORS.danger : COLORS.textMuted;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={[styles.cardPct, { color: pctColor }]}>{item.usage_pct}%</Text>
      </View>
      <UsageBar pct={item.usage_pct} />
      <View style={styles.cardFooter}>
        <Text style={styles.cardSpent}>{t('budget.spentOf', { amount: formatAmount(item.spent) })}</Text>
        <Text style={styles.cardBudgeted}>/ {formatAmount(item.budgeted)}</Text>
      </View>
    </View>
  );
});

// ─── 메인 화면 ───────────────────────────────────────────────────────────────
export default function BudgetScreen() {
  const { t } = useTranslation();
  const [overview, setOverview]       = useState<BudgetOverview | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [selectedCat, setSelectedCat] = useState<BudgetCatKey>('food');
  const [budgetAmount, setBudgetAmount] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await budgetApi.overview();
      setOverview(res.data);
      setError('');
    } catch {
      setError(t('budget.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSaveBudget = useCallback(async () => {
    const amt = Number(budgetAmount);
    if (!amt || amt <= 0) { Alert.alert(t('common.error'), t('budget.invalidAmount')); return; }
    try {
      await budgetApi.create({ category: selectedCat, amount: amt });
      setShowModal(false);
      setBudgetAmount('');
      load();
    } catch {
      Alert.alert(t('common.error'), t('budget.saveFailed'));
    }
  }, [budgetAmount, selectedCat, load, t]);

  const closeModal = useCallback(() => setShowModal(false), []);
  const openModal  = useCallback(() => setShowModal(true),  []);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />,
    [refreshing, load],
  );

  if (loading) return <LoadingView message={t('budget.loading')} />;
  if (error)   return <ErrorView message={error} onRetry={() => load()} />;

  const categories  = overview?.categories ?? [];
  const hasBudget   = (overview?.total_budgeted ?? 0) > 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={refreshControl}
        removeClippedSubviews
        scrollEventThrottle={16}
      >
        {/* 전체 요약 */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('budget.overview')}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('budget.total')}</Text>
              <Text style={styles.summaryValue}>{formatAmount(overview?.total_budgeted ?? 0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('budget.spent')}</Text>
              <Text style={[styles.summaryValue, styles.valueExpense]}>
                {formatAmount(overview?.total_spent ?? 0)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('budget.remaining')}</Text>
              <Text style={[styles.summaryValue, styles.valueIncome]}>
                {formatAmount(overview?.total_remaining ?? 0)}
              </Text>
            </View>
          </View>
          {hasBudget && <UsageBar pct={overview?.overall_usage_pct ?? 0} />}
        </View>

        {/* 카테고리별 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('budget.categories')}</Text>
          {categories.length === 0 ? (
            <Text style={styles.emptyText}>{t('budget.empty')}</Text>
          ) : (
            categories.map((item) => <BudgetCard key={item.id} item={item} />)
          )}
        </View>
        <View style={styles.footer} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 예산 설정 모달 */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('budget.modalTitle')}</Text>

            <Text style={styles.label}>{t('budget.category')}</Text>
            <View style={styles.catGrid}>
              {BUDGET_CATEGORY_KEYS.map((key) => {
                const selected = selectedCat === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={selected ? styles.catChipSelected : styles.catChip}
                    onPress={() => setSelectedCat(key)}
                  >
                    <Text style={selected ? styles.catChipTextSelected : styles.catChipText}>
                      {t(`budget.cat_${key}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('budget.monthlyAmount')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('budget.amountPh')}
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              keyboardType="numeric"
              returnKeyType="done"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBudget}>
                <Text style={styles.saveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  footer:    { height: 100 },

  summaryCard: {
    margin: 16, padding: 20,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  summaryTitle:  { color: COLORS.primaryLight, fontSize: 13, marginBottom: 16 },
  summaryRow:    { flexDirection: 'row', marginBottom: 16 },
  summaryItem:   { flex: 1, alignItems: 'center' },
  summaryLabel:  { color: COLORS.primaryMid,  fontSize: 11, marginBottom: 4 },
  summaryValue:  { color: COLORS.textInverse, fontSize: 16, fontWeight: '700' },
  valueExpense:  { color: COLORS.danger },
  valueIncome:   { color: COLORS.success },

  barBg:   { height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  section:      { marginHorizontal: 16, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyText:    { color: COLORS.textLight, textAlign: 'center', paddingVertical: 30, lineHeight: 22 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardLabel:    { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardPct:      { fontSize: 13, fontWeight: '700' },
  cardFooter:   { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cardSpent:    { fontSize: 13, fontWeight: '600', color: COLORS.text },
  cardBudgeted: { fontSize: 12, color: COLORS.textMuted, marginLeft: 4 },

  fab:     { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: COLORS.surface, fontSize: 28, fontWeight: '300', lineHeight: 32 },

  modalBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:   { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  label:      { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },

  catGrid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catChip:             { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bg,      borderWidth: 1, borderColor: COLORS.border },
  catChipSelected:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.primary, borderWidth: 1, borderColor: COLORS.primary },
  catChipText:         { fontSize: 13, color: COLORS.textMuted },
  catChipTextSelected: { fontSize: 13, color: COLORS.surface, fontWeight: '600' },

  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: COLORS.text, marginBottom: 24 },

  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.bg,      borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelText:{ fontSize: 15, color: COLORS.textMuted, fontWeight: '600' },
  saveBtn:   { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveText:  { fontSize: 15, color: COLORS.surface, fontWeight: '700' },
});
