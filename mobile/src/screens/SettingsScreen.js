// طير — Simple Tair Settings screen
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import Constants from "expo-constants";

const TEAL = "#0ea5e9";

function Row({ icon, label, onPress, color = "#0f172a", danger = false }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={danger ? "#ef4444" : color} />
      </View>
      <Text style={[styles.label, danger && { color: "#ef4444" }]}>{label}</Text>
      <Ionicons name="chevron-back" size={18} color="#94a3b8" />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ user, onBack, onLogout }) {
  const version = Constants.expoConfig?.version || "8.0.6";
  const uid = user?.id || user?.user_id || "-";

  const confirmLogout = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من حسابك؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "تسجيل الخروج", style: "destructive", onPress: onLogout },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="الإعدادات" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>الحساب</Text>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>الاسم</Text>
            <Text style={styles.infoValue}>{user?.name || "زائر"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>البريد الإلكتروني</Text>
            <Text style={styles.infoValue}>{user?.email || "—"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>المعرف</Text>
            <Text style={[styles.infoValue, { fontFamily: "monospace", fontSize: 11 }]}>{uid}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>حول التطبيق</Text>
          <Row icon="document-text-outline" label="الشروط والأحكام" onPress={() => Linking.openURL("https://saqr-ui-sync.preview.emergentagent.com/terms")} />
          <Row icon="shield-checkmark-outline" label="سياسة الخصوصية" onPress={() => Linking.openURL("https://saqr-ui-sync.preview.emergentagent.com/privacy")} />
          <Row icon="information-circle-outline" label={`الإصدار ${version}`} onPress={() => {}} />
        </View>

        {onLogout ? (
          <View style={styles.card}>
            <Row icon="log-out-outline" label="تسجيل الخروج" onPress={confirmLogout} color="#ef4444" danger />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  content: { padding: 14, paddingBottom: 80 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1,
    borderColor: "#e2e8f0", overflow: "hidden", marginBottom: 14, padding: 4,
  },
  sectionTitle: {
    fontSize: 12, color: TEAL, fontWeight: "900",
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, textAlign: "right",
  },
  infoBlock: { paddingHorizontal: 12, paddingVertical: 10 },
  infoLabel: { fontSize: 11, color: "#64748b", fontWeight: "700", textAlign: "right" },
  infoValue: { fontSize: 14, color: "#0f172a", fontWeight: "700", textAlign: "right", marginTop: 3 },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 12 },
  row: {
    flexDirection: "row-reverse", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 12, gap: 12,
  },
  iconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  label: { flex: 1, color: "#0f172a", fontSize: 14, fontWeight: "700", textAlign: "right" },
});
