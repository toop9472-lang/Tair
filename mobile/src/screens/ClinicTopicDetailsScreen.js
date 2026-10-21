/**
 * ClinicTopicDetailsScreen — عرض موضوع العيادة
 * - الوصف/الاستبيان أعلى الصفحة
 * - الصور والفيديو أسفل التفاصيل
 * - قائمة الردود
 * - زر «مساعدة الذكاء» (للمشرفين)
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Modal, Pressable, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { TAIR } from "../constants/tairTheme";
import { clinicTopicsApi, adminExtApi } from "../services/tairApi";
import api from "../services/api";
import { DetailSkeleton, ErrorState } from "../components/TairUI";
import { shareInApp } from "../services/shareContent";
import ClinicAssistOrb from "../components/ClinicAssistOrb";

const QLABELS = {
  q_lethargy: "خمول",
  q_appetite: "الشهية",
  q_onset: "بداية الأعراض",
  q_diet: "التغذية",
  q_gender: "ذكر أو أنثى",
  q_breeding: "حضن أو تزاوج",
  q_medications: "أدوية أخيرة",
  q_seen_vet: "عُرضت من قبل",
  q_age: "عمر الطير",
  q_time_with_owner: "منذ متى عندك",
  q_tame: "أليف",
  q_vomits: "استفراغ",
  q_mouth_droppings: "فم أو رائحة براز",
  chick_serelac_brand: "شركة السريلاك",
  chick_exact_age: "عمر الفرخ",
  chick_serelac_temp: "حرارة السريلاك",
  chick_feeding_count: "مرات الغر والكمية",
  chick_feeding_method: "طريقة التأكيل",
  chick_serelac_leftover: "بواقي السريلاك",
};

export default function ClinicTopicDetailsScreen({ user, topicId, onBack, onOpenProfile }) {
  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyImgs, setReplyImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [myScopes, setMyScopes] = useState([]);
  const [zoom, setZoom] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  const uid = user?.user_id || user?.id || user?.email;
  const isAdmin = !!(user?.is_admin || user?.role === "admin" || user?.role === "super_admin");
  const isMod = isAdmin || myScopes.includes("clinic") || myScopes.includes("general") || myScopes.includes("clinic_admin");
  const isOwner = topic?.user_id === uid;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, r] = await Promise.all([
        clinicTopicsApi.get(topicId),
        clinicTopicsApi.listReplies(topicId),
      ]);
      setTopic(t);
      setReplies(r?.items || []);
    } catch (e) {
      setTopic(null);
      setLoadError(e?.message || "تعذّر تحميل الموضوع");
    } finally { setLoading(false); }
    try {
      if (uid) {
        const r = await adminExtApi.myScopes(uid);
        setMyScopes(r?.scopes || []);
      }
    } catch {
      setMyScopes([]);
    }
  }, [topicId, uid]);

  useEffect(() => { load(); }, [load]);

  const pickReplyImage = async () => {
    if (replyImgs.length >= 5) return;
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      const form = new FormData();
      form.append("file", { uri: a.uri, name: "r.jpg", type: a.mimeType || "image/jpeg" });
      form.append("user_id", uid || "");
      const resp = await api.fetch("/api/listings/upload-image", { method: "POST", body: form });
      if (!resp?.ok) throw new Error("fail");
      const j = await resp.json();
      const url = j?.url || j?.image_url;
      if (url) setReplyImgs((p) => [...p, url]);
    } catch { Alert.alert("خطأ", "فشل رفع الصورة"); }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      await clinicTopicsApi.addReply(topicId, { text: replyText.trim(), images: replyImgs }, uid);
      setReplyText(""); setReplyImgs([]);
      const r = await clinicTopicsApi.listReplies(topicId);
      setReplies(r?.items || []);
    } catch (e) {
      Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر الإرسال");
    } finally { setBusy(false); }
  };

  const openAI = async () => {
    setAiOpen(true);
    setAiBusy(true);
    try {
      const r = await clinicTopicsApi.aiAssist(topicId, uid);
      // لو السيرفر رجع رد فارغ، نعرض السبب لا نعرض "تعذر"
      setAiData(r || {});
    } catch (e) {
      const msg = e?.data?.detail || e?.message || "تعذّر التحليل";
      setAiData({ error: true, message: msg });
    }
    finally { setAiBusy(false); }
  };

  const useAIReply = () => {
    if (aiData?.suggested_reply) setReplyText(aiData.suggested_reply);
    setAiOpen(false);
  };

  const useNote = (text) => {
    const clean = (text || "").trim();
    if (!clean) return;
    setReplyText(clean);
    setAiOpen(false);
  };

  const attachLibraryFile = (file) => {
    if (!file) return;
    const line = [file.title, file.file_url].filter(Boolean).join("\n");
    if (line) setReplyText((prev) => (prev ? `${prev}\n${line}` : line));
    const kind = String(file.file_type || "");
    const url = file.file_url || file.cover_url || "";
    if (url && (kind === "image" || kind === "jpg" || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url))) {
      setReplyImgs((prev) => (prev.includes(url) || prev.length >= 5 ? prev : [...prev, url]));
    }
    setAiOpen(false);
  };

  const sendLibraryFile = async (file) => {
    const line = [file?.title, file?.file_url].filter(Boolean).join("\n");
    if (!line) return;
    setBusy(true);
    try {
      const kind = String(file.file_type || "");
      const url = file.file_url || "";
      const images = url && (kind === "image" || kind === "jpg") ? [url] : [];
      await clinicTopicsApi.addReply(topicId, { text: line, images }, uid);
      const r = await clinicTopicsApi.listReplies(topicId);
      setReplies(r?.items || []);
      setAiOpen(false);
    } catch (e) {
      Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر إرسال الملف");
    } finally { setBusy(false); }
  };

  const baseKeys = Object.keys(QLABELS).filter((k) => !k.startsWith("chick_"));
  const chickKeys = Object.keys(QLABELS).filter((k) => k.startsWith("chick_"));
  const missingNow = [
    ...baseKeys.filter((k) => !(topic?.[k] || "").toString().trim()).map((k) => QLABELS[k]),
    ...(topic?.is_chick ? chickKeys.filter((k) => !(topic?.[k] || "").toString().trim()).map((k) => QLABELS[k]) : []),
  ];
  const modAnswered = replies.some((r) => r.is_moderator && !r.is_bot);
  const localAlerts = [];
  if (topic && !modAnswered) localAlerts.push("بانتظار رد المشرف");
  if (topic && !(topic.images || []).length && !(topic.videos || []).length) localAlerts.push("الحالة بلا صورة أو فيديو");
  if (missingNow.length) localAlerts.push(`أسئلة ناقصة: ${missingNow.slice(0, 6).join("، ")}`);
  const assistAlerts = aiData?.alerts?.length ? aiData.alerts : localAlerts;

  const deleteReply = (replyId) => {
    Alert.alert("حذف الرد", "هل تريد حذف هذا الرد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await clinicTopicsApi.deleteReply(replyId, uid);
          setReplies((p) => p.filter((x) => x.reply_id !== replyId));
        } catch (e) { Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر الحذف"); }
      }},
    ]);
  };

  const openProfile = (pid) => {
    if (pid && pid !== "clinic_bot") onOpenProfile?.(pid);
  };

  const deleteTopic = async () => {
    Alert.alert("حذف", "حذف هذا الموضوع نهائياً؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await clinicTopicsApi.delete(topicId, uid);
          Alert.alert("✔", "تم الحذف"); onBack?.();
        } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر"); }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={s.page}>
        <DetailSkeleton />
      </View>
    );
  }
  if (!topic) {
    return (
      <View style={s.page}>
        <TouchableOpacity onPress={onBack} style={{ padding: 16 }}><Text style={{ color: TAIR.emerald, fontWeight: "800" }}>رجوع</Text></TouchableOpacity>
        <ErrorState
          title={loadError ? "تعذّر فتح الموضوع" : "الموضوع غير موجود"}
          subtitle={loadError ? "تحقق من الاتصال ثم أعد المحاولة." : "ربما حُذف هذا الموضوع."}
          onRetry={loadError ? load : undefined}
        />
      </View>
    );
  }

  const answered = Object.entries(QLABELS)
    .filter(([k]) => (topic[k] || "").toString().trim().length > 0)
    .map(([k, label]) => ({ k, label, v: topic[k] }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.hBtn}>
          <Ionicons name="chevron-forward" size={22} color={TAIR.gold} />
        </TouchableOpacity>
        <Text style={s.hTitle} numberOfLines={1}>{topic.title}</Text>
        <View style={{ flexDirection: "row-reverse", gap: 6 }}>
          <TouchableOpacity
            onPress={() => shareInApp({
              kind: "clinic",
              id: topic.topic_id || topicId,
              title: topic.title || "موضوع في العيادة",
              image: topic.images?.[0] || "",
              lines: [
                topic.user_name ? `من ${topic.user_name}` : null,
                (topic.description || "").slice(0, 80),
              ],
            })}
            style={s.hBtn}
            testID="clinic-topic-share"
          >
            <Ionicons name="share-social-outline" size={18} color={TAIR.gold} />
          </TouchableOpacity>
          {(isOwner || isMod) ? (
            <TouchableOpacity onPress={deleteTopic} style={s.hBtn}>
              <Ionicons name="trash-outline" size={18} color={TAIR.gold} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView style={s.page} contentContainerStyle={{ padding: 14, paddingBottom: 90 }}>
        {/* Author */}
        <TouchableOpacity style={s.authorRow} onPress={() => openProfile(topic.user_id)} activeOpacity={0.7} testID="topic-author">
          <View style={s.avatar}>
            {topic.user_avatar ? (
              <Image source={{ uri: topic.user_avatar }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text style={{ color: TAIR.gold, fontWeight: "900" }}>{(topic.user_name || "?").charAt(0)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.authorName}>{topic.user_name || "مستخدم"}</Text>
            <Text style={s.authorTime}>{topic.created_at ? new Date(topic.created_at).toLocaleString("ar-SA") : ""}</Text>
          </View>
        </TouchableOpacity>

        {/* Description */}
        <View style={s.descBox}>
          <Text style={s.desc}>{topic.description}</Text>
        </View>

        {/* Diagnostic questionnaire — نفس نمط الشبكة في شاشة الإنشاء */}
        {answered.length > 0 || topic.is_chick ? (
          <>
            <Text style={s.sectH}>تشخيص الحالة</Text>
            <View style={s.answerList}>
              {topic.is_chick ? (
                <View style={s.answerRow}>
                  <Text style={s.answerK}>فرخ</Text>
                  <Text style={s.answerV}>نعم</Text>
                </View>
              ) : null}
              {answered.map(({ k, label, v }) => (
                <View key={k} style={s.answerRow}>
                  <Text style={s.answerK}>{label}</Text>
                  <Text style={s.answerV}>{v}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Images — عرض كبير لرؤية الحالة بوضوح */}
        {topic.images?.length > 0 ? (
          <>
            <Text style={s.sectH}>الصور</Text>
            <View style={s.bigMediaRow}>
              {topic.images.map((u, i) => (
                <TouchableOpacity key={i} onPress={() => setZoom(u)} style={s.bigImgThumb} testID={`topic-img-${i}`}>
                  <Image source={{ uri: u }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {/* Videos */}
        {topic.videos?.length > 0 ? (
          <>
            <Text style={s.sectH}>الفيديو</Text>
            <View style={s.bigMediaRow}>
              {topic.videos.map((u, i) => (
                <TouchableOpacity key={i} onPress={() => Linking.openURL(u)} style={[s.bigVideoThumb]}>
                  <Ionicons name="play-circle" size={56} color={TAIR.gold} />
                  <Text style={s.vidLabel}>تشغيل الفيديو</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {/* Replies */}
        <Text style={s.sectH}>الردود ({replies.length})</Text>
        {replies.length === 0 ? (
          <Text style={s.noReply}>لا توجد ردود بعد — كن أول من يساعد</Text>
        ) : (
          replies.map((r) => (
            <View key={r.reply_id} style={[s.replyCard, r.is_bot && s.replyBotCard, r.is_moderator && s.replyModCard]}>
              <View style={s.replyHead}>
                <TouchableOpacity
                  onPress={() => openProfile(r.user_id)}
                  disabled={r.is_bot}
                  activeOpacity={0.7}
                  style={{ flex: 1, flexDirection: "row-reverse", gap: 8 }}
                  testID={`reply-author-${r.reply_id}`}
                >
                <View style={[s.avatarSm, r.is_bot && { backgroundColor: TAIR.emerald }]}>
                  {r.is_bot ? (
                    <Ionicons name="hardware-chip" size={16} color={TAIR.gold} />
                  ) : r.user_avatar ? (
                    <Image source={{ uri: r.user_avatar }} style={{ width: "100%", height: "100%" }} />
                  ) : (
                    <Text style={{ color: TAIR.gold, fontSize: 11, fontWeight: "900" }}>{(r.user_name || "?").charAt(0)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                    <Text style={s.replyName}>{r.user_name || "مستخدم"}</Text>
                    {r.is_bot ? (
                      <View style={s.botMark}>
                        <Text style={s.botMarkText}>بوت</Text>
                      </View>
                    ) : r.is_moderator ? (
                      <View style={s.modMark}>
                        <Ionicons name="shield-checkmark" size={10} color={TAIR.gold} />
                        <Text style={s.modMarkText}>مشرف</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={s.replyTime}>{r.created_at ? new Date(r.created_at).toLocaleString("ar-SA") : ""}</Text>
                </View>
                </TouchableOpacity>
                {isMod ? (
                  <TouchableOpacity onPress={() => deleteReply(r.reply_id)} hitSlop={10} style={s.replyDel} testID={`reply-delete-${r.reply_id}`}>
                    <Ionicons name="trash-outline" size={16} color="#B3261E" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={s.replyText}>{r.text}</Text>
              {r.images?.length ? (
                <View style={[s.mediaRow, { marginTop: 8 }]}>
                  {r.images.map((u, i) => (
                    <TouchableOpacity key={i} onPress={() => setZoom(u)} style={s.mediaThumb}>
                      <Image source={{ uri: u }} style={{ width: "100%", height: "100%" }} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* Reply input — فقط للمشرفين */}
      {isMod ? (
        <View style={s.inputBar}>
          {replyImgs.length > 0 ? (
            <View style={{ flexDirection: "row-reverse", gap: 6, padding: 8 }}>
              {replyImgs.map((u, i) => (
                <View key={i} style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden" }}>
                  <Image source={{ uri: u }} style={{ width: "100%", height: "100%" }} />
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10 }}>
            <TouchableOpacity onPress={pickReplyImage} style={s.imgBtn}>
              <Ionicons name="image-outline" size={20} color={TAIR.emerald} />
            </TouchableOpacity>
            <TextInput
              value={replyText} onChangeText={setReplyText}
              placeholder="اكتب رداً..."
              placeholderTextColor={TAIR.textSoft} textAlign="right" multiline
              style={s.replyInput} testID="topic-reply-input"
            />
            <TouchableOpacity onPress={sendReply} disabled={busy || !replyText.trim()} style={[s.sendBtn, (busy || !replyText.trim()) && { opacity: 0.5 }]} testID="topic-reply-send">
              {busy ? <ActivityIndicator color={TAIR.gold} size="small" /> : <Ionicons name="send" size={18} color={TAIR.gold} />}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={s.readonlyBar} testID="reply-restricted">
          <Ionicons name="lock-closed" size={14} color={TAIR.goldDark} />
          <Text style={s.readonlyText}>الردود مخصصة لمشرفي العيادة فقط</Text>
        </View>
      )}

      {/* Zoom modal */}
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable onPress={() => setZoom(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" }}>
          <Image source={{ uri: zoom }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        </Pressable>
      </Modal>

      {/* AI Assist modal */}
      <Modal visible={aiOpen} transparent animationType="slide" onRequestClose={() => setAiOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={s.aiSheet}>
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <View style={{ width: 40, height: 4, backgroundColor: "#D6C9AB", borderRadius: 2 }} />
            </View>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: TAIR.divider }}>
              <Ionicons name="sparkles" size={20} color={TAIR.gold} />
              <Text style={{ color: TAIR.emerald, fontSize: 16, fontWeight: "900", flex: 1 }}>مساعد المشرف</Text>
              <TouchableOpacity onPress={() => setAiOpen(false)}><Ionicons name="close" size={22} color={TAIR.textSoft} /></TouchableOpacity>
            </View>
            {aiBusy ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator color={TAIR.emerald} />
                <Text style={{ color: TAIR.textSoft, marginTop: 10 }}>جارٍ جمع ردود المشرفين والملفات...</Text>
              </View>
            ) : (
              <ScrollView style={{ padding: 14, maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {assistAlerts.length > 0 ? (
                  <>
                    <Text style={s.aiLabel}>تنبيهات الحالة</Text>
                    {assistAlerts.map((line) => (
                      <View key={line} style={s.alertRow}>
                        <Ionicons name="alert-circle" size={14} color="#8B2E24" />
                        <Text style={s.alertText}>{line}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
                {aiData?.suggested_reply ? (
                  <>
                    <Text style={s.aiLabel}>ملاحظة للمراجعة</Text>
                    <View style={s.aiBlock}>
                      <Text style={s.aiText}>{aiData.suggested_reply}</Text>
                    </View>
                    <TouchableOpacity onPress={useAIReply} style={s.useBtn} testID="ai-use-reply">
                      <Ionicons name="checkmark-circle" size={16} color={TAIR.gold} />
                      <Text style={{ color: TAIR.gold, fontWeight: "900", fontSize: 13 }}>ضع الملاحظة في الرد</Text>
                    </TouchableOpacity>
                  </>
                ) : aiData?.error ? (
                  <Text style={{ textAlign: "center", color: TAIR.textSoft, fontSize: 12, marginVertical: 8 }}>تعذّر جلب الملاحظة. التنبيهات والملفات تبقى متاحة.</Text>
                ) : null}
                {aiData?.learned_replies?.length > 0 ? (
                  <>
                    <Text style={s.aiLabel}>من ردود المشرفين على حالات قريبة</Text>
                    {aiData.learned_replies.map((x) => (
                      <View key={x.lesson_id || x.reply_id} style={s.aiBlock}>
                        <Text style={{ color: TAIR.emerald, fontSize: 13, fontWeight: "900", textAlign: "right" }}>{x.title}</Text>
                        <Text style={s.aiText}>{x.text}</Text>
                        <TouchableOpacity onPress={() => useNote(x.text)} style={s.miniBtn}>
                          <Text style={s.miniBtnText}>استخدم هذا الرد</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                ) : null}
                {aiData?.library_matches?.length > 0 ? (
                  <>
                    <Text style={s.aiLabel}>ملفات مكتبة مطابقة</Text>
                    {aiData.library_matches.map((x) => (
                      <View key={x.library_id} style={s.aiBlock}>
                        <Text style={{ color: TAIR.emerald, fontSize: 13, fontWeight: "900", textAlign: "right" }}>{x.title}</Text>
                        {x.description ? <Text style={{ color: TAIR.textSoft, fontSize: 11, textAlign: "right", marginTop: 2 }}>{x.description}</Text> : null}
                        <View style={s.fileActions}>
                          <TouchableOpacity onPress={() => attachLibraryFile(x)} style={s.miniBtn} testID={`ai-attach-${x.library_id}`}>
                            <Text style={s.miniBtnText}>أرفق بالرد</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => sendLibraryFile(x)} style={s.miniBtn} testID={`ai-send-file-${x.library_id}`}>
                            <Text style={s.miniBtnText}>أرسله رداً</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                ) : null}
                {aiData?.similar_topics?.length > 0 ? (
                  <>
                    <Text style={s.aiLabel}>حالات مشابهة</Text>
                    {aiData.similar_topics.map((x) => (
                      <View key={x.topic_id} style={s.aiBlock}>
                        <Text style={{ color: TAIR.emerald, fontSize: 13, fontWeight: "900", textAlign: "right" }}>{x.title}</Text>
                        {x.mod_reply_preview ? <Text style={{ color: TAIR.textSoft, fontSize: 11, textAlign: "right", marginTop: 4, lineHeight: 18 }}>{x.mod_reply_preview}</Text> : null}
                        {x.mod_reply_preview ? (
                          <TouchableOpacity onPress={() => useNote(x.mod_reply_preview)} style={s.miniBtn}>
                            <Text style={s.miniBtnText}>استخدم رد المشرف</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))}
                  </>
                ) : null}
                <TouchableOpacity onPress={pickReplyImage} style={s.useBtn} testID="ai-add-photo">
                  <Ionicons name="image-outline" size={16} color={TAIR.gold} />
                  <Text style={{ color: TAIR.gold, fontWeight: "900", fontSize: 13 }}>أضف صورة من الجهاز إلى الرد</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {isMod ? (
        <ClinicAssistOrb badge={assistAlerts.length} onPress={openAI} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 48 : 20, paddingBottom: 12,
    backgroundColor: TAIR.emerald, borderBottomWidth: 1, borderBottomColor: TAIR.gold, gap: 8,
  },
  hTitle: { color: TAIR.gold, fontSize: 15, fontWeight: "900", flex: 1, textAlign: "center" },
  hBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  aiBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(198,161,91,0.18)", borderRadius: 16, borderWidth: 1, borderColor: TAIR.gold },

  authorRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: TAIR.emerald, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  authorName: { color: TAIR.emerald, fontSize: 14, fontWeight: "900", textAlign: "right" },
  authorTime: { color: TAIR.textSoft, fontSize: 11, textAlign: "right" },

  descBox: { backgroundColor: TAIR.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: TAIR.divider },
  desc: { color: "#0F241C", fontSize: 14, lineHeight: 24, textAlign: "right" },

  sectH: { color: TAIR.emerald, fontSize: 14, fontWeight: "900", textAlign: "right", marginTop: 14, marginBottom: 8, borderRightWidth: 3, borderRightColor: TAIR.gold, paddingRight: 8 },
  qBox: { backgroundColor: TAIR.card, borderRadius: 12, borderWidth: 1, borderColor: TAIR.divider, overflow: "hidden" },
  qRow: { flexDirection: "row-reverse", padding: 10, borderBottomWidth: 1, borderBottomColor: TAIR.divider, gap: 10 },
  qK: { color: TAIR.goldDark, fontSize: 12, fontWeight: "900", textAlign: "right", width: 120 },
  qV: { color: "#0F241C", fontSize: 13, flex: 1, textAlign: "right" },
  // شبكة بطاقات التشخيص على صفحة التفاصيل
  answerList: { backgroundColor: TAIR.card, borderRadius: 12, borderWidth: 1, borderColor: TAIR.divider, overflow: "hidden" },
  answerRow: { flexDirection: "row-reverse", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: TAIR.divider },
  answerK: { width: 108, color: TAIR.goldDark, fontSize: 12, fontWeight: "800", textAlign: "right" },
  answerV: { flex: 1, color: "#0F241C", fontSize: 13, textAlign: "right", lineHeight: 18 },

  mediaRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  mediaThumb: { width: 90, height: 90, borderRadius: 10, overflow: "hidden", backgroundColor: TAIR.divider, alignItems: "center", justifyContent: "center" },
  // صور الحالة الكبيرة — عرض كامل لرؤية التفاصيل
  bigMediaRow: { gap: 12, marginBottom: 8 },
  bigImgThumb: {
    width: "100%", aspectRatio: 1.2, borderRadius: 14, overflow: "hidden",
    backgroundColor: TAIR.divider, borderWidth: 1, borderColor: TAIR.gold + "66",
  },
  bigVideoThumb: {
    width: "100%", aspectRatio: 1.6, borderRadius: 14,
    backgroundColor: "#0F241C", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: TAIR.gold, gap: 6,
  },
  vidLabel: { color: TAIR.gold, fontSize: 13, fontWeight: "900" },

  noReply: { color: TAIR.textSoft, textAlign: "center", padding: 20, fontSize: 12 },
  replyCard: { backgroundColor: TAIR.card, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: TAIR.divider },
  replyModCard: { backgroundColor: "#FFFBF3", borderColor: TAIR.gold, borderWidth: 1.5 },
  replyBotCard: { backgroundColor: "#F0F7F2", borderColor: TAIR.emerald, borderWidth: 1.5 },
  replyHead: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  avatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: TAIR.emerald, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  replyDel: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FCEDEC" },
  replyName: { color: TAIR.emerald, fontSize: 13, fontWeight: "900", textAlign: "right" },
  replyTime: { color: TAIR.textSoft, fontSize: 10, textAlign: "right" },
  modMark: { flexDirection: "row-reverse", alignItems: "center", gap: 2, backgroundColor: TAIR.emerald, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  modMarkText: { color: TAIR.gold, fontSize: 9, fontWeight: "900" },
  botMark: { flexDirection: "row-reverse", alignItems: "center", gap: 2, backgroundColor: TAIR.emerald, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  botMarkText: { color: TAIR.gold, fontSize: 9, fontWeight: "900" },
  replyText: { color: "#0F241C", fontSize: 13, lineHeight: 22, textAlign: "right" },

  inputBar: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: TAIR.divider },
  imgBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: TAIR.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: TAIR.divider },
  replyInput: { flex: 1, backgroundColor: TAIR.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: TAIR.emerald, maxHeight: 100, borderWidth: 1, borderColor: TAIR.divider },
  readonlyBar: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, backgroundColor: "#FFFBF3",
    borderTopWidth: 1, borderTopColor: TAIR.gold,
  },
  readonlyText: { color: TAIR.goldDark, fontSize: 12, fontWeight: "900" },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: TAIR.emerald, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: TAIR.gold },

  aiSheet: { backgroundColor: "#FFFDF8", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  aiLabel: { color: TAIR.goldDark, fontSize: 12, fontWeight: "900", textAlign: "right", marginTop: 10, marginBottom: 6 },
  aiBlock: { backgroundColor: TAIR.card, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: TAIR.divider },
  aiText: { color: "#0F241C", fontSize: 13, lineHeight: 22, textAlign: "right" },
  useBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: TAIR.emerald, borderRadius: 10, paddingVertical: 10, marginVertical: 6, borderWidth: 1, borderColor: TAIR.gold },
  alertRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6, backgroundColor: "#F8EBE7", borderRadius: 10, padding: 8, marginBottom: 6 },
  alertText: { flex: 1, color: "#8B2E24", fontSize: 12, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  fileActions: { flexDirection: "row-reverse", gap: 8, marginTop: 8 },
  miniBtn: { marginTop: 8, alignSelf: "flex-end", backgroundColor: TAIR.emerald, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: TAIR.gold },
  miniBtnText: { color: TAIR.gold, fontSize: 11, fontWeight: "900" },
});
