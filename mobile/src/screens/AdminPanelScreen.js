// طير — Admin Panel v2 (لوحة المدير الشاملة)
// Tabs: إحصائيات • إعلانات • رحلات • مستخدمون • بلاغات • قصص • مزادات
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl, TextInput, Image, ScrollView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TAIR } from "../constants/tairTheme";
import { listingsApi, tripsApi, adminExtApi } from "../services/tairApi";
import api from "../services/api";

const TABS = [
  { id: "stats",     label: "الإحصائيات", icon: "stats-chart" },
  { id: "pending",   label: "قيد الموافقة", icon: "time" },
  { id: "broadcast", label: "رسالة عامة", icon: "megaphone-outline" },
  { id: "clinic_bot", label: "بوت العيادة", icon: "hardware-chip-outline" },
  { id: "verify",    label: "طلبات التوثيق", icon: "ribbon-outline" },
  { id: "mods",      label: "المشرفون",   icon: "shield-half-outline" },
  { id: "listings",  label: "الإعلانات",   icon: "megaphone" },
  { id: "trips",     label: "الرحلات",     icon: "airplane" },
  { id: "users",     label: "المستخدمون",  icon: "people" },
  { id: "reports",   label: "البلاغات",    icon: "flag" },
  { id: "stories",   label: "القصص",       icon: "sparkles" },
  { id: "auctions",  label: "المزادات",    icon: "hammer" },
];

// تبويبات محدودة لمشرف العيادة فقط (ليس أدمن عام)
const CLINIC_ONLY_TABS = ["stats", "reports", "users", "clinic_bot"];

async function authedFetch(pathAndQs, opts = {}) {
  const token = await AsyncStorage.getItem("saqr_token");
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return api.fetch(pathAndQs, { ...opts, headers });
}

async function jsonReq(pathAndQs, opts = {}) {
  const r = await authedFetch(pathAndQs, opts);
  if (!r) return null;
  try { return await r.json(); } catch { return null; }
}

