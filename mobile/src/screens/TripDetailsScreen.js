// طير — Trip Details
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { tripsApi } from "../services/tairApi";
import { shareInApp } from "../services/shareContent";
import { DetailSkeleton, ErrorState } from "../components/TairUI";

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

const statusColor = (s) =>
  ({
    scheduled: "#0891b2",
    departed: "#eab308",
    in_transit: "#f59e0b",
    arrived: "#2F6B45",
    completed: "#064e3b",
    cancelled: "#8B3A2F",
  }[s] || "#6B5E4A");
const statusLabel = (s) =>
  ({
    scheduled: "مجدولة",
    departed: "انطلقت",
    in_transit: "في الطريق",
    arrived: "وصلت",
    completed: "مكتملة",
    cancelled: "ملغاة",
  }[s] || s);

export default function TripDetailsScreen({ user, tripId, onBack, onContactCarrier, onOpenCarrier }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [trip, setTrip] = useState(null);

  const loadTrip = useCallback(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    tripsApi
      .get(tripId)
      .then((doc) => {
        if (!alive) return;
        setTrip(doc);
      })
      .catch((e) => {
        if (!alive) return;
        setTrip(null);
        setLoadError(e?.message || "تعذّر تحميل الرحلة");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tripId]);

  useEffect(() => loadTrip(), [loadTrip]);

  if (loading) {
    return (
      <View style={styles.container}>
        <DetailSkeleton />
      </View>
    );
  }
  if (!trip) {
    return (
      <View style={[styles.container, styles.center]}>
        <ErrorState
          title={loadError ? "تعذّر فتح الرحلة" : "الرحلة غير موجودة"}
          subtitle={loadError ? "تحقق من الاتصال ثم أعد المحاولة." : "ربما تم حذفها أو انتهت."}
          onRetry={loadError ? loadTrip : undefined}
        />
        <TouchableOpacity style={styles.linkBtn} onPress={onBack}>
          <Text style={styles.linkText}>عودة للرحلات</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dt = trip.depart_at ? new Date(trip.depart_at) : null;
  const carrierName = trip.carrier_name || "موصل طير";
  const rating = trip.carrier_rating_avg;
  const completed = trip.carrier_trips_completed || 0;
  const rawPhone = trip.carrier_whatsapp || trip.carrier_phone;
  const digits = rawPhone ? String(rawPhone).replace(/[^0-9]/g, "") : "";
  const hasWaypoints = Array.isArray(trip.waypoints) && trip.waypoints.length > 0;
  const isOwner = (user?.user_id || user?.id) === trip.carrier_id;

  const shareTrip = () => {
    const id = trip.trip_id || trip.id;
    if (!id) return;
    shareInApp({
      kind: "trip",
      id,
      title: `${trip.from_city || ""} ← ${trip.to_city || ""}`.trim(),
      lines: [
        dt ? dt.toLocaleString("ar-SA") : null,
        carrierName ? `الموصل: ${carrierName}` : null,
      ],
    });
  };

  const openWhatsapp = async () => {
    if (!digits) {
      Alert.alert("لا يوجد رقم", "لم يشارك الموصل رقم واتساب.");
      return;
    }
    const msg = encodeURIComponent(
      `السلام عليكم، أنا مهتم برحلتك من ${trip.from_city} إلى ${trip.to_city}`,
    );
    const nativeUrl = `whatsapp://send?phone=${digits}&text=${msg}`;
    const webUrl = `https://wa.me/${digits}?text=${msg}`;
    try {
      const canNative = await Linking.canOpenURL(nativeUrl);
      if (canNative) {
        return Linking.openURL(nativeUrl).catch(() => Linking.openURL(webUrl));
      }
    } catch {
      // إن تعذّر فحص التطبيق نكمل برابط الويب
    }
    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert(
        "تعذّر فتح واتساب",
        "قد يكون الرقم لا يستخدم واتساب أو أن التطبيق غير مثبّت على جهازك.",
      );
    }
  };

  const markArrived = async () => {
    Alert.alert(
      "إنهاء الرحلة",
      "هل وصلت وأتممت التسليم؟ لن تتمكن من تعديل الحالة بعد ذلك.",
      [
        { text: "لا", style: "cancel" },
        {
          text: "نعم، وصلت",
          style: "destructive",
          onPress: async () => {
            try {
              const uid = user?.user_id || user?.id;
              await tripsApi.updateStatus(trip.trip_id, uid, "arrived");
              const fresh = await tripsApi.get(trip.trip_id);
              setTrip(fresh);
              Alert.alert("تم", "تم تحديث حالة الرحلة إلى: وصلت ✅");
            } catch (e) {
              Alert.alert("خطأ", e?.message || "تعذّر تحديث الحالة");
            }
          },
        },
      ],
    );
  };

  const openCall = () => {
    if (!digits) {
      Alert.alert("لا يوجد رقم", "لم يشارك الموصل رقم اتصال.");
      return;
    }
    Linking.openURL(`tel:${digits}`).catch(() =>
      Alert.alert("خطأ", "تعذّر إجراء الاتصال"),
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Header */}
        <View style={[styles.hero, { backgroundColor: "#1B3D2F" }]}>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.heroIconBtn} onPress={onBack} testID="trip-back-btn">
              <Ionicons name="arrow-forward" size={22} color="#C6A15B" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroIconBtn} onPress={shareTrip} testID="trip-share-btn">
              <Ionicons name="share-social-outline" size={20} color="#C6A15B" />
            </TouchableOpacity>
          </View>

          <View style={styles.routeRow}>
            <View style={styles.cityBox}>
              <Text style={[styles.cityLabel, { color: "#E0C580" }]}>الانطلاق</Text>
              <Text style={[styles.cityName, { color: "#C6A15B" }]}>{trip.from_city}</Text>
            </View>
            <View style={styles.routeSep}>
              <View style={[styles.routeDot, { backgroundColor: "#C6A15B" }]} />
              <View style={[styles.routeLine, { backgroundColor: "#C6A15B" }]} />
              <Ionicons name="airplane" size={18} color="#C6A15B" />
              <View style={[styles.routeLine, { backgroundColor: "#C6A15B" }]} />
              <View style={[styles.routeDot, { backgroundColor: "#C6A15B" }]} />
            </View>
            <View style={styles.cityBox}>
              <Text style={[styles.cityLabel, { color: "#E0C580" }]}>الوصول</Text>
              <Text style={[styles.cityName, { color: "#C6A15B" }]}>{trip.to_city}</Text>
            </View>
          </View>

          <View style={styles.heroStatus}>
            <View style={[styles.heroStatusDot, { backgroundColor: "#C6A15B" }]} />
            <Text style={[styles.heroStatusText, { color: "#C6A15B" }]}>{statusLabel(trip.status)}</Text>
          </View>
        </View>

        {/* Carrier card */}
        <TouchableOpacity
          style={styles.carrierCard}
          onPress={() => onOpenCarrier && onOpenCarrier(trip.carrier_id)}
          activeOpacity={0.9}
          testID="trip-carrier-card"
        >
          <View style={styles.carrierAvatarWrap}>
            {trip.carrier_avatar ? (
              <Image source={{ uri: resolveMediaUrl(trip.carrier_avatar) }} style={styles.carrierAvatarImg} />
            ) : (
              <View style={styles.carrierAvatarPh}>
                <Text style={styles.carrierInitial}>{carrierName.charAt(0)}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.carrierNameRow}>
              <Text style={styles.carrierName} numberOfLines={1}>{carrierName}</Text>
              {trip.carrier_verified && (
                <View style={styles.verBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#1B3D2F" />
                  <Text style={styles.verText}>موصل موثوق</Text>
                </View>
              )}
            </View>
            <View style={styles.carrierMeta}>
              {rating != null && (
                <View style={styles.starRow}>
                  <Ionicons name="star" size={12} color="#facc15" />
                  <Text style={styles.starText}>{Number(rating).toFixed(1)}</Text>
                </View>
              )}
              <Text style={styles.carrierSub}>{completed} رحلة مكتملة</Text>
            </View>
          </View>
          <Ionicons name="chevron-back" size={18} color="#8A7B66" />
        </TouchableOpacity>

        {/* Detail cards */}
        <View style={styles.grid}>
          <DetailCard
            icon="calendar-outline"
            label="التاريخ والوقت"
            value={
              dt
                ? `${dt.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" })} · ${dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`
                : "-"
            }
            highlight
          />
          <DetailCard
            icon="car-outline"
            label="المركبة"
            value={trip.vehicle_type || "غير محدد"}
          />
          <DetailCard
            icon="cube-outline"
            label="الأقفاص"
            value={`${trip.available_cages || 0} من ${trip.total_cages || 0}`}
            highlight
          />
          {trip.has_ac ? (
            <DetailCard icon="snow-outline" label="التكييف" value="متوفر" color="#0891b2" />
          ) : null}
          {trip.is_direct ? (
            <DetailCard icon="flash" label="الرحلة" value="مباشرة" color="#d97706" />
          ) : null}
          {trip.accepts_sensitive ? (
            <DetailCard icon="heart-outline" label="الطيور الحساسة" value="مقبولة" color="#ec4899" />
          ) : null}
          {trip.price_hint_sar ? (
            <DetailCard
              icon="cash-outline"
              label="السعر الإرشادي"
              value={`${trip.price_hint_sar} ر.س`}
              color="#1B3D2F"
              highlight
            />
          ) : null}
        </View>

        {hasWaypoints && (
          <View style={styles.waypointsCard}>
            <Text style={styles.sectionTitle}>مدن المرور</Text>
            <View style={styles.waypointsList}>
              {trip.waypoints.map((w, i) => (
                <View key={`${w}-${i}`} style={styles.waypointChip}>
                  <Ionicons name="location" size={12} color="#1B3D2F" />
                  <Text style={styles.waypointText}>{w}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {trip.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.sectionTitle}>ملاحظات الموصل</Text>
            <Text style={styles.notesText}>{trip.notes}</Text>
          </View>
        ) : null}

        {/* Carrier action: end / arrived */}
        {isOwner && trip.status !== "arrived" && trip.status !== "completed" && trip.status !== "cancelled" && (
          <TouchableOpacity
            style={styles.endTripBtn}
            onPress={markArrived}
            activeOpacity={0.85}
            testID="end-trip-btn"
          >
            <Ionicons name="checkmark-done-circle" size={20} color="#C6A15B" />
            <Text style={styles.endTripText}>أنهيت الرحلة — وصلت</Text>
          </TouchableOpacity>
        )}

        {/* Safety notice */}
        <View style={styles.safetyBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#1B3D2F" />
          <Text style={[styles.safetyText, { color: "#1B3D2F" }]}>
            منصة طير وسيط بين الأطراف — نقدّم توثيق الموصلين وتقييمات موثوقة ولكن الاتفاق النهائي بينك وبين الموصل.
          </Text>
        </View>

        {/* تنويه — طير غير مسؤولة */}
        <View style={styles.tairTripDisclaimer}>
          <Ionicons name="information-circle-outline" size={14} color="#8A6A2E" />
          <Text style={styles.tairTripDisclaimerText}>
            طير غير مسؤولة عن تنفيذ الرحلة أو سلامة المنقولات — الاتفاق كامل بينك وبين الموصل.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom bar — show contact buttons to owner too so they can preview
          how buyers see the trip, and easily share/test their own contacts. */}
      <View style={styles.bottomBar}>
        {digits ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#25D366" }]}
            onPress={openWhatsapp}
            testID="trip-whatsapp"
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={styles.actionText}>واتساب</Text>
          </TouchableOpacity>
        ) : null}
        {digits ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#1B3D2F" }]}
            onPress={openCall}
            testID="trip-call"
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.actionText}>اتصال</Text>
          </TouchableOpacity>
        ) : null}
        {!isOwner ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#C6A15B", flex: digits ? 1 : 2 }]}
            onPress={() => onContactCarrier && onContactCarrier(trip.carrier_id, carrierName)}
            testID="trip-message"
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="#0F241C" />
            <Text style={[styles.actionText, { color: "#0F241C" }]}>مراسلة</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.ownerBadge, { flex: digits ? 1 : 2 }]}>
            <Ionicons name="checkmark-circle" size={16} color="#1B3D2F" />
            <Text style={styles.ownerBadgeText}>رحلتك</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function DetailCard({ icon, label, value, color = "#1B3D2F", highlight }) {
  return (
    <View style={[styles.detailCard, highlight && { backgroundColor: "#FBF6EE", borderColor: "#E6DCC8" }]}>
      <View style={[styles.detailIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color: highlight ? "#065f46" : "#0F241C" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  tairTripDisclaimer: {
    marginTop: 10, marginHorizontal: 14, marginBottom: 10, padding: 10, borderRadius: 10,
    backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: "#E6DCC8",
    flexDirection: "row-reverse", gap: 8, alignItems: "center",
  },
  tairTripDisclaimerText: { flex: 1, color: "#6B5E4A", fontSize: 11, fontWeight: "600", textAlign: "right", lineHeight: 18 },
  center: { alignItems: "center", justifyContent: "center", padding: 40, gap: 12, flex: 1 },
  emptyTitle: { color: "#334155", fontSize: 16, fontWeight: "800" },
  emptyText: { color: "#6B5E4A", fontSize: 13 },
  linkBtn: { paddingVertical: 10, paddingHorizontal: 20, marginTop: 6 },
  linkText: { color: "#1B3D2F", fontWeight: "800", fontSize: 14 },

  hero: { paddingTop: 50, paddingBottom: 26, paddingHorizontal: 16 },
  heroTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  heroIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  routeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cityBox: { flex: 1, alignItems: "center" },
  cityLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },
  cityName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  routeSep: {
    flex: 1.3,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  routeLine: { flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 1 },
  heroStatus: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 16,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  heroStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E6DCC8" },
  heroStatusText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  carrierCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFDF8",
    marginHorizontal: 16,
    marginTop: -18,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6DCC8",
    shadowColor: "#1B3D2F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  carrierAvatarWrap: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: "#E6DCC8", overflow: "hidden",
  },
  carrierAvatarImg: { width: "100%", height: "100%" },
  carrierAvatarPh: {
    width: "100%", height: "100%",
    backgroundColor: "#1B3D2F",
    alignItems: "center", justifyContent: "center",
  },
  carrierInitial: { color: "#fff", fontSize: 22, fontWeight: "800" },
  carrierNameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" },
  carrierName: { fontSize: 15, fontWeight: "900", color: "#0F241C", flexShrink: 1 },
  verBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FBF6EE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6DCC8",
  },
  verText: { fontSize: 10, fontWeight: "800", color: "#1B3D2F" },
  carrierMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  starRow: { flexDirection: "row-reverse", alignItems: "center", gap: 3 },
  starText: { fontSize: 11, color: "#334155", fontWeight: "800" },
  carrierSub: { fontSize: 11, color: "#8A7B66", fontWeight: "700" },

  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    padding: 14,
  },
  detailCard: {
    width: "47.5%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  detailIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  detailLabel: { color: "#6B5E4A", fontSize: 11, fontWeight: "700" },
  detailValue: { color: "#0F241C", fontSize: 14, fontWeight: "800" },

  waypointsCard: {
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1B3D2F",
    textAlign: "right",
    marginBottom: 10,
  },
  waypointsList: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  waypointChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FBF6EE",
    borderWidth: 1,
    borderColor: "#E6DCC8",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  waypointText: { color: "#065f46", fontSize: 12, fontWeight: "800" },

  notesCard: {
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  notesText: { color: "#475569", fontSize: 13, lineHeight: 22, textAlign: "right" },

  endTripBtn: {
    marginHorizontal: 14,
    marginTop: 6,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1B3D2F",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: "#1B3D2F",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  endTripText: { color: "#C6A15B", fontWeight: "800", fontSize: 15 },

  safetyBox: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    marginHorizontal: 14,
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
  },
  safetyText: { flex: 1, color: "#0c4a6e", fontSize: 12, lineHeight: 20, textAlign: "right" },

  bottomBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
    padding: 12, paddingBottom: 26,
    flexDirection: "row-reverse",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  ownerBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#FBF6EE",
    borderWidth: 1,
    borderColor: "#E6DCC8",
  },
  ownerBadgeText: { color: "#1B3D2F", fontWeight: "900", fontSize: 13 },
});
