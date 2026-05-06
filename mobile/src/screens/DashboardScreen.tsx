import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../hooks/useDashboard';
import { LoadingView, ErrorView } from '../components/LoadingView';
import { COLORS, CATEGORY_LABELS, INSIGHT_COLORS, formatAmount, formatDate } from '../constants';
import { advisorApi, receiptsApi, AdvisorInsight, ReceiptScanResult } from '../services/api';
import type { RecentTransaction } from '../services/api';
import { setPendingReceiptScan } from '../services/pendingReceiptScan';

interface BreakdownItem {
  category: string;
  amount: number;
  percentage: number;
}

const MASKED = '●●●●●';

function NetWorthCard({ netWorth, assets, liabilities }: {
  netWorth: number; assets: number; liabilities: number;
}) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(true);
  const positive = netWorth >= 0;

  return (
    <TouchableOpacity
      style={styles.netWorthCard}
      onPress={() => setHidden(v => !v)}
      activeOpacity={0.85}
    >
      <View style={styles.netWorthLabelRow}>
        <Text style={styles.netWorthLabel}>{t('dash.netWorth')}</Text>
        <Text style={styles.netWorthEye}>{hidden ? '👁️' : '🙈'}</Text>
      </View>
      <Text style={[styles.netWorthAmount, { color: hidden ? COLORS.primaryLight : positive ? COLORS.success : COLORS.danger }]}>
        {hidden ? MASKED : formatAmount(netWorth)}
      </Text>
      <View style={styles.netWorthRow}>
        <View style={styles.netWorthItem}>
          <Text style={styles.netWorthSubLabel}>{t('dash.assets')}</Text>
          <Text style={styles.netWorthSub}>{hidden ? MASKED : formatAmount(assets)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.netWorthItem}>
          <Text style={styles.netWorthSubLabel}>{t('dash.liabilities')}</Text>
          <Text style={[styles.netWorthSub, { color: hidden ? COLORS.primaryLight : COLORS.danger }]}>
            {hidden ? MASKED : formatAmount(liabilities)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MonthSummary({ revenue, expense, savings }: {
  revenue: number; expense: number; savings: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('dash.thisMonth')}</Text>
      <View style={styles.monthRow}>
        {[
          { label: t('dash.revenue'), value: revenue, color: COLORS.success, bg: COLORS.successBg },
          { label: t('dash.expense'), value: expense, color: COLORS.danger, bg: COLORS.dangerBg },
          { label: t('dash.savings'), value: savings, color: COLORS.info, bg: COLORS.infoBg },
        ].map(({ label, value, color, bg }) => (
          <View key={label} style={[styles.monthCard, { backgroundColor: bg }]}>
            <Text style={styles.monthLabel}>{label}</Text>
            <Text style={[styles.monthAmount, { color }]}>{formatAmount(value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AssetsBreakdown({ breakdown }: { breakdown: BreakdownItem[] }) {
  const { t } = useTranslation();
  if (breakdown.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('dash.assetsBreakdown')}</Text>
      {breakdown.map((item) => (
        <View key={item.category} style={styles.breakdownRow}>
          <Text style={styles.breakdownCategory}>
            {CATEGORY_LABELS[item.category] ?? item.category}
          </Text>
          <View style={styles.breakdownBar}>
            <View style={[styles.breakdownFill, { width: `${item.percentage}%` as any }]} />
          </View>
          <Text style={styles.breakdownPercent}>{item.percentage}%</Text>
        </View>
      ))}
    </View>
  );
}

const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function DailyReportCard({ revenue, expense, savings, netWorth }: {
  revenue: number; expense: number; savings: number; netWorth: number;
}) {
  const { t } = useTranslation();
  const today = new Date();
  const dateStr = t('dash.dateFormat', {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    monthName: MONTH_NAMES_EN[today.getMonth()],
    day: today.getDate(),
  });

  const savingsRate = revenue > 0 ? Math.round((savings / revenue) * 100) : 0;

  let headline = '';
  if (revenue === 0 && expense === 0) {
    headline = t('dash.noTx');
  } else if (savingsRate >= 30) {
    headline = t('dash.savingsHigh', { rate: savingsRate });
  } else if (savingsRate >= 10) {
    headline = t('dash.savingsMid', { rate: savingsRate });
  } else if (savings < 0) {
    headline = t('dash.deficit', { amount: formatAmount(Math.abs(savings)) });
  } else {
    headline = t('dash.surplus', { amount: formatAmount(savings) });
  }

  const bullets: string[] = [];
  if (revenue > 0) bullets.push(`${t('dash.revenue')} ${formatAmount(revenue)}`);
  if (expense > 0) bullets.push(`${t('dash.expense')} ${formatAmount(expense)}`);
  if (netWorth !== 0) bullets.push(`${t('dash.netWorth')} ${formatAmount(netWorth)}`);

  return (
    <View style={reportStyles.card}>
      <View style={reportStyles.topBar}>
        <Text style={reportStyles.tag}>{t('dash.dailyReport')}</Text>
        <Text style={reportStyles.date}>{dateStr}</Text>
      </View>
      <View style={reportStyles.dividerLine} />
      <Text style={reportStyles.headline}>{headline}</Text>
      {bullets.length > 0 && (
        <Text style={reportStyles.bullets}>{bullets.join('  ·  ')}</Text>
      )}
    </View>
  );
}

const reportStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tag: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  date: { fontSize: 11, color: COLORS.textLight },
  dividerLine: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 10,
  },
  headline: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 6,
  },
  bullets: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});

function AIInsightsBanner({ onPress }: { onPress: () => void }) {
  const [insights, setInsights] = useState<AdvisorInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<AdvisorInsight | null>(null);

  useEffect(() => {
    advisorApi.getInsights()
      .then((res) => {
        const all = res.data.insights;
        setInsights(all);
        // warning > tip > positive 우선 표시
        const priority = all.find((i) => i.type === 'warning')
          ?? all.find((i) => i.type === 'tip')
          ?? all[0] ?? null;
        setFeatured(priority);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={insightStyles.loading}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={insightStyles.loadingText}>{t('dash.aiAnalyzing')}</Text>
      </View>
    );
  }
  if (!featured) return null;

  const c = INSIGHT_COLORS[featured.type] ?? INSIGHT_COLORS.tip;

  return (
    <TouchableOpacity
      style={[insightStyles.card, { backgroundColor: c.bg, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={insightStyles.left}>
        <Text style={insightStyles.icon}>{featured.icon}</Text>
        <View style={insightStyles.textBlock}>
          <Text style={[insightStyles.title, { color: c.text }]}>{featured.title}</Text>
          <Text style={insightStyles.body} numberOfLines={2}>{featured.body}</Text>
        </View>
      </View>
      <View style={insightStyles.more}>
        {insights.length > 1 && (
          <Text style={[insightStyles.moreText, { color: c.text }]}>{t('dash.morePlus', { n: insights.length - 1 })}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const insightStyles = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12 },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  card: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 14,
    padding: 14, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 10 },
  icon: { fontSize: 22, marginTop: 1 },
  textBlock: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  body: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },
  more: { paddingLeft: 8 },
  moreText: { fontSize: 12, fontWeight: '700' },
});

function QuickScanCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={qsStyles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={qsStyles.iconBg}>
        <Text style={{ fontSize: 20 }}>📷</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={qsStyles.title}>영수증 스캔</Text>
        <Text style={qsStyles.desc}>AI가 금액·상점을 자동으로 입력해요</Text>
      </View>
      <Text style={qsStyles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const qsStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.border,
    gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  iconBg: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  desc:  { fontSize: 11, color: COLORS.textMuted },
  arrow: { fontSize: 20, color: COLORS.textLight, fontWeight: '700' },
});

const TX_META = {
  income:   { prefix: '+', color: COLORS.success },
  expense:  { prefix: '-', color: COLORS.danger  },
  transfer: { prefix: '',  color: COLORS.info    },
};

function RecentTransactions({ items }: { items: RecentTransaction[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('dash.recentTx')}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{t('dash.noRecentTx')}</Text>
      ) : (
        items.map((tx) => {
          const meta = TX_META[tx.tx_type] ?? TX_META.transfer;
          return (
          <View key={tx.id} style={styles.txRow}>
            <View style={styles.txLeft}>
              <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
              <Text style={styles.txDesc}>{tx.description}</Text>
            </View>
            <Text style={[styles.txAmount, { color: meta.color }]}>
              {meta.prefix}{formatAmount(tx.amount)}
            </Text>
          </View>
          );
        })
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { summary, recent, breakdown, loading, refreshing, error, load, refresh } = useDashboard();
  const [showScanSource, setShowScanSource] = useState(false);
  const [scanning, setScanning] = useState(false);
  const goToAdvisor = useCallback(() => navigation.navigate('AI 코치'), [navigation]);

  const doScan = useCallback(async (uri: string, mimeType: string) => {
    setScanning(true);
    try {
      const { data } = await receiptsApi.scan(uri, mimeType);
      setPendingReceiptScan(data);
      navigation.navigate('거래');
    } catch (e: any) {
      Alert.alert('스캔 오류', e?.response?.data?.detail ?? e?.message ?? '영수증 스캔에 실패했습니다.');
    } finally {
      setScanning(false);
    }
  }, [navigation]);

  const pickReceipt = useCallback(async (fromCamera: boolean) => {
    setShowScanSource(false);
    const { granted } = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('권한 필요', fromCamera ? '카메라 권한이 필요합니다.' : '갤러리 권한이 필요합니다.');
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] as any, quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, quality: 0.85 });
    if (!res.canceled && res.assets[0]) {
      await doScan(res.assets[0].uri, res.assets[0].mimeType ?? 'image/jpeg');
    }
  }, [doScan]);

  const handleQuickScan = useCallback(() => {
    setShowScanSource(true);
  }, []);

  useFocusEffect(
    React.useCallback(() => { load(); }, [load])
  );

  const { t } = useTranslation();
  if (loading) return <LoadingView message={t('dash.loading')} />;
  if (error) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.primary} />}
    >
      <NetWorthCard
        netWorth={summary?.net_worth ?? 0}
        assets={summary?.assets ?? 0}
        liabilities={summary?.liabilities ?? 0}
      />
      <DailyReportCard
        revenue={summary?.this_month.revenue ?? 0}
        expense={summary?.this_month.expense ?? 0}
        savings={summary?.this_month.savings ?? 0}
        netWorth={summary?.net_worth ?? 0}
      />
      <QuickScanCard onPress={handleQuickScan} />
      <AIInsightsBanner onPress={goToAdvisor} />
      <MonthSummary
        revenue={summary?.this_month.revenue ?? 0}
        expense={summary?.this_month.expense ?? 0}
        savings={summary?.this_month.savings ?? 0}
      />
      <AssetsBreakdown breakdown={breakdown} />
      <RecentTransactions items={recent} />
      <View style={{ height: 100 }} />
      <Modal visible={showScanSource} transparent animationType="fade" onRequestClose={() => setShowScanSource(false)}>
        <View style={styles.scanOverlay}>
          <View style={styles.scanSheet}>
            <Text style={styles.scanTitle}>영수증 스캔</Text>
            <Text style={styles.scanBody}>사진을 찍거나 앨범에서 영수증 이미지를 선택하세요.</Text>
            <TouchableOpacity style={styles.scanPrimaryBtn} onPress={() => pickReceipt(true)} disabled={scanning}>
              <Text style={styles.scanPrimaryText}>{scanning ? '분석 중...' : '카메라로 촬영'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanSecondaryBtn} onPress={() => pickReceipt(false)} disabled={scanning}>
              <Text style={styles.scanSecondaryText}>앨범에서 선택</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanCancelBtn} onPress={() => setShowScanSource(false)} disabled={scanning}>
              <Text style={styles.scanCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scanOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  scanSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    paddingBottom: 34,
  },
  scanTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  scanBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginBottom: 18 },
  scanPrimaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  scanPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  scanSecondaryBtn: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  scanSecondaryText: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  scanCancelBtn: { paddingVertical: 10, alignItems: 'center' },
  scanCancelText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },

  netWorthCard: {
    margin: 16, padding: 24,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  netWorthLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  netWorthLabel: { color: COLORS.primaryLight, fontSize: 13 },
  netWorthEye: { fontSize: 16 },
  netWorthAmount: { fontSize: 36, fontWeight: '800', marginBottom: 20 },
  netWorthRow: { flexDirection: 'row', alignItems: 'center' },
  netWorthItem: { flex: 1, alignItems: 'center' },
  netWorthSubLabel: { color: COLORS.primaryMid, fontSize: 12, marginBottom: 4 },
  netWorthSub: { color: COLORS.textInverse, fontSize: 16, fontWeight: '600' },
  divider: { width: 1, height: 32, backgroundColor: COLORS.primaryDarker, marginHorizontal: 8 },

  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  monthRow: { flexDirection: 'row', gap: 8 },
  monthCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  monthLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  monthAmount: { fontSize: 14, fontWeight: '700' },

  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  breakdownCategory: { width: 70, fontSize: 13, color: '#475569' },
  breakdownBar: {
    flex: 1, height: 8, backgroundColor: COLORS.border,
    borderRadius: 4, marginHorizontal: 8, overflow: 'hidden',
  },
  breakdownFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  breakdownPercent: { width: 40, fontSize: 12, color: COLORS.textMuted, textAlign: 'right' },

  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  txLeft: { flex: 1 },
  txDate: { fontSize: 11, color: COLORS.textLight, marginBottom: 2 },
  txDesc: { fontSize: 14, color: COLORS.text },
  txAmount: { fontSize: 14, fontWeight: '600', color: COLORS.danger },

  emptyText: { color: COLORS.textLight, textAlign: 'center', paddingVertical: 20 },
});