export default function AdminPanelScreen({ user, onBack }) {
  const uid = user?.email || user?.user_id || user?.id;
  const isAdmin = !!(user?.is_admin || user?.role === "admin" || user?.role === "super_admin");
  const [serverAdmin, setServerAdmin] = useState(null); // null = unknown, true/false
  const [myScopes, setMyScopes] = useState([]);
  const isClinicOnlyMod = !isAdmin && (myScopes.includes("clinic") || myScopes.includes("clinic_admin"));
  const visibleTabs = isClinicOnlyMod ? TABS.filter((t) => CLINIC_ONLY_TABS.includes(t.id)) : TABS;
  const [tab, setTab] = useState(visibleTabs[0]?.id || "stats");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  // Users pagination + active-only filter
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [activeOnly, setActiveOnly] = useState(false);
  const [stats, setStats] = useState({
    listings: 0, trips: 0, users: 0, reports: 0, stories: 0, auctions: 0,
    banned: 0, sellers: 0, carriers: 0, admins: 0,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (tab === "stats") {
        // aggregate stats from multiple endpoints
        const [l, t, u, r, s, a] = await Promise.all([
          listingsApi.feed({ limit: 1, include_all: true }).catch(() => ({ total: 0 })),
          tripsApi.list({ limit: 1 }).catch(() => ({ total: 0 })),
          jsonReq("/api/admin/users/stats/overview").catch(() => null),
          jsonReq("/api/tair-reports/list?status=open&limit=1").catch(() => null),
          jsonReq("/api/community/stories/list?limit=1").catch(() => null),
          jsonReq("/api/auctions/list?limit=1").catch(() => null),
        ]);
        setStats({
          listings: l.total || l.count || 0,
          trips: t.total || (t.items?.length || 0),
          users: u?.total_users || u?.total || 0,
          banned: u?.banned || 0,
          sellers: u?.sellers || 0,
          carriers: u?.carriers || 0,
          admins: u?.admins || 0,
          reports: r?.total || (r?.items?.length || 0),
          stories: s?.total || (s?.items?.length || 0),
          auctions: a?.total || (a?.items?.length || 0),
        });
        setItems([]);
      } else if (tab === "listings") {
        const r = await listingsApi.feed({ limit: 100, include_all: true });
        setItems(r.items || []);
      } else if (tab === "trips") {
        const r = await tripsApi.list({ limit: 100 });
        setItems(r.items || []);
      } else if (tab === "users") {
        if (activeOnly) {
          const data = await jsonReq(`/api/clinic/_admin/active-users?user_id=${encodeURIComponent(uid)}&minutes=15`);
          setItems(data?.items || []);
          setUserPages(1);
        } else {
          const data = await jsonReq(`/api/admin/users/list?limit=25&page=${userPage}${query ? `&search=${encodeURIComponent(query)}` : ""}`);
          setItems(data?.users || data?.items || []);
          setUserPages(data?.pages || 1);
        }
      } else if (tab === "reports") {
        const data = await jsonReq(`/api/tair-reports/list?limit=100`);
        setItems(data?.items || []);
      } else if (tab === "stories") {
        const data = await jsonReq(`/api/community/stories/list?limit=100`);
        setItems(data?.items || []);
      } else if (tab === "auctions") {
        const data = await jsonReq(`/api/auctions/list?limit=100`);
        setItems(data?.items || []);
      } else if (tab === "pending") {
        const data = await jsonReq(`/api/auctions/pending?user_id=${encodeURIComponent(uid)}`);
        setItems(data?.items || []);
      } else if (tab === "verify") {
        try {
          const data = await adminExtApi.verificationList(uid, "pending");
          setItems(data?.items || []);
        } catch { setItems([]); }
      } else if (tab === "mods") {
        try {
          const data = await adminExtApi.moderatorsList(uid);
          setItems(data?.items || []);
        } catch { setItems([]); }
      } else if (tab === "broadcast") {
        setItems([]);
      } else if (tab === "clinic_bot") {
        setItems([]);
        const r = await adminExtApi.clinicBotStatus().catch(() => null);
        setBotEnabled(r?.enabled !== false);
      }
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر التحميل");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, uid, userPage, activeOnly, query]);

  useEffect(() => { load(); }, [load]);

  // تحقّق من صلاحيات السيرفر — عشان نعرف إذا الحساب فعلاً مدير أم لا + جلب scopes
  useEffect(() => {
    (async () => {
      try {
        const r = await adminExtApi.myScopes(uid);
        setServerAdmin(!!r?.is_admin);
        setMyScopes(r?.scopes || []);
      } catch {
        setServerAdmin(false);
      }
    })();
  }, [uid]);

  const confirmDelete = (title, path) => {
    Alert.alert(
      "تأكيد",
      title,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف", style: "destructive", onPress: async () => {
            try {
              const r = await authedFetch(path, { method: "DELETE" });
              if (!r || !r.ok) {
                let msg = "تعذّر الحذف";
                try {
                  const j = await r.json();
                  if (j?.detail) msg = String(j.detail);
                } catch {}
                if (r?.status === 401) msg = "انتهت الجلسة — سجّل الدخول مرة أخرى";
                if (r?.status === 403) msg = "غير مصرح — تأكد أنك مسجّل كمدير";
                Alert.alert("خطأ", msg);
                return;
              }
              load();
            } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر الحذف"); }
          },
        },
      ]
    );
  };

  const banUser = (userId, banned) => {
    const path = banned ? `/api/admin/users/${userId}/unban` : `/api/admin/users/${userId}/ban`;
    Alert.alert(
      banned ? "إلغاء الحظر" : "حظر المستخدم",
      banned ? "سيُعاد تمكين هذا المستخدم." : "لن يستطيع هذا المستخدم استخدام التطبيق.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: banned ? "إلغاء الحظر" : "حظر", onPress: async () => {
            try {
              await authedFetch(path, { method: "PUT" });
              load();
            } catch { Alert.alert("خطأ", "تعذّر التنفيذ"); }
          },
        },
      ]
    );
  };

  const toggleTrust = async (userId, currentlyTrusted) => {
    try {
      await authedFetch(`/api/admin/users/${userId}/trust?trusted=${!currentlyTrusted}`, { method: "PUT" });
      load();
    } catch { Alert.alert("خطأ", "تعذّر التنفيذ"); }
  };

  const approveAuction = async (auctionId) => {
    try {
      const r = await authedFetch(`/api/auctions/${auctionId}/approve?user_id=${encodeURIComponent(uid)}`, { method: "POST" });
      if (!r?.ok) throw new Error("failed");
      const j = await r.json();
      Alert.alert("✅ تم القبول", `مزاد رقم #${j.sequence_number}`);
      load();
    } catch { Alert.alert("خطأ", "تعذّر القبول"); }
  };

  const rejectAuction = (auctionId) => {
    Alert.alert("رفض المزاد", "هل تريد رفض هذا الطلب؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "رفض", style: "destructive", onPress: async () => {
        try {
          const r = await authedFetch(`/api/auctions/${auctionId}/reject?user_id=${encodeURIComponent(uid)}&reason=${encodeURIComponent("لم يستوف الشروط")}`, { method: "POST" });
          if (!r?.ok) throw new Error("failed");
          load();
        } catch { Alert.alert("خطأ", "تعذّر الرفض"); }
      }},
    ]);
  };

  const resolveReport = async (rid) => {
    try {
      await authedFetch(`/api/tair-reports/${rid}/resolve`, { method: "PATCH" });
      load();
    } catch { Alert.alert("خطأ", "تعذّر الحل"); }
  };

  // ---- Broadcast state ----
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [bcSending, setBcSending] = useState(false);
  const sendBroadcast = async () => {
    const t = bcTitle.trim(), b = bcBody.trim();
    if (!t || !b) return Alert.alert("تنبيه", "أدخل العنوان والنص");
    Alert.alert("تأكيد", `إرسال رسالة لجميع المستخدمين؟\n\n${t}`, [
      { text: "إلغاء", style: "cancel" },
      { text: "إرسال", onPress: async () => {
        setBcSending(true);
        try {
          const r = await adminExtApi.broadcast({ title: t, body: b }, uid);
          Alert.alert("✔ تم", `أُرسلت لـ ${r?.recipients ?? r?.delivered_to ?? 0} مستخدم\nإشعارات الجوال: ${r?.push_devices ?? 0} جهاز`);
          setBcTitle(""); setBcBody("");
        } catch (e) { Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر الإرسال"); }
        finally { setBcSending(false); }
      }},
    ]);
  };

  // ---- App update notice ----
  const [upVersion, setUpVersion] = useState("");
  const [upNotes, setUpNotes] = useState("");
  const [upUrl, setUpUrl] = useState("");
  const [upSending, setUpSending] = useState(false);
  const publishUpdate = () => {
    const v = upVersion.trim(), n = upNotes.trim();
    if (!v || !n) return Alert.alert("تنبيه", "أدخل رقم النسخة وملاحظات التحديث");
    Alert.alert("تأكيد", `نشر إشعار التحديث ${v} لجميع المستخدمين؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "نشر", onPress: async () => {
        setUpSending(true);
        try {
          const r = await adminExtApi.publishUpdate({ version: v, notes: n, store_url: upUrl.trim() });
          Alert.alert("✔ تم", `نُشر التحديث لـ ${r?.recipients ?? 0} مستخدم\nإشعارات الجوال: ${r?.push_devices ?? 0} جهاز`);
          setUpVersion(""); setUpNotes(""); setUpUrl("");
        } catch (e) { Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر النشر"); }
        finally { setUpSending(false); }
      }},
    ]);
  };

  // ---- Clinic bot toggle ----
  const [botEnabled, setBotEnabled] = useState(true);
  const [botBusy, setBotBusy] = useState(false);
  const toggleBot = async () => {
    setBotBusy(true);
    try {
      const r = await adminExtApi.clinicBotToggle(!botEnabled, uid);
      setBotEnabled(!!r?.enabled);
    } catch (e) { Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر التغيير"); }
    finally { setBotBusy(false); }
  };

  // ---- Verification actions ----
  const approveVerification = async (id) => {
    try {
      await adminExtApi.verificationApprove(id, uid);
      Alert.alert("✔", "تمت الموافقة");
      load();
    } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر التنفيذ"); }
  };
  const rejectVerification = (id) => {
    Alert.alert("رفض الطلب", "هل تريد رفض هذا الطلب؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "رفض", style: "destructive", onPress: async () => {
        try {
          await adminExtApi.verificationReject(id, uid, "لم يستوف الشروط");
          load();
        } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر التنفيذ"); }
      }},
    ]);
  };

  // ---- Moderators actions ----
  const assignMod = (targetUid) => {
    Alert.alert(
      "تعيين مشرف",
      "اختر النطاق:",
      [
        { text: "إلغاء", style: "cancel" },
        { text: "👑 مدير العيادة",  onPress: () => doAssign(targetUid, ["clinic_admin","clinic"]) },
        { text: "🏥 مشرف عيادة",    onPress: () => doAssign(targetUid, ["clinic"]) },
        { text: "🛒 مشرف السوق",    onPress: () => doAssign(targetUid, ["market"]) },
        { text: "👥 مشرف المجتمع",  onPress: () => doAssign(targetUid, ["community"]) },
        { text: "🌐 مشرف عام (الكل)", onPress: () => doAssign(targetUid, ["clinic","market","community","general"]) },
      ],
    );
  };
  const doAssign = async (targetUid, scopes) => {
    try {
      await adminExtApi.moderatorsAssign(targetUid, scopes, uid);
      Alert.alert("✔", "تم التعيين");
      load();
    } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر التنفيذ"); }
  };
  const revokeMod = (targetUid) => {
    Alert.alert("سحب الصلاحيات", "متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "سحب", style: "destructive", onPress: async () => {
        try {
          await adminExtApi.moderatorsRevoke(targetUid, uid);
          load();
        } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر التنفيذ"); }
      }},
    ]);
  };

  // -------- Renderers --------
  const renderStats = () => (
    <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TAIR.emerald} />}>
      <View style={styles.statsGrid}>
        <StatCard icon="megaphone-outline" label="الإعلانات" value={stats.listings} color={TAIR.gold} />
        <StatCard icon="airplane-outline" label="الرحلات" value={stats.trips} color={TAIR.emerald} />
        <StatCard icon="people-outline" label="المستخدمون" value={stats.users} color={TAIR.goldDark} />
        <StatCard icon="flag-outline" label="بلاغات مفتوحة" value={stats.reports} color="#8B3A2F" />
        <StatCard icon="sparkles-outline" label="قصص نشطة" value={stats.stories} color={TAIR.emerald} />
        <StatCard icon="hammer-outline" label="مزادات" value={stats.auctions} color={TAIR.gold} />
        <StatCard icon="ban-outline" label="محظورون" value={stats.banned} color="#8B3A2F" />
        <StatCard icon="storefront-outline" label="بائعون" value={stats.sellers} color={TAIR.emerald} />
        <StatCard icon="car-sport-outline" label="ناقلون" value={stats.carriers} color={TAIR.goldDark} />
        <StatCard icon="shield-checkmark-outline" label="مديرون" value={stats.admins} color={TAIR.emerald} />
      </View>
      <View style={styles.quickActionsCard}>
        <Text style={styles.quickActionsTitle}>إجراءات سريعة</Text>
        <QuickAction icon="medkit-outline" label="تفعيل/إيقاف صفحة العيادة" onPress={async () => {
          try {
            // fetch current then toggle
            const r = await authedFetch("/api/clinic/settings");
            const cur = await r.json().catch(() => ({ enabled: false }));
            const next = !cur.enabled;
            Alert.alert(
              next ? "تفعيل العيادة" : "إيقاف العيادة",
              next ? "سيتمكن المستخدمون من الدخول للعيادة" : "سيتم إخفاء العيادة عن المستخدمين",
              [
                { text: "إلغاء", style: "cancel" },
                { text: next ? "تفعيل" : "إيقاف", onPress: async () => {
                  try {
                    const resp = await authedFetch(`/api/clinic/settings?user_id=${encodeURIComponent(uid)}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ enabled: next }),
                    });
                    if (!resp?.ok) throw new Error("failed");
                    Alert.alert("✔", next ? "تم التفعيل" : "تم الإيقاف");
                  } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر التنفيذ"); }
                }},
              ]
            );
          } catch (e) { Alert.alert("خطأ", "تعذّر جلب الحالة"); }
        }} />
        <QuickAction icon="trash-bin-outline" label="حذف جميع الرحلات" onPress={() => Alert.alert("خطر", "احذف كل الرحلات؟", [{ text: "إلغاء" }, { text: "احذف", style: "destructive", onPress: () => authedFetch("/api/admin/users/purge-all-trips", { method: "POST" }).then(load) }])} />
        <QuickAction icon="trash-outline" label="حذف جميع الإعلانات" onPress={() => Alert.alert("خطر", "احذف كل الإعلانات؟", [{ text: "إلغاء" }, { text: "احذف", style: "destructive", onPress: () => authedFetch("/api/admin/users/purge-all-listings", { method: "POST" }).then(load) }])} />
        <QuickAction icon="broom-outline" label="تنظيف البيانات المهجورة" onPress={() => authedFetch("/api/admin/users/cleanup/orphans", { method: "POST" }).then(load)} />
      </View>
    </ScrollView>
  );

  const renderList = () => {
    const filtered = items.filter((it) => {
      if (!query.trim() || tab === "users") return true; // for users, server-side search
      const q = query.toLowerCase();
      return JSON.stringify(it).toLowerCase().includes(q);
    });
    return (
      <FlatList
        data={filtered}
        keyExtractor={(it, i) => String(it.listing_id || it.trip_id || it.user_id || it.report_id || it.story_id || it.auction_id || it.id || i)}
        renderItem={({ item }) => renderRow(item)}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TAIR.emerald} />}
        ListHeaderComponent={
          tab === "users" ? (
            <View style={{ flexDirection: "row-reverse", padding: 10, gap: 8, alignItems: "center", backgroundColor: TAIR.card, borderBottomWidth: 1, borderBottomColor: TAIR.divider }}>
              <TouchableOpacity
                onPress={() => { setActiveOnly(!activeOnly); setUserPage(1); }}
                style={[
                  { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: TAIR.divider },
                  activeOnly ? { backgroundColor: TAIR.emerald, borderColor: TAIR.gold } : { backgroundColor: TAIR.bg },
                ]}
                testID="users-active-toggle"
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeOnly ? "#2F6B45" : TAIR.textSoft }} />
                <Text style={{ color: activeOnly ? TAIR.gold : TAIR.emerald, fontSize: 11, fontWeight: "900" }}>
                  {activeOnly ? "النشطون الآن (15د)" : "عرض النشطين فقط"}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: TAIR.textSoft, fontSize: 11, flex: 1, textAlign: "left" }}>
                {activeOnly ? `${items.length} نشط` : `صفحة ${userPage} / ${userPages}`}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          tab === "users" && !activeOnly && userPages > 1 ? (
            <View style={{ flexDirection: "row-reverse", justifyContent: "center", gap: 10, padding: 14 }}>
              <TouchableOpacity
                onPress={() => userPage > 1 && setUserPage(userPage - 1)}
                disabled={userPage <= 1}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: userPage > 1 ? TAIR.emerald : TAIR.card, borderWidth: 1, borderColor: TAIR.gold, opacity: userPage > 1 ? 1 : 0.5 }}
                testID="users-page-prev"
              >
                <Text style={{ color: userPage > 1 ? TAIR.gold : TAIR.textSoft, fontWeight: "900", fontSize: 12 }}>السابق ‹</Text>
              </TouchableOpacity>
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: TAIR.card, borderWidth: 1, borderColor: TAIR.divider }}>
                <Text style={{ color: TAIR.emerald, fontWeight: "900", fontSize: 12 }}>{userPage} / {userPages}</Text>
              </View>
              <TouchableOpacity
                onPress={() => userPage < userPages && setUserPage(userPage + 1)}
                disabled={userPage >= userPages}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: userPage < userPages ? TAIR.emerald : TAIR.card, borderWidth: 1, borderColor: TAIR.gold, opacity: userPage < userPages ? 1 : 0.5 }}
                testID="users-page-next"
              >
                <Text style={{ color: userPage < userPages ? TAIR.gold : TAIR.textSoft, fontWeight: "900", fontSize: 12 }}>› التالي</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="inbox-outline" size={40} color={TAIR.textSoft} />
              <Text style={styles.emptyText}>لا توجد بيانات</Text>
            </View>
          ) : null
        }
      />
    );
  };

  const renderRow = (item) => {
    if (tab === "listings") return <ListingRow item={item} onDelete={() => confirmDelete("حذف هذا الإعلان؟", `/api/listings/${item.listing_id || item.id}?user_id=${encodeURIComponent(uid)}`)} />;
    if (tab === "trips") return <TripRow item={item} onDelete={() => confirmDelete("حذف هذه الرحلة؟", `/api/trips/${item.trip_id || item.id}?user_id=${encodeURIComponent(uid)}`)} />;
    if (tab === "users") return <UserRow item={item} onBan={banUser} onTrust={toggleTrust} onAssignMod={() => assignMod(item.user_id || item.id)} onDelete={() => confirmDelete("حذف هذا المستخدم؟", `/api/admin/users/${item.user_id || item.id}`)} />;
    if (tab === "reports") return <ReportRow item={item} onResolve={() => resolveReport(item.report_id || item.id)} />;
    if (tab === "stories") return <StoryRow item={item} onDelete={() => confirmDelete("حذف هذه القصة؟", `/api/community/stories/${item.story_id || item.id}?user_id=${encodeURIComponent(uid)}`)} />;
    if (tab === "auctions") return <AuctionRow item={item} onDelete={() => confirmDelete("حذف هذا المزاد؟", `/api/auctions/${item.auction_id || item.id}?user_id=${encodeURIComponent(uid)}`)} />;
    if (tab === "pending") return <PendingAuctionRow item={item} onApprove={() => approveAuction(item.auction_id)} onReject={() => rejectAuction(item.auction_id)} />;
    if (tab === "verify") return <VerificationRow item={item} onApprove={() => approveVerification(item.request_id || item.id)} onReject={() => rejectVerification(item.request_id || item.id)} />;
    if (tab === "mods") return <ModeratorRow item={item} onRevoke={() => revokeMod(item.user_id || item.id)} onAssign={() => assignMod(item.user_id || item.id)} />;
    return null;
  };

  return (
    <View style={styles.container}>
      {/* هدر إداري */}
      <View style={styles.adminHeader}>
        <TouchableOpacity onPress={onBack} style={styles.adminBack} hitSlop={10}>
          <Ionicons name="chevron-forward" size={24} color={TAIR.gold} />
        </TouchableOpacity>
        <View style={{ alignItems: "flex-end", flex: 1 }}>
          <Text style={styles.adminTitle}>{isClinicOnlyMod ? "لوحة إدارة العيادة" : "لوحة المدير"}</Text>
          <Text style={styles.adminSub}>إدارة كاملة لتطبيق طير</Text>
        </View>
        <View style={styles.adminShield}>
          <Ionicons name="shield-checkmark" size={20} color={TAIR.gold} />
        </View>
      </View>

      {/* التبويبات — أفقية صغيرة */}
      <View style={{ height: 54, backgroundColor: TAIR.bg }}>
        <ScrollView
          horizontal
          inverted
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {visibleTabs.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
              activeOpacity={0.8}
              testID={`admin-tab-${t.id}`}
            >
              <Ionicons name={t.icon} size={15} color={tab === t.id ? TAIR.gold : TAIR.emerald} />
              <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* شريط بحث (لغير الإحصائيات) */}
      {tab !== "stats" && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={TAIR.textSoft} />
          <TextInput
            style={styles.searchInp}
            placeholder="بحث..."
            placeholderTextColor={TAIR.textSoft}
            value={query}
            onChangeText={setQuery}
            textAlign="right"
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={TAIR.emerald} /></View>
      ) : tab === "stats" ? renderStats()
        : tab === "broadcast" ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: TAIR.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: TAIR.divider }}>
              <Text style={{ color: TAIR.emerald, fontWeight: "900", fontSize: 16, textAlign: "right", marginBottom: 8 }}>
                إرسال رسالة عامة لجميع المستخدمين
              </Text>
              <Text style={{ color: TAIR.textSoft, fontSize: 12, textAlign: "right", marginBottom: 12 }}>
                سيتم إرسال إشعار push لجميع المستخدمين المسجلين — استخدمها بحذر.
              </Text>
              <TextInput
                style={[styles.searchInp, { backgroundColor: TAIR.bg, borderRadius: 10, borderWidth: 1, borderColor: TAIR.divider, height: 44, paddingHorizontal: 12, marginBottom: 10 }]}
                placeholder="عنوان الرسالة"
                placeholderTextColor={TAIR.textSoft}
                value={bcTitle}
                onChangeText={setBcTitle}
                textAlign="right"
                testID="broadcast-title"
              />
              <TextInput
                style={[styles.searchInp, { backgroundColor: TAIR.bg, borderRadius: 10, borderWidth: 1, borderColor: TAIR.divider, height: 100, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top", marginBottom: 12 }]}
                placeholder="نص الرسالة..."
                placeholderTextColor={TAIR.textSoft}
                value={bcBody}
                onChangeText={setBcBody}
                textAlign="right"
                multiline
                testID="broadcast-body"
              />
              <TouchableOpacity
                onPress={sendBroadcast}
                disabled={bcSending}
                style={{
                  backgroundColor: TAIR.emerald, borderRadius: 10, paddingVertical: 12,
                  flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
                  borderWidth: 1, borderColor: TAIR.gold, opacity: bcSending ? 0.7 : 1,
                }}
                testID="broadcast-send"
              >
                {bcSending
                  ? <ActivityIndicator size="small" color={TAIR.gold} />
                  : <Ionicons name="send" size={16} color={TAIR.gold} />}
                <Text style={{ color: TAIR.gold, fontWeight: "900", fontSize: 14 }}>
                  {bcSending ? "جاري الإرسال..." : "إرسال للجميع"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>إشعار تحديث جديد للتطبيق</Text>
              <Text style={styles.panelHint}>
                يظهر كنافذة منبثقة لكل المستخدمين مرة واحدة + إشعار على الجوال.
              </Text>
              <TextInput style={styles.panelInput} placeholder="رقم النسخة (مثال: 8.2.0)" placeholderTextColor={TAIR.textSoft}
                value={upVersion} onChangeText={setUpVersion} textAlign="right" testID="update-version" />
              <TextInput style={[styles.panelInput, { height: 100, paddingVertical: 10, textAlignVertical: "top" }]}
                placeholder="ما الجديد في هذا التحديث..." placeholderTextColor={TAIR.textSoft}
                value={upNotes} onChangeText={setUpNotes} textAlign="right" multiline testID="update-notes" />
              <TextInput style={styles.panelInput} placeholder="رابط المتجر (اختياري)" placeholderTextColor={TAIR.textSoft}
                value={upUrl} onChangeText={setUpUrl} textAlign="right" autoCapitalize="none" testID="update-store-url" />
              <TouchableOpacity onPress={publishUpdate} disabled={upSending} style={[styles.panelBtn, upSending && { opacity: 0.7 }]} testID="update-publish">
                {upSending ? <ActivityIndicator size="small" color={TAIR.gold} /> : <Ionicons name="rocket" size={16} color={TAIR.gold} />}
                <Text style={{ color: TAIR.gold, fontWeight: "900", fontSize: 14 }}>{upSending ? "جاري النشر..." : "نشر التحديث للجميع"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )
        : tab === "clinic_bot" ? (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>بوت العيادة</Text>
              <Text style={styles.panelHint}>
                عند التفعيل يرد البوت تلقائياً على كل موضوع جديد في العيادة. عند الإيقاف تبقى الردود للمشرفين فقط.
              </Text>
              <Text style={[styles.panelTitle, { color: botEnabled ? TAIR.emerald : "#B3261E", fontSize: 14 }]} testID="clinic-bot-status">
                الحالة: {botEnabled ? "مُفعّل" : "متوقف"}
              </Text>
              <TouchableOpacity onPress={toggleBot} disabled={botBusy}
                style={[styles.panelBtn, !botEnabled && { backgroundColor: TAIR.gold }, botBusy && { opacity: 0.7 }]}
                testID="clinic-bot-toggle">
                {botBusy ? <ActivityIndicator size="small" color={botEnabled ? TAIR.gold : TAIR.emerald} />
                  : <Ionicons name={botEnabled ? "pause-circle" : "play-circle"} size={18} color={botEnabled ? TAIR.gold : TAIR.emerald} />}
                <Text style={{ color: botEnabled ? TAIR.gold : TAIR.emerald, fontWeight: "900", fontSize: 14 }}>
                  {botEnabled ? "إيقاف البوت" : "تفعيل البوت"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )
        : renderList()}
    </View>
  );
}

// -------- Sub-components --------
const StatCard = ({ icon, label, value, color }) => (
  <View style={[styles.statCard, { borderColor: color }]}>
    <Ionicons name={icon} size={20} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QuickAction = ({ icon, label, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.quickAction} activeOpacity={0.7}>
    <Ionicons name={icon} size={18} color={TAIR.emerald} />
    <Text style={styles.quickActionLabel}>{label}</Text>
    <Ionicons name="chevron-back" size={16} color={TAIR.textSoft} />
  </TouchableOpacity>
);

const ListingRow = ({ item, onDelete }) => {
  const img = item.image_url || (Array.isArray(item.images) && item.images[0]) || null;
  return (
    <View style={styles.row}>
      {img ? <Image source={{ uri: img }} style={styles.rowImg} /> :
        <View style={[styles.rowImg, styles.rowImgPh]}><Ionicons name="image-outline" size={20} color={TAIR.textSoft} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title || "إعلان"}</Text>
        <Text style={styles.rowMeta}>{item.city || ""} • {item.price_sar ? `${item.price_sar} ر.س` : ""}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color="#8B3A2F" />
      </TouchableOpacity>
    </View>
  );
};

const TripRow = ({ item, onDelete }) => {
  const img = item.carrier_avatar || (item.images && item.images[0]);
  return (
    <View style={styles.row}>
      {img ? <Image source={{ uri: img }} style={styles.rowImg} /> : (
        <View style={styles.rowIconBox}><Ionicons name="airplane" size={20} color={TAIR.emerald} /></View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item.from_city || "?"} ← {item.to_city || "?"}</Text>
        <Text style={styles.rowMeta}>{item.carrier_name || "ناقل"} • {item.status || "متاح"} • {item.price_sar ? `${item.price_sar} ر.س` : ""}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color="#8B3A2F" />
      </TouchableOpacity>
    </View>
  );
};

const UserRow = ({ item, onBan, onTrust, onAssignMod, onDelete }) => {
  const banned = !!(item.banned || item.is_banned);
  const trusted = !!item.trusted_by_admin || !!item.is_verified_shop;
  const uid = item.user_id || item.id;
  const avatar = item.avatar || item.profile_image || item.storefront_settings?.logo_url;
  const copyId = async () => {
    try {
      const Clipboard = require("expo-clipboard");
      await Clipboard.setStringAsync(String(uid || ""));
      Alert.alert("تم النسخ", `المعرّف: ${uid}`);
    } catch {
      Alert.alert("المعرّف", String(uid || ""));
    }
  };
  return (
    <View style={styles.row}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.rowImg} />
      ) : (
        <View style={[styles.rowImg, styles.rowImgPh]}>
          <Ionicons name={banned ? "ban-outline" : "person"} size={22} color={banned ? "#8B3A2F" : TAIR.emerald} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name || item.username || "مستخدم"}</Text>
          {trusted ? (
            <View style={styles.trustBadge}>
              <Ionicons name="shield-checkmark" size={11} color={TAIR.gold} />
              <Text style={styles.trustBadgeText}>موثوق</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>{item.email || ""} • {item.role || "مستخدم"}</Text>
        <TouchableOpacity onPress={copyId} activeOpacity={0.7} style={styles.uidChip}>
          <Ionicons name="copy-outline" size={11} color={TAIR.textSoft} />
          <Text style={styles.uidText} numberOfLines={1}>ID: {String(uid || "").slice(0, 20)}{String(uid || "").length > 20 ? "…" : ""}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onAssignMod} style={styles.modBtn} testID={`assign-mod-${uid}`}>
        <Ionicons name="shield-half" size={16} color={TAIR.emerald} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onTrust(uid, trusted)} style={[styles.trustBtn, trusted && { backgroundColor: TAIR.emerald }]}>
        <Ionicons name="shield-checkmark-outline" size={14} color={trusted ? TAIR.gold : TAIR.emerald} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onBan(uid, banned)} style={styles.banBtn}>
        <Ionicons name={banned ? "checkmark-circle-outline" : "ban-outline"} size={16} color={banned ? TAIR.emerald : "#8B3A2F"} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtnSmall}>
        <Ionicons name="trash-outline" size={16} color="#8B3A2F" />
      </TouchableOpacity>
    </View>
  );
};

