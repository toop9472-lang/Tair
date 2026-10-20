// طير — نافذة "تحديث جديد" تظهر مرة واحدة لكل تحديث ينشره المدير
import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TAIR } from "../constants/tairTheme";
import { adminExtApi } from "../services/tairApi";

const SEEN_KEY = "tair_seen_update_id";

export default function UpdateNoticeModal() {
  const [upd, setUpd] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await adminExtApi.latestUpdate();
        if (!u?.update_id) return;
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (seen !== u.update_id) setUpd(u);
      } catch {}
    })();
  }, []);

  const close = async () => {
    if (upd?.update_id) await AsyncStorage.setItem(SEEN_KEY, upd.update_id).catch(() => null);
    setUpd(null);
  };

  if (!upd) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.card} testID="update-notice-modal">
          <View style={s.badge}><Ionicons name="rocket" size={26} color={TAIR.gold} /></View>
          <Text style={s.title}>تحديث جديد {upd.version}</Text>
          <ScrollView style={{ maxHeight: 260, alignSelf: "stretch" }}>
            <Text style={s.notes}>{upd.notes}</Text>
          </ScrollView>
          {upd.store_url ? (
            <TouchableOpacity style={s.primary} onPress={() => Linking.openURL(upd.store_url).catch(() => null)} testID="update-notice-store">
              <Text style={s.primaryT}>تحديث الآن</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={upd.store_url ? s.secondary : s.primary} onPress={close} testID="update-notice-close">
            <Text style={upd.store_url ? s.secondaryT : s.primaryT}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,36,28,0.65)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", backgroundColor: TAIR.bg, borderRadius: 20, padding: 20, alignItems: "center", borderWidth: 1, borderColor: TAIR.gold },
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: TAIR.emerald, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  title: { color: TAIR.emerald, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  notes: { color: "#0F241C", fontSize: 14, lineHeight: 23, textAlign: "right" },
  primary: { alignSelf: "stretch", backgroundColor: TAIR.emerald, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 14, borderWidth: 1, borderColor: TAIR.gold },
  primaryT: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },
  secondary: { alignSelf: "stretch", paddingVertical: 10, alignItems: "center", marginTop: 6 },
  secondaryT: { color: TAIR.textSoft, fontWeight: "800", fontSize: 14 },
});
