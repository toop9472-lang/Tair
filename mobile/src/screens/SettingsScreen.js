// طير — الإعدادات
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Linking, Modal, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import api from "../services/api";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import Constants from "expo-constants";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { PressableScale } from "../components/TairUI";

const SITE = process.env.EXPO_PUBLIC_BACKEND_URL;

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

  const [delOpen, setDelOpen] = useState(false);

  return (
    <View style={styles.container}>
      <DeleteAccountModal visible={delOpen} onClose={() => setDelOpen(false)} onDeleted={onLogout} />
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
          <Row icon="document-text-outline" label="الشروط والأحكام" onPress={() => Linking.openURL(`${SITE}/terms`)} />
          <Row icon="shield-checkmark-outline" label="سياسة الخصوصية" onPress={() => Linking.openURL(`${SITE}/privacy`)} />
          <Row icon="information-circle-outline" label={`الإصدار ${version}`} onPress={() => {}} />
        </View>

        {onLogout ? (
          <View style={styles.card}>
            <Row icon="log-out-outline" label="تسجيل الخروج" onPress={confirmLogout} danger />
            <View style={styles.divider} />
            <Row icon="trash-outline" label="حذف حسابي نهائياً" onPress={() => setDelOpen(true)} danger />
          </View>
        ) : null}

        <Text style={styles.foot}>طير · سوق الطيور والحيوانات</Text>
      </ScrollView>
    </View>
  );
}

function DeleteAccountModal({ visible, onClose, onDeleted }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.deleteAccount("حذف", password || null);
      onClose();
      Alert.alert("تم حذف الحساب", "حُذف حسابك وبياناتك من طير نهائياً.");
      onDeleted?.();
    } catch (e) {
      Alert.alert("تعذّر الحذف", e?.data?.detail || e?.message || "حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBack}>
        <View style={styles.modalCard} testID="delete-account-modal">
          <Ionicons name="warning" size={30} color={TAIR.error} style={{ alignSelf: "center" }} />
          <Text style={styles.modalTitle}>حذف الحساب نهائياً</Text>
          <Text style={styles.modalText}>
            ستُحذف بياناتك الشخصية ورسائلك وقصصك ومفضلتك، وتُخفى إعلاناتك ورحلاتك. لا يمكن التراجع عن هذا.
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder="كلمة المرور (إذا سجلت بالبريد)"
            placeholderTextColor={TAIR.faint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            textAlign="right"
            testID="delete-account-password"
          />
          <TouchableOpacity style={styles.modalDanger} onPress={submit} disabled={busy} testID="delete-account-confirm">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalDangerT}>حذف حسابي</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={onClose} disabled={busy} testID="delete-account-cancel">
            <Text style={styles.modalCancelT}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  modalBack: { flex: 1, backgroundColor: "rgba(15,36,28,0.6)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: TAIR.bg, borderRadius: 20, padding: 20, gap: 12 },
  modalTitle: { color: TAIR.error, fontSize: 18, fontWeight: "900", textAlign: "center" },
  modalText: { color: TAIR.emerald, fontSize: 13, lineHeight: 21, textAlign: "right" },
  modalInput: { backgroundColor: TAIR.card, borderRadius: 12, borderWidth: 1, borderColor: TAIR.divider, height: 46, paddingHorizontal: 12, color: TAIR.emerald },
  modalDanger: { backgroundColor: TAIR.error, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalDangerT: { color: "#fff", fontWeight: "900", fontSize: 15 },
  modalCancel: { paddingVertical: 8, alignItems: "center" },
  modalCancelT: { color: TAIR.emerald, fontWeight: "800" },
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
