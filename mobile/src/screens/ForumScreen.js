// طير — Mobile Forum with clean, mobile-first card layout
// Redesigned: vertical cards with clear hierarchy, comfortable spacing, larger tap targets.
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { forumApi } from "../services/tairApi";
import ScreenHeader from "../components/ScreenHeader";

// Map backend icon slugs → Ionicons names
const ICON_MAP = {
  bird: "leaf",
  feather: "leaf-outline",
  heart: "heart",
  music: "musical-notes",
  fish: "fish",
  egg: "egg-outline",
  "help-circle": "help-circle",
  wheat: "flower",
  lightbulb: "bulb",
  star: "star",
  "shopping-bag": "bag",
  "heart-pulse": "medkit",
  "book-open": "book",
  drumstick: "restaurant",
  "message-square": "chatbubbles",
  package: "cube",
  paw: "paw",
  worm: "bug-outline",
  sparkles: "sparkles",
  droplet: "water",
  bug: "bug",
  hexagon: "grid",
  briefcase: "briefcase",
  trees: "leaf",
  wrench: "construct",
};

const SECTION_GROUPS = [
  { id: "birds", title: "الطيور والعصافير", icon: "leaf", ids: ["general", "tips", "experience", "questions", "health", "food", "breeding"] },
  { id: "pets",  title: "حيوانات وأسماك",   icon: "paw",  ids: ["animals_cats_dogs", "animals_reptiles_rodents", "animals_exotic", "fish_water", "fish_aquarium", "fish_breeding"] },
  { id: "market", title: "السوق والاستيراد", icon: "bag",  ids: ["market", "import"] },
  { id: "more",  title: "التربية والحشرات",  icon: "bug",  ids: ["outdoor_breeding", "outdoor_solutions", "insects_ornamental", "insects_bees", "insects_food", "insects_projects"] },
];

