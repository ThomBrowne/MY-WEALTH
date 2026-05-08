import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants';
import { BASE_URL } from '../services/api';
import { getApiErrorMessage } from '../utils/apiError';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetName, setResetName] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('common.error'), t('auth.required'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e: any) {
      const msg = getApiErrorMessage(e, t('auth.loginFailed'));
      setError(msg);
      Alert.alert(t('auth.loginFailedTitle'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowReset(true);
  };

  const handleResetPassword = async () => {
    if (!email.trim() || !resetName.trim() || !resetNewPassword || !resetConfirm) {
      Alert.alert(t('common.error'), t('auth.allRequired'));
      return;
    }
    if (resetNewPassword.length < 6) {
      Alert.alert(t('common.error'), t('auth.passwordMin'));
      return;
    }
    if (resetNewPassword !== resetConfirm) {
      Alert.alert(t('common.error'), t('auth.passwordMismatch'));
      return;
    }

    setResetLoading(true);
    setError('');
    try {
      await resetPassword(email.trim().toLowerCase(), resetName.trim(), resetNewPassword);
      setShowReset(false);
      setPassword('');
      setResetName('');
      setResetNewPassword('');
      setResetConfirm('');
    } catch (e: any) {
      const msg = getApiErrorMessage(e, t('auth.resetFailed'));
      setError(msg);
      Alert.alert(t('common.error'), msg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.logo}>💰</Text>
          <Text style={s.title}>{t('auth.appName')}</Text>
          <Text style={s.subtitle}>{t('auth.tagline')}</Text>
        </View>

        <View style={s.form}>
          <Text style={s.label}>{t('auth.email')}</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor={COLORS.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={s.label}>{t('auth.password')}</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.passwordPh')}
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
          />
          <TouchableOpacity style={s.forgotLink} onPress={handleForgotPassword}>
            <Text style={s.forgotText}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
              <Text style={s.apiText}>{BASE_URL}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>{t('auth.login')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.link} onPress={() => navigation.navigate('Register')}>
            <Text style={s.linkText}>{t('auth.noAccount')} <Text style={s.linkBold}>{t('auth.signUp')}</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal visible={showReset} transparent animationType="fade" onRequestClose={() => setShowReset(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>{t('auth.forgotTitle')}</Text>
              <Text style={s.modalBody}>{t('auth.forgotBody')}</Text>

              <Text style={s.label}>{t('auth.email')}</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!resetLoading}
              />

              <Text style={s.label}>{t('auth.resetName')}</Text>
              <TextInput
                style={s.input}
                value={resetName}
                onChangeText={setResetName}
                placeholder={t('auth.resetNamePh')}
                placeholderTextColor={COLORS.textLight}
                autoCorrect={false}
                editable={!resetLoading}
              />

              <Text style={s.label}>{t('auth.resetNewPassword')}</Text>
              <TextInput
                style={s.input}
                value={resetNewPassword}
                onChangeText={setResetNewPassword}
                placeholder={t('auth.passwordPh')}
                placeholderTextColor={COLORS.textLight}
                secureTextEntry
                editable={!resetLoading}
              />

              <Text style={s.label}>{t('auth.resetNewPasswordConfirm')}</Text>
              <TextInput
                style={s.input}
                value={resetConfirm}
                onChangeText={setResetConfirm}
                placeholder={t('auth.passwordConfirmPh')}
                placeholderTextColor={COLORS.textLight}
                secureTextEntry
                editable={!resetLoading}
              />

              <TouchableOpacity style={s.btn} onPress={handleResetPassword} disabled={resetLoading}>
                {resetLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('auth.resetSubmit')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowReset(false)} disabled={resetLoading}>
                <Text style={s.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textMuted },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 2, marginTop: 8 },
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
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { alignItems: 'center', marginTop: 16 },
  linkText: { fontSize: 14, color: COLORS.textMuted },
  linkBold: { color: COLORS.primary, fontWeight: '700' },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: 6 },
  forgotText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  errorBox: {
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: '#F2B8B5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  errorText: { color: COLORS.danger, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  apiText: { color: COLORS.textLight, fontSize: 10, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalWrap: { width: '100%' },
  modalBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  modalBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: 10 },
  modalCancel: { alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
});
