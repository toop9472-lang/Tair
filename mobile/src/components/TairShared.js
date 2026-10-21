// طير — Reusable UI blocks used across mobile screens (mirrors web equivalents)
import React from "react";
import { View, Text, StyleSheet, ImageBackground, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR_BANNER_IMAGE, TAIR_PALETTE } from "../constants/tairDesign";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { PressableScale } from "./TairUI";

/** WholesaleCard — دليل موردي الجملة */
export function WholesaleCard({ onPress }) {
  const handle = onPress || (() =>
    Alert.alert("موردو الجملة", "سجل شركتك من صفحة الموردين. تظهر في الدليل بانتظار توثيق الإدارة.")
  );
  return (
    <PressableScale onPress={handle} haptic testID="wholesale-card" scaleTo={0.985} style={s.card}>
      <ImageBackground
        source={{ uri: TAIR_BANNER_IMAGE }}
        imageStyle={{ borderRadius: 20 }}
        style={s.bg}
      >
        <View style={s.overlay} />
        <View style={s.row}>
          <View style={s.iconBox}>
            <Ionicons name="albums" size={28} color={TAIR.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.badge}><Text style={s.badgeText}>دليل الموردين</Text></View>
            <Text style={s.title}>موردو الطيور بالجملة والمستلزمات</Text>
            <Text style={s.subtitle}>طيور، أعلاف، أقفاص وأدوات بأسعار الجملة — قسم مخصّص للتجار.</Text>
          </View>
        </View>
      </ImageBackground>
    </PressableScale>
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
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: TAIR.emerald,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.45)",
    ...TAIR_ELEVATION.card,
  },
  bg: { width: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,36,28,0.72)",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  iconBox: {
    width: 58, height: 58, borderRadius: 16,
    backgroundColor: "rgba(198,161,91,0.16)",
    borderWidth: 1, borderColor: "rgba(198,161,91,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    alignSelf: "flex-end",
    backgroundColor: TAIR.goldWash,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    marginBottom: 6,
  },
  badgeText: { color: TAIR.gold, fontSize: 10, fontWeight: "800" },
  title: {
    color: TAIR.cream, fontSize: 16, fontWeight: "800",
    textAlign: "right", marginBottom: 4,
  },
  subtitle: { color: "rgba(247,241,232,0.86)", fontSize: 12, fontWeight: "600", textAlign: "right", lineHeight: 18 },
});

const n = StyleSheet.create({
  box: {
    flexDirection: "row-reverse", gap: 10,
    backgroundColor: TAIR.warningSoft, borderColor: "rgba(198,161,91,0.45)", borderWidth: 1,
    padding: 12, borderRadius: 14, marginTop: 14,
  },
  icon: { fontSize: 18 },
  text: { flex: 1, fontSize: 12, lineHeight: 20, color: TAIR.goldDark, fontWeight: "600", textAlign: "right" },
});

const st = StyleSheet.create({
  card: {
    backgroundColor: TAIR.surface, borderColor: TAIR.divider, borderWidth: 1,
    borderRadius: 16, padding: 14, marginTop: 14,
    ...TAIR_ELEVATION.hair,
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