const timeAgo = (iso) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return `قبل ${Math.floor(s / 60)} د`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} س`;
  if (s < 86400 * 30) return `قبل ${Math.floor(s / 86400)} يوم`;
  return new Date(iso).toLocaleDateString("ar-SA");
};

function CategoryCard({ cat, onOpen, onCreate }) {
  const iconName = ICON_MAP[cat.icon] || "leaf";
  const color = cat.color || "#0ea5e9";
  const hasLatest = !!cat.latest_post;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={onOpen}
      data-testid={`forum-cat-${cat.id}`}
    >
      {/* Top row: icon + title/desc */}
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: color }]}>
          <Ionicons name={iconName} size={20} color="#fff" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{cat.name_ar}</Text>
          {cat.desc_ar ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{cat.desc_ar}</Text>
          ) : null}
        </View>
        <Ionicons
          name="chevron-back"
          size={18}
          color="#cbd5e1"
          style={{ marginTop: 6 }}
        />
      </View>

      {/* Stats pills */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Ionicons name="document-text-outline" size={12} color="#0ea5e9" />
          <Text style={styles.statText}>
            {(cat.threads || 0).toLocaleString("ar-SA")} موضوع
          </Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="chatbubble-outline" size={12} color="#0ea5e9" />
          <Text style={styles.statText}>
            {(cat.posts || 0).toLocaleString("ar-SA")} مشاركة
          </Text>
        </View>
        {(cat.views || 0) > 0 && (
          <View style={styles.statPill}>
            <Ionicons name="eye-outline" size={12} color="#64748b" />
            <Text style={[styles.statText, { color: "#64748b" }]}>
              {(cat.views || 0).toLocaleString("ar-SA")}
            </Text>
          </View>
        )}
      </View>

      {/* Latest activity footer */}
      <View style={styles.latestRow}>
        {hasLatest ? (
          <>
            <View style={styles.latestDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.latestTitle} numberOfLines={1}>
                {cat.latest_post.title}
              </Text>
              <Text style={styles.latestMeta} numberOfLines={1}>
                {cat.latest_post.author_name} · {timeAgo(cat.latest_post.at)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.emptyLatest}>لا مواضيع بعد — كن أول من يبدأ نقاشاً</Text>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={(e) => { e?.stopPropagation?.(); onCreate(cat.id); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.startBtnText}>ابدأ الآن</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function CreatePostModal({ visible, user, categories, initialCategory, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(initialCategory || "general");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setCategory(initialCategory || categories[0]?.id || "general");
  }, [visible, initialCategory, categories]);

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert("مطلوب", "أضف عنواناً للمنشور");
      return;
    }
    try {
      setSaving(true);
      const userId = user?.user_id || user?.id;
      await forumApi.create(
        { title: title.trim(), body: body.trim(), category, author_name: user?.name || user?.email },
        userId,
      );
      setTitle(""); setBody("");
      onCreated?.();
      onClose();
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر النشر");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#F7F1E8" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={22} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>منشور جديد</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.formLabel}>الفئة</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[styles.catPill, category === c.id && styles.catPillActive]}
              >
                <Text
                  style={[styles.catPillText, category === c.id && styles.catPillTextActive]}
                >
                  {c.name_ar}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.formLabel}>العنوان *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="مثال: ما أفضل تغذية للحسون؟"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.formLabel}>المحتوى</Text>
          <TextInput
            style={[styles.input, { minHeight: 140, textAlignVertical: "top" }]}
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="اكتب تفاصيل منشورك…"
            placeholderTextColor="#94a3b8"
          />

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={submit}
            disabled={saving}
            data-testid="forum-create-submit"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.submitText}>نشر</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ForumScreen({ user, onOpenPost, onOpenCategory, initialCreateFor = null, initialCreateOpen = false }) {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createFor, setCreateFor] = useState(initialCreateFor);
  const [createOpen, setCreateOpen] = useState(initialCreateOpen);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await forumApi.stats();
      setCats(r.items || []);
    } catch (e) {
      console.warn("forum stats", e?.message);
      setCats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byId = new Map(cats.map((c) => [c.id, c]));

  // Totals for hero strip
  const totals = cats.reduce(
    (acc, c) => ({
      threads: acc.threads + (c.threads || 0),
      posts: acc.posts + (c.posts || 0),
    }),
    { threads: 0, posts: 0 },
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="المنتدى"
        subtitle="ناقش وشارك خبرتك مع مربّي الطيور"
        rightAction={
          <TouchableOpacity
            onPress={() => { setCreateFor(null); setCreateOpen(true); }}
            data-testid="forum-new-post-btn"
            style={styles.headerAddBtn}
          >
            <Ionicons name="add" size={22} color="#0ea5e9" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#0ea5e9"
          />
        }
      >
        {loading ? (
          <ActivityIndicator color="#0ea5e9" size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Hero totals strip */}
            {!!cats.length && (
              <View style={styles.hero}>
                <View style={styles.heroCol}>
                  <Text style={styles.heroVal}>
                    {totals.threads.toLocaleString("ar-SA")}
                  </Text>
                  <Text style={styles.heroLabel}>موضوع</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroCol}>
                  <Text style={styles.heroVal}>
                    {totals.posts.toLocaleString("ar-SA")}
                  </Text>
                  <Text style={styles.heroLabel}>مشاركة</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroCol}>
                  <Text style={styles.heroVal}>
                    {cats.length.toLocaleString("ar-SA")}
                  </Text>
                  <Text style={styles.heroLabel}>قسم</Text>
                </View>
              </View>
            )}

            {SECTION_GROUPS.map((sec) => {
              const rows = sec.ids.map((id) => byId.get(id)).filter(Boolean);
              if (rows.length === 0) return null;
              return (
                <View key={sec.id} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name={sec.icon} size={14} color="#0ea5e9" />
                    <Text style={styles.sectionTitle}>{sec.title}</Text>
                    <Text style={styles.sectionCount}>
                      {rows.length.toLocaleString("ar-SA")}
                    </Text>
                  </View>
                  <View style={styles.sectionBody}>
                    {rows.map((cat) => (
                      <CategoryCard
                        key={cat.id}
                        cat={cat}
                        onOpen={() => {
                          if (onOpenCategory) {
                            onOpenCategory(cat.id, cat.name_ar);
                          } else if (onOpenPost) {
                            onOpenPost({ category: cat.id, categoryName: cat.name_ar });
                          }
                        }}
                        onCreate={(cid) => { setCreateFor(cid); setCreateOpen(true); }}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <CreatePostModal
        visible={createOpen}
        user={user}
        categories={cats}
        initialCategory={createFor}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  headerAddBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0ea5e9", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  // Hero totals strip
  hero: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0ea5e9",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  heroCol: { alignItems: "center", flex: 1 },
  heroVal: { fontSize: 18, fontWeight: "900", color: "#0ea5e9" },
  heroLabel: { fontSize: 11, color: "#64748b", fontWeight: "700", marginTop: 2 },
  heroDivider: { width: 1, height: 28, backgroundColor: "#e2e8f0" },

  // Section
  section: {
    marginTop: 14,
    marginHorizontal: 14,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 14,
    flex: 1,
    textAlign: "right",
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0ea5e9",
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sectionBody: { gap: 8 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0ea5e9", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "right",
    lineHeight: 20,
  },
  cardDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 17,
    marginTop: 2,
    textAlign: "right",
  },

  statsRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  statPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdfa",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0ea5e9",
  },

  latestRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  latestDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#10b981",
  },
  latestTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "right",
  },
  latestMeta: {
    fontSize: 10.5,
    color: "#94a3b8",
    fontWeight: "600",
    textAlign: "right",
    marginTop: 1,
  },
  emptyLatest: {
    flex: 1,
    fontSize: 11.5,
    color: "#94a3b8",
    fontWeight: "600",
    textAlign: "right",
  },
  startBtn: {
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  startBtnText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },

  // Modal
  modalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  formLabel: {
    fontSize: 13, fontWeight: "800", color: "#334155",
    marginTop: 14, marginBottom: 6, textAlign: "right",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    textAlign: "right",
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
  },
  catPillActive: { backgroundColor: "#0ea5e9" },
  catPillText: { color: "#64748b", fontWeight: "700", fontSize: 12 },
  catPillTextActive: { color: "#fff", fontWeight: "800" },
  submitBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0ea5e9",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
    elevation: 4,
    shadowColor: "#0ea5e9",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
