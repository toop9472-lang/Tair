/**
 * StoryViewerScreen — عارض القصص (24 ساعة) مع إعجاب وتعليق وشارة الأكثر تفاعلاً.
 * التقدّم من اليمين، واللمسة اليمنى ترجع للقصة السابقة.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Image, TouchableWithoutFeedback, StyleSheet, ActivityIndicator,
  Animated, Easing, TouchableOpacity, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TAIR } from "../constants/tairTheme";
import { communityApi, storiesApi } from "../services/tairApi";
import { PressableScale } from "../components/TairUI";
import { shareInApp } from "../services/shareContent";

const STORY_MS = 6000;

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

function storyAge(iso) {
  if (!iso) return "قصة";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "قصة";
  const diff = Math.max(0, (Date.now() - t) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return "اليوم";
}

export default function StoryViewerScreen({ initialStoryId, onClose }) {
  const [stories, setStories] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [uid, setUid] = useState(null);
  const [topId, setTopId] = useState(null);
  const [likes, setLikes] = useState({});
  const [liked, setLiked] = useState({});
  const [failedSid, setFailedSid] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [cmtText, setCmtText] = useState("");
  const [cmtBusy, setCmtBusy] = useState(false);
  const [cmtError, setCmtError] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const animRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await AsyncStorage.getItem("saqr_user");
      const u = s ? JSON.parse(s) : null;
      setUid(u?.user_id || u?.id || u?.email);
    } catch { /* يبقى الزائر بلا معرّف */ }
    try {
      const r = await communityApi.stories();
      const list = r?.items || [];
      setStories(list);
      const lm = {};
      list.forEach((x) => { lm[x.story_id || x.id] = x.likes_count || 0; });
      setLikes(lm);
      if (initialStoryId) {
        const i = list.findIndex((x) => (x.story_id || x.id) === initialStoryId);
        setIdx(i >= 0 ? i : 0);
      }
    } catch (e) {
      setStories([]);
      setLoadError(e?.message || "تعذّر تحميل القصص");
    } finally {
      setLoading(false);
    }
    try {
      const t = await storiesApi.topToday();
      setTopId(t?.story_id || null);
    } catch { setTopId(null); }
  }, [initialStoryId]);

  useEffect(() => { load(); }, [load]);

  const st = stories[idx];
  const sid = st?.story_id || st?.id;

  useEffect(() => {
    setFailedSid(null);
    fade.setValue(0.2);
    Animated.timing(fade, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [idx, sid, fade]);

  useEffect(() => {
    if (loading || stories.length === 0 || commentsOpen) return;
    progress.setValue(0);
    animRef.current = Animated.timing(progress, {
      toValue: 1, duration: STORY_MS, useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => { if (finished) next(); });
    return () => animRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loading, stories.length, commentsOpen]);

  const next = () => { if (idx + 1 < stories.length) setIdx(idx + 1); else onClose?.(); };
  const prev = () => { if (idx > 0) setIdx(idx - 1); };

  const toggleLike = async () => {
    if (!uid) return Alert.alert("سجّل الدخول أولاً");
    try {
      const r = await storiesApi.like(sid, uid);
      setLiked((p) => ({ ...p, [sid]: !!r.liked }));
      setLikes((p) => ({ ...p, [sid]: (p[sid] || 0) + (r.liked ? 1 : -1) }));
    } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر التنفيذ"); }
  };

  const fetchComments = async () => {
    if (!sid) return;
    setCmtError(null);
    try {
      const r = await storiesApi.listComments(sid);
      setComments(r?.items || []);
    } catch (e) {
      setComments([]);
      setCmtError(e?.message || "تعذّر تحميل التعليقات");
    }
  };

  const openComments = () => {
    setCommentsOpen(true);
    animRef.current?.stop();
    fetchComments();
  };

  const sendComment = async () => {
    const t = cmtText.trim();
    if (!t || !uid) return;
    setCmtBusy(true);
    try {
      await storiesApi.addComment(sid, t, uid);
      setCmtText("");
      setStories((list) => list.map((x) => (
        (x.story_id || x.id) === sid
          ? { ...x, comments_count: (x.comments_count || 0) + 1 }
          : x
      )));
      await fetchComments();
    } catch (e) { Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر الإرسال"); }
    finally { setCmtBusy(false); }
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={TAIR.gold} size="large" />
        <Text style={styles.emptySub}>جارٍ فتح القصص</Text>
      </View>
    );
  }

  if (loadError && !stories.length) {
    return (
      <View style={styles.centerState}>
        <View style={styles.stateMedal}>
          <Ionicons name="cloud-offline-outline" size={28} color={TAIR.gold} />
        </View>
        <Text style={styles.emptyTitle}>تعذّر فتح القصص</Text>
        <Text style={styles.emptySub}>تحقق من الاتصال ثم أعد المحاولة.</Text>
        <TouchableOpacity onPress={load} style={styles.closeBig} testID="story-retry">
          <Text style={styles.closeBigText}>إعادة المحاولة</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Text style={styles.dismiss}>إغلاق</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!stories.length) {
    return (
      <View style={styles.centerState}>
        <View style={styles.stateMedal}>
          <Ionicons name="images-outline" size={28} color={TAIR.gold} />
        </View>
        <Text style={styles.emptyTitle}>لا توجد قصص خلال آخر ٢٤ ساعة</Text>
        <Text style={styles.emptySub}>عندما يشارك المربّون لحظاتهم ستظهر هنا ليوم واحد.</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBig}>
          <Text style={styles.closeBigText}>إغلاق</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTop = topId && sid === topId;
  const showImage = !!st.image_url && failedSid !== sid;

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.stage, { opacity: fade }]}>
        {showImage ? (
          <Image
            source={{ uri: st.image_url }}
            style={styles.media}
            resizeMode="contain"
            onError={() => setFailedSid(sid)}
          />
        ) : (
          <View style={styles.centerText}>
            <Text style={styles.storyText}>{st.caption || st.text || "قصة"}</Text>
          </View>
        )}
        {st.caption && showImage ? (
          <View style={styles.captionBar}>
            <Text style={styles.captionText}>{st.caption}</Text>
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.tapLayer}>
        <TouchableWithoutFeedback onPress={prev}>
          <View style={styles.tapZone} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={next}>
          <View style={styles.tapZone} />
        </TouchableWithoutFeedback>
      </View>

      <View style={styles.progressRow}>
        {stories.map((_, i) => (
          <View key={i} style={styles.pTrack}>
            <Animated.View style={[styles.pFill, {
              width: i < idx ? "100%" :
                     i === idx ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) : "0%",
            }]} />
          </View>
        ))}
      </View>

      <View style={styles.topBar}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            {st.user_avatar ? (
              <Image source={{ uri: st.user_avatar }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text style={styles.avatarTxt}>{(st.user_name || "؟").charAt(0)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameLine}>
              <Text style={styles.author} numberOfLines={1}>{st.user_name || "مربّي"}</Text>
              {isTop ? (
                <View style={styles.topBadge}>
                  <Ionicons name="trophy" size={11} color={TAIR.emeraldDeep} />
                  <Text style={styles.topBadgeText}>الأكثر تفاعلاً</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.time}>{storyAge(st.created_at)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#F7F1E8" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity onPress={toggleLike} style={styles.actionBtn} testID="story-like-btn">
          <Ionicons name={liked[sid] ? "heart" : "heart-outline"} size={22} color={liked[sid] ? TAIR.gold : "#F7F1E8"} />
          <Text style={styles.actionText}>{likes[sid] || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openComments} style={styles.actionBtn} testID="story-comment-btn">
          <Ionicons name="chatbubble-outline" size={20} color="#F7F1E8" />
          <Text style={styles.actionText}>{st?.comments_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => shareInApp({
            kind: "story",
            id: sid,
            title: st.user_name ? `قصة ${st.user_name}` : "قصة على طير",
            image: st.image_url || "",
            lines: st.caption ? [st.caption] : [],
          })}
          style={styles.actionBtn}
          testID="story-share-btn"
        >
          <Ionicons name="share-social-outline" size={20} color={TAIR.gold} />
        </TouchableOpacity>
      </View>

      <Modal visible={commentsOpen} transparent animationType="slide" onRequestClose={() => setCommentsOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setCommentsOpen(false)}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.cmtSheet}>
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>
            <Text style={styles.cmtTitle}>التعليقات ({comments.length})</Text>
            <FlatList
              data={comments}
              keyExtractor={(c, i) => c.comment_id || `c-${i}`}
              contentContainerStyle={styles.cmtList}
              renderItem={({ item }) => (
                <View style={styles.cmtRow}>
                  <View style={styles.cmtAvatar}>
                    {item.user_avatar ? (
                      <Image source={{ uri: item.user_avatar }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <Text style={styles.cmtAvatarLetter}>{(item.user_name || "؟").charAt(0)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cmtNameRow}>
                      <Text style={styles.cmtName}>{item.user_name || "مستخدم"}</Text>
                      {item.created_at ? <Text style={styles.cmtTime}>{formatClock(item.created_at)}</Text> : null}
                    </View>
                    <Text style={styles.cmtText}>{item.text}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                cmtError ? (
                  <PressableScale onPress={fetchComments} style={styles.cmtEmpty}>
                    <Text style={styles.cmtEmptyText}>تعذّر تحميل التعليقات — إعادة</Text>
                  </PressableScale>
                ) : (
                  <Text style={styles.cmtEmptyText}>كن أول من يعلّق</Text>
                )
              }
            />
            <View style={styles.cmtInputRow}>
              <TextInput
                value={cmtText}
                onChangeText={setCmtText}
                placeholder="اكتب تعليقاً..."
                placeholderTextColor={TAIR.faint}
                textAlign="right"
                style={styles.cmtInput}
                testID="story-comment-input"
              />
              <PressableScale
                onPress={sendComment}
                disabled={cmtBusy || !cmtText.trim()}
                scaleTo={0.94}
                style={[styles.cmtSend, (cmtBusy || !cmtText.trim()) && { opacity: 0.45 }]}
                testID="story-comment-send"
              >
                {cmtBusy
                  ? <ActivityIndicator color={TAIR.gold} size="small" />
                  : <Ionicons name="paper-plane" size={18} color={TAIR.gold} />}
              </PressableScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0F241C" },
  stage: { ...StyleSheet.absoluteFillObject },
  centerState: {
    flex: 1,
    backgroundColor: "#0F241C",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 8,
  },
  stateMedal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: TAIR.gold,
    backgroundColor: "rgba(198,161,91,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  progressRow: {
    position: "absolute",
    top: 52,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
    zIndex: 6,
  },
  pTrack: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    backgroundColor: "rgba(247,241,232,0.28)",
    overflow: "hidden",
  },
  pFill: { height: "100%", backgroundColor: TAIR.gold, borderRadius: 99 },
  topBar: {
    position: "absolute",
    top: 66,
    left: 12,
    right: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    zIndex: 6,
  },
  authorRow: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  nameLine: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TAIR.emerald,
    borderWidth: 1.5,
    borderColor: TAIR.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarTxt: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },
  author: { color: "#F7F1E8", fontSize: 14, fontWeight: "800", textAlign: "right" },
  time: { color: TAIR.goldLight, fontSize: 11, fontWeight: "700", textAlign: "right", marginTop: 1 },
  topBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    backgroundColor: TAIR.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  topBadgeText: { color: TAIR.emeraldDeep, fontSize: 10, fontWeight: "900" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,36,28,0.45)",
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.4)",
  },
  tapLayer: {
    position: "absolute",
    top: 112,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    zIndex: 4,
  },
  tapZone: { flex: 1 },
  media: { position: "absolute", top: 112, bottom: 132, left: 0, right: 0 },
  centerText: { position: "absolute", top: "34%", left: 28, right: 28 },
  storyText: { color: "#F7F1E8", fontSize: 22, fontWeight: "800", textAlign: "center", lineHeight: 34 },
  captionBar: {
    position: "absolute",
    bottom: 92,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(15,36,28,0.55)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.28)",
  },
  captionText: { color: "#F7F1E8", fontSize: 14, lineHeight: 22, textAlign: "right", fontWeight: "700" },

  actionsBar: {
    position: "absolute",
    bottom: 28,
    left: 16,
    right: 16,
    flexDirection: "row-reverse",
    gap: 10,
    alignItems: "center",
    zIndex: 7,
  },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,36,28,0.55)",
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.35)",
  },
  actionText: { color: "#F7F1E8", fontWeight: "800", fontSize: 13 },

  emptyTitle: { color: "#F7F1E8", fontSize: 16, fontWeight: "900", textAlign: "center" },
  emptySub: { color: "rgba(247,241,232,0.72)", fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 20 },
  closeBig: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: TAIR.gold,
    borderRadius: 16,
  },
  closeBigText: { color: TAIR.emeraldDeep, fontWeight: "900", fontSize: 14 },
  dismiss: { color: TAIR.goldLight, fontWeight: "800", fontSize: 13, marginTop: 8 },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15,36,28,0.62)" },
  cmtSheet: {
    backgroundColor: TAIR.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "72%",
    borderTopWidth: 1,
    borderColor: "rgba(198,161,91,0.4)",
  },
  sheetHandleWrap: { alignItems: "center", paddingTop: 8 },
  sheetHandle: { width: 42, height: 4, backgroundColor: TAIR.gold, borderRadius: 2, opacity: 0.7 },
  cmtTitle: {
    textAlign: "center",
    color: TAIR.emerald,
    fontSize: 15,
    fontWeight: "900",
    paddingVertical: 10,
  },
  cmtList: { paddingHorizontal: 14, paddingBottom: 12 },
  cmtRow: {
    flexDirection: "row-reverse",
    gap: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: TAIR.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TAIR.divider,
  },
  cmtAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TAIR.emerald,
    borderWidth: 1,
    borderColor: TAIR.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cmtAvatarLetter: { color: TAIR.gold, fontWeight: "900", fontSize: 13 },
  cmtNameRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cmtName: { color: TAIR.emerald, fontWeight: "900", fontSize: 12, textAlign: "right", flex: 1 },
  cmtTime: { color: TAIR.faint, fontSize: 10, fontWeight: "700" },
  cmtText: { color: TAIR.ink, fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 3 },
  cmtEmpty: { padding: 24, alignItems: "center" },
  cmtEmptyText: { textAlign: "center", color: TAIR.muted, padding: 28, fontWeight: "700" },
  cmtInputRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(198,161,91,0.4)",
    backgroundColor: TAIR.card,
  },
  cmtInput: {
    flex: 1,
    backgroundColor: TAIR.bg,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 46,
    color: TAIR.ink,
    borderWidth: 1,
    borderColor: TAIR.divider,
  },
  cmtSend: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
});
