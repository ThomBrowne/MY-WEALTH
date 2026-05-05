import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View } from 'react-native';
import { COLORS, ACCOUNT_TYPE_LABELS } from '../constants';
import type { Account } from '../services/api';

interface AccountChipProps {
  account: Account;
  selected: boolean;
  onPress: (id: string) => void;
}

export function AccountChip({ account, selected, onPress }: AccountChipProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 선택 상태 변경 시 물방울 팽창 애니메이션
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: selected ? 1.07 : 1,
      tension: 260,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  const handlePress = () => {
    // 유리를 두드리는 물방울 효과
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.91,
        tension: 420,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: selected ? 1 : 1.07,
        tension: 230,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
    onPress(account.id);
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        selected ? styles.wrapperSelected : styles.wrapperIdle,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        style={[styles.droplet, selected ? styles.dropletSelected : null]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* 유리 광택 하이라이트 */}
        <View style={selected ? styles.glassShineSelected : styles.glassShine} />

        <Text style={selected ? styles.typeLabelSelected : styles.typeLabel}>
          {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
        </Text>
        <Text style={selected ? styles.nameSelected : styles.name}>
          {account.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 물방울 그림자
  wrapper: {
    borderRadius: 22,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  wrapperIdle: {
    shadowColor: '#1C1713',
    shadowOpacity: 0.10,
    elevation: 2,
  },
  wrapperSelected: {
    shadowColor: COLORS.primary,
    shadowOpacity: 0.40,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 7,
  },

  // 물방울 본체
  droplet: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 222, 214, 0.9)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dropletSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDarker,
  },

  // 유리 광택 (상단 하이라이트)
  glassShine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  glassShineSelected: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },

  typeLabel:         { fontSize: 10, color: COLORS.textLight,              marginBottom: 2, letterSpacing: 0.2 },
  typeLabelSelected: { fontSize: 10, color: 'rgba(255, 218, 205, 0.9)',    marginBottom: 2, letterSpacing: 0.2 },
  name:              { fontSize: 13, color: COLORS.text,   fontWeight: '600' },
  nameSelected:      { fontSize: 13, color: '#FFFFFF',     fontWeight: '600' },
});
