import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { householdsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants';

export default function HouseholdScreen() {
  const { t } = useTranslation();
  const { refreshHousehold } = useAuth();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!householdName.trim()) {
      Alert.alert(t('common.error'), t('household.nameRequired'));
      return;
    }
    setLoading(true);
    try {
      await householdsApi.create(householdName.trim());
      await refreshHousehold();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? t('household.createFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert(t('common.error'), t('household.codeRequired'));
      return;
    }
    setLoading(true);
    try {
      await householdsApi.join(inviteCode.trim().toUpperCase());
      await refreshHousehold();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? t('household.joinFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.logo}>🏠</Text>
          <Text style={s.title}>{t('household.title')}</Text>
          <Text style={s.subtitle}>{t('household.subtitle')}</Text>
        </View>

        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, tab === 'create' && s.tabActive]}
            onPress={() => setTab('create')}
          >
            <Text style={[s.tabText, tab === 'create' && s.tabTextActive]}>{t('household.create')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'join' && s.tabActive]}
            onPress={() => setTab('join')}
          >
            <Text style={[s.tabText, tab === 'join' && s.tabTextActive]}>{t('household.join')}</Text>
          </TouchableOpacity>
        </View>

        {tab === 'create' ? (
          <View style={s.panel}>
            <Text style={s.label}>{t('household.nameLabel')}</Text>
            <TextInput
              style={s.input}
              value={householdName}
              onChangeText={setHouseholdName}
              placeholder={t('household.namePh')}
              placeholderTextColor={COLORS.textLight}
              autoCorrect={false}
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity style={s.btn} onPress={handleCreate} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('household.createBtn')}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.panel}>
            <Text style={s.label}>{t('household.codeLabel')}</Text>
            <TextInput
              style={[s.input, s.codeInput]}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="ABC123"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />
            <Text style={s.hint}>{t('household.hint')}</Text>
            <TouchableOpacity style={s.btn} onPress={handleJoin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('household.joinBtn')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', padding: 28 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.border, borderRadius: 10, padding: 3, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.surface },
  tabText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  tabTextActive: { color: COLORS.text, fontWeight: '700' },
  panel: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  codeInput: { fontSize: 22, fontWeight: '700', letterSpacing: 6, textAlign: 'center' },
  hint: { fontSize: 12, color: COLORS.textLight, textAlign: 'center' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
