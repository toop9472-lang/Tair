// طير — Rate a completed order's counterparty (Mobile)
// Mirrors /app/frontend/src/tair/RateUserModal.jsx
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR_PALETTE } from "../constants/tairDesign";

const API = `${process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_BACKEND_URL || "https://saqr4u.com"}/api`;

export default function RateUserModal({ visible, raterId, targetId, role, orderId, onClose, onSubmitted }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const url = `${API}/trust/rate/${targetId}?rater_id=${encodeURIComponent(raterId || "")}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, comment, role, order_id: orderId }),
      });
      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try { const j = await resp.json(); detail = j?.detail || detail; } catch {}
        throw new Error(detail);
      }
      Alert.alert("شكراً!", "تم تسجيل تقييمك ⭐");
      onSubmitted?.(stars);
      onClose?.();
    } catch (e) {
      Alert.alert("خطأ", e.message || "تعذّر إرسال التقييم");
    } finally {
      setBusy(false);
    }
  };

  const label = role === "seller" ? "البائع" : "الناقل";
  const hint = stars === 5 ? "ممتاز!" : stars === 4 ? "جيّد جداً" : stars === 3 ? "جيّد" : stars === 2 ? "مقبول" : "سيّئ";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.head}>
            <TouchableOpacity onPress={onClose} style={s.close}>
              <Ionicons name="close" size={20} color={TAIR_PALETTE.textStrong} />
            </TouchableOpacity>
            <Text style={s.title}>تقييم {label}</Text>
            <View style={{ width: 30 }} />
          </View>

          <View style={{ padding: 18 }}>
            <View style={s.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} style={{ padding: 4 }}>
                  <Ionicons name={n <= stars ? "star" : "star-outline"} size={40} color="#facc15" />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.hint}>{hint}</Text>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="اكتب تعليقاً (اختياري)…"
              placeholderTextColor={TAIR_PALETTE.textFaint}
              multiline
              style={s.input}
            />

            <TouchableOpacity onPress={submit} disabled={busy} style={[s.submit, busy && { opacity: 0.6 }]}>
              <Text style={s.submitText}>{busy ? "جاري الإرسال…" : "أرسل التقييم"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center", padding: 16,
  },
  card: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden" },
  head: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: TAIR_PALETTE.border,
  },
  title: { fontSize: 16, fontWeight: "900", color: TAIR_PALETTE.textStrong },
  close: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#F7F1E8", alignItems: "center", justifyContent: "center",
  },
  stars: { flexDirection: "row-reverse", justifyContent: "center", marginBottom: 6 },
  hint: { textAlign: "center", fontSize: 13, fontWeight: "700", color: TAIR_PALETTE.text, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: TAIR_PALETTE.border, borderRadius: 12,
    padding: 12, minHeight: 90, textAlign: "right",
    fontSize: 13, color: TAIR_PALETTE.text,
  },
  submit: {
    backgroundColor: TAIR_PALETTE.primary, padding: 14, borderRadius: 12,
    alignItems: "center", marginTop: 14,
  },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
