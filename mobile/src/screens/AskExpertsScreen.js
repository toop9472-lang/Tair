/**
 * AskExpertsScreen (Mobile) — قائمة أسئلة مع:
 * - هدر أخضر ثابت مكتوب عليه "اسأل" مع سهم رجوع
 * - أزرار سفلية: زر رجوع + زر "اطرح سؤالاً" واضح
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR } from "../constants/tairTheme";
import { forumApi } from "../services/tairApi";

function timeAgo12(iso) {
  if (!iso) return "";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return `قبل ${Math.floor(diff / 86400)} يوم`;
}

export default function AskExpertsScreen({ user, onBack }) {
  const uid = user?.id || user?.user_id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await forumApi.feed({ limit: 30 });
        setItems(d.items || d.posts || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [refresh]);

  return (
    <View style={s.page}>
      {/* هدر أخضر ثابت */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.headerBack} hitSlop={12} testID="ask-back-top">
          <Ionicons name="chevron-forward" size={26} color={TAIR.gold} />
        </TouchableOpacity>
        <View style={s.headerTitleWrap}>
          <Ionicons name="help-circle-outline" size={22} color={TAIR.gold} />
          <Text style={s.headerTitle}>اسأل</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={TAIR.emerald} />
      ) : items.length === 0 ? (
        <View style={{ paddingTop: 60, paddingHorizontal: 24, alignItems: "center" }}>
          <Ionicons name="chatbubbles-outline" size={64} color={TAIR.divider} />
          <Text style={s.emptyText}>لا أسئلة بعد. كن أول من يسأل الخبراء.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
          {items.map((p) => (
            <View key={p.post_id || p.id} style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.author}>{p.author_name || p.user_name || "مربّي"}</Text>
                <Text style={s.time}>{timeAgo12(p.created_at)}</Text>
              </View>
              <Text style={s.qTitle}>{p.title || "سؤال"}</Text>
              <Text style={s.qBody} numberOfLines={4}>{p.body || p.content || ""}</Text>
              <View style={s.cardFoot}>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                  <Ionicons name="chatbubble-outline" size={14} color={TAIR.textSoft} />
                  <Text style={{ color: TAIR.textSoft, fontSize: 12 }}>{p.replies_count || 0}</Text>
                </View>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                  <Ionicons name="thumbs-up-outline" size={14} color={TAIR.textSoft} />
                  <Text style={{ color: TAIR.textSoft, fontSize: 12 }}>{p.likes_count || 0}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* أزرار سفلية */}
      <View style={s.bottomBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} testID="ask-back-bottom">
          <Ionicons name="arrow-forward" size={18} color={TAIR.emerald} />
          <Text style={s.backBtnText}>رجوع</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={s.askBtn} testID="ask-open-form">
          <Ionicons name="add-circle" size={20} color={TAIR.gold} />
          <Text style={s.askBtnText}>اطرح سؤالاً</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: "900", color: TAIR.emerald }}>اطرح سؤالك</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={22} color={TAIR.emerald} />
              </TouchableOpacity>
            </View>
            <NewQuestionForm userId={uid} onDone={() => { setShowCreate(false); setRefresh((x) => x + 1); }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function NewQuestionForm({ userId, onDone }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async () => {
    if (!title.trim()) { setErr("اكتب عنوان السؤال"); return; }
    setBusy(true); setErr(null);
    try {
      await forumApi.createPost({ title: title.trim(), body: body.trim(), category: "general" }, userId);
      onDone();
    } catch (e) { setErr("تعذّر النشر"); }
    finally { setBusy(false); }
  };
  return (
    <View>
      <Text style={s.label}>عنوان السؤال</Text>
      <TextInput value={title} onChangeText={setTitle} style={s.inp} textAlign="right" placeholder="مثال: كيف أعتني بصغار الحسون؟" placeholderTextColor={TAIR.textSoft} />
      <Text style={[s.label, { marginTop: 10 }]}>التفاصيل (اختياري)</Text>
      <TextInput value={body} onChangeText={setBody} multiline style={[s.inp, { minHeight: 90, textAlignVertical: "top", paddingTop: 10 }]} textAlign="right" />
      {err && <Text style={{ color: "#B91C1C", fontSize: 12, marginTop: 6, textAlign: "right" }}>{err}</Text>}
      <TouchableOpacity onPress={submit} disabled={busy} style={s.submitBtn}>
        <Ionicons name="send" size={16} color={TAIR.gold} />
        <Text style={s.submitBtnText}>{busy ? "..جاري النشر" : "نشر السؤال"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  // هدر أخضر
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 48 : 20, paddingBottom: 14,
    backgroundColor: TAIR.emerald,
  },
  headerBack: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitleWrap: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  headerTitle: { color: TAIR.gold, fontSize: 20, fontWeight: "900" },

  emptyText: { color: TAIR.textSoft, fontSize: 14, textAlign: "center", padding: 20 },
  card: { padding: 14, borderRadius: 14, backgroundColor: TAIR.card, borderWidth: 1, borderColor: TAIR.divider, marginBottom: 12 },
  cardHead: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 },
  author: { fontWeight: "800", color: TAIR.emerald, fontSize: 12 },
  time: { color: TAIR.textSoft, fontSize: 11 },
  qTitle: { color: TAIR.emerald, fontSize: 15, fontWeight: "900", marginBottom: 4, textAlign: "right" },
  qBody: { color: TAIR.text, fontSize: 13, lineHeight: 20, marginBottom: 8, textAlign: "right" },
  cardFoot: { flexDirection: "row-reverse", gap: 14 },

  // أزرار سفلية
  bottomBar: {
    position: "absolute", left: 12, right: 12, bottom: Platform.OS === "ios" ? 26 : 16,
    flexDirection: "row-reverse", gap: 10,
  },
  backBtn: {
    flex: 1, height: 52, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 26, backgroundColor: TAIR.card, borderWidth: 1.5, borderColor: TAIR.gold,
  },
  backBtnText: { color: TAIR.emerald, fontSize: 15, fontWeight: "800" },
  askBtn: {
    flex: 2, height: 52, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 26, backgroundColor: TAIR.emerald,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  askBtnText: { color: TAIR.gold, fontSize: 15, fontWeight: "900" },

  // مودال
  modalWrap: { flex: 1, backgroundColor: "rgba(15,36,28,0.55)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: TAIR.card, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  label: { color: TAIR.emerald, fontSize: 13, fontWeight: "800", marginBottom: 4, textAlign: "right" },
  inp: { minHeight: 44, borderWidth: 1, borderColor: TAIR.divider, borderRadius: 12, paddingHorizontal: 12, backgroundColor: TAIR.bg, color: TAIR.emerald, fontSize: 14 },
  submitBtn: { marginTop: 14, height: 50, borderRadius: 25, backgroundColor: TAIR.emerald, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  submitBtnText: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },
});
