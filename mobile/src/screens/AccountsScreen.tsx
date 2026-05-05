import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, SectionList, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { accountsApi, Account } from '../services/api';
import { LoadingView, ErrorView } from '../components/LoadingView';
import { COLORS, ACCOUNT_TYPE_LABELS, CATEGORY_LABELS, formatAmount } from '../constants';

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense'];

function groupByType(accounts: Account[]) {
  const groups: Record<string, Account[]> = {};
  for (const acc of accounts) {
    if (!groups[acc.account_type]) groups[acc.account_type] = [];
    groups[acc.account_type].push(acc);
  }
  return TYPE_ORDER
    .filter((t) => groups[t]?.length)
    .map((t) => ({ title: ACCOUNT_TYPE_LABELS[t] ?? t, data: groups[t], type: t }));
}

function AccountRow({ account }: { account: Account }) {
  const isDebitNormal = account.account_type === 'asset' || account.account_type === 'expense';
  const bal = Number(account.balance);
  const isPositive = isDebitNormal ? bal >= 0 : bal >= 0;
  const color = bal > 0 ? COLORS.success : bal < 0 ? COLORS.danger : COLORS.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName}>{account.name}</Text>
        <Text style={styles.rowCategory}>{CATEGORY_LABELS[account.category] ?? account.category}</Text>
      </View>
      <Text style={[styles.rowBalance, { color }]}>{formatAmount(bal)}</Text>
    </View>
  );
}

export default function AccountsScreen() {
  const [sections, setSections] = useState<ReturnType<typeof groupByType>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await accountsApi.list();
      setSections(groupByType(res.data));
      setError('');
    } catch {
      setError('계정 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { if (!loading) load(); }, []));

  if (loading) return <LoadingView message="계정 목록 불러오는 중..." />;
  if (error) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
      }
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { borderLeftColor: sectionColor(section.type) }]}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionTotal}>
            {formatAmount(section.data.reduce((s, a) => s + Number(a.balance), 0))}
          </Text>
        </View>
      )}
      renderItem={({ item }) => <AccountRow account={item} />}
      ListFooterComponent={<View style={{ height: 30 }} />}
    />
  );
}

function sectionColor(type: string) {
  const map: Record<string, string> = {
    asset: COLORS.success,
    liability: COLORS.danger,
    equity: COLORS.primary,
    revenue: '#8B5CF6',
    expense: '#F59E0B',
  };
  return map[type] ?? COLORS.border;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingVertical: 10,
    borderLeftWidth: 4, marginTop: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  sectionTotal: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  rowCategory: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  rowBalance: { fontSize: 15, fontWeight: '700' },
});
