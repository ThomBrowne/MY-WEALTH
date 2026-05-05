import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants';

interface LoadingViewProps {
  message?: string;
}

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
}

export function LoadingView({ message }: LoadingViewProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>{message ?? t('loading.default')}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>{t('loading.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14 },
  errorText: { color: COLORS.danger, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: COLORS.surface, fontWeight: '600' },
});
