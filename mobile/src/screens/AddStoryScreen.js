/**
 * AddStoryScreen — إضافة قصة جديدة (24 ساعة) مع اختيار صورة + نص + نشر.
 */
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { TAIR } from "../constants/tairTheme";
import { communityApi } from "../services/tairApi";
import api from "../services/api";

export default function AddStoryScreen({ user, onClose }) {
  const uid = user?.id || user?.user_id;
  const [image, setImage] = useState(null);   // { uri, mime }
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("الصلاحيات", "نحتاج صلاحية الوصول إلى الصور");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85, aspect: [9, 16], allowsEditing: true,
    });
    if (!r.canceled && r.assets && r.assets[0]) {
      setImage({ uri: r.assets[0].uri, mime: r.assets[0].mimeType || "image/jpeg" });
    }
  };

  const submit = async () => {
    if (!image && !caption.trim()) {
      setErr("أضف صورة أو نصاً");
      return;
    }
    setErr(null); setBusy(true);
    try {
      let imageUrl = null;
      if (image) {
        const form = new FormData();
        form.append("file", { uri: image.uri, name: "story.jpg", type: image.mime });
        form.append("user_id", uid || "");
        const resp = await api.fetch("/api/community/upload-image", {
          method: "POST",
          body: form,
        });
        if (!resp?.ok) {
          throw new Error("upload failed");
        }
        const json = await resp.json().catch(() => null);
        imageUrl = json?.url || json?.image_url || null;
        if (!imageUrl) throw new Error("upload returned no url");
      }
      await communityApi.createStory({
        image_url: imageUrl || "",
        caption: caption.trim(),
      }, uid);
      onClose?.();
    } catch (e) {
      setErr("تعذّر النشر — تأكد من الاتصال وحاول مرة أخرى");
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView
      style={s.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* هدر أخضر */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12} testID="add-story-close">
          <Ionicons name="close" size={26} color={TAIR.gold} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <Ionicons name="sparkles" size={20} color={TAIR.gold} />
          <Text style={s.headerTitle}>قصة جديدة</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <TouchableOpacity onPress={pickImage} style={s.mediaBox} testID="add-story-pick">
          {image ? (
            <Image source={{ uri: image.uri }} style={s.mediaImg} resizeMode="cover" />
          ) : (
            <View style={s.mediaPh}>
              <Ionicons name="image-outline" size={54} color={TAIR.gold} />
              <Text style={s.mediaHint}>اضغط لاختيار صورة (اختياري)</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={s.label}>النص / التعليق</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="اكتب نص قصتك…"
          placeholderTextColor={TAIR.textSoft}
          style={s.input}
          textAlign="right"
          multiline
          maxLength={280}
          testID="add-story-caption"
        />
        <Text style={s.counter}>{caption.length} / 280</Text>

        {err ? <Text style={s.err}>{err}</Text> : null}

        <View style={s.footer}>
          <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
            <Text style={s.cancelText}>إلغاء</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={submit}
            style={[s.submitBtn, busy && { opacity: 0.6 }]}
            disabled={busy}
            testID="add-story-submit"
          >
            {busy ? <ActivityIndicator size="small" color={TAIR.gold} /> : (
              <>
                <Ionicons name="send" size={16} color={TAIR.gold} />
                <Text style={s.submitText}>نشر القصة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.disclaimer}>القصص تظهر ٢٤ ساعة فقط ثم تُحذف تلقائياً.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 48 : 20, paddingBottom: 14,
    backgroundColor: TAIR.emerald,
  },
  headerTitle: { color: TAIR.gold, fontSize: 19, fontWeight: "900" },
  mediaBox: {
    width: "100%", aspectRatio: 9/16, borderRadius: 20, overflow: "hidden",
    backgroundColor: TAIR.card, borderWidth: 1.5, borderColor: TAIR.gold, marginBottom: 16,
  },
  mediaImg: { width: "100%", height: "100%" },
  mediaPh: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  mediaHint: { color: TAIR.textSoft, fontSize: 13, fontWeight: "700" },
  label: { color: TAIR.emerald, fontSize: 14, fontWeight: "900", marginBottom: 6, textAlign: "right" },
  input: {
    minHeight: 100, borderRadius: 12, backgroundColor: TAIR.card,
    borderWidth: 1, borderColor: TAIR.divider, padding: 12, fontSize: 15, color: TAIR.text,
    textAlignVertical: "top",
  },
  counter: { color: TAIR.textSoft, fontSize: 11, textAlign: "left", marginTop: 4 },
  err: { color: "#8B3A2F", fontSize: 12, marginTop: 8, textAlign: "right", fontWeight: "700" },
  footer: { flexDirection: "row-reverse", gap: 10, marginTop: 16 },
  submitBtn: {
    flex: 2, height: 52, borderRadius: 26, backgroundColor: TAIR.emerald,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitText: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },
  cancelBtn: {
    flex: 1, height: 52, borderRadius: 26, backgroundColor: TAIR.card,
    borderWidth: 1.5, borderColor: TAIR.gold, alignItems: "center", justifyContent: "center",
  },
  cancelText: { color: TAIR.emerald, fontWeight: "800", fontSize: 14 },
  disclaimer: { color: TAIR.textSoft, fontSize: 11, textAlign: "center", marginTop: 14, fontWeight: "600" },
});
