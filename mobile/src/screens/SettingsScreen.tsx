import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Switch, Share, Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, formatAmount } from '../constants';
import { useAuth } from '../context/AuthContext';
import { householdsApi } from '../services/api';
import { changeLanguage, currentLanguage, LANGUAGES, Language } from '../i18n';

function PlanCard({ planId, price, highlight, current }: {
  planId: 'free' | 'pro' | 'family'; price: number; highlight?: boolean; current?: boolean;
}) {
  const { t } = useTranslation();
  const name = t(`settings.plan_${planId}_name`);
  const cta  = t(`settings.plan_${planId}_cta`);
  const features = t(`settings.plan_${planId}_features`, { returnObjects: true }) as string[];

  const handleSelect = () => {
    if (current) return;
    Alert.alert(
      t('settings.planPlan', { name }),
      t('settings.planUpgrade', { name, price: formatAmount(price) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => Alert.alert(t('settings.comingSoon'), t('settings.paymentPending')) },
      ]
    );
  };

  return (
    <View style={[styles.planCard, highlight && styles.planCardHighlight, current && styles.planCardCurrent]}>
      {highlight && <View style={styles.popularBadge}><Text style={styles.popularText}>{t('settings.popular')}</Text></View>}
      <View style={styles.planHeader}>
        <Text style={[styles.planName, highlight && styles.planNameHighlight]}>{name}</Text>
        <View style={styles.planPriceRow}>
          <Text style={[styles.planPrice, highlight && styles.planPriceHighlight]}>
            {price === 0 ? t('settings.plan_free_name') : formatAmount(price)}
          </Text>
          {price > 0 && <Text style={styles.planPeriod}>{t('settings.perMonth')}</Text>}
        </View>
      </View>

      <View style={styles.featureList}>
        {features.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Text style={[styles.featureCheck, highlight && styles.featureCheckHighlight]}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.planBtn, highlight && styles.planBtnHighlight, current && styles.planBtnCurrent]}
        onPress={handleSelect}
        activeOpacity={0.8}
      >
        <Text style={[styles.planBtnText, highlight && styles.planBtnTextHighlight]}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SettingRow({ label, description, value, onToggle }: {
  label: string; description?: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDesc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.border, true: COLORS.primaryMid }}
        thumbColor={value ? COLORS.primary : COLORS.textLight}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { user, household, logout, refreshHousehold } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [lang, setLang] = useState<Language>(currentLanguage());
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = () => {
    setShowLogout(true);
  };

  const handleRegenerateInvite = async () => {
    try {
      const { data } = await householdsApi.regenerateInvite();
      await refreshHousehold();
      Alert.alert(t('settings.newInviteCode'), data.invite_code);
    } catch {
      Alert.alert(t('common.error'), t('settings.regenFailed'));
    }
  };

  const handleShareInvite = async () => {
    if (!household) return;
    await Share.share({ message: t('settings.shareMsg', { code: household.invite_code }) });
  };

  const handleLanguageChange = async (newLang: Language) => {
    setLang(newLang);
    await changeLanguage(newLang);
  };

  const dataItems = [
    { label: t('settings.csv'), icon: '📤' },
    { label: t('settings.excel'), icon: '📊' },
    { label: t('settings.backup'), icon: '☁️' },
  ];

  return (
    <>
    <ScrollView style={styles.container}>
      {user && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>{user.name}</Text>
                <Text style={styles.settingDesc}>{user.email}</Text>
              </View>
            </View>
            {household && (
              <>
                <View style={styles.settingDivider} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Text style={styles.settingLabel}>{t('settings.household', { name: household.name })}</Text>
                    <Text style={styles.settingDesc}>{t('settings.inviteCode', { code: household.invite_code, count: household.members.length })}</Text>
                  </View>
                  <TouchableOpacity onPress={handleShareInvite}>
                    <Text style={styles.actionLink}>{t('settings.share')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.settingDivider} />
                <TouchableOpacity style={styles.menuRow} onPress={handleRegenerateInvite}>
                  <Text style={styles.menuIcon}>🔄</Text>
                  <Text style={styles.menuLabel}>{t('settings.regenerate')}</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={styles.settingDivider} />
            <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
              <Text style={styles.menuIcon}>🚪</Text>
              <Text style={[styles.menuLabel, { color: COLORS.danger }]}>{t('settings.logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.plans')}</Text>
        <PlanCard planId="free" price={0} current />
        <PlanCard planId="pro" price={4900} highlight />
        <PlanCard planId="family" price={8900} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.appSettings')}</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            label={t('settings.pushNotif')}
            description={t('settings.pushNotifDesc')}
            value={notifications}
            onToggle={setNotifications}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            label={t('settings.biometric')}
            description={t('settings.biometricDesc')}
            value={biometric}
            onToggle={(v) => {
              setBiometric(v);
              if (v) Alert.alert(t('settings.comingSoon'), t('settings.biometricSoon'));
            }}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            label={t('settings.autoScan')}
            description={t('settings.autoScanDesc')}
            value={autoScan}
            onToggle={setAutoScan}
          />
          <View style={styles.settingDivider} />
          {/* 언어 선택 */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>{t('settings.language')}</Text>
            </View>
            <View style={styles.langToggle}>
              {(Object.keys(LANGUAGES) as Language[]).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.langBtn, lang === l && styles.langBtnActive]}
                  onPress={() => handleLanguageChange(l)}
                >
                  <Text style={[styles.langBtnText, lang === l && styles.langBtnTextActive]}>
                    {LANGUAGES[l]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.data')}</Text>
        <View style={styles.settingsCard}>
          {dataItems.map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => Alert.alert(t('settings.proFeature'), t('settings.proRequired'))}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuArrow}>›</Text>
                <View style={styles.proBadge}><Text style={styles.proBadgeText}>Pro</Text></View>
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={styles.settingDivider} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('settings.version')}</Text>
        <Text style={styles.footerText}>{t('settings.poweredBy')}</Text>
      </View>
    </ScrollView>
    <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>{t('settings.logoutTitle')}</Text>
          <Text style={styles.confirmBody}>{t('settings.logoutConfirm')}</Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowLogout(false)}>
              <Text style={styles.confirmCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmDanger}
              onPress={async () => {
                setShowLogout(false);
                await logout();
              }}
            >
              <Text style={styles.confirmDangerText}>{t('settings.logout')}</Text>
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
  section: { margin: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  planCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 20,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  planCardHighlight: {
    borderColor: COLORS.primary, borderWidth: 2,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  planCardCurrent: { backgroundColor: COLORS.bg },
  popularBadge: {
    position: 'absolute', top: -12, right: 20,
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  popularText: { color: COLORS.surface, fontSize: 11, fontWeight: '700' },
  planHeader: { marginBottom: 16 },
  planName: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  planNameHighlight: { color: COLORS.primary },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  planPrice: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  planPriceHighlight: { color: COLORS.primary },
  planPeriod: { fontSize: 13, color: COLORS.textMuted },
  featureList: { marginBottom: 20, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureCheck: { fontSize: 14, color: COLORS.success, fontWeight: '700', marginTop: 1 },
  featureCheckHighlight: { color: COLORS.primary },
  featureText: { fontSize: 13, color: COLORS.textMuted, flex: 1, lineHeight: 20 },
  planBtn: {
    paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  planBtnHighlight: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  planBtnCurrent: { backgroundColor: COLORS.bg },
  planBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
  planBtnTextHighlight: { color: COLORS.surface },

  settingsCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingLeft: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  settingDesc: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  settingDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 14, color: COLORS.text },
  menuArrow: { fontSize: 20, color: COLORS.textLight },
  proBadge: {
    backgroundColor: COLORS.primaryLight, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8,
  },
  proBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  actionLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  langToggle: { flexDirection: 'row', backgroundColor: COLORS.border, borderRadius: 8, padding: 2, gap: 2 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  langBtnActive: { backgroundColor: COLORS.primary },
  langBtnText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  langBtnTextActive: { color: '#fff' },

  footer: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  footerText: { fontSize: 12, color: COLORS.textLight },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  confirmBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  confirmBody: { fontSize: 14, color: COLORS.textMuted, lineHeight: 21, marginBottom: 18 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmCancel: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
  confirmDanger: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.danger,
  },
  confirmDangerText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
