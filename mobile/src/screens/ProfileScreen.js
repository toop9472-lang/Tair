// طير — Tair Profile screen (mirrors /app/frontend/src/tair/ProfileScreen.jsx)
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ImageBackground,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  listingsApi,
  tripsApi,
  ratingsApi,
  profileApi,
  adminExtApi,
} from "../services/tairApi";
import { TAIR_BANNER_IMAGE } from "../constants/tairDesign";
import { ErrorState, ListSkeleton } from "../components/TairUI";
import { TAIR_ELEVATION } from "../constants/tairTheme";
import { shareAppPayload, shareInApp } from "../services/shareContent";
import { HeaderSheen } from "../components/TairPolish";

const API_BASE =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "";
const resolveMediaUrl = (u) => {
  if (!u || typeof u !== "string") return "";
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
};

const TEAL = "#1B3D2F";        // Tair emerald
const TEAL_SOFT = "#F7F1E8";   // Tair cream
const BORDER = "#E6DCC8";      // Tair divider
const TAIR_GOLD = "#C6A15B";

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={TEAL} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, color = "#0F241C", testID }) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
      testID={testID}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-back" size={18} color="#8A7B66" />
    </TouchableOpacity>
  );
}

const MOD_BADGES = [
  { id: "general", label: "مشرف عام", icon: "shield-checkmark", bg: "#1B3D2F", fg: "#C6A15B" },
  { id: "clinic_admin", label: "مدير العيادة", icon: "medkit", bg: "#C6A15B", fg: "#1B3D2F" },
  { id: "clinic", label: "مشرف عيادة", icon: "medkit-outline", bg: "#1B3D2F", fg: "#C6A15B" },
  { id: "market", label: "مشرف السوق", icon: "storefront-outline", bg: "#1B3D2F", fg: "#C6A15B" },
  { id: "community", label: "مشرف المجتمع", icon: "people-outline", bg: "#1B3D2F", fg: "#C6A15B" },
];

function visibleModBadges(scopes) {
  if (!scopes?.length) return [];
  if (scopes.includes("general")) return MOD_BADGES.filter((b) => b.id === "general");
  return MOD_BADGES.filter((b) => scopes.includes(b.id) && !(b.id === "clinic" && scopes.includes("clinic_admin")));
}

function modPanelLabel(scopes) {
  if (scopes.includes("general") || scopes.filter((s) => s !== "clinic").length > 1) return "لوحة المشرف";
  if (scopes.includes("clinic_admin") || scopes.includes("clinic")) return "لوحة إدارة العيادة";
  if (scopes.includes("market")) return "لوحة مشرف السوق";
  if (scopes.includes("community")) return "لوحة مشرف المجتمع";
  return "لوحة المشرف";
}

