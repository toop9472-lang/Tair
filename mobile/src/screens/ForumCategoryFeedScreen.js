// طير — Mobile Forum category feed (mirrors web ForumCategoryFeedScreen.jsx)
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { forumApi } from "../services/tairApi";
import ScreenHeader from "../components/ScreenHeader";

const timeAgo = (iso) => {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "الآن";
  if (s < 3600) return `${Math.floor(s / 60)} د`;
  if (s < 86400) return `${Math.floor(s / 3600)} س`;
  return `${Math.floor(s / 86400)} ي`;
};

export default function ForumCategoryFeedScreen({
  category,
  categoryName,
  onBack,
  onOpenPost,
  onCreate,
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await forumApi.feed({ category, limit: 50 });
      const items = Array.isArray(res) ? res : res?.items || [];
      setPosts(items);
    } catch (e) {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={categoryName}
        onBack={onBack}
        rightAction={
          <TouchableOpacity
            onPress={() => onCreate?.(category)}
            testID="forum-cat-new-post"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.22)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.catLabel}>{categoryName}</Text>

          {posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>لا توجد مواضيع بعد في هذا القسم</Text>
              <TouchableOpacity
                onPress={() => onCreate?.(category)}
                style={styles.startBtn}
                testID="forum-cat-empty-create"
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.startBtnText}>ابدأ أول موضوع</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {posts.map((p, idx) => {
                const initial = (p.author_name || "?").charAt(0).toUpperCase();
                const gradientPairs = [
                  ["#0ea5e9", "#14b8a6"],
                  ["#ec4899", "#f97316"],
                  ["#3b82f6", "#8b5cf6"],
                  ["#facc15", "#f97316"],
                  ["#059669", "#84cc16"],
                ];
                const [c1, c2] = gradientPairs[idx % gradientPairs.length];
                return (
                  <TouchableOpacity
                    key={p.post_id || p.id}
                    onPress={() => onOpenPost?.(p.post_id || p.id)}
                    style={styles.card}
                    activeOpacity={0.85}
                    testID={`forum-post-${p.post_id || p.id}`}
                  >
                    <View style={[styles.cardAccent, { backgroundColor: c1 }]} />
                    <View style={styles.head}>
                      <View style={[styles.avatar, { backgroundColor: c1 + "18" }]}>
                        <Text style={[styles.avatarText, { color: c1 }]}>{initial}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.author} numberOfLines={1}>{p.author_name || "مستخدم طير"}</Text>
                        <Text style={styles.meta}>{timeAgo(p.created_at)}</Text>
                      </View>
                      <View style={[styles.catBadge, { backgroundColor: c1 + "14", borderColor: c1 + "44" }]}>
                        <Ionicons name="chatbubbles" size={11} color={c1} />
                        <Text style={[styles.catBadgeText, { color: c1 }]}>{categoryName}</Text>
                      </View>
                    </View>
                    <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
                    {!!p.body && (
                      <Text style={styles.body} numberOfLines={3}>{p.body}</Text>
                    )}
                    <View style={styles.stats}>
                      <View style={[styles.statPill, { backgroundColor: "#fef2f2" }]}>
                        <Ionicons name="heart" size={11} color="#dc2626" />
                        <Text style={[styles.statPillText, { color: "#dc2626" }]}>{p.likes_count || 0}</Text>
                      </View>
                      <View style={[styles.statPill, { backgroundColor: c1 + "14" }]}>
                        <Ionicons name="chatbubble" size={11} color={c1} />
                        <Text style={[styles.statPillText, { color: c1 }]}>{p.replies_count || 0}</Text>
                      </View>
                      <View style={[styles.statPill, { backgroundColor: "#f1f5f9" }]}>
                        <Ionicons name="eye" size={11} color="#64748b" />
                        <Text style={[styles.statPillText, { color: "#64748b" }]}>{p.views_count || 0}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  catLabel: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0ea5e9",
    textAlign: "right",
    marginBottom: 12,
  },
  empty: {
    backgroundColor: "#fff",
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  emptyText: { color: "#64748b", fontSize: 13, marginBottom: 14 },
  startBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  startBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    paddingRight: 22,
    shadowColor: "#0f172a",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: "relative",
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "900" },
  catBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  catBadgeText: { fontSize: 10.5, fontWeight: "800" },
  author: { fontSize: 13.5, fontWeight: "800", color: "#0f172a", textAlign: "right" },
  meta: { fontSize: 11, color: "#94a3b8", fontWeight: "600", textAlign: "right", marginTop: 2 },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 6,
    textAlign: "right",
    lineHeight: 22,
  },
  body: { fontSize: 13, color: "#475569", lineHeight: 20, marginBottom: 12, textAlign: "right" },
  stats: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  statPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statPillText: { fontSize: 11, fontWeight: "800" },
});