const ReportRow = ({ item, onResolve }) => (
  <View style={styles.row}>
    <View style={[styles.rowIconBox, { backgroundColor: "#FDECEA" }]}>
      <Ionicons name="flag" size={18} color="#8B3A2F" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>{item.reason || item.category || "بلاغ"}</Text>
      <Text style={styles.rowMeta} numberOfLines={2}>{item.description || item.details || ""}</Text>
    </View>
    {item.status !== "resolved" ? (
      <TouchableOpacity onPress={onResolve} style={styles.resolveBtn}>
        <Ionicons name="checkmark" size={16} color={TAIR.gold} />
        <Text style={styles.resolveBtnText}>حل</Text>
      </TouchableOpacity>
    ) : (
      <View style={styles.resolvedBadge}>
        <Text style={styles.resolvedText}>محلول</Text>
      </View>
    )}
  </View>
);

const StoryRow = ({ item, onDelete }) => (
  <View style={styles.row}>
    {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.rowImg} /> :
      <View style={[styles.rowImg, styles.rowImgPh]}><Ionicons name="sparkles-outline" size={20} color={TAIR.gold} /></View>}
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>{item.user_name || "مربّي"}</Text>
      <Text style={styles.rowMeta} numberOfLines={1}>{item.caption || item.text || ""}</Text>
    </View>
    <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
      <Ionicons name="trash-outline" size={18} color="#8B3A2F" />
    </TouchableOpacity>
  </View>
);

