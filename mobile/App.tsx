import './src/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from './src/screens/DashboardScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import InvestmentScreen from './src/screens/InvestmentScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AIAdvisorScreen from './src/screens/AIAdvisorScreen';
import MoreScreen from './src/screens/MoreScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HouseholdScreen from './src/screens/HouseholdScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { COLORS } from './src/constants';
import FloatingAIButton from './src/components/FloatingAIButton';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

type CrashBoundaryState = { error: Error | null };

class CrashBoundary extends React.Component<React.PropsWithChildren, CrashBoundaryState> {
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

function CrashFallback({ message }: { message: string }) {
  return (
    <View style={crashStyles.wrap}>
      <Text style={crashStyles.title}>앱 오류</Text>
      <Text style={crashStyles.body}>{message}</Text>
      <Text style={crashStyles.hint}>Safari에서 새로고침 후 다시 시도해주세요.</Text>
    </View>
  );
}

function RuntimeErrorOverlay() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onError = (event: ErrorEvent) => setMessage(event.message || '브라우저 오류가 발생했습니다.');
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      setMessage(reason?.response?.data?.detail ?? reason?.message ?? String(reason ?? '요청 처리 중 오류가 발생했습니다.'));
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
    <View style={crashStyles.overlay}>
      <Text style={crashStyles.title}>앱 오류</Text>
      <Text style={crashStyles.body}>{message}</Text>
      <TouchableOpacity style={crashStyles.button} onPress={() => setMessage('')}>
        <Text style={crashStyles.buttonText}>닫기</Text>
      </TouchableOpacity>
    </View>
  );
}

const HEADER_STYLE = {
  headerStyle: { backgroundColor: COLORS.primaryDark },
  headerTintColor: COLORS.textInverse,
  headerTitleStyle: { fontWeight: '700' as const },
};

function makeStack(routeName: string, titleKey: string, Component: React.ComponentType<any>) {
  return function StackScreen() {
    const { t } = useTranslation();
    return (
      <Stack.Navigator>
        <Stack.Screen name={routeName} component={Component} options={{ title: t(titleKey), ...HEADER_STYLE }} />
      </Stack.Navigator>
    );
  };
}

const DashboardStack  = makeStack('DashboardHome', 'nav.dashboardTitle', DashboardScreen);
const HistoryStack    = makeStack('HistoryHome', 'nav.historyTitle', TransactionHistoryScreen);
const AddTxStack      = makeStack('AddTxHome', 'nav.addTxTitle', AddTransactionScreen);
const InvestmentStack = makeStack('InvestmentHome', 'nav.investmentTitle', InvestmentScreen);
const BudgetStack     = makeStack('BudgetHome', 'nav.budgetTitle', BudgetScreen);
const AIAdvisorStack  = makeStack('AIAdvisorHome', 'nav.aiTitle', AIAdvisorScreen);
const SettingsStack   = makeStack('SettingsHome', 'nav.settingsTitle', SettingsScreen);
const MoreStack       = makeStack('MoreHome', 'nav.moreTitle', MoreScreen);

// ─── 중앙 거래 탭 물방울 버튼 ─────────────────────────────────────────────────
function AddTabButton({ onPress, accessibilityState, style }: any) {
  const focused = accessibilityState?.selected ?? false;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.87, tension: 380, friction: 5, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 220, friction: 7, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  return (
    <TouchableOpacity style={[style, fabStyles.wrap]} onPress={handlePress} activeOpacity={0.85}>
      <Animated.View
        style={[
          fabStyles.bubble,
          focused ? fabStyles.bubbleFocused : fabStyles.bubbleIdle,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={fabStyles.shine} />
        <Text style={fabStyles.plus}>＋</Text>
      </Animated.View>
      <Text style={[fabStyles.label, focused && fabStyles.labelFocused]}>거래</Text>
    </TouchableOpacity>
  );
}

const fabStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingBottom: 4 },
  bubble: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 3, overflow: 'hidden',
  },
  bubbleIdle: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38, shadowRadius: 9, elevation: 8,
  },
  bubbleFocused: {
    backgroundColor: COLORS.primaryDarker,
    shadowColor: COLORS.primaryDarker,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 11, elevation: 10,
  },
  shine: {
    position: 'absolute', top: 0, left: '20%', right: '20%',
    height: 8, backgroundColor: 'rgba(255,255,255,0.40)',
    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
  },
  plus: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 32, marginTop: 2 },
  label: { fontSize: 10, color: COLORS.textLight },
  labelFocused: { color: COLORS.primary, fontWeight: '600' },
});

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  '홈':    { active: '◉', inactive: '○' },
  '내역':  { active: '▤', inactive: '☰' },
  '투자':  { active: '◈', inactive: '◇' },
  '더보기':{ active: '⊞', inactive: '⊟' },
};

function MainApp() {
  const { t } = useTranslation();
  return (
    <>
      <FloatingAIButton />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => {
            const icons = TAB_ICONS[route.name] ?? { active: '●', inactive: '○' };
            return (
              <Text style={{ fontSize: 18, color: focused ? COLORS.primary : COLORS.textLight, marginBottom: 1 }}>
                {focused ? icons.active : icons.inactive}
              </Text>
            );
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textLight,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            height: 62, paddingBottom: 6, paddingTop: 4,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        })}
      >
        <Tab.Screen name="홈"     component={DashboardStack} options={{ tabBarLabel: t('nav.home') }} />
        <Tab.Screen name="내역"   component={HistoryStack}   options={{ tabBarLabel: t('nav.history') }} />
        <Tab.Screen
          name="거래"
          component={AddTxStack}
          options={{ tabBarButton: (props) => <AddTabButton {...props} /> }}
        />
        <Tab.Screen name="투자"   component={InvestmentStack} options={{ tabBarLabel: t('nav.investment') }} />
        <Tab.Screen name="더보기" component={MoreStack}       options={{ tabBarLabel: t('nav.more') }} />
        <Tab.Screen name="예산"   component={BudgetStack}     options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="AI 코치" component={AIAdvisorStack} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="설정"   component={SettingsStack}   options={{ tabBarItemStyle: { display: 'none' } }} />
      </Tab.Navigator>
    </>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, household, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return <AuthStack />;
  if (!household) return <HouseholdScreen />;
  return <MainApp />;
}

function AppInner() {
  const isWeb = Platform.OS === 'web';
  const nav = (
    <NavigationContainer>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
  if (!isWeb) return nav;
  return (
    <View style={webShell.outer}>
      <View style={webShell.phone}>{nav}</View>
    </View>
  );
}

export default function App() {
  return (
    <CrashBoundary>
      <AuthProvider>
        <AppInner />
        <RuntimeErrorOverlay />
      </AuthProvider>
    </CrashBoundary>
  );
}

const crashStyles = StyleSheet.create({
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
