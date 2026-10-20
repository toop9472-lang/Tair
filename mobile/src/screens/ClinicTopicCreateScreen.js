/**
 * ClinicTopicCreateScreen — إنشاء موضوع في العيادة
 * - أسئلة تشخيصية (نعم/لا مع حقل تفاصيل عند الحاجة) + نص قصير
 * - عرض شبكي: مربعات متجاورة (3 أعمدة) بدل القائمة الطويلة
 * - صور + فيديو (حد أقصى 60 ثانية)
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { TAIR } from "../constants/tairTheme";
import { clinicTopicsApi } from "../services/tairApi";
import api from "../services/api";

/**
 * types:
 *  - "yesno": نعم/لا، لو "نعم" يفتح حقل تفاصيل اختياري
 *  - "text":  حقل نص قصير
 */
const QUESTIONS = [
  { key: "q_lethargy",         label: "خمول؟",             type: "yesno", detailLabel: "فصّل الخمول" },
  { key: "q_appetite",         label: "قلة شهية؟",         type: "yesno", detailLabel: "درجة الشهية" },
  { key: "q_vomits",           label: "استفراغ؟",          type: "yesno", detailLabel: "عدد المرات / الشكل" },
  { key: "q_mouth_droppings",  label: "نقاط فم/براز غريب؟", type: "yesno", detailLabel: "اللون/الرائحة" },
  { key: "q_breeding",         label: "حضن/تزاوج؟",        type: "yesno", detailLabel: "منذ متى؟" },
  { key: "q_seen_vet",         label: "زار دكتور؟",         type: "yesno", detailLabel: "التشخيص السابق" },
  { key: "q_tame",             label: "أليف؟",              type: "yesno" },
  { key: "q_onset",            label: "متى بدأ؟",           type: "text", placeholder: "منذ متى؟" },
  { key: "q_age",              label: "العمر",             type: "text", placeholder: "مثال: ٨ شهور" },
  { key: "q_time_with_owner",  label: "عمر تواجده عندك",   type: "text", placeholder: "مثال: سنتين" },
  { key: "q_gender",           label: "النوع",              type: "text", placeholder: "ذكر/أنثى" },
  { key: "q_diet",             label: "التغذية",            type: "text", placeholder: "ماذا يأكل؟" },
  { key: "q_medications",      label: "أدوية حديثة",       type: "text", placeholder: "اسم الدواء/الجرعة" },
];

const CHICK_QUESTIONS = [
  { key: "chick_serelac_brand",    label: "شركة السريلاك",    type: "text" },
  { key: "chick_exact_age",        label: "عمر الفرخ بالضبط",   type: "text" },
  { key: "chick_serelac_temp",     label: "درجة حرارة السريلاك", type: "text" },
  { key: "chick_feeding_count",    label: "عدد مرات الغر",      type: "text" },
  { key: "chick_feeding_method",   label: "طريقة التأكيل",       type: "text" },
  { key: "chick_serelac_leftover", label: "بواقي سريلاك؟",      type: "yesno", detailLabel: "الكمية المتبقية" },
];