const AuctionRow = ({ item, onDelete }) => (
  <View style={styles.row}>
    <View style={styles.rowIconBox}><Ionicons name="hammer-outline" size={20} color={TAIR.gold} /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {item.sequence_number ? `#${item.sequence_number} • ` : ""}{item.title || "مزاد"}
      </Text>
      <Text style={styles.rowMeta}>{item.status || "?"} • {item.current_bid_sar ? `${item.current_bid_sar} ر.س` : `يبدأ من ${item.starting_price_sar || 1}`}</Text>
    </View>
    <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
      <Ionicons name="trash-outline" size={18} color="#8B3A2F" />
    </TouchableOpacity>
  </View>
);

const PendingAuctionRow = ({ item, onApprove, onReject }) => (  <View style={[styles.row, { flexDirection: "column", alignItems: "stretch", padding: 12, gap: 10 }]}>
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
      <View style={[styles.rowIconBox, { backgroundColor: "#FFF3D9" }]}>
        <Ionicons name="time" size={20} color="#B8860B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title || "مزاد"}</Text>
        <Text style={styles.rowMeta}>{item.seller_name} • {item.city || "-"}</Text>
      </View>
    </View>
    {/* Preview images */}
    {Array.isArray(item.images) && item.images.length > 0 && (
      <View style={{ flexDirection: "row-reverse", gap: 6 }}>
        {item.images.slice(0, 3).map((u, i) => (
          <Image key={i} source={{ uri: u }} style={{ width: 60, height: 60, borderRadius: 8 }} />
        ))}
      </View>
    )}
    <View style={{ flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" }}>
      {item.species ? <Text style={styles.miniTag}>{item.species}</Text> : null}
      {item.gender ? <Text style={styles.miniTag}>{item.gender}</Text> : null}
      {item.age_months != null ? <Text style={styles.miniTag}>{item.age_months} شهر</Text> : null}
      <Text style={[styles.miniTag, { backgroundColor: TAIR.gold + "33" }]}>افتتاح: {item.starting_price_sar} ر.س</Text>
    </View>
    {item.description ? (
      <Text style={{ color: TAIR.text, fontSize: 12, textAlign: "right" }} numberOfLines={2}>
        {item.description}
      </Text>
    ) : null}
    <View style={{ flexDirection: "row-reverse", gap: 8 }}>
      <TouchableOpacity onPress={onApprove} style={styles.approveBtn}>
        <Ionicons name="checkmark-circle" size={16} color={TAIR.gold} />
        <Text style={styles.approveText}>موافقة</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onReject} style={styles.rejectBtn}>
        <Ionicons name="close-circle" size={16} color="#8B3A2F" />
        <Text style={styles.rejectText}>رفض</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const VerificationRow = ({ item, onApprove, onReject }) => (
  <View style={styles.row}>
    <View style={[styles.rowIconBox, { backgroundColor: "#F5EED9" }]}>
      <Ionicons name="ribbon" size={18} color={TAIR.gold} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>{item.name || item.user_name || "مستخدم"}</Text>
      <Text style={styles.rowMeta} numberOfLines={2}>{item.reason || item.note || ""}</Text>
      {item.phone ? <Text style={styles.rowMeta}>{item.phone}</Text> : null}
    </View>
    <TouchableOpacity onPress={onApprove} style={[styles.resolveBtn, { backgroundColor: TAIR.emerald }]}>
      <Ionicons name="checkmark" size={16} color={TAIR.gold} />
      <Text style={styles.resolveBtnText}>قبول</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onReject} style={styles.deleteBtn}>
      <Ionicons name="close" size={16} color="#8B3A2F" />
    </TouchableOpacity>
  </View>
);

const ModeratorRow = ({ item, onRevoke, onAssign }) => (
  <View style={styles.row}>
    <View style={[styles.rowIconBox, { backgroundColor: "#E4EEE7" }]}>
      <Ionicons name="shield-half" size={18} color={TAIR.emerald} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>{item.name || item.user_name || "مشرف"}</Text>
      <Text style={styles.rowMeta} numberOfLines={1}>
        النطاقات: {(item.scopes || []).join("، ") || "-"}
      </Text>
    </View>
    <TouchableOpacity onPress={onAssign} style={[styles.resolveBtn, { backgroundColor: TAIR.card, borderWidth: 1, borderColor: TAIR.emerald }]}>
      <Ionicons name="add-circle-outline" size={14} color={TAIR.emerald} />
      <Text style={[styles.resolveBtnText, { color: TAIR.emerald }]}>تعديل</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onRevoke} style={styles.deleteBtn}>
      <Ionicons name="close-circle-outline" size={18} color="#8B3A2F" />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  panelCard: { backgroundColor: TAIR.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: TAIR.divider, gap: 10 },
  panelTitle: { color: TAIR.emerald, fontWeight: "900", fontSize: 16, textAlign: "right" },
  panelHint: { color: TAIR.textSoft, fontSize: 12, textAlign: "right", lineHeight: 19 },
  panelInput: { backgroundColor: TAIR.bg, borderRadius: 10, borderWidth: 1, borderColor: TAIR.divider, height: 44, paddingHorizontal: 12, color: TAIR.emerald },
  panelBtn: {
    backgroundColor: TAIR.emerald, borderRadius: 10, paddingVertical: 12, flexDirection: "row-reverse",
    alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: TAIR.gold,
  },
  container: { flex: 1, backgroundColor: TAIR.bg },
  adminHeader: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 48 : 20, paddingBottom: 16,
    backgroundColor: TAIR.emerald,
  },
  adminBack: { width: 32, alignItems: "center" },
  adminTitle: { color: TAIR.gold, fontSize: 20, fontWeight: "900" },
  adminSub: { color: "#E0C580", fontSize: 11, marginTop: 2 },
  adminShield: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(198,161,91,0.18)", alignItems: "center", justifyContent: "center" },
  permBanner: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    backgroundColor: "#FDECEA", borderBottomWidth: 1, borderBottomColor: "#F3B9B2",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  permBannerText: { flex: 1, color: "#8B3A2F", fontSize: 12, textAlign: "right", lineHeight: 18, fontWeight: "700" },

  tabsRow: { flexDirection: "row-reverse", gap: 6, paddingHorizontal: 12, alignItems: "center", height: 54 },
  tabBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 5,
    backgroundColor: TAIR.card, paddingHorizontal: 12, height: 34,
    borderRadius: 999, borderWidth: 1, borderColor: TAIR.divider,
  },
  tabBtnActive: { backgroundColor: TAIR.emerald, borderColor: TAIR.gold },
  tabLabel: { color: TAIR.emerald, fontWeight: "800", fontSize: 12 },
  tabLabelActive: { color: TAIR.gold },

  searchWrap: {
    marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, height: 44,
    backgroundColor: TAIR.card, borderRadius: 12, borderWidth: 1, borderColor: TAIR.divider,
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
  },
  searchInp: { flex: 1, color: TAIR.text, fontSize: 14 },

  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyText: { color: TAIR.textSoft, fontSize: 13 },

  // Stats
  statsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "31%", backgroundColor: TAIR.card, borderRadius: 12,
    borderWidth: 1.5, padding: 12, alignItems: "center", gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "900", color: TAIR.emerald, marginTop: 2 },
  statLabel: { fontSize: 10, color: TAIR.textSoft, textAlign: "center" },

  quickActionsCard: {
    marginTop: 20, backgroundColor: TAIR.card, borderRadius: 14,
    borderWidth: 1, borderColor: TAIR.divider, padding: 4,
  },
  quickActionsTitle: { padding: 12, paddingBottom: 6, color: TAIR.emerald, fontSize: 14, fontWeight: "900", textAlign: "right" },
  quickAction: {
    flexDirection: "row-reverse", alignItems: "center", gap: 12,
    padding: 14, borderTopWidth: 1, borderTopColor: TAIR.divider,
  },
  quickActionLabel: { flex: 1, textAlign: "right", color: TAIR.text, fontSize: 13, fontWeight: "700" },

  // Row
  divider: { height: 1, backgroundColor: TAIR.divider, marginHorizontal: 14 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: TAIR.card },
  rowImg: { width: 40, height: 40, borderRadius: 8, backgroundColor: TAIR.divider },
  rowImgPh: { alignItems: "center", justifyContent: "center" },
  rowIconBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: TAIR.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: TAIR.divider },
  rowTitle: { color: TAIR.emerald, fontSize: 14, fontWeight: "800", textAlign: "right" },
  rowMeta: { color: TAIR.textSoft, fontSize: 11, marginTop: 2, textAlign: "right" },
  deleteBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center" },
  trustBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: TAIR.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: TAIR.gold },
  banBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: TAIR.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: TAIR.divider },
  modBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F5EED9", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: TAIR.emerald },
  deleteBtnSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F5C7C2" },
  trustBadge: {
    flexDirection: "row-reverse", alignItems: "center", gap: 3,
    backgroundColor: TAIR.emerald, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 999,
  },
  trustBadgeText: { color: TAIR.gold, fontSize: 9, fontWeight: "800" },
  uidChip: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    backgroundColor: "#F0EAD8", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, marginTop: 4, alignSelf: "flex-end",
    borderWidth: 0.5, borderColor: TAIR.divider,
  },
  uidText: { color: TAIR.textSoft, fontSize: 10, fontWeight: "700" },
  resolveBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: TAIR.emerald },
  resolveBtnText: { color: TAIR.gold, fontSize: 12, fontWeight: "800" },
  resolvedBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#D6E5DA" },
  resolvedText: { color: TAIR.emerald, fontSize: 11, fontWeight: "800" },
  miniTag: {
    backgroundColor: "#F0EAD8", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, fontSize: 11, color: TAIR.emerald, fontWeight: "800",
  },
  approveBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: TAIR.emerald, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: TAIR.gold,
  },
  approveText: { color: TAIR.gold, fontWeight: "900", fontSize: 13 },
  rejectBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#FDECEA", paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "#8B3A2F",
  },
  rejectText: { color: "#8B3A2F", fontWeight: "900", fontSize: 13 },
});
