import './src/i18n';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { AppErrorBoundary, RuntimeErrorOverlay } from './src/components/AppErrorBoundary';
import { AppNavigator } from './src/navigation/AppNavigator';

function AppInner() {
  const isWeb = Platform.OS === 'web';
  if (!isWeb) return <AppNavigator />;
  return (
    <View style={webShell.outer}>
      <View style={webShell.phone}>
        <AppNavigator />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppInner />
        <RuntimeErrorOverlay />
      </AuthProvider>
    </AppErrorBoundary>
  );
}

const webShell = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#0f0f23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: 390,
    height: '100%' as any,
    maxHeight: 844,
    overflow: 'hidden' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
  },
});
