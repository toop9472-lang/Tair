// طير — Onboarding (Mobile). Mirrors /app/frontend/src/tair/OnboardingScreen.jsx
// Screen 1: Platform intro | Screen 2: Buyer/Seller CTA | Screen 3: Carrier
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR_PALETTE } from "../constants/tairDesign";

const STEPS = [
  {
    icon: "sparkles",
    kicker: "أهلاً بك في",
    title: "منصة طير",
    desc: "أول منصة سعودية تجمع محبّي الطيور والحيوانات في مكان واحد: سوق موثوق، مجتمع نشِط، ومُوصّلون معتمدون بين المدن.",
    highlights: [
      { icon: "shield-checkmark", label: "بائعون موثّقون" },
      { icon: "chatbubbles", label: "مجتمع ونقاشات" },
      { icon: "location", label: "توصيل بين المدن" },
    ],
  },
  {
    icon: "bag-handle",
    kicker: "اختر ما يناسبك",
    title: "متسوّق أم بائع؟",
    desc: "سواء كنت تبحث عن طائرك المفضّل، أو تريد بيع طيورك ومستلزماتها لمجتمع مهتم — طير هي وجهتك.",
    dual: [
      { icon: "bag-handle", title: "متسوّق", text: "تصفّح آلاف الإعلانات من بائعين موثوقين مع صور وشهادات صحية." },
      { icon: "storefront", title: "بائع", text: "انشر إعلانك مجاناً وابنِ تقييمك مع كل عملية بيع ناجحة." },
    ],
  },
  {
    icon: "car",
    title: "تسافر بين المدن؟",
    desc: "كن مُوصّلاً معتمداً. سجّل رحلاتك واحصل على طلبات نقل الطيور بأمان وثقة.",
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <View style={t.wrap}>
      <View style={t.header}>
        <Image source={require("../../assets/icon.png")} style={{ width: 36, height: 36, borderRadius: 8 }} />
        <TouchableOpacity onPress={onComplete} testID="onboarding-skip">
          <Text style={t.skip}>تخطّي</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={t.body}>
        <View style={t.iconWrap}>
          <Ionicons name={s.icon} size={64} color={TAIR_PALETTE.primary} />
        </View>
        {s.kicker && <Text style={t.kicker}>{s.kicker}</Text>}
        <Text style={t.title}>{s.title}</Text>
        <Text style={t.desc}>{s.desc}</Text>

        {s.highlights && (
          <View style={t.highlightsRow}>
            {s.highlights.map((h, i) => (
              <View key={i} style={t.highlight}>
                <View style={t.highlightIcon}>
                  <Ionicons name={h.icon} size={18} color={TAIR_PALETTE.primary} />
                </View>
                <Text style={t.highlightLabel}>{h.label}</Text>
              </View>
            ))}
          </View>
        )}

        {s.dual && (
          <View style={t.dualGrid}>
            {s.dual.map((d, i) => (
              <View key={i} style={t.dualCard}>
                <View style={t.dualIconWrap}>
                  <Ionicons name={d.icon} size={26} color={TAIR_PALETTE.primary} />
                </View>
                <Text style={t.dualTitle}>{d.title}</Text>
                <Text style={t.dualText}>{d.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={t.footer}>
        <View style={t.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[t.dot, i === step && t.dotActive]} />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => (last ? onComplete() : setStep(step + 1))}
          style={t.next}
          testID="onboarding-next"
        >
          <Text style={t.nextText}>{last ? "ابدأ الآن" : "التالي"}</Text>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F7F1E8" },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8,
  },
  skip: { fontSize: 13, color: TAIR_PALETTE.textMuted, fontWeight: "800" },
  body: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  iconWrap: {
    width: 128, height: 128, borderRadius: 32,
    backgroundColor: "#F0EAD8", alignItems: "center", justifyContent: "center",
    marginBottom: 28, borderWidth: 1, borderColor: "#C6A15B",
  },
  kicker: { fontSize: 12, fontWeight: "800", color: TAIR_PALETTE.primary, letterSpacing: 1, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: "900", color: TAIR_PALETTE.textStrong, marginBottom: 12, textAlign: "center" },
  desc: { fontSize: 15, color: TAIR_PALETTE.textMuted, lineHeight: 26, textAlign: "center", maxWidth: 380 },
  highlightsRow: { flexDirection: "row-reverse", gap: 12, marginTop: 28, flexWrap: "wrap", justifyContent: "center" },
  highlight: { alignItems: "center", gap: 6, minWidth: 84 },
  highlightIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: "#F0EAD8",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#C6A15B",
  },
  highlightLabel: { fontSize: 11, fontWeight: "700", color: TAIR_PALETTE.text },
  dualGrid: { flexDirection: "row-reverse", gap: 12, marginTop: 28, maxWidth: 400 },
  dualCard: {
    flex: 1, backgroundColor: "#FFFDF8", borderRadius: 14,
    borderWidth: 1, borderColor: TAIR_PALETTE.border,
    padding: 16, alignItems: "center", gap: 8,
  },
  dualIconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "#F0EAD8",
    alignItems: "center", justifyContent: "center",
  },
  dualTitle: { fontSize: 15, fontWeight: "900", color: TAIR_PALETTE.textStrong },
  dualText: { fontSize: 11, color: TAIR_PALETTE.textMuted, lineHeight: 18, textAlign: "center" },
  footer: {
    padding: 20, borderTopWidth: 1, borderTopColor: TAIR_PALETTE.border,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
  },
  dots: { flexDirection: "row-reverse", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TAIR_PALETTE.border },
  dotActive: { width: 22, backgroundColor: TAIR_PALETTE.primary },
  next: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    backgroundColor: TAIR_PALETTE.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
  },
  nextText: { color: "#C6A15B", fontWeight: "900", fontSize: 14 },
});
