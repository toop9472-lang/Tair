/**
 * StoryViewerScreen — عارض القصص (24 ساعة) مع likes + comments + شارة "الأكثر تفاعلاً"
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Image, TouchableWithoutFeedback, StyleSheet, ActivityIndicator,
  Animated, TouchableOpacity, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TAIR } from "../constants/tairTheme";
import { communityApi, storiesApi } from "../services/tairApi";

const STORY_MS = 6000;

export default function StoryViewerScreen({ initialStoryId, onClose }) {
  const [stories, setStories] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);
  const [topId, setTopId] = useState(null);
  const [likes, setLikes] = useState({});   // story_id -> count
  const [liked, setLiked] = useState({});   // story_id -> bool
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [cmtText, setCmtText] = useState("");
  const [cmtBusy, setCmtBusy] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem("saqr_user");
        const u = s ? JSON.parse(s) : null;
        setUid(u?.user_id || u?.id || u?.email);
      } catch {}
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
      } catch { setStories([]); }
      finally { setLoading(false); }
      try {
        const t = await storiesApi.topToday();
        setTopId(t?.story_id || null);
      } catch {}
    })();
  }, [initialStoryId]);

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

  const st = stories[idx];
  const sid = st?.story_id || st?.id;

  const toggleLike = async () => {
    if (!uid) return Alert.alert("سجّل الدخول أولاً");
    try {
      const r = await storiesApi.like(sid, uid);
      setLiked((p) => ({ ...p, [sid]: !!r.liked }));
      setLikes((p) => ({ ...p, [sid]: (p[sid] || 0) + (r.liked ? 1 : -1) }));
    } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر التنفيذ"); }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    animRef.current?.stop();
    try {
      const r = await storiesApi.listComments(sid);
      setComments(r?.items || []);
    } catch { setComments([]); }
  };

  const sendComment = async () => {
    const t = cmtText.trim();
    if (!t || !uid) return;
    setCmtBusy(true);
    try {
      await storiesApi.addComment(sid, t, uid);
      setCmtText("");
      const r = await storiesApi.listComments(sid);
      setComments(r?.items || []);
    } catch (e) { Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر الإرسال"); }
    finally { setCmtBusy(false); }
  };

  if (loading) {
    return (<View style={styles.wrap}><ActivityIndicator color={TAIR.gold} /></View>);
  }
  if (!stories.length) {
    return (
      <View style={[styles.wrap, { padding: 24 }]}>
        <Text style={styles.emptyText}>لا توجد قصص خلال آخر ٢٤ ساعة</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBig}>
          <Text style={styles.closeBigText}>إغلاق</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const isTop = topId && sid === topId;

  return (
    <View style={styles.wrap}>
      <View style={styles.progressRow}>
        {stories.map((_, i) => (
          <View key={i} style={styles.pTrack}>
            <Animated.View style={[styles.pFill, {
              width: i < idx ? "100%" :
                     i === idx ? progress.interpolate({ inputRange: [0,1], outputRange: ["0%","100%"] }) : "0%",
            }]} />
          </View>
        ))}
      </View>

      <View style={styles.topBar}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, flex: 1 }}>
          <View style={styles.avatar}>
            {st.user_avatar ? (
              <Image source={{ uri: st.user_avatar }} style={{ width: "100%", height: "100%" }} />
            ) : (<Text style={styles.avatarTxt}>{(st.user_name || "?").charAt(0)}</Text>)}
          </View>
          <View>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
              <Text style={styles.author}>{st.user_name || "مربّي"}</Text>
              {isTop ? (
                <View style={styles.topBadge}>
                  <Ionicons name="trophy" size={11} color="#1B3D2F" />
                  <Text style={styles.topBadgeText}>الأكثر تفاعلاً</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.time}>قصة</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, flexDirection: "row" }}>
        <TouchableWithoutFeedback onPress={prev}><View style={{ flex: 1 }} /></TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={next}><View style={{ flex: 1 }} /></TouchableWithoutFeedback>
      </View>

      {st.image_url ? (
        <Image source={{ uri: st.image_url }} style={styles.media} resizeMode="contain" />
      ) : (
        <View style={styles.centerText}>
          <Text style={styles.storyText}>{st.text || st.caption || "قصة"}</Text>
        </View>
      )}

      {st.caption ? (
        <View style={styles.captionBar}>
          <Text style={styles.captionText}>{st.caption}</Text>
        </View>
      ) : null}

      {/* Actions bar (like + comment) */}
      <View style={styles.actionsBar}>
        <TouchableOpacity onPress={toggleLike} style={styles.actionBtn} testID="story-like-btn">
          <Ionicons name={liked[sid] ? "heart" : "heart-outline"} size={26} color={liked[sid] ? "#EF4444" : "#fff"} />
          <Text style={styles.actionText}>{likes[sid] || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openComments} style={styles.actionBtn} testID="story-comment-btn">
          <Ionicons name="chatbubble-outline" size={24} color="#fff" />
          <Text style={styles.actionText}>{st?.comments_count || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Comments Sheet */}
      <Modal visible={commentsOpen} transparent animationType="slide" onRequestClose={() => setCommentsOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setCommentsOpen(false)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
          </TouchableWithoutFeedback>
          <View style={styles.cmtSheet}>
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <View style={{ width: 40, height: 4, backgroundColor: "#D6C9AB", borderRadius: 2 }} />
            </View>
            <Text style={styles.cmtTitle}>التعليقات ({comments.length})</Text>
            <FlatList
              data={comments}
              keyExtractor={(c) => c.comment_id || String(Math.random())}
              contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
              renderItem={({ item }) => (
                <View style={styles.cmtRow}>
                  <View style={styles.cmtAvatar}>
                    {item.user_avatar ? <Image source={{ uri: item.user_avatar }} style={{ width: "100%", height: "100%" }} />
                      : <Text style={{ color: TAIR.gold, fontWeight: "900" }}>{(item.user_name || "?").charAt(0)}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cmtName}>{item.user_name || "مستخدم"}</Text>
                    <Text style={styles.cmtText}>{item.text}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={{ textAlign: "center", color: TAIR.textSoft, padding: 30 }}>كن أول من يعلّق</Text>}
            />
            <View style={styles.cmtInputRow}>
              <TextInput
                value={cmtText} onChangeText={setCmtText}
                placeholder="اكتب تعليقاً..." placeholderTextColor="#94A3B8" textAlign="right"
                style={styles.cmtInput} testID="story-comment-input"
              />
              <TouchableOpacity onPress={sendComment} disabled={cmtBusy || !cmtText.trim()} style={[styles.cmtSend, (cmtBusy || !cmtText.trim()) && { opacity: 0.5 }]} testID="story-comment-send">
                {cmtBusy ? <ActivityIndicator color={TAIR.gold} size="small" /> : <Ionicons name="send" size={18} color={TAIR.gold} />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0F241C", justifyContent: "center", alignItems: "center" },
  progressRow: { position: "absolute", top: 44, left: 8, right: 8, flexDirection: "row", gap: 3, zIndex: 5 },
  pTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  pFill: { height: "100%", backgroundColor: TAIR.gold },
  topBar: { position: "absolute", top: 56, left: 12, right: 12, flexDirection: "row-reverse", alignItems: "center", zIndex: 5 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: TAIR.gold, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarTxt: { color: TAIR.emerald, fontWeight: "900", fontSize: 15 },
  author: { color: "#fff", fontSize: 13, fontWeight: "800", textAlign: "right" },
  time: { color: "#E0C580", fontSize: 11, textAlign: "right" },
  topBadge: {
    flexDirection: "row-reverse", alignItems: "center", gap: 3,
    backgroundColor: TAIR.gold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  topBadgeText: { color: "#1B3D2F", fontSize: 10, fontWeight: "900" },
  media: { position: "absolute", top: 90, bottom: 130, left: 0, right: 0, width: "100%", height: "auto" },
  centerText: { position: "absolute", top: "35%", left: 24, right: 24 },
  storyText: { color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center", lineHeight: 32 },
  captionBar: { position: "absolute", bottom: 90, left: 16, right: 16, padding: 12, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 12 },
  captionText: { color: "#fff", fontSize: 13, textAlign: "right" },

  actionsBar: {
    position: "absolute", bottom: 28, left: 16, flexDirection: "row-reverse", gap: 14, alignItems: "center", zIndex: 6,
  },
  actionBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  emptyText: { color: "#F7F1E8", fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 16 },
  closeBig: { paddingVertical: 12, paddingHorizontal: 30, backgroundColor: TAIR.gold, borderRadius: 999 },
  closeBigText: { color: TAIR.emerald, fontWeight: "900", fontSize: 14 },

  cmtSheet: { backgroundColor: "#FFFDF8", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%" },
  cmtTitle: { textAlign: "center", color: TAIR.emerald, fontSize: 15, fontWeight: "900", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: TAIR.divider },
  cmtRow: { flexDirection: "row-reverse", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: TAIR.divider },
  cmtAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: TAIR.emerald, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cmtName: { color: TAIR.emerald, fontWeight: "900", fontSize: 12, textAlign: "right" },
  cmtText: { color: "#0F241C", fontSize: 13, textAlign: "right", marginTop: 2 },
  cmtInputRow: { flexDirection: "row-reverse", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: TAIR.divider, backgroundColor: "#fff" },
  cmtInput: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 20, paddingHorizontal: 14, height: 42, color: TAIR.emerald, borderWidth: 1, borderColor: TAIR.divider },
  cmtSend: { width: 42, height: 42, borderRadius: 21, backgroundColor: TAIR.emerald, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: TAIR.gold },
});
