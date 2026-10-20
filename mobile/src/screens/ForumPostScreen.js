// طير — Mobile Forum post details + replies (mirrors ForumPostScreen.jsx)
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { forumApi } from "../services/tairApi";
import ScreenHeader from "../components/ScreenHeader";

const CATEGORY_ICON = {
  general: "chatbubbles",
  tips: "bulb",
  experience: "star",
  health: "medkit",
  food: "flower",
  breeding: "egg-outline",
  questions: "help-circle",
  market: "bag",
  import: "cube",
  animals_cats_dogs: "paw",
  animals_reptiles_rodents: "bug-outline",
  animals_exotic: "sparkles",
  fish_water: "fish",
  fish_aquarium: "water",
  fish_breeding: "egg-outline",
  insects_ornamental: "bug",
  insects_bees: "grid",
  insects_food: "restaurant",
  insects_projects: "briefcase",
  outdoor_breeding: "leaf",
  outdoor_solutions: "construct",
};

const timeAgo = (iso) => {
  if (!iso) return "الآن";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "الآن";
  if (s < 3600) return `قبل ${Math.floor(s / 60)} د`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} س`;
  return `قبل ${Math.floor(s / 86400)} ي`;
};

function ReplyCard({ reply, canDelete, onDelete }) {
  const initial = (reply.author_name || reply.author_id || "?").charAt(0).toUpperCase();
  return (
    <View style={styles.replyCard}>
      <View style={styles.replyTop}>
        <View style={styles.avatarSm}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName} numberOfLines={1}>{reply.author_name || "مستخدم طير"}</Text>
          <Text style={styles.metaText}>{timeAgo(reply.created_at)}</Text>
        </View>
        {canDelete ? (
          <TouchableOpacity
            onPress={onDelete}
            style={styles.replyDeleteBtn}
            testID={`reply-delete-${reply.reply_id}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color="#8B3A2F" />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.replyBody}>{reply.body}</Text>
    </View>
  );
}

