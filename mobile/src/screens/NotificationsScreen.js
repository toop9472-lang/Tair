// طير — شاشة الإشعارات
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { tairNotificationsApi } from "../services/tairApi";
import { setUnreadCount } from "../services/unreadNotifications";
import { EmptyState, ErrorState, ListSkeleton, PressableScale } from "../components/TairUI";

const FACE = {
  chat: ["رسالة", "messages"],
  community_chat: ["دردشة عامة", "messages"],
  clinic_topic: ["موضوع في العيادة", "clinic"],
  clinic_reply: ["رد في العيادة", "clinic"],
  trip_match: ["رحلة تناسبك", "trips"],
  trip_request: ["طلب رحلة", "trips"],
  trip_booking: ["حجز رحلة", "trips"],
  trip_motion: ["حركة الرحلة", "trips"],
  trip_status: ["رحلة", "trips"],
  order_update: ["طلب", "orders"],
  order_disputed: ["نزاع على طلب", "orders"],
  follow: ["متابعة", "general"],
  kyc_decision: ["توثيق", "general"],
  verification_request: ["توثيق", "general"],
  admin_broadcast: ["من طير", "general"],
  app_update: ["تحديث التطبيق", "general"],
  listing_new: ["إعلان", "general"],
  story_new: ["قصة", "general"],
};

const ICONS = {
  admin_broadcast: "megaphone",
  app_update: "rocket",
  verification_request: "ribbon",
  kyc_decision: "shield-checkmark",
  chat: "chatbubble-ellipses",
  community_chat: "people",
  clinic_topic: "medkit",
  clinic_reply: "chatbox-ellipses",
  listing_new: "pricetag",
  story_new: "sparkles",
  trip_match: "airplane",
  trip_request: "map",
  trip_booking: "cube",
  trip_motion: "navigate",
  trip_status: "airplane",
  order_update: "receipt",
  order_disputed: "alert-circle",
  follow: "person-add",
};

function faceOf(item) {
  if (item?.label && item?.channel) return { label: item.label, channel: item.channel };
  const kind = String(item?.type || "");
  if (FACE[kind]) return { label: FACE[kind][0], channel: FACE[kind][1] };
  if (kind.startsWith("chat")) return { label: "رسالة", channel: "messages" };
  if (kind.startsWith("clinic")) return { label: "العيادة", channel: "clinic" };
  if (kind.startsWith("trip")) return { label: "رحلة", channel: "trips" };
  if (kind.startsWith("order")) return { label: "طلب", channel: "orders" };
  return { label: "طير", channel: "general" };
}

function iconFor(type) {
  const kind = String(type || "");
  if (ICONS[kind]) return ICONS[kind];
  if (kind.startsWith("chat")) return "chatbubble-ellipses";
  if (kind.startsWith("clinic")) return "medkit";
  if (kind.startsWith("trip")) return "airplane";
  if (kind.startsWith("order")) return "receipt";
  return "notifications";
}

function openHint(item) {
  const kind = String(item?.type || "");
  const data = item?.data || {};
  if (kind.startsWith("chat")) return "افتح الرسائل";
  if (kind === "community_chat" || kind === "story_new" || kind === "story") return "افتح المجتمع";
  if (kind.startsWith("clinic") && data.topic_id) return "افتح الموضوع";
  if (kind.startsWith("clinic")) return "افتح العيادة";
  if (kind.startsWith("order")) return "افتح الطلبات";
  if (kind.startsWith("trip") && data.trip_id) return "افتح الرحلة";
  if (kind.startsWith("trip")) return "افتح الرحلات";
  if (data.listing_id || kind.startsWith("listing")) return "افتح الإعلان";
  return "";
}

function arDigits(n) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
}

function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, (Date.now() - then) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${arDigits(Math.floor(diff / 60))} د`;
  if (diff < 86400) return `قبل ${arDigits(Math.floor(diff / 3600))} س`;
  if (diff < 86400 * 7) return `قبل ${arDigits(Math.floor(diff / 86400))} يوم`;
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function dayBucket(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "أقدم";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(then);
  day.setHours(0, 0, 0, 0);
  const diff = (start.getTime() - day.getTime()) / 86400000;
  if (diff < 1) return "اليوم";
  if (diff < 2) return "أمس";
  if (diff < 7) return "هذا الأسبوع";
  return "أقدم";
}

function withSections(items) {
  const rows = [];
  let last = "";
  items.forEach((item, index) => {
    const bucket = dayBucket(item.created_at);
    if (bucket !== last) {
      rows.push({ row: "head", id: `head-${bucket}`, title: bucket });
      last = bucket;
    }
    rows.push({ row: "item", id: item.notif_id || `n-${index}`, item });
  });
  return rows;
}

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

  const rows = withSections(items);
  const renderItem = ({ item: row }) => {
    if (row.row === "head") {
      return <Text style={s.section}>{row.title}</Text>;
    }
    const item = row.item;
    const face = faceOf(item);
    const hint = openHint(item);
    return (
      <PressableScale
        style={[s.card, !item.is_read && s.cardUnread]}
        scaleTo={0.985}
        onPress={() => onOpenItem?.(item)}
        testID={`notif-${item.notif_id}`}
      >
        <View style={[s.icon, !item.is_read && s.iconUnread]}>
          <Ionicons name={iconFor(item.type)} size={18} color={TAIR.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.topRow}>
            <View style={s.kind} testID={`notif-kind-${item.notif_id}`}>
              <Text style={s.kindText}>{face.label}</Text>
            </View>
            <Text style={s.time}>{relativeTime(item.created_at)}</Text>
          </View>
          <Text style={s.title}>{item.title}</Text>
          {item.body ? <Text style={s.body} numberOfLines={3}>{item.body}</Text> : null}
          {hint ? <Text style={s.hint}>{hint}</Text> : null}
        </View>
      </PressableScale>
    );
  };

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
          data={rows}
          keyExtractor={(it) => it.id}
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
  icon: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: TAIR.emerald, alignItems: "center", justifyContent: "center",
  },
  section: {
    color: TAIR.faint, fontSize: 12, fontWeight: "800", textAlign: "right",
    marginTop: 6, marginBottom: 8, marginHorizontal: 4,
  },
  topRow: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8,
  },
  kind: {
    backgroundColor: "rgba(27,61,47,0.08)",
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: "rgba(198,161,91,0.45)",
  },
  kindText: { color: TAIR.emerald, fontSize: 10, fontWeight: "800" },
  title: { color: TAIR.emerald, fontSize: 14, fontWeight: "800", textAlign: "right", marginTop: 6 },
  body: { color: TAIR.ink, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 4, fontWeight: "500" },
  time: { color: TAIR.faint, fontSize: 11, fontWeight: "700" },
  hint: { color: TAIR.gold, fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 8 },
  iconUnread: { borderWidth: 1, borderColor: "rgba(198,161,91,0.7)" },
});
