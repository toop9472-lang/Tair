// طير — Mobile: AI Bird identification modal
import React, { useState } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { TAIR_PALETTE } from "../constants/tairDesign";

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  "https://saqr4u.com";

const money = (v) => new Intl.NumberFormat("ar-SA").format(v || 0);

export default function IdentifyBirdModal({ visible, onClose, onApply }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => { setPreview(null); setResult(null); };

  const pick = async (fromCamera) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("تنبيه", "يجب السماح بالوصول للكاميرا");
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
      }
      const opts = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.85,
        allowsEditing: false,
      };
      const picker = fromCamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
      const r = await picker(opts);
      if (r.canceled) return;
      const asset = r.assets?.[0];
      if (!asset?.base64) return;
      setPreview(`data:image/jpeg;base64,${asset.base64}`);
      setLoading(true);
      setResult(null);
      const resp = await fetch(`${API_URL.replace(/\/+$/, "")}/api/ai/identify-bird-b64`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: asset.base64, mime_type: "image/jpeg" }),
      });
      const data = await resp.json();
      setResult(data);
    } catch (e) {
      Alert.alert("خطأ", e.message || "تعذّرت المعالجة");
    } finally {
      setLoading(false);
    }
  };

  const isBird = result?.is_bird === true;
  const price = result?.estimated_price_sar;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>
              <Ionicons name="sparkles" size={16} color={TAIR_PALETTE.primary} />  تعرّف على الطائر — AI
            </Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#334155" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {!preview ? (
              <View style={{ gap: 10 }}>
                <TouchableOpacity onPress={() => pick(true)} style={s.upload}>
                  <Ionicons name="camera-outline" size={28} color={TAIR_PALETTE.primary} />
                  <Text style={s.uploadTitle}>صور بالكاميرا</Text>
                  <Text style={s.uploadSub}>نتعرف على النوع + سعر تقريبي بالسوق السعودي</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => pick(false)} style={[s.upload, s.uploadAlt]}>
                  <Ionicons name="images-outline" size={22} color={TAIR_PALETTE.primary} />
                  <Text style={[s.uploadTitle, { fontSize: 14 }]}>اختر من المعرض</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={s.previewWrap}>
                  <Image source={{ uri: preview }} style={s.preview} resizeMode="contain" />
                </View>
                {loading ? (
                  <View style={s.loading}>
                    <ActivityIndicator color={TAIR_PALETTE.primary} />
                    <Text style={{ color: TAIR_PALETTE.primary, fontWeight: "700", marginTop: 6 }}>
                      جاري التحليل…
                    </Text>
                  </View>
                ) : result ? (
                  <View style={s.resultCard}>
                    {isBird ? (
                      <>
                        <View style={s.resultTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.species}>{result.species_ar || "نوع غير محدد"}</Text>
                            {result.species_en ? (
                              <Text style={s.speciesEn}>{result.species_en}</Text>
                            ) : null}
                          </View>
                          {typeof result.confidence === "number" && (
                            <View style={s.confidence}>
                              <Text style={s.confidenceText}>{Math.round(result.confidence * 100)}%</Text>
                            </View>
                          )}
                        </View>
                        {price && (
                          <View style={s.priceBox}>
                            <Text style={s.priceLabel}>السعر المقترح</Text>
                            <Text style={s.priceVal}>
                              {money(price.min)} — {money(price.max)} ر.س
                            </Text>
                          </View>
                        )}
                        {result.age_estimate_ar && result.age_estimate_ar !== "غير محدد" && (
                          <View style={s.tagRow}>
                            <Text style={s.tag}>العمر: {result.age_estimate_ar}</Text>
                          </View>
                        )}
                        {result.notes_ar && <Text style={s.notes}>{result.notes_ar}</Text>}
                        {onApply && (
                          <TouchableOpacity
                            style={s.applyBtn}
                            onPress={() =>
                              onApply({
                                title: result.species_ar,
                                price_min: price?.min,
                                price_max: price?.max,
                                notes: result.notes_ar,
                              })
                            }
                          >
                            <Text style={s.applyText}>استخدم في الإعلان</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    ) : (
                      <Text style={s.noBird}>
                        {result.notes_ar || "لم يتم التعرف على طائر في الصورة. جرّب صورة أوضح."}
                      </Text>
                    )}
                  </View>
                ) : null}
                <TouchableOpacity onPress={reset} style={s.retryBtn}>
                  <Ionicons name="camera-outline" size={16} color="#334155" />
                  <Text style={s.retryText}>صورة أخرى</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.65)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "88%",
  },
  head: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderBottomWidth: 1, borderColor: "#e2e8f0",
  },
  title: { fontSize: 15, fontWeight: "900", color: "#0F241C" },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center",
  },

  upload: {
    padding: 26, borderRadius: 14,
    borderWidth: 2, borderColor: TAIR_PALETTE.primary, borderStyle: "dashed",
    alignItems: "center", backgroundColor: "rgba(15,118,110,0.05)",
  },
  uploadAlt: { padding: 16 },
  uploadTitle: { fontSize: 16, fontWeight: "800", color: "#0F241C", marginTop: 6 },
  uploadSub: { fontSize: 12, color: "#6B5E4A", textAlign: "center", marginTop: 4 },

  previewWrap: {
    borderRadius: 14, overflow: "hidden", backgroundColor: "#f1f5f9",
    marginBottom: 12, height: 240, alignItems: "center", justifyContent: "center",
  },
  preview: { width: "100%", height: "100%" },
  loading: { padding: 20, alignItems: "center", backgroundColor: "rgba(15,118,110,0.06)", borderRadius: 10 },

  resultCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 14 },
  resultTop: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
  species: { fontSize: 18, fontWeight: "900", color: "#0F241C", textAlign: "right" },
  speciesEn: { fontSize: 12, color: "#6B5E4A", textAlign: "right" },
  confidence: { backgroundColor: TAIR_PALETTE.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  confidenceText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  priceBox: {
    marginTop: 12, padding: 12, backgroundColor: "rgba(15,118,110,0.08)",
    borderRadius: 10, alignItems: "center",
  },
  priceLabel: { fontSize: 11, color: "#6B5E4A", fontWeight: "700" },
  priceVal: { fontSize: 20, fontWeight: "900", color: TAIR_PALETTE.primary, marginTop: 2 },
  tagRow: { flexDirection: "row-reverse", marginTop: 10 },
  tag: { backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 11, fontWeight: "700", color: "#334155" },
  notes: {
    marginTop: 10, backgroundColor: "#fefce8", borderColor: "#fef3c7", borderWidth: 1,
    borderRadius: 8, padding: 10, fontSize: 13, color: "#334155", textAlign: "right", lineHeight: 20,
  },
  noBird: { color: "#6B5E4A", fontSize: 13, textAlign: "center", padding: 8 },
  applyBtn: {
    marginTop: 12, backgroundColor: TAIR_PALETTE.primary, borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  retryBtn: {
    marginTop: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10,
  },
  retryText: { fontSize: 13, fontWeight: "700", color: "#334155" },
});
