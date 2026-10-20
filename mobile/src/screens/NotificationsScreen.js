// طير — شاشة الإشعارات (الرسائل العامة، التحديثات، التنبيهات)
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR } from "../constants/tairTheme";
import { tairNotificationsApi } from "../services/tairApi";

const ICONS = { admin_broadcast: "megaphone", app_update: "rocket", verification_request: "ribbon" };

export default function NotificationsScreen({ user, onBack }) {
  const uid = user?.user_id || user?.id || user?.email;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await tairNotificationsApi.list(uid, 100);
      setItems(r?.items || []);
      if (r?.unread_count) tairNotificationsApi.readAll(uid).catch(() => null);
    } catch { setItems([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }) => (
    <View style={[s.card, !item.is_read && s.cardUnread]} testID={`notif-${item.notif_id}`}>
      <View style={s.icon}>
        <Ionicons name={ICONS[item.type] || "notifications"} size={18} color={TAIR.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.body}>{item.body}</Text>
        <Text style={s.time}>{item.created_at ? new Date(item.created_at).toLocaleString("ar-SA") : ""}</Text>
      </View>
    </View>
  );

  return (
    <View style={s.page} testID="notifications-screen">
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={10} testID="notifications-back">
          <Ionicons name="chevron-forward" size={24} color={TAIR.gold} />
        </TouchableOpacity>
        <Text style={s.hTitle}>الإشعارات</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator color={TAIR.emerald} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, i) => it.notif_id || String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={s.empty} testID="notifications-empty">
              <Ionicons name="notifications-off-outline" size={44} color={TAIR.gold} />
              <Text style={s.emptyT}>لا توجد إشعارات جديدة</Text>
              <Text style={s.emptyS}>ستظهر هنا رسائل إدارة طير والتحديثات والتنبيهات.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 50 : 24, paddingBottom: 14,
    backgroundColor: TAIR.emerald, borderBottomWidth: 1, borderBottomColor: TAIR.gold,
  },
  hTitle: { color: TAIR.gold, fontSize: 18, fontWeight: "900" },
  card: {
    flexDirection: "row-reverse", gap: 10, backgroundColor: TAIR.card, borderRadius: 14,
    padding: 12, marginBottom: 10, borderWidth: 1, borderColor: TAIR.divider,
  },
  cardUnread: { borderColor: TAIR.gold, backgroundColor: "#FFFBF3" },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: TAIR.emerald, alignItems: "center", justifyContent: "center" },
  title: { color: TAIR.emerald, fontSize: 14, fontWeight: "900", textAlign: "right" },
  body: { color: "#0F241C", fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 4 },
  time: { color: TAIR.textSoft, fontSize: 10, textAlign: "right", marginTop: 6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyT: { color: TAIR.emerald, fontSize: 16, fontWeight: "900" },
  emptyS: { color: TAIR.textSoft, fontSize: 13, textAlign: "center", lineHeight: 20 },
});
