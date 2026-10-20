// طير — Success Stories (mobile). Mirrors /app/frontend/src/tair/SuccessStoriesScreen.jsx
import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR_PALETTE } from "../constants/tairDesign";

const STORIES = [
  {
    name: "أبو عبدالعزيز", city: "الرياض", role: "بائع كناري", stars: 5,
    story: "بعت أكثر من 30 كناري خلال شهرَين عن طريق طير. المشترون جادّون والتواصل عن طريق الشات آمن ومريح.",
    outcome: "30+ عملية بيع في شهرَين", verified: true,
  },
  {
    name: "منى العتيبي", city: "جدة", role: "مشتري ببغاء كوكاتيل", stars: 5,
    story: "كنت أبحث عن كوكاتيل مدرّب لفترة طويلة. لقيت البائع في طير، شاهدت الطائر عبر فيديو، وأرسله لي موصّل معتمد.",
    outcome: "توصيل آمن بين المدن", verified: true,
  },
  {
    name: "خالد الشمري", city: "الدمام", role: "موصّل معتمد", stars: 5,
    story: "بدأت أستخدم طير كموصّل قبل شهر. الآن عندي 5-6 طلبات نقل أسبوعياً بين الشرقية والرياض.",
    outcome: "5-6 رحلات أسبوعياً", verified: true,
  },
  {
    name: "سلطان الغامدي", city: "أبها", role: "مربّي حمام زاجل", stars: 4,
    story: "المنتدى مفيد جداً — تعرّفت على مربّين من كل السعودية وتبادلنا نصائح التغذية والسلالات.",
    outcome: "مجتمع متعاون", verified: false,
  },
  {
    name: "أم فيصل", city: "المدينة", role: "بائعة أعلاف", stars: 5,
    story: "افتتحت متجر أعلاف قبل 6 أشهر وطير ساعدني أوصل لآلاف الزبائن. الشارة الزرقاء رفعت ثقة الناس.",
    outcome: "توثيق يبني الثقة", verified: true,
  },
];

export default function SuccessStoriesScreen({ onBack }) {
  return (
    <View style={{ flex: 1, backgroundColor: TAIR_PALETTE.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.back} testID="stories-back-btn">
          <Ionicons name="chevron-forward" size={22} color={TAIR_PALETTE.textStrong} />
        </TouchableOpacity>
        <Text style={s.title}>قصص نجاح من مجتمع طير</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={s.hero}>
          <Ionicons name="chatbox-ellipses-outline" size={30} color={TAIR_PALETTE.primary} style={{ opacity: 0.4 }} />
          <Text style={s.heroText}>
            آلاف البائعين والمشترين والموصّلين يعتمدون على طير يومياً — إليك بعض تجاربهم.
          </Text>
        </View>

        {STORIES.map((it, i) => (
          <View key={i} style={s.card}>
            <View style={s.head}>
              <View style={s.avatar}>
                <Text style={s.avatarTxt}>{it.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
                  <Text style={s.name}>{it.name}</Text>
                  {it.verified && (
                    <Ionicons name="shield-checkmark" size={14} color={TAIR_PALETTE.primary} style={{ marginRight: 4 }} />
                  )}
                </View>
                <Text style={s.role}>{it.role} — {it.city}</Text>
              </View>
              <View style={{ flexDirection: "row-reverse" }}>
                {[...Array(it.stars)].map((_, j) => (
                  <Ionicons key={j} name="star" size={14} color="#facc15" />
                ))}
              </View>
            </View>
            <Text style={s.quote}>«{it.story}»</Text>
            <View style={s.chip}>
              <Ionicons name="checkmark-circle" size={12} color="#0ea5e9" />
              <Text style={s.chipTxt}>{it.outcome}</Text>
            </View>
          </View>
        ))}

        <View style={s.cta}>
          <Text style={s.ctaTitle}>هل عندك قصة لتحكيها؟</Text>
          <Text style={s.ctaText}>شاركنا تجربتك على stories@tair4u.com وقد ننشرها هنا!</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: TAIR_PALETTE.border,
  },
  back: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: TAIR_PALETTE.border, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "900", color: TAIR_PALETTE.textStrong },
  hero: {
    backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: TAIR_PALETTE.border,
    borderRadius: 18, padding: 20, marginBottom: 16, alignItems: "flex-end", gap: 8,
  },
  heroText: { fontSize: 15, textAlign: "right", color: TAIR_PALETTE.text, fontWeight: "600", lineHeight: 26 },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: TAIR_PALETTE.border,
  },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: TAIR_PALETTE.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { color: "#fff", fontWeight: "900", fontSize: 18 },
  name: { fontSize: 14, fontWeight: "900", color: TAIR_PALETTE.textStrong },
  role: { fontSize: 11, color: TAIR_PALETTE.textMuted, marginTop: 2, textAlign: "right", fontWeight: "600" },
  quote: { fontSize: 13.5, color: TAIR_PALETTE.text, lineHeight: 24, fontStyle: "italic", textAlign: "right" },
  chip: {
    alignSelf: "flex-end", marginTop: 8, flexDirection: "row-reverse", alignItems: "center", gap: 4,
    backgroundColor: "#dcfce7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  chipTxt: { color: "#166534", fontSize: 11, fontWeight: "800" },
  cta: {
    backgroundColor: TAIR_PALETTE.primary, padding: 18, borderRadius: 16,
    marginTop: 16, alignItems: "center",
  },
  ctaTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  ctaText: { color: "#fff", fontSize: 12.5, opacity: 0.95, textAlign: "center", lineHeight: 20 },
});
