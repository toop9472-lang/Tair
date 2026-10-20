/**
 * CommunityScreen — طير المجتمع
 * القصص (24 ساعة) ثم دردشة عامة حتى الشريط السفلي.
 * الدردشة بدون روابط أو أرقام أو صور (المنع من الواجهة ومن الخادم).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TairHeader from "../components/TairHeader";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { adminExtApi, communityApi, communityChatApi, storiesApi } from "../services/tairApi";
import { EmptyState, ErrorState, PressableScale, Skeleton, TairImage } from "../components/TairUI";

const CHAT_POLL_MS = 5000;
const LONG_MSG = 280;
const URL_RX = /(https?:\/\/|www\.|[a-z0-9]+\.[a-z]{2,}\/)/i;
const PHONE_RX = /(\+?\d[\d\s\-.]{6,}\d)/;

function blockReason(value) {
  const t = (value || "").trim();
  if (!t) return null;
  if (URL_RX.test(t)) return "الروابط والصور غير مسموحة في الدردشة العامة";
  if (PHONE_RX.test(t)) return "أرقام الهواتف غير مسموحة في الدردشة العامة";
  return null;
}

function formatClock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function StoryRing({ story, isTop, onPress }) {
  const initial = (story.user_name || "؟").charAt(0);
  return (
    <PressableScale onPress={onPress} scaleTo={0.96} style={s.storyItem}>
      <View style={[s.ringOuter, isTop && s.ringOuterTop]}>
        <View style={s.ringInner}>
          {story.image_url ? (
            <TairImage uri={story.image_url} style={s.storyImg} icon="image-outline" iconSize={16} />
          ) : (
            <Text style={s.ringInitial}>{initial}</Text>
          )}
        </View>
        {isTop ? (
          <View style={s.trophy}>
            <Ionicons name="trophy" size={11} color={TAIR.emeraldDeep} />
          </View>
        ) : null}
      </View>
      <Text style={[s.storyLabel, isTop && s.storyLabelTop]} numberOfLines={1}>
        {story.user_name || "مربّي"}
      </Text>
    </PressableScale>
  );
}

export default function CommunityScreen({
  user, onOpenStories, onAddStory,
  onOpenNotifications, onOpenMessages, onOpenProfile,
}) {
  const uid = user?.user_id || user?.id || user?.email;
  const isAdmin = !!(user?.is_admin || user?.role === "admin" || user?.role === "super_admin");
  const [myScopes, setMyScopes] = useState([]);
  const canModerate = isAdmin || myScopes.some((s) => s === "community" || s === "general" || s === "clinic_admin");
  const [stories, setStories] = useState([]);
  const [topStoryId, setTopStoryId] = useState(null);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState({});
  const flatRef = useRef(null);
  const pollRef = useRef(null);
  const stickToEnd = useRef(true);

  const loadStories = useCallback(async (skeleton = false) => {
    if (skeleton === true) setStoriesLoading(true);
    try {
      const r = await communityApi.stories();
      setStories(r?.items || []);
      setStoriesError(null);
    } catch (e) {
      setStoriesError(e?.message || "تعذّر تحميل القصص");
    } finally {
      setStoriesLoading(false);
    }
    try {
      const t = await storiesApi.topToday();
      setTopStoryId(t?.story_id || null);
    } catch {
      setTopStoryId(null);
    }
  }, []);

  const loadChat = useCallback(async (opts) => {
    if (opts?.skeleton) setChatLoading(true);
    try {
      const r = await communityChatApi.list(80);
      setChat(r?.items || []);
      setChatError(null);
    } catch (e) {
      setChatError(e?.message || "تعذّر تحميل الدردشة");
    } finally {
      setChatLoading(false);
    }
  }, []);

  useEffect(() => { loadStories(); loadChat(); }, [loadStories, loadChat]);

  useEffect(() => {
    if (!uid) return;
    adminExtApi.myScopes(uid).then((r) => setMyScopes(r?.scopes || [])).catch(() => setMyScopes([]));
  }, [uid]);

  useEffect(() => {
    pollRef.current = setInterval(loadChat, CHAT_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [loadChat]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    const blocked = blockReason(t);
    if (blocked) return Alert.alert("ممنوع", blocked);
    if (!uid) return Alert.alert("تنبيه", "سجّل الدخول أولاً");
    stickToEnd.current = true;
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
        try { await communityChatApi.delete(msgId, uid); loadChat(); }
        catch (e) { Alert.alert("خطأ", e?.message || "تعذّر"); }
      }},
    ]);
  };

  const renderMsg = ({ item }) => {
    const mine = item.user_id === uid;
    const when = formatClock(item.created_at);
    const body = item.text || "";
    const long = body.length > LONG_MSG;
    const open = !!expanded[item.msg_id];
    const shown = long && !open ? `${body.slice(0, LONG_MSG).trim()}…` : body;
    return (
      <TouchableOpacity
        activeOpacity={mine || canModerate ? 0.75 : 1}
        onLongPress={() => (mine || canModerate) && deleteMsg(item.msg_id)}
        style={[s.msgRow, mine && s.msgRowMine]}
      >
        <TouchableOpacity
          style={s.msgAvatar}
          onPress={() => item.user_id && onOpenProfile?.(item.user_id)}
          testID={`chat-avatar-${item.msg_id}`}
        >
          {item.user_avatar ? (
            <TairImage uri={item.user_avatar} style={s.avatarImg} icon="person" iconSize={14} />
          ) : (
            <Text style={s.avatarLetter}>{(item.user_name || "؟").charAt(0)}</Text>
          )}
        </TouchableOpacity>
        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther, item.is_moderator && !mine && s.bubbleMod]}>
          <View style={s.nameRow}>
            <Text
              style={[s.msgName, mine && s.msgNameMine]}
              numberOfLines={1}
              onPress={() => item.user_id && onOpenProfile?.(item.user_id)}
              testID={`chat-name-${item.msg_id}`}
            >
              {mine ? "أنا" : item.user_name}
            </Text>
            {item.is_moderator ? (
              <View style={[s.modMark, mine && s.modMarkMine]}>
                <Ionicons name="shield-checkmark" size={9} color={mine ? TAIR.emerald : TAIR.gold} />
                <Text style={[s.modMarkText, mine && { color: TAIR.emerald }]}>مشرف</Text>
              </View>
            ) : null}
          </View>
          <Text style={[s.msgText, mine && s.msgTextMine]}>{shown}</Text>
          {long ? (
            <Text
              style={[s.more, mine && s.moreMine]}
              onPress={() => setExpanded((p) => ({ ...p, [item.msg_id]: !p[item.msg_id] }))}
            >
              {open ? "عرض أقل" : "عرض المزيد"}
            </Text>
          ) : null}
          {when ? <Text style={[s.msgTime, mine && s.msgTimeMine]}>{when}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const storiesEmpty = !storiesLoading && !storiesError && stories.length === 0;
  const composerBlock = blockReason(text);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
      <View style={s.page}>
        <TairHeader
          variant="community"
          onBellPress={onOpenNotifications}
          onMessagesPress={onOpenMessages}
        />

        <View style={s.storiesWrap}>
          <ScrollView
            horizontal
            inverted
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.storiesRow}
          >
            <PressableScale onPress={onAddStory} scaleTo={0.96} style={s.storyItem} testID="community-add-story">
              <View style={s.addOuter}>
                <View style={s.addInner}>
                  <Ionicons name="add" size={26} color={TAIR.gold} />
                </View>
              </View>
              <Text style={s.storyLabel} numberOfLines={1}>قصة جديدة</Text>
            </PressableScale>

            {storiesLoading ? (
              <View style={s.storySkeletons}>
                <Skeleton width={64} height={64} radius={32} />
                <Skeleton width={64} height={64} radius={32} />
                <Skeleton width={64} height={64} radius={32} />
              </View>
            ) : storiesError && stories.length === 0 ? (
              <PressableScale onPress={() => loadStories(true)} scaleTo={0.98} style={s.storiesRetry}>
                <Ionicons name="refresh" size={16} color={TAIR.error} />
                <Text style={s.storiesRetryText}>تعذّر تحميل القصص</Text>
                <Text style={s.storiesRetryAction}>إعادة المحاولة</Text>
              </PressableScale>
            ) : storiesEmpty ? (
              <View style={s.storiesEmpty}>
                <Text style={s.storiesEmptyTitle}>لا قصص خلال ٢٤ ساعة</Text>
                <Text style={s.storiesEmptySub}>شارك لحظة طائرك لتظهر هنا يوماً واحداً</Text>
              </View>
            ) : (
              stories.map((st) => (
                <StoryRing
                  key={st.story_id}
                  story={st}
                  isTop={!!topStoryId && st.story_id === topStoryId}
                  onPress={() => onOpenStories?.(st.story_id)}
                />
              ))
            )}
          </ScrollView>
        </View>

        <View style={s.chatHead}>
          <View style={s.chatHeadIcon}>
            <Ionicons name="chatbubbles" size={15} color={TAIR.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.chatHeadText}>الدردشة العامة</Text>
            <Text style={s.chatHint}>حديث المربّين · بدون روابط أو أرقام</Text>
          </View>
          {canModerate ? (
            <View style={s.modMark} testID="community-mod-chip">
              <Ionicons name="shield-checkmark" size={11} color={TAIR.gold} />
              <Text style={s.modMarkText}>مشرف</Text>
            </View>
          ) : null}
        </View>

        {chatError && chat.length > 0 ? (
          <PressableScale onPress={() => loadChat()} scaleTo={0.99} style={s.inlineError}>
            <Ionicons name="cloud-offline-outline" size={14} color={TAIR.error} />
            <Text style={s.inlineErrorText}>تعذّر تحديث الدردشة — إعادة</Text>
          </PressableScale>
        ) : null}

        <View style={{ flex: 1 }}>
          {chatLoading && chat.length === 0 ? (
            <View style={s.chatSkeleton}>
              <Skeleton width="58%" height={54} radius={18} style={{ alignSelf: "flex-end" }} />
              <Skeleton width="74%" height={62} radius={18} style={{ alignSelf: "flex-start" }} />
              <Skeleton width="46%" height={48} radius={18} style={{ alignSelf: "flex-end" }} />
              <Skeleton width="68%" height={54} radius={18} style={{ alignSelf: "flex-start" }} />
            </View>
          ) : (
            <FlatList
              ref={flatRef}
              data={chat}
              extraData={expanded}
              keyExtractor={(m) => m.msg_id}
              renderItem={renderMsg}
              contentContainerStyle={s.chatList}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                const dist = contentSize.height - layoutMeasurement.height - contentOffset.y;
                stickToEnd.current = dist < 140;
              }}
              scrollEventThrottle={64}
              onContentSizeChange={() => {
                if (stickToEnd.current) flatRef.current?.scrollToEnd?.({ animated: true });
              }}
              ListHeaderComponent={chat.length ? (
                <View style={s.dayChip}><Text style={s.dayChipText}>اليوم</Text></View>
              ) : null}
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  {chatError ? (
                    <ErrorState
                      title="تعذّر فتح الدردشة"
                      subtitle="تحقق من الاتصال ثم أعد المحاولة."
                      onRetry={() => loadChat({ skeleton: true })}
                      testID="community-chat-error"
                    />
                  ) : (
                    <EmptyState
                      icon="chatbubbles-outline"
                      title="الدردشة هادئة الآن"
                      subtitle="ابدأ الحديث مع المربّين. الرسائل نص فقط، وتبقى يوماً واحداً."
                      testID="community-chat-empty"
                    />
                  )}
                </View>
              }
            />
          )}
        </View>

        <View style={s.composer}>
          {composerBlock ? (
            <View style={s.blockNote}>
              <Ionicons name="alert-circle-outline" size={14} color={TAIR.error} />
              <Text style={s.blockNoteText}>{composerBlock}</Text>
            </View>
          ) : null}
          <View style={s.composerRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="اكتب رسالة نصية..."
            placeholderTextColor={TAIR.faint}
            textAlign="right"
            style={s.inp}
            editable={!sending}
            maxLength={500}
            multiline
            testID="community-chat-input"
          />
          <PressableScale
            onPress={send}
            disabled={!text.trim() || sending || !!composerBlock}
            scaleTo={0.94}
            style={[s.sendBtn, (!text.trim() || sending || composerBlock) && s.sendBtnOff]}
            testID="community-chat-send"
          >
            {sending
              ? <ActivityIndicator color={TAIR.gold} size="small" />
              : <Ionicons name="paper-plane" size={18} color={TAIR.gold} />}
          </PressableScale>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },

  storiesWrap: {
    backgroundColor: TAIR.card,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(198,161,91,0.38)",
    ...TAIR_ELEVATION.hair,
  },
  storiesRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    alignItems: "flex-start",
  },
  storyItem: { alignItems: "center", width: 74 },
  ringOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: TAIR.gold,
    padding: 2,
    backgroundColor: TAIR.emerald,
    marginBottom: 6,
  },
  ringOuterTop: {
    borderWidth: 2.5,
    borderColor: TAIR.gold,
    backgroundColor: TAIR.goldDark,
  },
  ringInner: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: TAIR.card,
    borderWidth: 1.5,
    borderColor: TAIR.card,
    alignItems: "center",
    justifyContent: "center",
  },
  storyImg: { width: "100%", height: "100%" },
  ringInitial: { color: TAIR.emerald, fontWeight: "900", fontSize: 18 },
  trophy: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: TAIR.gold,
    borderRadius: 999,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: TAIR.card,
  },
  storyLabel: { color: TAIR.emerald, fontSize: 10, fontWeight: "800", textAlign: "center" },
  storyLabelTop: { color: TAIR.goldDark },
  addOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: TAIR.gold,
    padding: 3,
    backgroundColor: TAIR.card,
    marginBottom: 6,
  },
  addInner: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
  },
  storySkeletons: { flexDirection: "row-reverse", gap: 12, alignItems: "center", paddingTop: 2 },
  storiesEmpty: {
    width: 168,
    minHeight: 64,
    justifyContent: "center",
    paddingHorizontal: 4,
    gap: 3,
  },
  storiesEmptyTitle: { color: TAIR.emerald, fontSize: 13, fontWeight: "900", textAlign: "right" },
  storiesEmptySub: { color: TAIR.muted, fontSize: 11, fontWeight: "700", textAlign: "right", lineHeight: 16 },
  storiesRetry: {
    minHeight: 64,
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 2,
    alignItems: "flex-end",
  },
  storiesRetryText: { color: TAIR.error, fontSize: 12, fontWeight: "900", textAlign: "right" },
  storiesRetryAction: { color: TAIR.goldDark, fontSize: 11, fontWeight: "800", textAlign: "right" },

  chatHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: TAIR.bg,
  },
  chatHeadIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: TAIR.emerald,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeadText: { color: TAIR.emerald, fontSize: 14, fontWeight: "900", textAlign: "right" },
  chatHint: { color: TAIR.muted, fontSize: 11, fontWeight: "700", textAlign: "right", marginTop: 1 },

  inlineError: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: TAIR.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(139,58,47,0.18)",
  },
  inlineErrorText: { color: TAIR.error, fontSize: 12, fontWeight: "800" },

  chatSkeleton: { padding: 16, gap: 12 },
  chatList: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 16, flexGrow: 1 },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },

  msgRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 10, alignItems: "flex-end" },
  msgRowMine: { flexDirection: "row" },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: TAIR.gold,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarLetter: { color: TAIR.gold, fontWeight: "900", fontSize: 13 },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: TAIR.emerald,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.45)",
  },
  bubbleOther: {
    backgroundColor: TAIR.card,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: TAIR.divider,
    ...TAIR_ELEVATION.hair,
  },
  bubbleMod: {
    borderColor: "rgba(198,161,91,0.7)",
    backgroundColor: "#FFFBF3",
  },
  nameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 3 },
  msgName: { color: TAIR.emerald, fontSize: 11, fontWeight: "900", textAlign: "right", flexShrink: 1 },
  msgNameMine: { color: TAIR.gold },
  modMark: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 2,
    backgroundColor: TAIR.emerald,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  modMarkText: { color: TAIR.gold, fontSize: 8, fontWeight: "900" },
  modMarkMine: { backgroundColor: TAIR.gold },
  msgText: { color: TAIR.ink, fontSize: 15, lineHeight: 23, textAlign: "right" },
  msgTextMine: { color: "#F7F1E8" },
  more: { color: TAIR.goldDark, fontSize: 12, fontWeight: "900", textAlign: "right", marginTop: 6 },
  moreMine: { color: TAIR.goldLight },
  dayChip: {
    alignSelf: "center",
    backgroundColor: TAIR.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TAIR.divider,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  dayChipText: { color: TAIR.muted, fontSize: 11, fontWeight: "800" },
  msgTime: { color: TAIR.faint, fontSize: 10, fontWeight: "700", textAlign: "right", marginTop: 4 },
  msgTimeMine: { color: "rgba(247,241,232,0.72)" },

  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    marginBottom: TAIR.tabBarH,
    backgroundColor: TAIR.card,
    borderTopWidth: 1,
    borderTopColor: "rgba(198,161,91,0.45)",
    gap: 8,
  },
  composerRow: { flexDirection: "row-reverse", alignItems: "flex-end", gap: 8 },
  blockNote: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: TAIR.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  blockNoteText: { color: TAIR.error, fontSize: 12, fontWeight: "800", flex: 1, textAlign: "right" },
  inp: {
    flex: 1,
    backgroundColor: TAIR.bg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 46,
    maxHeight: 110,
    color: TAIR.ink,
    fontSize: 14,
    borderWidth: 1,
    borderColor: TAIR.divider,
    textAlignVertical: "center",
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
  sendBtnOff: { opacity: 0.45 },
});
