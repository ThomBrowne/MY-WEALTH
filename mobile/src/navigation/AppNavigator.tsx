import React, { useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import DashboardScreen from '../screens/DashboardScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import BudgetScreen from '../screens/BudgetScreen';
import InvestmentScreen from '../screens/InvestmentScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AIAdvisorScreen from '../screens/AIAdvisorScreen';
import MoreScreen from '../screens/MoreScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HouseholdScreen from '../screens/HouseholdScreen';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants';
import FloatingAIButton from '../components/FloatingAIButton';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HEADER_STYLE = {
  headerStyle: { backgroundColor: COLORS.primaryDark },
  headerTintColor: COLORS.textInverse,
  headerTitleStyle: { fontWeight: '700' as const },
};

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  '홈': { active: '◉', inactive: '○' },
  '내역': { active: '▤', inactive: '☰' },
  '투자': { active: '◈', inactive: '◇' },
  '더보기': { active: '⊞', inactive: '⊟' },
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

const DashboardStack = makeStack('DashboardHome', 'nav.dashboardTitle', DashboardScreen);
const HistoryStack = makeStack('HistoryHome', 'nav.historyTitle', TransactionHistoryScreen);
const AddTxStack = makeStack('AddTxHome', 'nav.addTxTitle', AddTransactionScreen);
const InvestmentStack = makeStack('InvestmentHome', 'nav.investmentTitle', InvestmentScreen);
const BudgetStack = makeStack('BudgetHome', 'nav.budgetTitle', BudgetScreen);
const AIAdvisorStack = makeStack('AIAdvisorHome', 'nav.aiTitle', AIAdvisorScreen);
const SettingsStack = makeStack('SettingsHome', 'nav.settingsTitle', SettingsScreen);
const MoreStack = makeStack('MoreHome', 'nav.moreTitle', MoreScreen);

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
    <TouchableOpacity style={[style, addTabStyles.wrap]} onPress={handlePress} activeOpacity={0.85}>
      <Animated.View
        style={[
          addTabStyles.bubble,
          focused ? addTabStyles.bubbleFocused : addTabStyles.bubbleIdle,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={addTabStyles.shine} />
        <Text style={addTabStyles.plus}>＋</Text>
      </Animated.View>
      <Text style={[addTabStyles.label, focused && addTabStyles.labelFocused]}>거래</Text>
    </TouchableOpacity>
  );
}

function MainTabs() {
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
            height: 62,
            paddingBottom: 6,
            paddingTop: 4,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        })}
      >
        <Tab.Screen name="홈" component={DashboardStack} options={{ tabBarLabel: t('nav.home') }} />
        <Tab.Screen name="내역" component={HistoryStack} options={{ tabBarLabel: t('nav.history') }} />
        <Tab.Screen name="거래" component={AddTxStack} options={{ tabBarButton: (props) => <AddTabButton {...props} /> }} />
        <Tab.Screen name="투자" component={InvestmentStack} options={{ tabBarLabel: t('nav.investment') }} />
        <Tab.Screen name="더보기" component={MoreStack} options={{ tabBarLabel: t('nav.more') }} />
        <Tab.Screen name="예산" component={BudgetStack} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="AI 코치" component={AIAdvisorStack} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="설정" component={SettingsStack} options={{ tabBarItemStyle: { display: 'none' } }} />
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
      <View style={navigatorStyles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return <AuthStack />;
  if (!household) return <HouseholdScreen />;
  return <MainTabs />;
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}

const addTabStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingBottom: 4 },
  bubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    overflow: 'hidden',
  },
  bubbleIdle: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 9,
    elevation: 8,
  },
  bubbleFocused: {
    backgroundColor: COLORS.primaryDarker,
    shadowColor: COLORS.primaryDarker,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 11,
    elevation: 10,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.40)',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  plus: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 32, marginTop: 2 },
  label: { fontSize: 10, color: COLORS.textLight },
  labelFocused: { color: COLORS.primary, fontWeight: '600' },
});

const navigatorStyles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
});
