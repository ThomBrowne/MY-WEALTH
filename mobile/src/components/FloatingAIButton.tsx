import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView,
  Platform, Animated, Pressable,
} from 'react-native';
import { advisorApi, AdvisorMessage } from '../services/api';
import { COLORS } from '../constants';
import { getApiErrorMessage } from '../utils/apiError';

export default function FloatingAIButton() {
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const open = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      tension: 380,
      friction: 5,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 220,
        friction: 7,
        useNativeDriver: true,
      }).start();
    });
    setVisible(true);
  };

  const close = () => {
    setVisible(false);
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: AdvisorMessage = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInputText('');
    setSending(true);
    scrollToBottom();

    try {
      const res = await advisorApi.chat(next);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (e: any) {
      const detail = getApiErrorMessage(e, '잠시 후 다시 시도해주세요.');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `오류: ${detail}` },
      ]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }, [messages, sending, scrollToBottom]);

  return (
    <>
      {/* 플로팅 버튼 */}
      <Animated.View style={[styles.fab, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity onPress={open} activeOpacity={0.85} style={styles.fabInner}>
          <Text style={styles.fabIcon}>🧠</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 채팅 모달 */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={close}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.headerTitle}>🧠 AI 재무 코치</Text>
            <View style={styles.headerActions}>
              {messages.length > 0 && (
                <TouchableOpacity onPress={() => setMessages([])} style={styles.clearBtn}>
                  <Text style={styles.clearText}>초기화</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={close} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 메시지 목록 */}
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>재무에 대해 무엇이든 물어보세요.</Text>
                <View style={styles.quickRow}>
                  {['이번 달 분석', '저축 팁', '지출 진단'].map((label) => (
                    <TouchableOpacity
                      key={label}
                      style={styles.quickChip}
                      onPress={() => sendMessage(label)}
                    >
                      <Text style={styles.quickChipText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <View
                  key={i}
                  style={[styles.bubbleRow, isUser ? styles.rowUser : styles.rowAI]}
                >
                  {!isUser && <Text style={styles.avatar}>🤖</Text>}
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
                    <Text style={isUser ? styles.textUser : styles.textAI}>{msg.content}</Text>
                  </View>
                </View>
              );
            })}

            {sending && (
              <View style={[styles.bubbleRow, styles.rowAI]}>
                <Text style={styles.avatar}>🤖</Text>
                <View style={[styles.bubble, styles.bubbleAI, { paddingVertical: 14 }]}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* 입력창 */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="메시지 입력..."
              placeholderTextColor={COLORS.textLight}
              value={inputText}
              onChangeText={setInputText}
              multiline
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => sendMessage(inputText)}
              editable={!sending}
            />
            <TouchableOpacity
              style={(!inputText.trim() || sending) ? styles.sendOff : styles.sendOn}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.8}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const SHEET_HEIGHT = '72%';

const styles = StyleSheet.create({
  // ── 플로팅 버튼 ──────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 82,          // 탭바(62) 위에 여백
    zIndex: 999,
  },
  fabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { fontSize: 24 },

  // ── 모달 배경 ─────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // ── 시트 ─────────────────────────────────────────────
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  // ── 헤더 ─────────────────────────────────────────────
  header: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerActions: {
    position: 'absolute',
    right: 12,
    top: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  clearText: { fontSize: 12, color: COLORS.textMuted },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  closeText: { fontSize: 16, color: COLORS.textMuted },

  // ── 스크롤 ────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 8 },

  emptyState: { paddingTop: 20, alignItems: 'center', gap: 16 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickChipText: { fontSize: 13, color: COLORS.text },

  // ── 말풍선 ────────────────────────────────────────────
  bubbleRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', gap: 6 },
  rowUser: { justifyContent: 'flex-end' },
  rowAI: { justifyContent: 'flex-start' },
  avatar: { fontSize: 20, marginBottom: 2 },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 11 },
  bubbleUser: { backgroundColor: COLORS.primaryDark, borderBottomRightRadius: 4 },
  bubbleAI: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  textUser: { fontSize: 14, lineHeight: 20, color: COLORS.textInverse },
  textAI: { fontSize: 14, lineHeight: 20, color: COLORS.text },

  // ── 입력창 ────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 96,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: COLORS.text,
  },
  sendOn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendOff: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: { color: COLORS.surface, fontSize: 17, fontWeight: '700' },
});