export default function ProfileScreen({
  user,
  onOpenSettings,
  onOpenSupport,
  onLogout,
  onNavigate,
  onEditListing,
  onEditTrip,
  onRefreshUser,
  onUserChanged,
}) {
  const uid = user?.id || user?.user_id;
  const isGuest = !!user?.isGuest || String(uid || "").startsWith("guest_");
  const isAdmin = !!user?.is_admin || user?.role === "admin" || user?.role === "super_admin";
  const [myScopes, setMyScopes] = useState([]);
  const modBadges = isAdmin ? [] : visibleModBadges(myScopes);
  const hasModTools = !isAdmin && modBadges.length > 0;

  const [tab, setTab] = useState("listings");
  const [myListings, setMyListings] = useState([]);
  const [myTrips, setMyTrips] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [avg, setAvg] = useState({ seller: 0, carrier: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editBio, setEditBio] = useState(user?.bio || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [editWhatsapp, setEditWhatsapp] = useState(user?.whatsapp || "");
  // Verification request modal state
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [vfShop, setVfShop] = useState("");
  const [vfReason, setVfReason] = useState("");
  const [vfDocs, setVfDocs] = useState([]);
  const [vfSubmitting, setVfSubmitting] = useState(false);
  const pickVerifyDoc = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7, allowsEditing: false,
      });
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      const form = new FormData();
      form.append("file", { uri: a.uri, name: "doc.jpg", type: a.mimeType || "image/jpeg" });
      form.append("user_id", uid || "");
      const { default: apiSvc } = await import("../services/api");
      const resp = await apiSvc.fetch("/api/listings/upload-image", { method: "POST", body: form });
      if (!resp?.ok) throw new Error("upload failed");
      const j = await resp.json();
      const url = j?.url || j?.image_url;
      if (url) setVfDocs((prev) => [...prev, url]);
    } catch (e) { Alert.alert("خطأ", "فشل رفع الوثيقة"); }
  };
  const submitVerification = async () => {
    const reason = (vfReason || "").trim();
    if (reason.length < 10) {
      return Alert.alert("تنبيه", "اذكر سبب التوثيق بشكل واضح (10 أحرف على الأقل)");
    }
    setVfSubmitting(true);
    try {
      const { adminExtApi } = await import("../services/tairApi");
      await adminExtApi.verificationRequest({
        shop_name: vfShop.trim() || "",
        reason,
        supporting_docs: vfDocs,
      }, uid);
      Alert.alert("✔ تم الإرسال", "تم إرسال طلبك. سيراجعه فريق طير قريباً");
      setVerifyOpen(false);
      setVfShop(""); setVfReason(""); setVfDocs([]);
    } catch (e) {
      Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر الإرسال");
    } finally { setVfSubmitting(false); }
  };
  const [localAvatar, setLocalAvatar] = useState(user?.avatar || null);
  const [localBg, setLocalBg] = useState(user?.profile_bg_url || null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (isGuest || !uid) {
      setLoading(false);
      return;
    }
    try {
      // Always refresh the user identity first so name/avatar/bio/bg stay accurate
      if (onRefreshUser) {
        try { await onRefreshUser(); } catch {}
      }
      const [ls, tr, rs] = await Promise.all([
        listingsApi.bySeller(uid, true).catch(() => []),
        tripsApi.byCarrier(uid, true).catch(() => []),
        ratingsApi.forUser(uid).catch(() => []),
      ]);
      setMyListings(Array.isArray(ls) ? ls : ls?.items || []);
      setMyTrips(Array.isArray(tr) ? tr : tr?.items || []);
      const ratingsArr = Array.isArray(rs) ? rs : rs?.items || [];
      setRatings(ratingsArr);
      const bySeller = ratingsArr.filter((r) => r.rated_role === "seller");
      const byCarrier = ratingsArr.filter((r) => r.rated_role === "carrier");
      const avgOf = (arr) =>
        arr.length
          ? Math.round((arr.reduce((s, r) => s + (r.stars || 0), 0) / arr.length) * 10) / 10
          : 0;
      setAvg({ seller: avgOf(bySeller), carrier: avgOf(byCarrier) });
      setLoadError(null);
    } catch (e) {
      setLoadError(e?.message || "تعذّر تحميل الحساب");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid, isGuest]);

  // Refresh edit-modal fields when user prop updates (e.g. after refreshUser)
  useEffect(() => {
    setEditName(user?.name || "");
    setEditBio(user?.bio || "");
    setEditPhone(user?.phone || "");
    setEditWhatsapp(user?.whatsapp || "");
    setLocalAvatar(user?.avatar || null);
    setLocalBg(user?.profile_bg_url || null);
  }, [user?.name, user?.bio, user?.phone, user?.whatsapp, user?.avatar, user?.profile_bg_url]);

  useEffect(() => {
    load();
  }, [load]);

  // جلب صلاحيات المشرف (clinic/clinic_admin/general) لتفعيل زر لوحة المدير
  useEffect(() => {
    if (!uid || isGuest) return;
    (async () => {
      try {
        const r = await adminExtApi.myScopes(uid);
        setMyScopes(r?.scopes || []);
      } catch {
        setMyScopes([]);
      }
    })();
  }, [uid, isGuest]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const pickAndUpload = async (kind) => {
    if (isGuest) {
      Alert.alert("تسجيل الدخول مطلوب", "يجب تسجيل الدخول لتعديل ملفك");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("إذن مطلوب", "امنح إذن الوصول للصور");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: kind === "avatar" ? [1, 1] : [16, 9],
      quality: 0.8,
    });
    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setSaving(true);
    try {
      if (kind === "avatar") {
        const r = await profileApi.uploadAvatar(uid, uri);
        const newUrl = r.avatar_url || r.url;
        setLocalAvatar(newUrl);
        try {
          const saved = await AsyncStorage.getItem("saqr_user");
          const parsed = saved ? JSON.parse(saved) : {};
          await AsyncStorage.setItem("saqr_user", JSON.stringify({ ...(parsed || {}), avatar: newUrl }));
          if (user) user.avatar = newUrl;
        } catch {}
        if (onUserChanged) onUserChanged({ avatar: newUrl });
        Alert.alert("تم", "تم تحديث صورة العرض");
      } else {
        const r = await profileApi.uploadProfileBg(uid, uri);
        const newBg = r.profile_bg_url || r.url;
        setLocalBg(newBg);
        try {
          const saved = await AsyncStorage.getItem("saqr_user");
          const parsed = saved ? JSON.parse(saved) : {};
          await AsyncStorage.setItem("saqr_user", JSON.stringify({ ...(parsed || {}), profile_bg_url: newBg }));
          if (user) user.profile_bg_url = newBg;
        } catch {}
        if (onUserChanged) onUserChanged({ profile_bg_url: newBg });
        Alert.alert("تم", "تم تحديث خلفية المتجر");
      }
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر الرفع");
    } finally {
      setSaving(false);
    }
  };

  const saveNameBio = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      Alert.alert("خطأ", "الاسم قصير جداً");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: editName.trim(),
        bio: editBio.trim(),
        phone: editPhone.trim(),
        whatsapp: editWhatsapp.trim(),
      };
      await profileApi.update(uid, payload);
      // Persist updated user in AsyncStorage so name stays after refresh
      try {
        const saved = await AsyncStorage.getItem("saqr_user");
        const parsed = saved ? JSON.parse(saved) : {};
        const updated = {
          ...(parsed || {}),
          ...payload,
        };
        await AsyncStorage.setItem("saqr_user", JSON.stringify(updated));
        // Mutate the current user object for immediate UI
        if (user) Object.assign(user, payload);
      } catch {}
      if (onUserChanged) onUserChanged(payload);
      Alert.alert("تم", "تم حفظ بيانات المتجر");
      setEditOpen(false);
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const initial = ((user?.name || "ز").charAt(0) || "").toUpperCase();
  const avatarUrl = localAvatar || user?.avatar;
  const bgUrl = localBg || user?.profile_bg_url;

  return (
    <View style={styles.container}>
      {/* Full-screen merchant identity canvas — NO top bar */}
      <ImageBackground
        source={{ uri: resolveMediaUrl(bgUrl) || TAIR_BANNER_IMAGE }}
        style={styles.identityBanner}
      >
        {/* Bottom-to-top scrim so text is readable */}
        <View style={styles.bannerScrim} />
        <HeaderSheen />
        <View style={styles.goldRule} pointerEvents="none" />

        {/* Identity content stacked at bottom */}
        <View style={styles.identityContent}>
          <TouchableOpacity
            style={styles.avatarLarge}
            onPress={() => !isGuest && pickAndUpload("avatar")}
            disabled={isGuest || saving}
            testID="profile-avatar-edit"
          >
            {avatarUrl ? (
              <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={styles.avatarLargeImage} />
            ) : (
              <Text style={styles.avatarLargeText}>{initial}</Text>
            )}
            {!isGuest && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.identityName}>{user?.name || "زائر"}</Text>
          {uid && !isGuest ? (
            <TouchableOpacity
              onPress={async () => {
                try {
                  const Clipboard = require("expo-clipboard");
                  await Clipboard.setStringAsync(String(uid));
                  Alert.alert("✔", "تم نسخ المعرّف");
                } catch { Alert.alert("المعرّف", String(uid)); }
              }}
              activeOpacity={0.75}
              style={{
                flexDirection: "row-reverse", alignItems: "center", gap: 5,
                alignSelf: "center", marginTop: 4,
                backgroundColor: "rgba(255,255,255,0.14)",
                paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
                borderWidth: 1, borderColor: "rgba(198,161,91,0.5)",
              }}
              testID="profile-user-id-chip"
            >
              <Ionicons name="copy-outline" size={11} color="#FEEDC2" />
              <Text style={{ color: "#FEEDC2", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 }}>
                ID: {String(uid).length > 24 ? String(uid).slice(0, 24) + "…" : String(uid)}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.identityBadges}>
            {user?.is_verified_shop && (
              <View style={styles.identityBadge}>
                <Ionicons name="storefront" size={11} color="#fff" />
                <Text style={styles.identityBadgeText}>متجر موثوق</Text>
              </View>
            )}
            {user?.is_verified_carrier && (
              <View style={styles.identityBadge}>
                <Ionicons name="car" size={11} color="#fff" />
                <Text style={styles.identityBadgeText}>موصل معتمد</Text>
              </View>
            )}
            {isAdmin && (
              <View style={[styles.identityBadge, { backgroundColor: "rgba(220,38,38,0.4)", borderColor: "rgba(255,255,255,0.35)" }]}>
                <Ionicons name="shield-checkmark" size={11} color="#fff" />
                <Text style={styles.identityBadgeText}>مدير</Text>
              </View>
            )}
            {modBadges.map((b) => (
              <View key={b.id} style={[styles.identityBadge, { backgroundColor: b.bg, borderColor: b.fg }]} testID={`mod-badge-${b.id}`}>
                <Ionicons name={b.icon} size={11} color={b.fg} />
                <Text style={[styles.identityBadgeText, { color: b.fg }]}>{b.label}</Text>
              </View>
            ))}
          </View>

          {/* Inline identity controls (edit + settings) — part of the identity, not a top bar */}
          <View style={styles.identityControls}>
            {!isGuest && (
              <TouchableOpacity
                style={styles.identityCtrlBtn}
                onPress={() => setEditOpen(true)}
                testID="profile-edit-btn"
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.identityCtrlText}>تعديل هويتي</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.identityCtrlBtn, styles.identityCtrlSecondary]}
              onPress={onOpenSettings}
              testID="profile-settings-btn"
            >
              <Ionicons name="settings-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Small email/status under banner */}
        <View style={styles.emailBlock}>
          <Text style={styles.emailSmall}>
            {isGuest ? "حساب زائر — سجّل للحصول على كامل الميزات" : user?.email || user?.phone || uid}
          </Text>
        </View>

        {isGuest && (
          <TouchableOpacity style={styles.signInBtn} onPress={onLogout} testID="signin-cta">
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.signInBtnText}>إنشاء حساب / تسجيل الدخول</Text>
          </TouchableOpacity>
        )}

        {/* Stats */}
        {!isGuest && (
          <View style={styles.statsRow}>
            <Stat icon="pricetags" label="إعلانات" value={myListings.length} />
            <Stat icon="car" label="رحلات" value={myTrips.length} />
            <Stat icon="star" label="بائع" value={avg.seller > 0 ? avg.seller : "—"} />
            <Stat icon="star" label="موصّل" value={avg.carrier > 0 ? avg.carrier : "—"} />
          </View>
        )}

        {/* Tabs */}
        {!isGuest && (
          <>
            <View style={styles.tabsRow}>
              {[
                { id: "listings", label: `إعلاناتي (${myListings.length})` },
                { id: "trips", label: `رحلاتي (${myTrips.length})` },
                { id: "ratings", label: `تقييماتي (${ratings.length})` },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  style={[styles.tab, tab === t.id && styles.tabActive]}
                  testID={`profile-tab-${t.id}`}
                >
                  <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading ? (
              <ListSkeleton count={3} />
            ) : loadError && myListings.length === 0 && myTrips.length === 0 ? (
              <ErrorState title="تعذّر تحميل حسابك" subtitle="تحقق من الاتصال ثم أعد المحاولة." onRetry={load} />
            ) : (
              <View style={{ gap: 8, marginBottom: 20 }}>
                {tab === "listings" &&
                  (myListings.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>لم تنشر إعلانات بعد.</Text>
                    </View>
                  ) : (
                    myListings.map((l) => (
                      <View key={l.listing_id} style={styles.rowCard} testID={`my-listing-${l.listing_id}`}>
                        <View style={styles.rowThumb}>
                          {l.cover_image ? (
                            <Image source={{ uri: resolveMediaUrl(l.cover_image) }} style={styles.thumbImg} />
                          ) : (
                            <Ionicons name="image" size={22} color="#cbd5e1" />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{l.title}</Text>
                          <Text style={styles.rowMeta}>{l.price_sar} ر.س · {l.status}</Text>
                        </View>
                        <View style={styles.rowActions}>
                          <TouchableOpacity
                            style={styles.editIconBtn}
                            onPress={() => onEditListing && onEditListing(l)}
                            testID={`edit-listing-${l.listing_id}`}
                          >
                            <Ionicons name="create-outline" size={18} color="#1B3D2F" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteIconBtn}
                            onPress={() =>
                              Alert.alert(
                                "حذف الإعلان",
                                `هل أنت متأكد من حذف "${l.title}"؟`,
                                [
                                  { text: "إلغاء", style: "cancel" },
                                  {
                                    text: "حذف",
                                    style: "destructive",
                                    onPress: async () => {
                                      try {
                                        await listingsApi.remove(l.listing_id, uid);
                                        setMyListings((prev) => prev.filter((x) => x.listing_id !== l.listing_id));
                                        Alert.alert("تم", "تم حذف الإعلان");
                                      } catch (e) {
                                        Alert.alert("خطأ", e?.message || "تعذّر الحذف");
                                      }
                                    },
                                  },
                                ],
                              )
                            }
                            testID={`delete-listing-${l.listing_id}`}
                          >
                            <Ionicons name="trash-outline" size={18} color="#8B3A2F" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ))}

                {tab === "trips" &&
                  (myTrips.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>لم تسجّل رحلات بعد.</Text>
                    </View>
                  ) : (
                    myTrips.map((t) => (
                      <View key={t.trip_id} style={styles.rowCard} testID={`my-trip-${t.trip_id}`}>
                        <View style={styles.rowThumb}>
                          <Ionicons name={t.is_direct ? "flash" : "car"} size={22} color={TEAL} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {t.from_city} ← {(t.waypoints || []).length > 0 ? `[${t.waypoints.join(" ← ")}] ← ` : ""}{t.to_city}
                          </Text>
                          <Text style={styles.rowMeta}>
                            {new Date(t.depart_at).toLocaleDateString("ar-SA")} · {t.status} {t.is_direct ? "· مباشرة" : ""}
                          </Text>
                        </View>
                        <View style={styles.rowActions}>
                          <TouchableOpacity
                            style={styles.editIconBtn}
                            onPress={() => onEditTrip && onEditTrip(t)}
                            testID={`edit-trip-${t.trip_id}`}
                          >
                            <Ionicons name="create-outline" size={18} color="#1B3D2F" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteIconBtn}
                            onPress={() =>
                              Alert.alert(
                                "حذف الرحلة",
                                `هل تريد حذف رحلة ${t.from_city} → ${t.to_city}؟`,
                                [
                                  { text: "إلغاء", style: "cancel" },
                                  {
                                    text: "حذف",
                                    style: "destructive",
                                    onPress: async () => {
                                      try {
                                        await tripsApi.cancel(t.trip_id, uid);
                                        setMyTrips((prev) => prev.filter((x) => x.trip_id !== t.trip_id));
                                        Alert.alert("تم", "تم حذف الرحلة");
                                      } catch (e) {
                                        Alert.alert("خطأ", e?.message || "تعذّر الحذف");
                                      }
                                    },
                                  },
                                ],
                              )
                            }
                            testID={`delete-trip-${t.trip_id}`}
                          >
                            <Ionicons name="trash-outline" size={18} color="#8B3A2F" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ))}

                {tab === "ratings" &&
                  (ratings.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>لا يوجد تقييمات بعد.</Text>
                    </View>
                  ) : (
                    ratings.map((r, i) => (
                      <View key={r.rating_id || i} style={styles.ratingCard}>
                        <View style={styles.ratingHead}>
                          <View style={styles.starsRow}>
                            {[0, 1, 2, 3, 4].map((s) => (
                              <Ionicons
                                key={s}
                                name={s < (r.stars || 0) ? "star" : "star-outline"}
                                size={14}
                                color="#facc15"
                              />
                            ))}
                          </View>
                          <Text style={styles.ratingRole}>
                            {r.rated_role === "seller" ? "كبائع" : "كناقل"}
                          </Text>
                        </View>
                        {r.comment ? <Text style={styles.ratingComment}>{r.comment}</Text> : null}
                      </View>
                    ))
                  ))}
              </View>
            )}
          </>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          {isAdmin && (
            <MenuItem
              icon="shield-checkmark"
              label="لوحة المدير — صلاحيات كاملة"
              color="#8B3A2F"
              onPress={() => onNavigate?.("admin_panel")}
              testID="menu-admin-panel"
            />
          )}
          {hasModTools && (
            <MenuItem
              icon="shield-half-outline"
              label={modPanelLabel(myScopes)}
              color="#1B3D2F"
              onPress={() => onNavigate?.("admin_panel")}
              testID="menu-mod-panel"
            />
          )}
          {!isGuest && (
            <>
              <MenuItem
                icon="clipboard-outline"
                label="طلباتي"
                onPress={() => onNavigate?.("orders")}
                testID="menu-orders"
              />
              <MenuItem
                icon="share-social-outline"
                label="شارك التطبيق"
                color="#C6A15B"
                onPress={() => shareInApp(shareAppPayload())}
                testID="menu-share-app"
              />
              <MenuItem
                icon="business"
                label="إدارة متجري (احترافي)"
                color="#3D6B54"
                onPress={() => onNavigate?.("storefront_manager")}
                testID="menu-storefront-manager"
              />
              <MenuItem
                icon="cube-outline"
                label="سوق الجملة والموردون"
                onPress={() => onNavigate?.("wholesale")}
                testID="menu-wholesale"
              />
              <MenuItem
                icon="bar-chart-outline"
                label="تحليلات المبيعات"
                onPress={() => onNavigate?.("seller_analytics")}
                testID="menu-analytics"
              />
              <MenuItem
                icon="ribbon-outline"
                label="قصص النجاح"
                onPress={() => onNavigate?.("success_stories")}
                testID="menu-stories"
              />
            </>
          )}
          {!isGuest && !user?.is_verified_shop && !user?.trusted_by_admin && (
            <MenuItem
              icon="ribbon"
              label="طلب توثيق المتجر"
              color="#C6A15B"
              onPress={() => setVerifyOpen(true)}
              testID="menu-request-verification"
            />
          )}
          <MenuItem
            icon="help-circle-outline"
            label="الدعم الفني"
            onPress={onOpenSupport}
            testID="menu-support"
          />
          <MenuItem
            icon="settings-outline"
            label="الإعدادات"
            onPress={onOpenSettings}
            testID="menu-settings"
          />
          {!isGuest && (
            <MenuItem
              icon="log-out-outline"
              label="تسجيل الخروج"
              color="#8B3A2F"
              onPress={onLogout}
              testID="menu-logout"
            />
          )}
          {isGuest && (
            <MenuItem
              icon="log-in-outline"
              label="تسجيل الدخول / إنشاء حساب"
              color={TEAL}
              onPress={onLogout}
              testID="menu-signin"
            />
          )}
        </View>

        <Text style={styles.versionText}>طير • Tair — الإصدار ٨.٣.٢</Text>
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            طير منصة وسيطة فقط — طير غير مسؤولة عن صحة الإعلانات أو المعاملات بين الأطراف.
          </Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <TouchableOpacity onPress={() => setEditOpen(false)}>
                <Ionicons name="close" size={24} color="#6B5E4A" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تعديل المتجر</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView>
              <TouchableOpacity
                style={styles.bgPicker}
                onPress={() => pickAndUpload("bg")}
                disabled={saving}
                testID="profile-bg-edit"
              >
                {bgUrl ? (
                  <ImageBackground source={{ uri: resolveMediaUrl(bgUrl) }} style={styles.bgPreview} imageStyle={{ borderRadius: 12 }}>
                    <View style={styles.bgOverlayDark} />
                    <Ionicons name="camera" size={22} color="#fff" />
                    <Text style={styles.bgLabel}>تغيير خلفية المتجر</Text>
                  </ImageBackground>
                ) : (
                  <View style={[styles.bgPreview, { backgroundColor: "#f0fdfa" }]}>
                    <Ionicons name="image-outline" size={26} color="#1B3D2F" />
                    <Text style={[styles.bgLabel, { color: "#1B3D2F" }]}>اختر خلفية للمتجر</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>الاسم / اسم المتجر</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="اكتب اسم متجرك"
                placeholderTextColor="#8A7B66"
                testID="profile-edit-name"
              />

              <Text style={styles.fieldLabel}>نبذة (اختياري)</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: "top" }]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="اكتب نبذة عن متجرك (طيور، تخصصات، مواعيد…)"
                placeholderTextColor="#8A7B66"
                multiline
                testID="profile-edit-bio"
              />

              <Text style={styles.fieldLabel}>رقم الجوال (للاتصال)</Text>
              <TextInput
                style={styles.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="05xxxxxxxx"
                placeholderTextColor="#8A7B66"
                keyboardType="phone-pad"
                testID="profile-edit-phone"
              />

              <Text style={styles.fieldLabel}>رقم واتساب (يظهر في الإعلان والرحلة والمتجر)</Text>
              <TextInput
                style={styles.input}
                value={editWhatsapp}
                onChangeText={setEditWhatsapp}
                placeholder="05xxxxxxxx"
                placeholderTextColor="#8A7B66"
                keyboardType="phone-pad"
                testID="profile-edit-whatsapp"
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={saveNameBio}
                disabled={saving}
                testID="profile-edit-save"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Verification Request Modal */}
      <Modal visible={verifyOpen} transparent animationType="slide" onRequestClose={() => setVerifyOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: "88%" }}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2 }} />
            </View>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Ionicons name="ribbon" size={22} color="#C6A15B" />
              <Text style={{ fontSize: 18, fontWeight: "900", color: "#1B3D2F" }}>طلب توثيق المتجر</Text>
            </View>
            <Text style={{ color: "#6B5E4A", fontSize: 12, textAlign: "right", marginBottom: 14 }}>
              كل الحقول اختيارية باستثناء سبب التوثيق. رفع الوثائق (الهوية، السجل التجاري، الرخصة) يزيد فرصة القبول.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, color: "#1B3D2F", fontWeight: "800", textAlign: "right", marginBottom: 4 }}>اسم المتجر (اختياري)</Text>
              <TextInput
                value={vfShop} onChangeText={setVfShop}
                placeholder="مثال: متجر طير الخليج"
                placeholderTextColor="#8A7B66"
                textAlign="right"
                style={{ backgroundColor: "#F7F1E8", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 14, height: 46, marginBottom: 12, color: "#1B3D2F" }}
                testID="verify-shop-name"
              />
              <Text style={{ fontSize: 12, color: "#1B3D2F", fontWeight: "800", textAlign: "right", marginBottom: 4 }}>
                سبب طلب التوثيق <Text style={{ color: "#8B3A2F" }}>*</Text>
              </Text>
              <TextInput
                value={vfReason} onChangeText={setVfReason}
                placeholder="اذكر تخصصك، خبرتك، عدد سنوات النشاط..."
                placeholderTextColor="#8A7B66"
                textAlign="right"
                multiline
                style={{ backgroundColor: "#F7F1E8", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 14, paddingVertical: 12, minHeight: 90, textAlignVertical: "top", marginBottom: 12, color: "#1B3D2F" }}
                testID="verify-reason"
              />
              <Text style={{ fontSize: 12, color: "#1B3D2F", fontWeight: "800", textAlign: "right", marginBottom: 6 }}>
                الوثائق المرفقة (اختياري — هوية / سجل تجاري / رخصة)
              </Text>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {vfDocs.map((u, i) => (
                  <View key={i} style={{ width: 78, height: 78, borderRadius: 10, overflow: "hidden", position: "relative" }}>
                    <Image source={{ uri: u }} style={{ width: "100%", height: "100%" }} />
                    <TouchableOpacity
                      onPress={() => setVfDocs((prev) => prev.filter((_, x) => x !== i))}
                      style={{ position: "absolute", top: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={pickVerifyDoc}
                  style={{ width: 78, height: 78, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C6A15B", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFBF3" }}
                  testID="verify-add-doc"
                >
                  <Ionicons name="camera-outline" size={22} color="#C6A15B" />
                  <Text style={{ color: "#C6A15B", fontSize: 10, fontWeight: "700", marginTop: 4 }}>إضافة</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={submitVerification}
                  disabled={vfSubmitting}
                  style={{ flex: 1, backgroundColor: "#1B3D2F", borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row-reverse", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#C6A15B", opacity: vfSubmitting ? 0.7 : 1 }}
                  testID="verify-submit"
                >
                  {vfSubmitting ? <ActivityIndicator color="#C6A15B" size="small" /> : <Ionicons name="send" size={16} color="#C6A15B" />}
                  <Text style={{ color: "#C6A15B", fontWeight: "900", fontSize: 14 }}>
                    {vfSubmitting ? "جاري الإرسال..." : "إرسال الطلب"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setVerifyOpen(false)}
                  style={{ paddingHorizontal: 22, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E5E7EB" }}
                >
                  <Text style={{ color: "#475569", fontWeight: "800", fontSize: 14 }}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  content: { paddingHorizontal: 14, paddingBottom: 120, paddingTop: 4 },
  header: {
    alignItems: "center",
    marginTop: 0,
    marginBottom: 0,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: TEAL_SOFT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
  },
  avatarImage: { width: 84, height: 84, borderRadius: 42 },
  avatarText: { color: TEAL, fontSize: 32, fontWeight: "900" },
  name: { color: "#0F241C", fontSize: 20, fontWeight: "900", marginTop: 10 },
  email: { color: "#6B5E4A", fontSize: 12, marginTop: 4, textAlign: "center" },

  verifiedBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: TEAL_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  verifiedText: { color: TEAL, fontSize: 11, fontWeight: "800" },

  signInBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  signInBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  statsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    marginBottom: 16,
  },
  stat: {
    flex: 1,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    ...TAIR_ELEVATION.hair,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TEAL_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statValue: { color: "#0F241C", fontSize: 16, fontWeight: "900" },
  statLabel: { color: "#6B5E4A", fontSize: 10, fontWeight: "700", marginTop: 2 },

  tabsRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#FFFDF8",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: { backgroundColor: TEAL },
  tabText: { color: "#6B5E4A", fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: "#C6A15B" },

  emptyCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  emptyText: { color: "#6B5E4A", fontSize: 13 },

  rowCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
    ...TAIR_ELEVATION.hair,
  },
  rowThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: { width: 48, height: 48 },
  rowTitle: { color: "#0F241C", fontSize: 13.5, fontWeight: "800", textAlign: "right" },
  rowMeta: { color: "#6B5E4A", fontSize: 11, fontWeight: "600", textAlign: "right", marginTop: 2 },
  rowActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3EDE2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },


  ratingCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  ratingHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  starsRow: { flexDirection: "row-reverse", gap: 1 },
  ratingRole: { color: TEAL, fontSize: 11, fontWeight: "800" },
  ratingComment: { color: "#334155", fontSize: 13, lineHeight: 20, textAlign: "right" },

  menuSection: {
    backgroundColor: "#FFFDF8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginTop: 8,
    ...TAIR_ELEVATION.hair,
  },
  menuItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "700", textAlign: "right" },

  versionText: {
    color: "#8A6A2E",
    fontSize: 11,
    textAlign: "center",
    marginTop: 18,
  },
  disclaimerBox: {
    marginTop: 10, marginHorizontal: 20, marginBottom: 30,
    padding: 12, borderRadius: 12,
    backgroundColor: "#FFFDF8",
    borderWidth: 1, borderColor: "#E6DCC8",
  },
  disclaimerText: {
    color: "#6B5E4A", fontSize: 11, lineHeight: 18, textAlign: "center", fontWeight: "600",
  },
  identityBanner: {
    height: 340,
    position: "relative",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  goldRule: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 0,
    height: 2,
    backgroundColor: TAIR_GOLD,
    opacity: 0.85,
    zIndex: 4,
  },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,36,28,0.38)",
  },
  identityContent: {
    alignItems: "center",
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 60,
    zIndex: 4,
  },
  identityControls: {
    marginTop: 14,
    flexDirection: "row-reverse",
    gap: 8,
    alignItems: "center",
  },
  identityCtrlBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  identityCtrlSecondary: {
    paddingHorizontal: 12,
    width: 40,
    justifyContent: "center",
  },
  identityCtrlText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  avatarLarge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
    shadowColor: "#0F241C",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: 10,
  },
  avatarLargeImage: { width: 100, height: 100, borderRadius: 50 },
  avatarLargeText: { color: TEAL, fontSize: 40, fontWeight: "900" },
  identityName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  identityBadges: {
    flexDirection: "row-reverse",
    gap: 6,
    marginTop: 8,
  },
  identityBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15,23,42,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  identityBadgeText: { color: "#ffffff", fontSize: 10.5, fontWeight: "800" },
  emailBlock: {
    alignItems: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  emailSmall: {
    fontSize: 12,
    color: "#6B5E4A",
    fontWeight: "600",
    textAlign: "center",
  },
  avatarEditBadge: {
    position: "absolute", right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#1B3D2F", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 18, maxHeight: "85%",
  },
  modalHead: {
    flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0F241C" },
  bgPicker: { marginBottom: 14 },
  bgPreview: {
    width: "100%", height: 130, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden",
  },
  bgOverlayDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  bgLabel: { color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 6 },
  fieldLabel: { fontSize: 12, color: "#1B3D2F", fontWeight: "800", marginBottom: 6, textAlign: "right" },
  input: {
    backgroundColor: "#F7F1E8",
    borderWidth: 1, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 12,
    fontSize: 14, color: "#0F241C",
    textAlign: "right", marginBottom: 14,
  },
  saveBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#1B3D2F",
    paddingVertical: 14, borderRadius: 14, marginTop: 4, marginBottom: 20,
  },
  saveBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
