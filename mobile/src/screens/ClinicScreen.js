/**
 * ClinicScreen — طير العيادة (نموذج المواضيع)
 * - بنر قابل للنقر → المكتبة
 * - زر طوارئ دائري → تيليجرام
 * - قائمة المواضيع (استبيان طبي + صور/فيديو) — بديل الدردشة العامة
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Linking, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TairHeader from "../components/TairHeader";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { clinicTopicsApi, adminExtApi } from "../services/tairApi";
import { EmptyState, ErrorState, ListSkeleton, PressableScale, TairImage } from "../components/TairUI";

const EMERGENCY_TG = "https://t.me/parrotsnbirds2020";

export default function ClinicScreen({
  user, onBellPress, onOpenMessages,
  onOpenTopic, onCreateTopic, onOpenLibrary,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [myScopes, setMyScopes] = useState([]);
  const uid = user?.user_id || user?.id || user?.email;
  const isAdmin = !!(user?.is_admin || user?.role === "admin" || user?.role === "super_admin");
  const isClinicMod =
    isAdmin ||
    myScopes.includes("clinic") ||
    myScopes.includes("general") ||
    myScopes.includes("clinic_admin");

  const load = useCallback(async () => {
    try {
      const r = await clinicTopicsApi.list(30, 0);
      setItems(r?.items || []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e?.message || "تعذّر تحميل المواضيع");
    } finally { setLoading(false); setRefreshing(false); }
    try {
      if (uid) {
        const r = await adminExtApi.myScopes(uid);
        setMyScopes(r?.scopes || []);
      }
    } catch {
      setMyScopes([]);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const openEmergency = () => {
    Linking.openURL(EMERGENCY_TG).catch(() =>
      Alert.alert("خطأ", "تعذّر فتح تيليجرام")
    );
  };

  const renderTopic = ({ item }) => {
    const img = (item.images && item.images[0]) || item.user_avatar;
    return (
      <PressableScale
        onPress={() => onOpenTopic?.(item.topic_id)}
        style={s.topicCard}
        haptic
        testID={`clinic-topic-${item.topic_id}`}
      >
        <View style={s.topicLeft}>
          {img ? (
            <TairImage uri={img} style={s.topicImg} icon="medkit-outline" />
          ) : (
            <View style={[s.topicImg, { backgroundColor: TAIR.creamDeep, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="medkit-outline" size={22} color={TAIR.emerald} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.topicTitle} numberOfLines={2}>
            {item.user_name ? `${item.user_name} — ` : ""}{item.title}
          </Text>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 6 }}>
            <View style={s.replyChip}>
              <Ionicons name="chatbubbles-outline" size={11} color={TAIR.emerald} />
              <Text style={s.replyChipText}>
                {item.replies_count || 0} ردود
              </Text>
            </View>
            {item.views_count ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 3 }}>
                <Ionicons name="eye-outline" size={11} color={TAIR.textSoft} />
                <Text style={{ color: TAIR.textSoft, fontSize: 11 }}>{item.views_count}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>
    );
  };

  return (
    <View style={s.page}>
      <TairHeader variant="clinic" userId={user?.user_id || user?.id} onBellPress={onBellPress} onMessagesPress={onOpenMessages} />

      <FlatList
        data={items}
        keyExtractor={(t) => t.topic_id}
        renderItem={renderTopic}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TAIR.emerald} />}
        ListHeaderComponent={
          <>
            {/* Clickable Library Banner */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={onOpenLibrary}
              style={s.banner}
              testID="clinic-library-banner"
            >
              <View style={s.bannerIconBox}>
                <Ionicons name="book" size={22} color={TAIR.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bannerTitle}>المكتبة</Text>
                <Text style={s.bannerSub}>بالتعاون مع فريق طيور وببغاوات 🦜</Text>
              </View>
              {isClinicMod ? (
                <View style={s.modBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={TAIR.gold} />
                  <Text style={s.modBadgeText}>مشرف</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-back" size={18} color={TAIR.gold} />
            </TouchableOpacity>

            {/* Section header + Add topic */}
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>المواضيع</Text>
              <TouchableOpacity onPress={onCreateTopic} style={s.addBtn} testID="clinic-add-topic">
                <Ionicons name="add-circle" size={16} color={TAIR.gold} />
                <Text style={s.addBtnText}>إضافة موضوع</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? null : loadError ? (
            <ErrorState
              title="تعذّر تحميل العيادة"
              subtitle="تحقق من الاتصال ثم أعد المحاولة."
              onRetry={load}
              testID="clinic-error"
            />
          ) : (
            <EmptyState
              icon="medkit-outline"
              title="لا توجد مواضيع بعد"
              subtitle="كن أول من يطرح استشارة طبية — اضغط «إضافة موضوع»"
            />
          )
        }
        contentContainerStyle={{ paddingBottom: TAIR.tabBarH + 90, flexGrow: 1 }}
      />

      {loading && items.length === 0 ? (
        <View style={s.loading} pointerEvents="none">
          <ListSkeleton count={4} />
        </View>
      ) : null}

      {/* Floating emergency button (left) → Telegram */}
      <TouchableOpacity
        onPress={openEmergency}
        activeOpacity={0.85}
        style={s.sosFab}
        testID="clinic-emergency-btn"
      >
        <View style={s.sosInner}>
          <Ionicons name="warning" size={22} color="#fff" />
        </View>
        <Text style={s.sosLabel}>طوارئ</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  loading: { position: "absolute", top: 250, left: 0, right: 0 },

  banner: {
    marginHorizontal: 14, marginTop: 10,
    flexDirection: "row-reverse", alignItems: "center", gap: 12,
    backgroundColor: TAIR.emerald, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: TAIR.gold,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  bannerIconBox: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: "rgba(198,161,91,0.18)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: TAIR.gold,
  },
  bannerTitle: { color: TAIR.gold, fontSize: 17, fontWeight: "900", textAlign: "right" },
  bannerSub: { color: "#E4D3A8", fontSize: 12, textAlign: "right", marginTop: 3 },
  modBadge: {
    flexDirection: "row-reverse", alignItems: "center", gap: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1, borderColor: TAIR.gold,
  },
  modBadgeText: { color: TAIR.gold, fontSize: 10, fontWeight: "900" },

  sectionHead: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16,
    marginTop: 18, marginBottom: 10,
  },
  sectionTitle: { color: TAIR.emerald, fontSize: 16, fontWeight: "900" },
  addBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 5,
    backgroundColor: TAIR.emerald, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: TAIR.gold,
  },
  addBtnText: { color: TAIR.gold, fontSize: 12, fontWeight: "900" },

  topicCard: {
    flexDirection: "row-reverse", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: TAIR.card, borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: TAIR.divider,
    ...TAIR_ELEVATION.card,
  },
  topicLeft: {},
  topicImg: { width: 54, height: 54, borderRadius: 27, backgroundColor: TAIR.divider, overflow: "hidden" },
  topicTitle: { color: "#0F241C", fontSize: 14, fontWeight: "800", textAlign: "right", lineHeight: 22 },
  replyChip: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    backgroundColor: "#EEF6F0", borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: TAIR.divider,
  },
  replyChipText: { color: TAIR.emerald, fontSize: 11, fontWeight: "800" },

  empty: { alignItems: "center", padding: 40, gap: 10 },
  emptyTitle: { color: TAIR.emerald, fontSize: 15, fontWeight: "900", marginTop: 8 },
  emptyHint: { color: TAIR.textSoft, fontSize: 12, textAlign: "center", lineHeight: 18 },

  sosFab: {
    position: "absolute", left: 16, bottom: TAIR.tabBarH + 20,
    alignItems: "center", gap: 4,
    zIndex: 10,
  },
  sosInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "#8B3A2F",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#FEF2C8",
    shadowColor: "#8B3A2F", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  sosLabel: {
    color: "#8B3A2F", fontSize: 11, fontWeight: "900",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, borderWidth: 1, borderColor: "#8B3A2F",
  },
});
