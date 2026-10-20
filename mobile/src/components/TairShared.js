// طير — Reusable UI blocks used across mobile screens (mirrors web equivalents)
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR_BANNER_IMAGE, TAIR_PALETTE } from "../constants/tairDesign";

/** WholesaleCard — "قريباً" card on the home feed */
export function WholesaleCard({ onPress }) {
  const handle = onPress || (() =>
    Alert.alert("قريباً — موردو الطيور بالجملة والمستلزمات",
      "قسم مخصّص لموردي الطيور، الأعلاف، والأقفاص بأسعار الجملة. جاري التحضير!")
  );
  return (
    <TouchableOpacity onPress={handle} testID="wholesale-card">
      <ImageBackground
        source={{ uri: TAIR_BANNER_IMAGE }}
        imageStyle={{ borderRadius: 20 }}
        style={s.card}
      >
        <View style={s.overlay} />
        <View style={s.iconBox}>
          <Ionicons name="albums" size={30} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.badge}><Text style={s.badgeText}>قريباً</Text></View>
          <Text style={s.title}>موردو الطيور بالجملة والمستلزمات</Text>
          <Text style={s.subtitle}>طيور، أعلاف، أقفاص وأدوات بأسعار الجملة — قسم مخصّص للتجار.</Text>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

/** SafetyNotice — yellow reminder banner shown on non-owned listings */
export function SafetyNotice() {
  return (
    <View style={n.box} testID="safety-notice">
      <Text style={n.icon}>⚠️</Text>
      <Text style={n.text}>
        <Text style={{ fontWeight: "900" }}>تنبيه: </Text>
        منصة طير وسيط تقني فقط ولا تتحمّل أي تقصير من المُعلنين أو الموصّلين
        <Text style={{ fontWeight: "900" }}> غير الموثّقين</Text>. تعامَل بحذر ولا تدفع قبل رؤية الطائر.
      </Text>
    </View>
  );
}

/** OwnerStatsCard — views/likes/contacts card shown on the seller's own listing */
export function OwnerStatsCard({ views, likes, contacts }) {
  return (
    <View style={st.card} testID="owner-stats">
      <Text style={st.title}>📊 إحصائيات إعلانك</Text>
      <View style={st.grid}>
        <StatBox value={views} label="مشاهدة" />
        <StatBox value={likes} label="إعجاب" />
        <StatBox value={contacts} label="تواصل" />
      </View>
    </View>
  );
}
function StatBox({ value, label }) {
  return (
    <View style={st.box}>
      <Text style={st.value}>{value || 0}</Text>
      <Text style={st.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row-reverse", alignItems: "center", gap: 14,
    padding: 16, marginBottom: 16, borderRadius: 20,
    overflow: "hidden", backgroundColor: TAIR_PALETTE.primary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,118,110,0.45)",
    borderRadius: 20,
  },
  iconBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.32)",
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    alignSelf: "flex-end",
    backgroundColor: "#facc15",
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    marginBottom: 6,
  },
  badgeText: { color: "#7c2d12", fontSize: 10, fontWeight: "900" },
  title: {
    color: "#fff", fontSize: 16, fontWeight: "900",
    textAlign: "right", marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 },
  },
  subtitle: { color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: "600", textAlign: "right", lineHeight: 18 },
});

const n = StyleSheet.create({
  box: {
    flexDirection: "row-reverse", gap: 10,
    backgroundColor: "#fef3c7", borderColor: "#fde68a", borderWidth: 1,
    padding: 12, borderRadius: 12, marginTop: 14,
  },
  icon: { fontSize: 18 },
  text: { flex: 1, fontSize: 12, lineHeight: 20, color: "#78350f", fontWeight: "600", textAlign: "right" },
});

const st = StyleSheet.create({
  card: {
    backgroundColor: "#f0fdfa", borderColor: TAIR_PALETTE.border, borderWidth: 1,
    borderRadius: 14, padding: 14, marginTop: 14,
  },
  title: { fontSize: 13, fontWeight: "900", color: TAIR_PALETTE.textStrong, textAlign: "right", marginBottom: 12 },
  grid: { flexDirection: "row-reverse", gap: 8 },
  box: {
    flex: 1, backgroundColor: "#fff", borderColor: TAIR_PALETTE.border, borderWidth: 1,
    borderRadius: 10, padding: 10, alignItems: "center",
  },
  value: { fontSize: 20, fontWeight: "900", color: TAIR_PALETTE.primary },
  label: { fontSize: 11, fontWeight: "700", color: TAIR_PALETTE.textMuted, marginTop: 2 },
});