export default function ForumPostScreen({ user, postId, onBack }) {
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const uid = user?.id || user?.user_id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await forumApi.getPost(postId, uid);
      setPost(p);
      setLikesCount(p.likes_count || 0);
      setLiked(Array.isArray(p.liked_by) && p.liked_by.includes(uid));
      const r = await forumApi.listReplies(postId);
      setReplies(Array.isArray(r) ? r : []);
    } catch (e) {
      Alert.alert("خطأ", "تعذّر تحميل المنشور");
    } finally {
      setLoading(false);
    }
  }, [postId, uid]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLike = async () => {
    try {
      const res = await forumApi.like(postId, uid);
      setLiked(res.liked);
      setLikesCount((c) => c + (res.liked ? 1 : -1));
    } catch (e) {
      /* ignore */
    }
  };

  const submitReply = async () => {
    const body = replyBody.trim();
    if (!body) return;
    setPosting(true);
    try {
      const authorName = user?.name && user.name !== "زائر" ? user.name : null;
      await forumApi.reply(postId, { body, author_name: authorName }, uid);
      setReplyBody("");
      await load();
    } catch (e) {
      Alert.alert("خطأ", "تعذّر إرسال الرد");
    } finally {
      setPosting(false);
    }
  };

  const isAdmin = !!user?.is_admin;
  const canDeletePost = !!post && (isAdmin || post.author_id === uid);

  const confirmDeletePost = () => {
    Alert.alert(
      "حذف الموضوع",
      "هل تريد حذف هذا الموضوع نهائياً؟ لا يمكن التراجع.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              await forumApi.deletePost(postId, uid);
              Alert.alert("تم", "تم حذف الموضوع", [{ text: "حسناً", onPress: onBack }]);
            } catch (e) {
              Alert.alert("خطأ", "تعذّر الحذف");
            }
          },
        },
      ],
    );
  };

  const confirmDeleteReply = (reply) => {
    Alert.alert(
      "حذف الرد",
      "هل تريد حذف هذا الرد؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              await forumApi.deleteReply(reply.reply_id, uid);
              setReplies((prev) => prev.filter((r) => r.reply_id !== reply.reply_id));
            } catch (e) {
              Alert.alert("خطأ", "تعذّر حذف الرد");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="المنشور" onBack={onBack} />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1B3D2F" />
        </View>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="المنشور" onBack={onBack} />
        <View style={styles.centerBox}>
          <Text style={{ color: "#8B3A2F", fontWeight: "700" }}>المنشور غير موجود</Text>
        </View>
      </View>
    );
  }

  const iconName = CATEGORY_ICON[post.category] || "chatbubbles";
  const authorInitial = (post.author_name || post.author_id || "?").charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <ScreenHeader
        title="المنشور"
        onBack={onBack}
        testID="post-details-screen"
        rightAction={
          canDeletePost ? (
            <TouchableOpacity
              onPress={confirmDeletePost}
              style={styles.headerDeleteBtn}
              testID="post-delete-btn"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={20} color="#8B3A2F" />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.postTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{authorInitial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{post.author_name || "مستخدم طير"}</Text>
              <Text style={styles.metaText}>{timeAgo(post.created_at)}</Text>
            </View>
            <View style={styles.catPill}>
              <Ionicons name={iconName} size={12} color="#1B3D2F" />
              <Text style={styles.catPillText}>{post.category}</Text>
            </View>
          </View>

          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postBody}>{post.body}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={toggleLike}
              style={[
                styles.actionBtn,
                liked && { backgroundColor: "#fef2f2", borderColor: "#8B3A2F" },
              ]}
              testID="post-like-btn"
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={16}
                color={liked ? "#8B3A2F" : "#6B5E4A"}
              />
              <Text style={[styles.actionText, liked && { color: "#8B3A2F" }]}>{likesCount}</Text>
            </TouchableOpacity>
            <View style={styles.stat}>
              <Ionicons name="chatbubble-outline" size={14} color="#6B5E4A" />
              <Text style={styles.statText}>{post.replies_count || 0}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="eye-outline" size={14} color="#6B5E4A" />
              <Text style={styles.statText}>{post.views_count || 0}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.repliesTitle}>الردود ({replies.length})</Text>

        {replies.length === 0 ? (
          <View style={styles.emptyReplies}>
            <Text style={{ color: "#6B5E4A", textAlign: "center" }}>
              لا توجد ردود بعد — كن أول من يشارك رأيه
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {replies.map((r) => (
              <ReplyCard
                key={r.reply_id}
                reply={r}
                canDelete={isAdmin || r.author_id === uid}
                onDelete={() => confirmDeleteReply(r)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={replyBody}
          onChangeText={setReplyBody}
          placeholder="اكتب رداً…"
          placeholderTextColor="#8A7B66"
          style={styles.composerInput}
          testID="reply-input"
        />
        <TouchableOpacity
          onPress={submitReply}
          disabled={posting || !replyBody.trim()}
          style={[styles.sendBtn, (posting || !replyBody.trim()) && { opacity: 0.4 }]}
          testID="reply-send"
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  headerDeleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fef2f2",
    borderWidth: 1, borderColor: "#fecaca",
    alignItems: "center", justifyContent: "center",
  },
  replyDeleteBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#fef2f2",
    alignItems: "center", justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  postTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#1B3D2F", fontSize: 14, fontWeight: "800" },
  authorName: { fontSize: 14, fontWeight: "800", color: "#0F241C", textAlign: "right" },
  metaText: { fontSize: 11, color: "#6B5E4A", fontWeight: "600", textAlign: "right", marginTop: 2 },
  catPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdfa",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  catPillText: { color: "#1B3D2F", fontSize: 11, fontWeight: "800" },
  postTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F241C",
    textAlign: "right",
    marginBottom: 8,
  },
  postBody: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
    textAlign: "right",
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#F7F1E8",
  },
  actionText: { fontSize: 13, fontWeight: "800", color: "#6B5E4A" },
  stat: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontWeight: "700", color: "#6B5E4A" },
  repliesTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F241C",
    textAlign: "right",
    marginBottom: 8,
    marginTop: 4,
  },
  emptyReplies: {
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  replyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  replyTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 8 },
  replyAuthor: { fontSize: 12, fontWeight: "800", color: "#0F241C", textAlign: "right" },
  replyBody: { fontSize: 14, color: "#334155", lineHeight: 20, textAlign: "right" },
  composer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    fontSize: 14,
    backgroundColor: "#F7F1E8",
    color: "#0F241C",
    textAlign: "right",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1B3D2F",
    alignItems: "center",
    justifyContent: "center",
  },
});