export default function ClinicTopicCreateScreen({ user, onBack, onCreated }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [answers, setAnswers] = useState({});
  const [isChick, setIsChick] = useState(false);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [busy, setBusy] = useState(false);
  const uid = user?.user_id || user?.id || user?.email;

  const set = (k, v) => setAnswers((p) => ({ ...p, [k]: v }));

  const pickImage = async () => {
    if (images.length >= 10) return Alert.alert("حد أقصى", "١٠ صور كحد أقصى");
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8, allowsMultipleSelection: false,
      });
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      const form = new FormData();
      form.append("file", { uri: a.uri, name: "clinic.jpg", type: a.mimeType || "image/jpeg" });
      form.append("user_id", uid || "");
      const resp = await api.fetch("/api/listings/upload-image", { method: "POST", body: form });
      if (!resp?.ok) {
        const t = await resp?.text?.().catch(() => "");
        throw new Error(t || "upload failed");
      }
      const j = await resp.json();
      const url = j?.url || j?.image_url;
      if (url) setImages((p) => [...p, url]);
    } catch (e) { Alert.alert("خطأ", e?.message || "فشل رفع الصورة"); }
  };

  const pickVideo = async () => {
    if (videos.length >= 3) return Alert.alert("حد أقصى", "٣ مقاطع كحد أقصى");
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.7, videoMaxDuration: 60,
      });
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      if (a.duration && a.duration > 60500) {
        return Alert.alert("طويل جداً", "الحد الأقصى للفيديو ٦٠ ثانية");
      }
      // استخراج الامتداد من URI للتأكد (iOS يرجع .mov)
      const uriLower = (a.uri || "").toLowerCase();
      const ext = uriLower.endsWith(".mov") ? "mov"
        : uriLower.endsWith(".m4v") ? "m4v"
        : uriLower.endsWith(".3gp") ? "3gp"
        : uriLower.endsWith(".webm") ? "webm"
        : "mp4";
      const mime = ext === "mov" ? "video/quicktime"
        : ext === "webm" ? "video/webm"
        : ext === "3gp" ? "video/3gpp"
        : "video/mp4";
      const form = new FormData();
      form.append("file", { uri: a.uri, name: `clinic.${ext}`, type: mime });
      form.append("user_id", uid || "");
      // مسار الفيديو الصحيح — ليس /upload-image
      const resp = await api.fetch("/api/listings/upload-video", { method: "POST", body: form });
      if (!resp?.ok) {
        let msg = "فشل رفع الفيديو";
        try { const j = await resp.json(); msg = j?.detail || msg; } catch {}
        throw new Error(msg);
      }
      const j = await resp.json();
      const url = j?.url || j?.video_url;
      if (url) setVideos((p) => [...p, url]);
    } catch (e) { Alert.alert("خطأ", e?.message || "فشل رفع الفيديو"); }
  };

  const submit = async () => {
    if (title.trim().length < 3) return Alert.alert("تنبيه", "اكتب عنواناً مختصراً للحالة");
    if (desc.trim().length < 10) return Alert.alert("تنبيه", "اكتب شرحاً مختصراً (10 أحرف على الأقل)");
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        description: desc.trim(),
        images, videos,
        is_chick: isChick,
        ...answers,
      };
      const r = await clinicTopicsApi.create(payload, uid);
      Alert.alert("✔ تم النشر", "ستتلقى إشعاراً عند الرد");
      onCreated?.(r?.topic_id);
    } catch (e) {
      Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر الإنشاء");
    } finally { setBusy(false); }
  };

  // بطاقات الأسئلة — نرسمها inline داخل map لتجنّب إعادة بناء TextInput في كل render (وفقدان الكيبورد)
  const renderGrid = (list) => (
    <View style={s.grid}>
      {list.map((q) => {
        const v = answers[q.key];
        if (q.type === "yesno") {
          const isYes = v && v !== "لا";
          const isNo = v === "لا";
          return (
            <View key={q.key} style={s.gridItem}>
              <View style={s.qCard}>
                <Text style={s.qCardLabel} numberOfLines={2}>{q.label}</Text>
                <View style={s.ynRow}>
                  <TouchableOpacity
                    onPress={() => set(q.key, isYes ? "" : "نعم")}
                    style={[s.ynBtn, isYes && s.ynBtnActive]}
                    testID={`q-${q.key}-yes`}
                  >
                    <Text style={[s.ynText, isYes && s.ynTextActive]}>نعم</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => set(q.key, isNo ? "" : "لا")}
                    style={[s.ynBtn, isNo && s.ynBtnNo]}
                    testID={`q-${q.key}-no`}
                  >
                    <Text style={[s.ynText, isNo && s.ynTextActive]}>لا</Text>
                  </TouchableOpacity>
                </View>
                {isYes && q.detailLabel ? (
                  <TextInput
                    value={typeof v === "string" && v !== "نعم" ? v : ""}
                    onChangeText={(t) => set(q.key, t || "نعم")}
                    placeholder={q.detailLabel}
                    placeholderTextColor={TAIR.textSoft}
                    textAlign="right"
                    style={s.qCardDetail}
                    testID={`q-${q.key}-detail`}
                  />
                ) : null}
              </View>
            </View>
          );
        }
        // type === "text"
        return (
          <View key={q.key} style={s.gridItem}>
            <View style={s.qCard}>
              <Text style={s.qCardLabel} numberOfLines={2}>{q.label}</Text>
              <TextInput
                value={answers[q.key] || ""}
                onChangeText={(val) => set(q.key, val)}
                placeholder={q.placeholder || "إجابتك..."}
                placeholderTextColor={TAIR.textSoft}
                textAlign="right"
                style={s.qCardInput}
                testID={`q-${q.key}-text`}
              />
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.hBtn}>
          <Ionicons name="chevron-forward" size={22} color={TAIR.gold} />
        </TouchableOpacity>
        <Text style={s.hTitle}>إضافة موضوع</Text>
        <View style={s.hBtn} />
      </View>

      <ScrollView style={s.page} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <Text style={s.sectH}>العنوان والشرح</Text>
        <TextInput
          value={title} onChangeText={setTitle}
          placeholder="مثال: ببغاء ما يأكل من يومين"
          placeholderTextColor={TAIR.textSoft} textAlign="right"
          style={s.input} testID="topic-title"
        />
        <TextInput
          value={desc} onChangeText={setDesc}
          placeholder="اشرح الحالة بالتفصيل..."
          placeholderTextColor={TAIR.textSoft} textAlign="right"
          multiline style={[s.input, s.textarea]} testID="topic-desc"
        />

        <Text style={s.sectH}>الصور ({images.length}/10)</Text>
        <View style={s.mediaRow}>
          {images.map((u, i) => (
            <View key={i} style={s.mediaThumb}>
              <Image source={{ uri: u }} style={{ width: "100%", height: "100%" }} />
              <TouchableOpacity onPress={() => setImages((p) => p.filter((_, x) => x !== i))} style={s.rm}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={pickImage} style={s.mediaAdd} testID="topic-add-image">
            <Ionicons name="camera-outline" size={22} color={TAIR.gold} />
            <Text style={s.mediaAddText}>صورة</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectH}>الفيديو ({videos.length}/3 — حد أقصى ٦٠ ثانية)</Text>
        <View style={s.mediaRow}>
          {videos.map((u, i) => (
            <View key={i} style={s.mediaThumb}>
              <View style={{ flex: 1, backgroundColor: "#0F241C", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="videocam" size={22} color={TAIR.gold} />
              </View>
              <TouchableOpacity onPress={() => setVideos((p) => p.filter((_, x) => x !== i))} style={s.rm}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={pickVideo} style={s.mediaAdd} testID="topic-add-video">
            <Ionicons name="videocam-outline" size={22} color={TAIR.gold} />
            <Text style={s.mediaAddText}>فيديو</Text>
          </TouchableOpacity>
        </View>

        <View style={s.diagBox}>
          <Text style={s.sectH}>📋 أسئلة تشخيص الحالة</Text>
          <Text style={s.diagHint}>كل الأسئلة اختيارية — جاوب على ما يهمك فقط</Text>
          {renderGrid(QUESTIONS)}
        </View>

        <View style={s.chickToggle}>
          <View style={{ flex: 1 }}>
            <Text style={s.chickTitle}>🐣 هل الطير فرخ؟</Text>
            <Text style={s.chickHint}>فعّل هذا الخيار إن كان الطير فرخ وأضف تفاصيل الغر</Text>
          </View>
          <Switch
            value={isChick} onValueChange={setIsChick}
            trackColor={{ false: "#CBD5E1", true: TAIR.emerald }}
            thumbColor={isChick ? TAIR.gold : "#F1F5F9"}
          />
        </View>

        {isChick ? (
          <View style={[s.diagBox, { borderColor: TAIR.gold }]}>
            <Text style={[s.sectH, { color: TAIR.goldDark }]}>تفاصيل الفرخ</Text>
            {renderGrid(CHICK_QUESTIONS)}
          </View>
        ) : null}

        <TouchableOpacity onPress={submit} disabled={busy} style={[s.submit, busy && { opacity: 0.7 }]} testID="topic-submit">
          {busy ? <ActivityIndicator color={TAIR.gold} size="small" /> : <Ionicons name="send" size={16} color={TAIR.gold} />}
          <Text style={s.submitText}>{busy ? "جاري النشر..." : "نشر الموضوع"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 48 : 20, paddingBottom: 12,
    backgroundColor: TAIR.emerald, borderBottomWidth: 1, borderBottomColor: TAIR.gold,
  },
  hTitle: { color: TAIR.gold, fontSize: 17, fontWeight: "900" },
  hBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sectH: { color: TAIR.emerald, fontSize: 14, fontWeight: "900", textAlign: "right", marginTop: 14, marginBottom: 8, borderRightWidth: 3, borderRightColor: TAIR.gold, paddingRight: 8 },
  input: {
    backgroundColor: TAIR.card, borderRadius: 12,
    borderWidth: 1, borderColor: TAIR.divider,
    paddingHorizontal: 14, height: 46, color: TAIR.emerald, marginBottom: 10,
  },
  textarea: { height: 110, paddingVertical: 12, textAlignVertical: "top" },
  mediaRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  mediaThumb: { width: 78, height: 78, borderRadius: 10, overflow: "hidden", position: "relative", backgroundColor: TAIR.divider },
  mediaAdd: {
    width: 78, height: 78, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed",
    borderColor: TAIR.gold, backgroundColor: TAIR.emerald,
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  mediaAddText: { color: TAIR.gold, fontSize: 11, fontWeight: "900" },
  rm: { position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },

  diagBox: {
    marginTop: 10, padding: 10,
    backgroundColor: TAIR.card, borderRadius: 14,
    borderWidth: 1, borderColor: TAIR.divider,
  },
  diagHint: { color: TAIR.textSoft, fontSize: 11, textAlign: "right", marginBottom: 10, lineHeight: 18 },

  // ---- Grid 3 أعمدة ----
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  gridItem: { width: "32%" }, // 3 أعمدة (~ ثلث العرض مع gap)
  qCard: {
    backgroundColor: TAIR.bg, borderRadius: 10,
    borderWidth: 1, borderColor: TAIR.divider,
    padding: 8, minHeight: 94,
  },
  qCardLabel: { color: TAIR.emerald, fontSize: 11, fontWeight: "900", textAlign: "right", marginBottom: 6, lineHeight: 16 },
  qCardInput: {
    backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: TAIR.divider,
    paddingHorizontal: 8, paddingVertical: 6, color: TAIR.emerald, textAlign: "right",
    fontSize: 12, minHeight: 36,
  },
  qCardDetail: {
    marginTop: 6,
    backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: TAIR.gold,
    paddingHorizontal: 8, paddingVertical: 6, color: TAIR.emerald, textAlign: "right",
    fontSize: 11, minHeight: 32,
  },
  ynRow: { flexDirection: "row-reverse", gap: 6 },
  ynBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: "#fff", borderWidth: 1, borderColor: TAIR.divider,
    alignItems: "center",
  },
  ynBtnActive: { backgroundColor: TAIR.emerald, borderColor: TAIR.gold },
  ynBtnNo:     { backgroundColor: "#8B3A2F", borderColor: TAIR.gold },
  ynText: { color: TAIR.emerald, fontSize: 12, fontWeight: "900" },
  ynTextActive: { color: TAIR.gold },

  chickToggle: {
    flexDirection: "row-reverse", alignItems: "center",
    backgroundColor: TAIR.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: TAIR.gold, marginTop: 14,
  },
  chickTitle: { color: TAIR.emerald, fontSize: 14, fontWeight: "900", textAlign: "right" },
  chickHint: { color: TAIR.textSoft, fontSize: 11, textAlign: "right", marginTop: 2 },
  submit: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: TAIR.emerald, borderRadius: 14, paddingVertical: 14, marginTop: 20,
    borderWidth: 1.5, borderColor: TAIR.gold,
  },
  submitText: { color: TAIR.gold, fontSize: 15, fontWeight: "900" },
});
