// طير — شاشة الإشعارات
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { tairNotificationsApi } from "../services/tairApi";
import { setUnreadCount } from "../services/unreadNotifications";
import { EmptyState, ErrorState, ListSkeleton, PressableScale } from "../components/TairUI";

const ICONS = {
  admin_broadcast: "megaphone",
  app_update: "rocket",
  verification_request: "ribbon",
  chat: "chatbubble-ellipses",
  clinic_topic: "medkit",
  clinic_reply: "chatbox-ellipses",
  listing_new: "pricetag",
  story_new: "sparkles",
};

export default function NotificationsScreen({ user, onBack, onOpenItem }) {
  const uid = user?.user_id || user?.id || user?.email;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await tairNotificationsApi.list(uid, 100);
      setItems(r?.items || []);
      setLoadError(null);
      if (r?.unread_count) {
        tairNotificationsApi.readAll(uid).then(() => setUnreadCount(0)).catch(() => null);
      } else {
        setUnreadCount(0);
      }
    } catch (e) {
      setLoadError(e?.message || "تعذّر تحميل الإشعارات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }) => (
    <PressableScale
      style={[s.card, !item.is_read && s.cardUnread]}
      scaleTo={0.985}
      onPress={() => onOpenItem?.(item)}
      testID={`notif-${item.notif_id}`}
    >
      <View style={s.icon}>
        <Ionicons name={ICONS[item.type] || "notifications"} size={18} color={TAIR.gold} />
      </View>
      <View style={{ flex: 1 }}>
        {!item.is_read ? <View style={s.unread} /> : null}
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.body}>{item.body}</Text>
        <Text style={s.time}>{item.created_at ? new Date(item.created_at).toLocaleString("ar-SA") : ""}</Text>
      </View>
    </PressableScale>
  );

  return (
    <View style={s.page} testID="notifications-screen">
      <View style={s.header}>
        <PressableScale onPress={onBack} haptic scaleTo={0.92} hitSlop={10} testID="notifications-back" style={s.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={TAIR.gold} />
        </PressableScale>
        <Text style={s.hTitle}>الإشعارات</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading ? (
        <ListSkeleton count={5} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, i) => it.notif_id || String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={TAIR.emerald}
            />
          }
          ListEmptyComponent={
            loadError ? (
              <ErrorState title="تعذّر تحميل الإشعارات" onRetry={load} testID="notifications-error" />
            ) : (
              <EmptyState
                icon="notifications-off-outline"
                title="لا توجد إشعارات"
                subtitle="ستظهر هنا الرسالة العامة، والرسائل الخاصة، ومواضيع العيادة وردودها."
                testID="notifications-empty"
              />
            )
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
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 54 : 28, paddingBottom: 14,
    backgroundColor: TAIR.emeraldDeep,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(198,161,91,0.55)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,253,248,0.08)",
    borderWidth: 1, borderColor: "rgba(198,161,91,0.4)",
  },
  hTitle: { color: TAIR.gold, fontSize: 17, fontWeight: "800" },
  card: {
    flexDirection: "row-reverse", gap: 12, backgroundColor: TAIR.card, borderRadius: 18,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: TAIR.divider,
    ...TAIR_ELEVATION.hair,
  },
  cardUnread: {
    borderColor: "rgba(198,161,91,0.65)",
    backgroundColor: "#FFFBF3",
  },
  unread: {
    position: "absolute",
    top: 2,
    left: 0,
    width: 7, height: 7, borderRadius: 4, backgroundColor: TAIR.gold,
  },
  icon: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: TAIR.emerald, alignItems: "center", justifyContent: "center",
  },
  title: { color: TAIR.emerald, fontSize: 14, fontWeight: "800", textAlign: "right" },
  body: { color: TAIR.ink, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 4, fontWeight: "500" },
  time: { color: TAIR.faint, fontSize: 11, textAlign: "right", marginTop: 8, fontWeight: "600" },
});
