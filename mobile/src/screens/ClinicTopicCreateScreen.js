/**
 * ClinicTopicCreateScreen — تشخيص حالة
 * سطور رفيعة بأيقونات، لا شبكة مربعات.
 * الصور والفيديو مع إجابات المشرف في صفحة واحدة.
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
const CASE_QUESTIONS = [
  { key: "q_lethargy", icon: "moon-outline", label: "هل يوجد خمول؟", kind: "yesno" },
  { key: "q_appetite", icon: "restaurant-outline", label: "الشهية", kind: "choice", options: ["طبيعية", "قليلة", "معدومة"] },
  { key: "q_onset", icon: "time-outline", label: "متى بدأت الأعراض؟", kind: "text", placeholder: "مثال: من يومين" },
  { key: "q_diet", icon: "nutrition-outline", label: "تغذية الطير بالتفصيل", kind: "text", placeholder: "بذور، فواكه، خضار…", multiline: true },
  { key: "q_gender", icon: "male-female-outline", label: "ذكر أم أنثى؟", kind: "choice", options: ["ذكر", "أنثى", "لا أعرف"] },
  { key: "q_breeding", icon: "egg-outline", label: "في حضن بيض أو تزاوج؟", kind: "yesno" },
  { key: "q_medications", icon: "medkit-outline", label: "أدوية أخذها مؤخراً؟", kind: "text", placeholder: "لا، أو اسم ما أُعطي" },
  { key: "q_seen_vet", icon: "person-outline", label: "عُرضت الحالة على أحد من قبل؟", kind: "yesno", detail: "دكتور أو غيره، وماذا قال؟" },
  { key: "q_age", icon: "hourglass-outline", label: "كم عمر الطير؟", kind: "text", placeholder: "مثال: ٨ أشهر" },
  { key: "q_time_with_owner", icon: "home-outline", label: "كم له عايش عندك؟", kind: "text", placeholder: "مثال: سنة" },
  { key: "q_tame", icon: "heart-outline", label: "أليف أم لا؟", kind: "yesno" },
  { key: "q_vomits", icon: "water-outline", label: "هل يستفرغ؟", kind: "yesno" },
  { key: "q_mouth_droppings", icon: "alert-circle-outline", label: "نقاط صفراء أو بيضاء بالفم، أو رائحة في البراز؟", kind: "yesno", detail: "صف اللون أو الرائحة" },
];

const CHICK_QUESTIONS = [
  { key: "chick_serelac_brand", icon: "flask-outline", label: "شركة السريلاك", kind: "text", placeholder: "اسم الشركة" },
  { key: "chick_exact_age", icon: "hourglass-outline", label: "عمر الطائر بالضبط", kind: "text", placeholder: "بالأيام أو الأسابيع" },
  { key: "chick_serelac_temp", icon: "thermometer-outline", label: "درجة حرارة السريلاك", kind: "text", placeholder: "عند التقديم" },
  { key: "chick_feeding_count", icon: "repeat-outline", label: "عدد مرات الغر والكمية", kind: "text", placeholder: "كم مرة، وكم في كل مرة" },
  { key: "chick_feeding_method", icon: "hand-left-outline", label: "طريقة التأكيل اليدوي", kind: "text", placeholder: "سرنجة، ملعقة…" },
  { key: "chick_serelac_leftover", icon: "alert-circle-outline", label: "هل يوجد بواقي سريلاك؟", kind: "yesno", detail: "من متى والكمية" },
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
    if (desc.trim().length < 10) return Alert.alert("تنبيه", "اكتب الأعراض التي تراها في شرح قصير");
    const pending = CASE_QUESTIONS.filter((q) => !String(answers[q.key] || "").trim());
    const chickPending = isChick ? CHICK_QUESTIONS.filter((q) => !String(answers[q.key] || "").trim()) : [];
    if (pending.length || chickPending.length) {
      const first = (pending[0] || chickPending[0]).label;
      return Alert.alert(
        "أكمل تشخيص الحالة",
        `بقيت ${pending.length + chickPending.length} إجابات. أولها: ${first}. المشرف يرد أسرع عندما تكتمل القائمة.`,
      );
    }
    if (!images.length && !videos.length) {
      return Alert.alert("صورة أو فيديو", "أرفق صورة للبراز أو فيديو للطير حتى تُفهم الحالة.");
    }
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

  const filled = CASE_QUESTIONS.filter((q) => String(answers[q.key] || "").trim()).length;

  const renderQuestion = (q) => {
    const v = answers[q.key] || "";
    const isYes = v && v !== "لا";
    const isNo = v === "لا";
    return (
      <View key={q.key} style={s.qRow} testID={`q-${q.key}`}>
        <View style={s.qHead}>
          <Ionicons name={q.icon} size={16} color={TAIR.goldDark} />
          <Text style={s.qLabel}>{q.label}</Text>
        </View>
        {q.kind === "yesno" ? (
          <View style={s.ynRow}>
            <TouchableOpacity onPress={() => set(q.key, isYes ? "" : "نعم")} style={[s.ynBtn, isYes && s.ynOn]} testID={`q-${q.key}-yes`}>
              <Text style={[s.ynText, isYes && s.ynTextOn]}>نعم</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => set(q.key, isNo ? "" : "لا")} style={[s.ynBtn, isNo && s.ynOff]} testID={`q-${q.key}-no`}>
              <Text style={[s.ynText, isNo && s.ynTextOn]}>لا</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {q.kind === "choice" ? (
          <View style={s.choiceRow}>
            {q.options.map((opt) => {
              const on = v === opt;
              return (
                <TouchableOpacity key={opt} onPress={() => set(q.key, on ? "" : opt)} style={[s.choice, on && s.choiceOn]} testID={`q-${q.key}-${opt}`}>
                  <Text style={[s.choiceText, on && s.ynTextOn]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {q.kind === "text" ? (
          <TextInput
            value={v}
            onChangeText={(val) => set(q.key, val)}
            placeholder={q.placeholder || "إجابتك"}
            placeholderTextColor={TAIR.textSoft}
            textAlign="right"
            multiline={!!q.multiline}
            style={[s.qInput, q.multiline && s.qInputTall]}
            testID={`q-${q.key}-text`}
          />
        ) : null}
        {q.kind === "yesno" && isYes && q.detail ? (
          <TextInput
            value={v !== "نعم" ? v : ""}
            onChangeText={(t) => set(q.key, t || "نعم")}
            placeholder={q.detail}
            placeholderTextColor={TAIR.textSoft}
            textAlign="right"
            style={s.qInput}
            testID={`q-${q.key}-detail`}
          />
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.hBtn}>
          <Ionicons name="chevron-forward" size={22} color={TAIR.gold} />
        </TouchableOpacity>
        <Text style={s.hTitle}>تشخيص حالة</Text>
        <View style={s.hBtn} />
      </View>

      <ScrollView style={s.page} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <View style={s.intro}>
          <Ionicons name="medkit-outline" size={16} color={TAIR.goldDark} />
          <Text style={s.introText}>
            اجمع الأعراض وأجب في هذه الصفحة. المشرف يرد أسرع عندما تكتمل الإجابات، ويتأخر الرد إذا بقيت فارغة.
          </Text>
        </View>
        <Text style={s.progress}>{filled} من {CASE_QUESTIONS.length}</Text>

        <Text style={s.sectH}>الحالة</Text>
        <TextInput
          value={title} onChangeText={setTitle}
          placeholder="عنوان قصير: ببغاء ما يأكل من يومين"
          placeholderTextColor={TAIR.textSoft} textAlign="right"
          style={s.input} testID="topic-title"
        />
        <TextInput
          value={desc} onChangeText={setDesc}
          placeholder="الأعراض التي تراها، في رسالة واحدة"
          placeholderTextColor={TAIR.textSoft} textAlign="right"
          multiline style={[s.input, s.textarea]} testID="topic-desc"
        />

        <Text style={s.sectH}>صورة البراز والفيديو ({images.length} صورة · {videos.length} فيديو)</Text>
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
            <Text style={s.mediaAddText}>براز</Text>
          </TouchableOpacity>
        </View>

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
            <Text style={s.mediaAddText}>الطير</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.mediaHint}>صورة البراز، وفيديو للطير لا يتجاوز دقيقة.</Text>

        <Text style={s.sectH}>تشخيص الحالة</Text>
        <View style={s.list}>{CASE_QUESTIONS.map(renderQuestion)}</View>

        <View style={s.chickToggle}>
          <View style={{ flex: 1 }}>
            <Text style={s.chickTitle}>إذا كان الطائر فرخاً</Text>
            <Text style={s.chickHint}>أكمل أسئلة السريلاك. الطير البالغ لا يحتاجها.</Text>
          </View>
          <Switch
            value={isChick} onValueChange={setIsChick}
            trackColor={{ false: "#CBD5E1", true: TAIR.emerald }}
            thumbColor={isChick ? TAIR.gold : "#F1F5F9"}
          />
        </View>

        {isChick ? <View style={s.list}>{CHICK_QUESTIONS.map(renderQuestion)}</View> : null}

        <TouchableOpacity onPress={submit} disabled={busy} style={[s.submit, busy && { opacity: 0.7 }]} testID="topic-submit">
          {busy ? <ActivityIndicator color={TAIR.gold} size="small" /> : <Ionicons name="send" size={16} color={TAIR.gold} />}
          <Text style={s.submitText}>{busy ? "جاري النشر..." : "نشر تشخيص الحالة"}</Text>
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

  intro: {
    flexDirection: "row-reverse", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FFF8EC", borderRadius: 12, padding: 10, marginTop: 4,
  },
  introText: { flex: 1, color: "#6B5E4A", fontSize: 12, lineHeight: 18, textAlign: "right" },
  progress: { color: TAIR.goldDark, fontSize: 11, fontWeight: "800", textAlign: "left", marginTop: 8 },
  mediaHint: { color: TAIR.textSoft, fontSize: 11, textAlign: "right", marginTop: 6 },
  list: {
    backgroundColor: TAIR.card, borderRadius: 14, borderWidth: 1, borderColor: TAIR.divider,
    overflow: "hidden",
  },
  qRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: TAIR.divider, gap: 8 },
  qHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  qLabel: { flex: 1, color: TAIR.emerald, fontSize: 13, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  qInput: {
    backgroundColor: TAIR.bg, borderRadius: 8, borderWidth: 1, borderColor: TAIR.divider,
    paddingHorizontal: 10, paddingVertical: 8, color: TAIR.emerald, fontSize: 13, textAlign: "right",
  },
  qInputTall: { minHeight: 64, textAlignVertical: "top" },
  ynRow: { flexDirection: "row-reverse", gap: 6 },
  ynBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: TAIR.bg, borderWidth: 1, borderColor: TAIR.divider,
  },
  ynOn: { backgroundColor: TAIR.emerald, borderColor: TAIR.emerald },
  ynOff: { backgroundColor: "#8B3A2F", borderColor: "#8B3A2F" },
  ynText: { color: TAIR.emerald, fontSize: 12, fontWeight: "800" },
  ynTextOn: { color: "#fff" },
  choiceRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  choice: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: TAIR.bg, borderWidth: 1, borderColor: TAIR.divider,
  },
  choiceOn: { backgroundColor: TAIR.emerald, borderColor: TAIR.emerald },
  choiceText: { color: TAIR.emerald, fontSize: 12, fontWeight: "800" },

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
