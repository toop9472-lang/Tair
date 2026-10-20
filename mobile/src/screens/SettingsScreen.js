// طير — الإعدادات
import React from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import Constants from "expo-constants";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { PressableScale } from "../components/TairUI";

function Row({ icon, label, onPress, danger = false }) {
  const color = danger ? TAIR.error : TAIR.emerald;
  return (
    <PressableScale style={styles.row} onPress={onPress} haptic scaleTo={0.99}>
      <View style={[styles.iconBox, { backgroundColor: danger ? TAIR.dangerSoft : TAIR.emeraldWash }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.label, danger && { color: TAIR.error }]}>{label}</Text>
      <Ionicons name="chevron-back" size={16} color={TAIR.faint} />
    </PressableScale>
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
      <ScreenHeader title="الإعدادات" subtitle="حسابك وتفضيلات طير" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>الحساب</Text>
          <Info label="الاسم" value={user?.name || "زائر"} />
          <View style={styles.divider} />
          <Info label="البريد الإلكتروني" value={user?.email || "—"} />
          <View style={styles.divider} />
          <Info label="المعرف" value={String(uid)} mono />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>حول التطبيق</Text>
          <Row icon="document-text-outline" label="الشروط والأحكام" onPress={() => Linking.openURL("https://saqr-ui-sync.preview.emergentagent.com/terms")} />
          <Row icon="shield-checkmark-outline" label="سياسة الخصوصية" onPress={() => Linking.openURL("https://saqr-ui-sync.preview.emergentagent.com/privacy")} />
          <Row icon="information-circle-outline" label={`الإصدار ${version}`} onPress={() => {}} />
        </View>

        {onLogout ? (
          <View style={styles.card}>
            <Row icon="log-out-outline" label="تسجيل الخروج" onPress={confirmLogout} danger />
          </View>
        ) : null}

        <Text style={styles.foot}>طير · سوق الطيور والحيوانات</Text>
      </ScrollView>
    </View>
  );
}

function Info({ label, value, mono }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TAIR.bg },
  content: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: TAIR.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TAIR.divider,
    overflow: "hidden",
    marginBottom: 14,
    ...TAIR_ELEVATION.hair,
  },
  sectionTitle: {
    fontSize: 12,
    color: TAIR.goldDark,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    textAlign: "right",
    letterSpacing: 0.3,
  },
  infoBlock: { paddingHorizontal: 16, paddingVertical: 12 },
  infoLabel: { fontSize: 11, color: TAIR.faint, fontWeight: "700", textAlign: "right" },
  infoValue: { fontSize: 15, color: TAIR.ink, fontWeight: "700", textAlign: "right", marginTop: 3 },
  mono: { fontSize: 12, fontWeight: "600", color: TAIR.muted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: TAIR.divider, marginHorizontal: 16 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, color: TAIR.ink, fontSize: 14, fontWeight: "700", textAlign: "right" },
  foot: { textAlign: "center", color: TAIR.faint, fontSize: 12, marginTop: 8, fontWeight: "600" },
});
