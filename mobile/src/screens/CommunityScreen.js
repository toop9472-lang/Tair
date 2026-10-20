/**
 * CommunityScreen — طير المجتمع
 * - القصص (24 ساعة) أعلى الصفحة كما هي
 * - أسفلها مباشرة دردشة عامة ممتدة حتى الشريط السفلي
 * - الدردشة بدون روابط، أرقام، أو صور (إجباري من الـ backend)
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList, Image,
  TouchableOpacity, ActivityIndicator, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TairHeader from "../components/TairHeader";
import { TAIR } from "../constants/tairTheme";
import { communityApi, communityChatApi, storiesApi } from "../services/tairApi";

const CHAT_POLL_MS = 5000;
const URL_RX = /(https?:\/\/|www\.|[a-z0-9]+\.[a-z]{2,}\/)/i;
const PHONE_RX = /(\+?\d[\d\s\-.]{6,}\d)/;

export default function CommunityScreen({
  user, onOpenStories, onAddStory,
  onOpenNotifications, onOpenMessages, onOpenProfile,
}) {
  const uid = user?.user_id || user?.id || user?.email;
  const [stories, setStories] = useState([]);
  const [topStoryId, setTopStoryId] = useState(null);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [chat, setChat] = useState([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const flatRef = useRef(null);
  const pollRef = useRef(null);

  const loadStories = useCallback(async () => {
    try {
      const r = await communityApi.stories();
      setStories(r?.items || []);
    } catch { setStories([]); }
    finally { setStoriesLoading(false); }
    try {
      const t = await storiesApi.topToday();
      setTopStoryId(t?.story_id || null);
    } catch {}
  }, []);

  const loadChat = useCallback(async () => {
    try {
      const r = await communityChatApi.list(80);
      setChat(r?.items || []);
    } catch { setChat([]); }
    finally { setChatLoading(false); }
  }, []);

  useEffect(() => { loadStories(); loadChat(); }, [loadStories, loadChat]);

  // Poll chat every 5s
  useEffect(() => {
    pollRef.current = setInterval(loadChat, CHAT_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [loadChat]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!chat.length) return;
    setTimeout(() => flatRef.current?.scrollToEnd?.({ animated: true }), 80);
  }, [chat.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (URL_RX.test(t)) return Alert.alert("ممنوع", "لا يسمح بإرسال الروابط في الدردشة العامة");
    if (PHONE_RX.test(t)) return Alert.alert("ممنوع", "لا يسمح بإرسال أرقام الهواتف في الدردشة العامة");
    if (!uid) return Alert.alert("تنبيه", "سجّل الدخول أولاً");
    setSending(true);
    try {
      await communityChatApi.send(t, uid);
      setText("");
      loadChat();
    } catch (e) {
      Alert.alert("لم يُرسل", e?.data?.detail || e?.message || "تعذّر الإرسال");
    } finally { setSending(false); }
  };

  const deleteMsg = (msgId) => {
    Alert.alert("حذف", "حذف الرسالة؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try { await communityChatApi.delete(msgId, uid); loadChat(); } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر"); }
      }},
    ]);
  };

  const renderMsg = ({ item }) => {
    const mine = item.user_id === uid;
    return (
      <TouchableOpacity
        activeOpacity={mine || user?.is_admin ? 0.6 : 1}
        onLongPress={() => (mine || user?.is_admin) && deleteMsg(item.msg_id)}
        style={[s.msgRow, mine && { flexDirection: "row" }]}
      >
        <TouchableOpacity
          style={s.msgAvatar}
          onPress={() => item.user_id && onOpenProfile?.(item.user_id)}
          testID={`chat-avatar-${item.msg_id}`}
        >
          {item.user_avatar ? <Image source={{ uri: item.user_avatar }} style={{ width: "100%", height: "100%" }} />
            : <Text style={{ color: TAIR.gold, fontWeight: "900", fontSize: 12 }}>{(item.user_name || "?").charAt(0)}</Text>}
        </TouchableOpacity>
        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther, item.is_moderator && !mine && s.bubbleMod]}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, marginBottom: 3 }}>
            <Text
              style={[s.msgName, mine && { color: TAIR.gold }]}
              numberOfLines={1}
              onPress={() => item.user_id && onOpenProfile?.(item.user_id)}
              testID={`chat-name-${item.msg_id}`}
            >
              {mine ? "أنا" : item.user_name}
            </Text>
            {item.is_moderator && !mine ? (
              <View style={s.modMark}>
                <Ionicons name="shield-checkmark" size={9} color={TAIR.gold} />
                <Text style={s.modMarkText}>مشرف</Text>
              </View>
            ) : null}
          </View>
          <Text style={[s.msgText, mine && { color: "#fff" }]}>{item.text}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
      <View style={s.page}>
        <TairHeader
          variant="community"
          onBellPress={onOpenNotifications}
          onMessagesPress={onOpenMessages}
        />

        {/* Stories row (fixed) */}
        <View style={s.storiesWrap}>
          <ScrollView
            horizontal
            inverted
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 10, gap: 10 }}
          >
            <TouchableOpacity style={s.storyItem} onPress={onAddStory} testID="community-add-story">
              <View style={[s.storyCircle, { backgroundColor: TAIR.emerald, borderStyle: "dashed", borderWidth: 2, borderColor: TAIR.gold }]}>
                <Ionicons name="add" size={30} color={TAIR.gold} />
              </View>
              <Text style={s.storyLabel} numberOfLines={1}>قصة جديدة</Text>
            </TouchableOpacity>
            {storiesLoading ? <ActivityIndicator color={TAIR.emerald} /> :
              stories.map((st) => {
                const isTop = topStoryId && st.story_id === topStoryId;
                return (
                  <TouchableOpacity key={st.story_id} style={s.storyItem} onPress={() => onOpenStories?.(st.story_id)}>
                    <View style={[s.storyCircle, isTop && { borderColor: TAIR.gold, borderWidth: 3 }]}>
                      {st.image_url ? <Image source={{ uri: st.image_url }} style={s.storyImg} />
                        : <Text style={{ color: TAIR.emerald, fontWeight: "900" }}>{(st.user_name || "?").charAt(0)}</Text>}
                      {isTop ? (
                        <View style={{ position: "absolute", top: -5, right: -5, backgroundColor: TAIR.gold, borderRadius: 999, width: 20, height: 20, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" }}>
                          <Ionicons name="trophy" size={11} color="#1B3D2F" />
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.storyLabel} numberOfLines={1}>{st.user_name || "مربّي"}</Text>
                  </TouchableOpacity>
                );
              })
            }
          </ScrollView>
        </View>

        {/* Divider */}
        <View style={s.chatHead}>
          <Ionicons name="people" size={14} color={TAIR.goldDark} />
          <Text style={s.chatHeadText}>الدردشة العامة</Text>
          <View style={{ flex: 1 }} />
        </View>

        {/* Chat list — fills down to tab bar */}
        <View style={{ flex: 1 }}>
          {chatLoading ? (
            <View style={{ padding: 30, alignItems: "center" }}>
              <ActivityIndicator color={TAIR.emerald} />
            </View>
          ) : (
            <FlatList
              ref={flatRef}
              data={chat}
              keyExtractor={(m) => m.msg_id}
              renderItem={renderMsg}
              contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", padding: 36, gap: 8 }}>
                  <Ionicons name="chatbubbles-outline" size={44} color={TAIR.divider} />
                  <Text style={{ color: TAIR.textSoft, textAlign: "center" }}>كن أول من يبدأ الدردشة اليوم</Text>
                </View>
              }
            />
          )}
        </View>

        {/* Composer */}
        <View style={s.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="اكتب رسالة..."
            placeholderTextColor={TAIR.textSoft}
            textAlign="right"
            style={s.inp}
            editable={!sending}
            maxLength={500}
            testID="community-chat-input"
          />
          <TouchableOpacity
            onPress={send}
            disabled={!text.trim() || sending}
            style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            testID="community-chat-send"
          >
            {sending ? <ActivityIndicator color={TAIR.gold} size="small" /> : <Ionicons name="send" size={18} color={TAIR.gold} />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },

  storiesWrap: { backgroundColor: TAIR.card, borderBottomWidth: 1, borderBottomColor: TAIR.divider },
  storyItem: { alignItems: "center", width: 70 },
  storyCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: TAIR.card, borderWidth: 2, borderColor: TAIR.gold,
    alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 4,
  },
  storyImg: { width: "100%", height: "100%" },
  storyLabel: { color: TAIR.emerald, fontSize: 10, fontWeight: "800" },

  chatHead: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: TAIR.bg, borderBottomWidth: 1, borderBottomColor: TAIR.divider,
  },
  chatHeadText: { color: TAIR.goldDark, fontSize: 12, fontWeight: "900" },
  chatHint: { color: TAIR.textSoft, fontSize: 10, fontWeight: "700" },

  msgRow: { flexDirection: "row-reverse", gap: 6, marginBottom: 10, alignItems: "flex-end" },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: TAIR.emerald,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  bubble: {
    maxWidth: "75%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
    backgroundColor: TAIR.card, borderWidth: 1, borderColor: TAIR.divider,
  },
  bubbleMine: {
    backgroundColor: TAIR.emerald, borderColor: TAIR.gold,
    borderTopRightRadius: 4, borderTopLeftRadius: 14,
  },
  bubbleOther: { borderTopLeftRadius: 4, borderTopRightRadius: 14 },
  bubbleMod: { borderColor: TAIR.gold, backgroundColor: "#FFFBF3" },
  msgName: { color: TAIR.emerald, fontSize: 11, fontWeight: "900" },
  modMark: { flexDirection: "row-reverse", alignItems: "center", gap: 2, backgroundColor: TAIR.emerald, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 },
  modMarkText: { color: TAIR.gold, fontSize: 8, fontWeight: "900" },
  msgText: { color: "#0F241C", fontSize: 13, lineHeight: 20, textAlign: "right" },

  composer: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    paddingHorizontal: 10, paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
    marginBottom: TAIR.tabBarH,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: TAIR.divider,
  },
  inp: {
    flex: 1, backgroundColor: TAIR.bg, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, color: TAIR.emerald,
    borderWidth: 1, borderColor: TAIR.divider, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: TAIR.emerald,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: TAIR.gold,
  },
});
