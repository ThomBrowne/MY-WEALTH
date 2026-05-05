import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { receiptsApi, ReceiptScanResult } from '../services/api';
import { COLORS } from '../constants';

interface Props {
  onResult: (result: ReceiptScanResult) => void;
  compact?: boolean;
}

export function ReceiptScanButton({ onResult, compact }: Props) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('권한 필요', fromCamera ? '카메라 권한이 필요합니다.' : '갤러리 권한이 필요합니다.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: true,
        });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPreview(asset.uri);
    setShowPreview(true);

    setScanning(true);
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const res = await receiptsApi.scan(asset.uri, mimeType);
      setShowPreview(false);
      onResult(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? '영수증 스캔에 실패했습니다.';
      Alert.alert('스캔 오류', msg);
      setShowPreview(false);
    } finally {
      setScanning(false);
    }
  };

  const showSourcePicker = () => {
    Alert.alert('영수증 스캔', '이미지 소스를 선택하세요', [
      { text: '📷 카메라', onPress: () => pickImage(true) },
      { text: '🖼️ 갤러리', onPress: () => pickImage(false) },
      { text: '취소', style: 'cancel' },
    ]);
  };

  if (compact) {
    return (
      <>
        <TouchableOpacity style={styles.scanBtnCompact} onPress={showSourcePicker} activeOpacity={0.8}>
          <Text style={styles.scanIcon}>📷</Text>
        </TouchableOpacity>
        <Modal visible={showPreview} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.previewBox}>
              {preview && <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" />}
              {scanning && (
                <View style={styles.scanningRow}>
                  <ActivityIndicator color={COLORS.primary} size="small" />
                  <Text style={styles.scanningText}>Claude AI가 영수증을 분석 중...</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.scanBtn} onPress={showSourcePicker} activeOpacity={0.8}>
        <Text style={styles.scanIcon}>📷</Text>
        <Text style={styles.scanText}>영수증 스캔</Text>
      </TouchableOpacity>

      {/* 스캔 중 프리뷰 모달 */}
      <Modal visible={showPreview} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.previewBox}>
            {preview && (
              <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" />
            )}
            {scanning && (
              <View style={styles.scanningRow}>
                <ActivityIndicator color={COLORS.primary} size="small" />
                <Text style={styles.scanningText}>Claude AI가 영수증을 분석 중...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  scanBtnCompact: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scanIcon: { fontSize: 18 },
  scanText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  previewBox: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    overflow: 'hidden', width: '100%', maxHeight: 480,
  },
  previewImg: { width: '100%', height: 360 },
  scanningRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, backgroundColor: COLORS.bg,
  },
  scanningText: { fontSize: 14, color: COLORS.textMuted, flex: 1 },
});
