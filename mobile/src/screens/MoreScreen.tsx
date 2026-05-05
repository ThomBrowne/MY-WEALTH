import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Animated,
} from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants';
import type { RootStackParamList, RootTabParamList } from '../types/navigation';

type MoreRouteName = '예산' | 'AI 코치' | '설정';

interface MoreItem {
  name: MoreRouteName;
  icon: string;
  label: string;
  desc: string;
  accent: string;
  tint: string;
}

type MoreNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList, 'MoreHome'>,
  BottomTabNavigationProp<RootTabParamList>
>;

function MoreCard({ item, onPress }: { item: MoreItem; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        tension: 350,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Glass shine */}
        <View style={styles.cardShine} />

        <View style={[styles.iconWrap, { backgroundColor: item.tint }]}>
          <Text style={styles.icon}>{item.icon}</Text>
        </View>

        <View style={styles.cardText}>
          <Text style={[styles.cardLabel, { color: item.accent }]}>
            {item.label}
          </Text>
          <Text style={styles.cardDesc}>{item.desc}</Text>
        </View>

        <Text style={[styles.chevron, { color: item.accent }]}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MoreScreen({ navigation }: { navigation: MoreNavigation }) {
  const { t } = useTranslation();
  const navigate = (name: MoreRouteName) => {
    const tabNavigation = navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
    if (tabNavigation) {
      tabNavigation.navigate(name);
      return;
    }
    navigation.navigate(name);
  };

  const MORE_ITEMS = [
    { name: '예산' as MoreRouteName, icon: '📊', label: t('more.budgetLabel'), desc: t('more.budgetDesc'), accent: '#2A7A50', tint: '#EDF7F2' },
    { name: 'AI 코치' as MoreRouteName, icon: '🧠', label: t('more.aiLabel'), desc: t('more.aiDesc'), accent: '#2B5FA0', tint: '#EBF2FA' },
    { name: '설정' as MoreRouteName, icon: '⚙️', label: t('more.settingsLabel'), desc: t('more.settingsDesc'), accent: COLORS.textMuted, tint: '#F0EDE9' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('more.title')}</Text>
        <Text style={styles.subtitle}>{t('more.subtitle')}</Text>
      </View>

      <View style={styles.list}>
        {MORE_ITEMS.map((item) => (
          <MoreCard key={item.name} item={item} onPress={() => navigate(item.name)} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    // Glass depth shadow
    shadowColor: '#1C1713',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  icon: { fontSize: 22 },
  cardText: { flex: 1 },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 8,
  },
});
