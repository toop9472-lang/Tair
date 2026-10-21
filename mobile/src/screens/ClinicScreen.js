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
import { TAIR } from "../constants/tairTheme";
import { clinicTopicsApi, adminExtApi } from "../services/tairApi";
import { EmptyState, ErrorState, ListSkeleton, PressableScale, TairImage } from "../components/TairUI";

const EMERGENCY_TG = "https://t.me/parrotsnbirds2020";

function whenLabel(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return mins <= 1 ? "الآن" : `قبل ${mins} د`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `قبل ${hours} س`;
  const days = Math.round(hours / 24);
  if (days < 14) return `قبل ${days} ي`;
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

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
    const waiting = !item.replies_count;
    return (
      <PressableScale
        onPress={() => onOpenTopic?.(item.topic_id)}
        style={s.row}
        haptic
        testID={`clinic-topic-${item.topic_id}`}
      >
        <View style={s.avatar}>
          {item.user_avatar ? (
            <TairImage uri={item.user_avatar} style={s.avatarImg} icon="person-outline" />
          ) : (
            <Text style={s.avatarLetter}>{(item.user_name || "ع").charAt(0)}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.rowTop}>
            <Text style={s.member} numberOfLines={1}>{item.user_name || "عضو"}</Text>
            <Text style={s.when}>{whenLabel(item.updated_at || item.created_at)}</Text>
          </View>
          <Text style={s.subject} numberOfLines={1}>{item.title}</Text>
          <View style={s.meta}>
            <Ionicons name="chatbubble-outline" size={11} color={TAIR.textSoft} />
            <Text style={s.metaText}>{item.replies_count || 0}</Text>
            {item.is_chick ? <Text style={s.tag}>فرخ</Text> : null}
            {waiting ? <Text style={s.wait}>بانتظار الرد</Text> : null}
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
              <View>
                <Text style={s.sectionTitle}>المواضيع</Text>
                <Text style={s.sectionSub}>الأحدث نشاطاً، الاسم ثم الموضوع</Text>
              </View>
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
  sectionTitle: { color: TAIR.emerald, fontSize: 16, fontWeight: "900", textAlign: "right" },
  sectionSub: { color: TAIR.textSoft, fontSize: 11, textAlign: "right", marginTop: 2 },
  addBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 5,
    backgroundColor: TAIR.emerald, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: TAIR.gold,
  },
  addBtnText: { color: TAIR.gold, fontSize: 12, fontWeight: "900" },

  row: {
    flexDirection: "row-reverse", alignItems: "center", gap: 10,
    marginHorizontal: 14, paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: TAIR.divider,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: TAIR.creamDeep,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarLetter: { color: TAIR.emerald, fontSize: 14, fontWeight: "900" },
  rowTop: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  member: { flex: 1, color: TAIR.goldDark, fontSize: 12, fontWeight: "800", textAlign: "right" },
  when: { color: TAIR.textSoft, fontSize: 10, fontWeight: "700" },
  subject: { color: "#0F241C", fontSize: 14, fontWeight: "800", textAlign: "right", marginTop: 2 },
  meta: { flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { color: TAIR.textSoft, fontSize: 11, fontWeight: "700" },
  tag: { color: TAIR.emerald, fontSize: 10, fontWeight: "800", backgroundColor: TAIR.creamDeep, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  wait: { color: "#8B3A2F", fontSize: 10, fontWeight: "800" },

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
