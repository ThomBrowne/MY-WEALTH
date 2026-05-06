import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Image,
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
  const [showSource, setShowSource] = useState(false);
  const [scanError, setScanError] = useState('');

  const pickImage = async (fromCamera: boolean) => {
    setShowSource(false);
    setScanError('');
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      setScanError(fromCamera ? '카메라 권한이 필요합니다.' : '갤러리 권한이 필요합니다.');
      setShowPreview(true);
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
      const msg = e?.response?.data?.detail ?? e?.message ?? '영수증 스캔에 실패했습니다.';
      setScanError(msg);
    } finally {
      setScanning(false);
    }
  };

  const showSourcePicker = () => {
    setShowSource(true);
  };

  const SourceModal = (
    <Modal visible={showSource} transparent animationType="fade" onRequestClose={() => setShowSource(false)}>
      <View style={styles.sourceOverlay}>
        <View style={styles.sourceBox}>
          <Text style={styles.sourceTitle}>영수증 스캔</Text>
          <Text style={styles.sourceBody}>사진을 찍거나 앨범에서 영수증 이미지를 선택하세요.</Text>
          <TouchableOpacity style={styles.sourcePrimaryBtn} onPress={() => pickImage(true)} activeOpacity={0.8}>
            <Text style={styles.sourcePrimaryText}>카메라로 촬영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sourceSecondaryBtn} onPress={() => pickImage(false)} activeOpacity={0.8}>
            <Text style={styles.sourceSecondaryText}>앨범에서 선택</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sourceCancelBtn} onPress={() => setShowSource(false)}>
            <Text style={styles.sourceCancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (compact) {
    return (
      <>
        <TouchableOpacity style={styles.scanBtnCompact} onPress={showSourcePicker} activeOpacity={0.8}>
          <Text style={styles.scanIcon}>📷</Text>
        </TouchableOpacity>
        {SourceModal}
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
              {!!scanError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>스캔 오류</Text>
                  <Text style={styles.errorText}>{scanError}</Text>
                  <TouchableOpacity style={styles.errorButton} onPress={() => { setScanError(''); setShowPreview(false); }}>
                    <Text style={styles.errorButtonText}>확인</Text>
                  </TouchableOpacity>
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
      {SourceModal}

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
            {!!scanError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>스캔 오류</Text>
                <Text style={styles.errorText}>{scanError}</Text>
                <TouchableOpacity style={styles.errorButton} onPress={() => { setScanError(''); setShowPreview(false); }}>
                  <Text style={styles.errorButtonText}>확인</Text>
                </TouchableOpacity>
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
  errorBox: {
    padding: 16,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  errorTitle: { fontSize: 15, fontWeight: '800', color: COLORS.danger, marginBottom: 6 },
  errorText: { fontSize: 13, color: COLORS.danger, lineHeight: 19, marginBottom: 12 },
  errorButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  errorButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  sourceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sourceBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    paddingBottom: 34,
  },
  sourceTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  sourceBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginBottom: 18 },
  sourcePrimaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  sourcePrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sourceSecondaryBtn: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  sourceSecondaryText: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  sourceCancelBtn: { paddingVertical: 10, alignItems: 'center' },
  sourceCancelText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
});
