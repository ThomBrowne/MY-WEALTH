import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants';
import { getApiErrorMessage } from '../utils/apiError';

type CrashBoundaryState = { error: Error | null };

function CrashFallback({ message }: { message: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>앱 오류</Text>
      <Text style={styles.body}>{message}</Text>
      <Text style={styles.hint}>Safari에서 새로고침 후 다시 시도해주세요.</Text>
    </View>
  );
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, CrashBoundaryState> {
  state: CrashBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <CrashFallback message={this.state.error.message || '앱 화면을 표시하는 중 오류가 발생했습니다.'} />;
    }
    return this.props.children;
  }
}

export function RuntimeErrorOverlay() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onError = (event: ErrorEvent) => setMessage(event.message || '브라우저 오류가 발생했습니다.');
    const onRejection = (event: PromiseRejectionEvent) => {
      setMessage(getApiErrorMessage(event.reason, String(event.reason ?? '요청 처리 중 오류가 발생했습니다.')));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!message) return null;
  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>앱 오류</Text>
      <Text style={styles.body}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={() => setMessage('')}>
        <Text style={styles.buttonText}>닫기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    padding: 24,
  },
  overlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.danger,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.danger, marginBottom: 8 },
  body: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 8 },
  hint: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18 },
  button: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
