import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { advisorApi, AdvisorMessage, AdvisorInsight } from '../services/api';
import { COLORS, INSIGHT_COLORS } from '../constants';

// ─── 서브 컴포넌트 (React.memo) ───────────────────────────────────────────────
const InsightCard = React.memo(function InsightCard({ insight }: { insight: AdvisorInsight }) {
  const c = INSIGHT_COLORS[insight.type] ?? INSIGHT_COLORS.tip;
  return (
    <View style={[styles.insightCard, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={styles.insightIcon}>{insight.icon}</Text>
      <View style={styles.insightBody}>
        <Text style={[styles.insightTitle, { color: c.text }]}>{insight.title}</Text>
        <Text style={styles.insightText}>{insight.body}</Text>
      </View>
    </View>
  );
});

const ChatBubble = React.memo(function ChatBubble({ msg }: { msg: AdvisorMessage }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && <Text style={styles.avatar}>🤖</Text>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAI}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
});

// ─── 메인 화면 ───────────────────────────────────────────────────────────────
export default function AIAdvisorScreen() {
  const { t } = useTranslation();
  const [messages, setMessages]           = useState<AdvisorMessage[]>([]);
  const [inputText, setInputText]         = useState('');
  const [sending, setSending]             = useState(false);
  const [insights, setInsights]           = useState<AdvisorInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [showInsights, setShowInsights]   = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const QUICK_PROMPTS = useMemo(() => [
    { label: t('ai.q1_label'), text: t('ai.q1_text') },
    { label: t('ai.q2_label'), text: t('ai.q2_text') },
    { label: t('ai.q3_label'), text: t('ai.q3_text') },
    { label: t('ai.q4_label'), text: t('ai.q4_text') },
  ], [t]);

  // 스크롤 타이머 ref - 컴포넌트 언마운트 시 정리
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const scrollToBottom = useCallback((delay = 50) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      delay,
    );
  }, []);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await advisorApi.getInsights();
      setInsights(res.data.insights);
    } catch {
      // 인사이트 로드 실패는 조용히 처리
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (insights.length === 0) loadInsights();
  }, [insights.length, loadInsights]));

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: AdvisorMessage = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setSending(true);
    setShowInsights(false);
    scrollToBottom(50);

    try {
      const res = await advisorApi.chat(newMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail ?? t('ai.retry');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('ai.errorMsg', { msg: errMsg }) },
      ]);
    } finally {
      setSending(false);
      scrollToBottom(100);
    }
  }, [messages, sending, scrollToBottom]);

  const handleReset = useCallback(() => {
    setMessages([]);
    setShowInsights(true);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
      >
        {messages.length === 0 && (
          <View style={styles.introHeader}>
            <Text style={styles.introEmoji}>🧠</Text>
            <Text style={styles.introTitle}>{t('ai.title')}</Text>
            <Text style={styles.introSubtitle}>{t('ai.subtitle')}</Text>
          </View>
        )}

        {showInsights && (
          <View style={styles.insightsSection}>
            <View style={styles.insightsSectionHeader}>
              <Text style={styles.sectionTitle}>{t('ai.insights')}</Text>
              <TouchableOpacity onPress={loadInsights} disabled={insightsLoading}>
                <Text style={styles.refreshBtn}>{insightsLoading ? '...' : '↻'}</Text>
              </TouchableOpacity>
            </View>
            {insightsLoading ? (
              <View style={styles.insightsLoading}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.insightsLoadingText}>{t('ai.analyzing')}</Text>
              </View>
            ) : insights.length > 0 ? (
              insights.map((ins, i) => <InsightCard key={i} insight={ins} />)
            ) : (
              <Text style={styles.noInsights}>{t('ai.noInsights')}</Text>
            )}
          </View>
        )}

        {messages.length === 0 && (
          <View style={styles.quickSection}>
            <Text style={styles.sectionTitle}>{t('ai.quickQuestions')}</Text>
            <View style={styles.quickGrid}>
              {QUICK_PROMPTS.map((q) => (
                <TouchableOpacity
                  key={q.label}
                  style={styles.quickBtn}
                  onPress={() => sendMessage(q.text)}
                  disabled={sending}
                >
                  <Text style={styles.quickBtnText}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}

        {sending && (
          <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
            <Text style={styles.avatar}>🤖</Text>
            <View style={[styles.bubble, styles.bubbleAI, styles.bubbleTyping]}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          </View>
        )}

        {messages.length > 0 && !sending && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetText}>{t('ai.reset')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.scrollPad} />
      </ScrollView>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.textInput}
          placeholder={t('ai.placeholder')}
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
          style={(!inputText.trim() || sending) ? styles.sendBtnDisabled : styles.sendBtn}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  scrollPad:     { height: 20 },

  introHeader:   { alignItems: 'center', paddingVertical: 24 },
  introEmoji:    { fontSize: 48, marginBottom: 12 },
  introTitle:    { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  introSubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  insightsSection:       { marginBottom: 20 },
  insightsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:          { fontSize: 15, fontWeight: '700', color: COLORS.text },
  refreshBtn:            { fontSize: 20, color: COLORS.primary, fontWeight: '700' },
  insightsLoading:       { alignItems: 'center', paddingVertical: 20, gap: 8 },
  insightsLoadingText:   { fontSize: 13, color: COLORS.textMuted },
  noInsights:            { color: COLORS.textLight, textAlign: 'center', paddingVertical: 16, fontSize: 13 },

  insightCard:  { flexDirection: 'row', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, gap: 10, alignItems: 'flex-start' },
  insightIcon:  { fontSize: 22, marginTop: 1 },
  insightBody:  { flex: 1 },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  insightText:  { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },

  quickSection: { marginBottom: 24 },
  quickGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  quickBtnText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },

  bubbleRow:     { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI:   { justifyContent: 'flex-start' },
  avatar:        { fontSize: 22, marginBottom: 4 },

  bubble:        { maxWidth: '80%', borderRadius: 18, padding: 12 },
  bubbleUser:    { backgroundColor: COLORS.primaryDark, borderBottomRightRadius: 4 },
  bubbleAI:      { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  bubbleTyping:  { paddingVertical: 14, paddingHorizontal: 20 },

  bubbleTextUser: { fontSize: 14, lineHeight: 20, color: COLORS.textInverse },
  bubbleTextAI:   { fontSize: 14, lineHeight: 20, color: COLORS.text },

  resetBtn:  { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, marginTop: 4 },
  resetText: { fontSize: 12, color: COLORS.textMuted },

  inputArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  textInput: { flex: 1, minHeight: 42, maxHeight: 100, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 21, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.text },

  sendBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary,  justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  sendIcon:        { color: COLORS.surface, fontSize: 18, fontWeight: '700' },
});
