// طير — Simple Tair Support screen
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";

const TEAL = "#0ea5e9";
const SUPPORT_EMAIL = "sky-321@hotmail.com";
const SUPPORT_WHATSAPP = "+966539999415";

const FAQ = [
  {
    q: "كيف أنشر إعلاناً؟",
    a: "من الصفحة الرئيسية اضغط زر + في أعلى الشاشة، أضف الصور والعنوان والسعر ثم اضغط نشر.",
  },
  {
    q: "كيف أشتري طائراً؟",
    a: "افتح الإعلان، ثم اضغط 'تواصل مع البائع' عبر الشات أو واتساب واتفق على السعر والتوصيل.",
  },
  {
    q: "من هو الناقل (Carrier)؟",
    a: "الناقل شخص يسجّل رحلاته بين المدن ويوصّل الطيور بين البائع والمشتري بأمان مقابل رسوم.",
  },
  {
    q: "هل التطبيق يأخذ عمولة؟",
    a: "لا يوجد عمولات حالياً. منصة طير وسيط مجاني يربط البائعين والمشترين والنقّالين.",
  },
];

function ContactRow({ icon, color, label, value, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-back" size={18} color="#94a3b8" />
    </TouchableOpacity>
  );
}

export default function SupportScreen({ onBack }) {
  const openWhatsapp = () => {
    const url = `https://wa.me/${SUPPORT_WHATSAPP.replace(/\+/g, "")}?text=${encodeURIComponent("مرحباً، أحتاج مساعدة في تطبيق طير")}`;
    Linking.openURL(url).catch(() => Alert.alert("خطأ", "تعذّر فتح واتساب"));
  };
  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=استفسار عن تطبيق طير`).catch(() =>
      Alert.alert("خطأ", "تعذّر فتح البريد"),
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="الدعم الفني" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          فريقنا جاهز لخدمتك من السبت إلى الخميس (9 صباحاً — 9 مساءً)
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>تواصل معنا</Text>
          <ContactRow icon="logo-whatsapp" color="#22c55e" label="واتساب" value={SUPPORT_WHATSAPP} onPress={openWhatsapp} />
          <View style={styles.divider} />
          <ContactRow icon="mail" color="#0369a1" label="البريد الإلكتروني" value={SUPPORT_EMAIL} onPress={openEmail} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>الأسئلة الشائعة</Text>
          {FAQ.map((item, i) => (
            <View key={i}>
              <View style={styles.faqItem}>
                <View style={styles.qRow}>
                  <Ionicons name="help-circle" size={16} color={TEAL} />
                  <Text style={styles.qText}>{item.q}</Text>
                </View>
                <Text style={styles.aText}>{item.a}</Text>
              </View>
              {i < FAQ.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  content: { padding: 14, paddingBottom: 80 },
  hint: {
    color: "#64748b", fontSize: 13, textAlign: "center",
    marginBottom: 14, lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1,
    borderColor: "#e2e8f0", overflow: "hidden", marginBottom: 14, padding: 4,
  },
  sectionTitle: {
    fontSize: 12, color: TEAL, fontWeight: "900",
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, textAlign: "right",
  },
  row: {
    flexDirection: "row-reverse", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 12, gap: 12,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: { color: "#0f172a", fontSize: 14, fontWeight: "800", textAlign: "right" },
  rowValue: { color: "#64748b", fontSize: 12, fontWeight: "600", textAlign: "right", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 12 },
  faqItem: { paddingHorizontal: 12, paddingVertical: 12 },
  qRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 4 },
  qText: { color: "#0f172a", fontSize: 13.5, fontWeight: "800", flex: 1, textAlign: "right" },
  aText: { color: "#475569", fontSize: 12.5, lineHeight: 20, textAlign: "right" },
});
