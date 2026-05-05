import React, { useState } from 'react';
import {
  Platform, View, Text, TouchableOpacity,
  Modal, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { readCardSms, ParsedCardSms } from '../services/smsReader';
import { COLORS } from '../constants';

interface Props {
  onSelect: (parsed: ParsedCardSms) => void;
}

export default function SmsImportButton({ onSelect }: Props) {
  if (Platform.OS !== 'android') return null;

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ParsedCardSms[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState('');

  const handlePress = async () => {
    setLoading(true);
    setError('');
    const result = await readCardSms();
    setLoading(false);

    if (!result.success || !result.data?.length) {
      setError(result.error ?? '카드 문자를 찾을 수 없습니다.');
      return;
    }
    setList(result.data);
    setModalVisible(true);
  };

  const handleSelect = (item: ParsedCardSms) => {
    setModalVisible(false);
    onSelect(item);
  };

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={handlePress} disabled={loading} activeOpacity={0.75}>
        {loading
          ? <ActivityIndicator size="small" color={COLORS.primary} />
          : <Text style={styles.btnText}>📱 카드 문자</Text>
        }
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.backdrop} onPress={() => setModalVisible(false)} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>카드 결제 문자 선택</Text>
          <FlatList
            data={list}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)} activeOpacity={0.75}>
                <View style={styles.itemLeft}>
                  <Text style={styles.merchant}>{item.merchant}</Text>
                  <Text style={styles.cardName}>{item.cardName}</Text>
                </View>
                <Text style={styles.amount}>{item.amount.toLocaleString('ko-KR')}원</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnText: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  error: { fontSize: 12, color: COLORS.danger, marginTop: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    maxHeight: '60%',
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 14,
  },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  itemLeft: { flex: 1 },
  merchant: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  cardName: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: COLORS.danger },
  sep: { height: 1, backgroundColor: COLORS.border },
});
