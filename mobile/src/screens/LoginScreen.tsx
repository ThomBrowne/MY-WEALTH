import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants';
import { BASE_URL } from '../services/api';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
      const msg = e?.response?.data?.detail ?? e?.message ?? t('auth.loginFailed');
      setError(msg);
      Alert.alert(t('auth.loginFailedTitle'), msg);
    } finally {
      setLoading(false);
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
});
