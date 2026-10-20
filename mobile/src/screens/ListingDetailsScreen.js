// طير — Listing Details
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  Share,
  Linking,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import Constants from "expo-constants";
import { listingsApi, tairReportsApi } from "../services/tairApi";
import api from "../services/api";
import { SafetyNotice, OwnerStatsCard } from "../components/TairShared";
import { DetailSkeleton, ErrorState, TairImage } from "../components/TairUI";
import { TAIR } from "../constants/tairTheme";

const { width } = Dimensions.get("window");

// Resolve possibly-relative media URLs (backend may return /media/... when R2 unavailable)
const API_BASE =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "";
const resolveMediaUrl = (u) => {
  if (!u) return "";
  if (typeof u !== "string") return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
};

const genderLabel = (g) =>
  ({ male: "ذكر", female: "أنثى", pair: "زوج", unknown: "غير محدد" }[g] || g);
const healthLabel = (s) =>
  ({
    excellent: "ممتازة",
    good: "جيدة",
    needs_care: "تحتاج رعاية",
    special_needs: "احتياجات خاصة",
  }[s] || s);

export default function ListingDetailsScreen({
  user,
  listingId,
  onBack,
  onContactSeller,
  onOrder,
  onOpenSeller,
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [listing, setListing] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);

  const loadListing = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    const viewerId = user?.user_id || user?.id;
    listingsApi
      .get(listingId, viewerId)
      .then((doc) => {
        setListing(doc);
        setLoadError(null);
      })
      .catch((e) => {
        setListing(null);
        setLoadError(e?.message || "تعذّر تحميل الإعلان");
      })
      .finally(() => setLoading(false));
  }, [listingId, user]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  const toggleFav = async () => {
    try {
      const res = await listingsApi.toggleFavorite(
        listingId,
        user?.user_id || user?.id,
      );
      setFavorited(res.favorited);
    } catch (e) {
      Alert.alert("خطأ", "تعذّر تحديث المفضلة");
    }
  };

  const shareListing = async () => {
    if (!listing) return;
    const base = process.env.EXPO_PUBLIC_BACKEND_URL || "https://saqr-ui-sync.emergent.host";
    const url = `${base}/share/listing/${encodeURIComponent(listing.listing_id || listing.id)}`;
    const message = `🦜 ${listing.title}\n💰 ${listing.price_sar} ر.س\n📍 طير · ${listing.city}\n\n${url}`;
    try {
      await Share.share({ title: listing.title, message, url });
    } catch { /* user cancelled */ }
  };

  const reportListing = () => {
    Alert.alert(
      "الإبلاغ عن الإعلان",
      "اختر سبب الإبلاغ:",
      [
        { text: "احتيال", onPress: () => submitReport("scam") },
        { text: "إعلان مزيّف", onPress: () => submitReport("fake_listing") },
        { text: "نوع محظور", onPress: () => submitReport("prohibited_species") },
        { text: "إساءة", onPress: () => submitReport("abuse") },
        { text: "إلغاء", style: "cancel" },
      ],
    );
  };

  const submitReport = async (reason) => {
    try {
      await tairReportsApi.create(user?.user_id || user?.id, {
        target_type: "listing",
        target_id: listingId,
        reason,
      });
      Alert.alert("شكراً", "تم استلام البلاغ وسيراجعه فريقنا");
    } catch (e) {
      Alert.alert("خطأ", "تعذّر إرسال البلاغ");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <DetailSkeleton />
      </View>
    );
  }
  if (!listing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ErrorState
          title={loadError ? "تعذّر فتح الإعلان" : "الإعلان غير موجود"}
          subtitle={loadError ? "تحقق من الاتصال ثم أعد المحاولة." : "ربما حُذف أو لم يعد متاحاً."}
          onRetry={loadError ? loadListing : undefined}
        />
        <TouchableOpacity onPress={onBack} style={styles.linkBtn}>
          <Text style={styles.linkText}>رجوع</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = (user?.user_id || user?.id) === listing.seller_id;
  const rawImages = listing.images?.length ? listing.images : [listing.cover_image].filter(Boolean);
  const images = rawImages.map(resolveMediaUrl).filter(Boolean);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Image gallery */}
        <View style={styles.gallery}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              setImgIdx(i);
            }}
          >
            {images.map((uri, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.9}
                onPress={() => setZoomImg(uri)}
                testID={`listing-img-${i}`}
              >
                <TairImage
                  uri={uri}
                  style={{ width, height: Math.round(width * 0.92), backgroundColor: TAIR.creamDeep }}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Dots */}
          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === imgIdx && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}

          {/* Top actions */}
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
              <Ionicons name="arrow-forward" size={22} color="#0F241C" />
            </TouchableOpacity>
            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              <TouchableOpacity style={styles.iconBtn} onPress={shareListing}>
                <Ionicons name="share-social-outline" size={20} color="#0F241C" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={toggleFav}>
                <Ionicons
                  name={favorited ? "heart" : "heart-outline"}
                  size={20}
                  color={favorited ? "#ef4444" : "#0F241C"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.title}>{listing.title}</Text>

          {/* Location + views compact row */}
          <View style={styles.metaRow}>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color="#1B3D2F" />
              <Text style={styles.locationText}>
                {listing.city}
                {listing.district ? ` · ${listing.district}` : ""}
              </Text>
            </View>
            <View style={styles.viewsBadge}>
              <Ionicons name="eye-outline" size={13} color="#6B5E4A" />
              <Text style={styles.viewsText}>{listing.view_count || 0}</Text>
            </View>
          </View>

          {/* Price — big prominent card */}
          <View style={styles.priceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.priceLabel}>السعر</Text>
              <View style={{ flexDirection: "row-reverse", alignItems: "baseline", gap: 4 }}>
                <Text style={styles.price}>{listing.price_sar}</Text>
                <Text style={styles.priceCurrency}>ر.س</Text>
              </View>
              {listing.price_negotiable ? (
                <Text style={styles.negotiable}>قابل للتفاوض</Text>
              ) : null}
            </View>
            {(listing.status === "sold" || listing.sold_at) ? (
              <View style={styles.soldBadge}>
                <Ionicons name="checkmark-done-circle" size={14} color="#fff" />
                <Text style={styles.soldBadgeText}>تم البيع</Text>
              </View>
            ) : null}
          </View>

          {/* Seller info card */}
          {listing.seller_id ? (
            <TouchableOpacity
              style={styles.sellerCard}
              onPress={() => onOpenSeller && onOpenSeller(listing.seller_id)}
              activeOpacity={0.9}
              testID="seller-info-card"
            >
              <View style={styles.sellerAvatarWrap}>
                {listing.seller_avatar ? (
                  <Image source={{ uri: resolveMediaUrl(listing.seller_avatar) }} style={styles.sellerAvatarImg} />
                ) : (
                  <View style={styles.sellerAvatarPh}>
                    <Text style={styles.sellerAvatarInit}>
                      {(listing.seller_name || "?").charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName} numberOfLines={1}>
                    {listing.seller_name || "بائع طير"}
                  </Text>
                  {listing.seller_verified_shop && (
                    <View style={styles.sellerVerBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#C6A15B" />
                      <Text style={styles.sellerVerText}>موثوق</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sellerHint}>عرض متجر البائع ›</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}

          {/* Spec cards */}
          <Text style={styles.sectionH}>المواصفات</Text>
          <View style={styles.specGrid}>
            <SpecCard icon="male-female" label="الجنس" value={genderLabel(listing.gender)} />
            {listing.age_months ? (
              <SpecCard icon="calendar" label="العمر" value={`${listing.age_months} شهر`} />
            ) : null}
            {listing.breed ? (
              <SpecCard icon="paw" label="السلالة" value={listing.breed} />
            ) : null}
            {listing.color ? (
              <SpecCard icon="color-palette" label="اللون" value={listing.color} />
            ) : null}
          </View>

          {/* Description */}
          {listing.description ? (
            <>
              <Text style={styles.sectionH}>الوصف</Text>
              <View style={styles.descBox}>
                <Text style={styles.desc}>{listing.description}</Text>
              </View>
            </>
          ) : null}

          {(() => {
            const clips = []
              .concat(Array.isArray(listing.videos) ? listing.videos : [])
              .concat(listing.video_url ? [listing.video_url] : [])
              .map(resolveMediaUrl)
              .filter(Boolean);
            if (!clips.length) return null;
            return (
              <>
                <Text style={styles.sectionH}>الفيديو</Text>
                <View style={styles.videoBox}>
                  <Video
                    source={{ uri: clips[0] }}
                    style={styles.video}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                    testID="listing-video"
                  />
                </View>
              </>
            );
          })()}

          {/* Health */}
          <Text style={styles.sectionH}>الحالة الصحية</Text>
          <View style={styles.healthBox}>
            <Row
              icon="pulse"
              label="الحالة العامة"
              value={healthLabel(listing.health?.status)}
            />
            <Row
              icon="shield-checkmark"
              label="محصّن"
              value={listing.health?.vaccinated ? "نعم" : "لا"}
              color={listing.health?.vaccinated ? "#1B3D2F" : "#94a3b8"}
            />
            {listing.health?.ring_number ? (
              <Row icon="pricetag" label="رقم الخاتم" value={listing.health.ring_number} />
            ) : null}
            {listing.health?.notes ? (
              <Row icon="document-text" label="ملاحظات" value={listing.health.notes} />
            ) : null}
          </View>

          {/* Report button */}
          <TouchableOpacity style={styles.reportBtn} onPress={reportListing}>
            <Ionicons name="flag-outline" size={16} color="#ef4444" />
            <Text style={styles.reportText}>الإبلاغ عن هذا الإعلان</Text>
          </TouchableOpacity>

          {/* Owner stats or safety notice */}
          {isOwner ? (
            <>
              <OwnerStatsCard
                views={listing.view_count}
                likes={listing.likes_count}
                contacts={listing.contacts_count}
              />

              {/* Mark as Sold toggle */}
              <TouchableOpacity
                onPress={async () => {
                  const uid = user?.user_id || user?.id;
                  const isSold = listing.status === "sold" || !!listing.sold_at;
                  const path = isSold ? "unmark-sold" : "mark-sold";
                  Alert.alert(
                    isSold ? "إلغاء علامة البيع" : "تأكيد البيع",
                    isSold ? "هل تريد إعادة الإعلان للنشاط؟" : "سيظهر الإعلان مع ختم «تم البيع» للجميع",
                    [
                      { text: "إلغاء", style: "cancel" },
                      { text: isSold ? "إلغاء البيع" : "تم البيع", onPress: async () => {
                        try {
                          const resp = await api.fetch(`/api/listings/${listing.listing_id}/${path}?user_id=${encodeURIComponent(uid)}`, { method: "POST" });
                          if (!resp?.ok) throw new Error("fail");
                          Alert.alert("✔", isSold ? "تم إعادة الإعلان" : "تم تعليم الإعلان كمُباع");
                          setListing((prev) => prev ? { ...prev, status: isSold ? "active" : "sold", sold_at: isSold ? null : new Date().toISOString() } : prev);
                        } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر التنفيذ"); }
                      }},
                    ]
                  );
                }}
                style={{
                  flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
                  gap: 8, backgroundColor: (listing.status === "sold" || listing.sold_at) ? "#8B3A2F" : "rgba(27,61,47,0.08)",
                  borderColor: (listing.status === "sold" || listing.sold_at) ? "#FFFDF8" : "#1B3D2F",
                  borderWidth: 1.5, padding: 12, borderRadius: 12, marginTop: 10,
                }}
                testID="mark-sold-btn"
              >
                <Ionicons
                  name={(listing.status === "sold" || listing.sold_at) ? "refresh" : "checkmark-done-circle"}
                  size={16}
                  color={(listing.status === "sold" || listing.sold_at) ? "#FFFDF8" : "#1B3D2F"}
                />
                <Text style={{
                  color: (listing.status === "sold" || listing.sold_at) ? "#FFFDF8" : "#1B3D2F",
                  fontWeight: "900", fontSize: 13,
                }}>
                  {(listing.status === "sold" || listing.sold_at) ? "إلغاء تعليم البيع" : "تم البيع — علّم الإعلان"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Alert.alert("حذف الإعلان", "هل تريد حذف هذا الإعلان نهائياً؟", [
                    { text: "إلغاء", style: "cancel" },
                    {
                      text: "حذف", style: "destructive",
                      onPress: async () => {
                        try {
                          await listingsApi.delete(listing.listing_id, user?.user_id || user?.id);
                          Alert.alert("تم", "تم حذف الإعلان.");
                          onBack && onBack();
                        } catch (e) {
                          Alert.alert("خطأ", e.response?.data?.detail || e.message);
                        }
                      },
                    },
                  ]);
                }}
                style={{
                  flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
                  gap: 6, backgroundColor: "rgba(239,68,68,0.08)",
                  borderColor: "rgba(239,68,68,0.35)", borderWidth: 1,
                  padding: 12, borderRadius: 12, marginTop: 10,
                }}
                testID="delete-listing-btn"
              >
                <Ionicons name="trash" size={14} color="#ef4444" />
                <Text style={{ color: "#ef4444", fontWeight: "800", fontSize: 12 }}>حذف الإعلان نهائياً</Text>
              </TouchableOpacity>
            </>
          ) : (
            <SafetyNotice />
          )}

          {/* تنويه — طير غير مسؤولة */}
          <View style={styles.tairDisclaimer}>
            <Ionicons name="information-circle-outline" size={14} color="#8A6A2E" />
            <Text style={styles.tairDisclaimerText}>
              طير منصة وسيطة فقط — طير غير مسؤولة عن جودة الإعلان أو صحة المعاملة.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      {!isOwner ? (
        <View style={styles.bottomBar}>
          {onOpenSeller && (
            <TouchableOpacity
              style={styles.storefrontBtn}
              onPress={() => onOpenSeller(listing.seller_id)}
              testID="open-seller-storefront"
            >
              <Ionicons name="storefront-outline" size={18} color="#C6A15B" />
            </TouchableOpacity>
          )}
          {listing?.seller_whatsapp || listing?.whatsapp || listing?.seller_phone ? (
            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={() => {
                const raw = listing.seller_whatsapp || listing.whatsapp || listing.seller_phone;
                const digits = String(raw).replace(/[^0-9]/g, "");
                if (!digits) {
                  Alert.alert("لا يوجد رقم", "لم يشارك البائع رقم واتساب.");
                  return;
                }
                const msg = encodeURIComponent(`السلام عليكم، أنا مهتم بإعلانك: ${listing.title}`);
                Linking.openURL(`https://wa.me/${digits}?text=${msg}`).catch(() =>
                  Alert.alert("خطأ", "تعذّر فتح واتساب"),
                );
              }}
              data-testid="whatsapp-seller-btn"
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => onContactSeller && onContactSeller(listing.seller_id, listing.seller_name)}
            data-testid="contact-seller-btn"
          >
            <Ionicons name="chatbubble-outline" size={18} color="#1B3D2F" />
            <Text style={styles.secondaryText}>تواصل</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onOrder && onOrder(listing)}
            data-testid="order-btn"
          >
            <LinearGradient
              colors={["#0F241C", "#1B3D2F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGrad}
            >
              <Ionicons name="cube" size={18} color="#C6A15B" />
              <Text style={[styles.primaryText, { color: "#C6A15B" }]}>اطلب مع موصل</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <View style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
            <Text style={{ color: "#6B5E4A", fontSize: 13 }}>
              هذا إعلانك — عدّله من "حسابي"
            </Text>
          </View>
        </View>
      )}

      {/* Fullscreen Image Zoom */}
      <Modal visible={!!zoomImg} transparent animationType="fade" onRequestClose={() => setZoomImg(null)}>
        <Pressable onPress={() => setZoomImg(null)} style={styles.zoomBackdrop}>
          <Image source={{ uri: zoomImg }} style={styles.zoomImage} resizeMode="contain" />
          <TouchableOpacity onPress={() => setZoomImg(null)} style={styles.zoomClose} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </View>
  );
}

function SpecCard({ icon, label, value }) {
  return (
    <View style={styles.spec}>
      <Ionicons name={icon} size={18} color={TAIR.goldDark} />
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}
function Row({ icon, label, value, color }) {
  return (
    <View style={styles.hrow}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
        <Ionicons name={icon} size={16} color={color || "#6B5E4A"} />
        <Text style={styles.hlabel}>{label}</Text>
      </View>
      <Text style={[styles.hvalue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  priceCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.45)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#1B3D2F",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  priceLabel: { fontSize: 11, color: "#6B5E4A", fontWeight: "700", textAlign: "right", marginBottom: 2 },
  priceCurrency: { fontSize: 15, color: "#1B3D2F", fontWeight: "700" },
  sectionH: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1B3D2F",
    textAlign: "right",
    marginTop: 8,
    marginBottom: 10,
    borderRightWidth: 3,
    borderRightColor: "#C6A15B",
    paddingRight: 10,
  },
  descBox: {
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E6DCC8",
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
  },
  soldBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  soldBadgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  zoomBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  zoomImage: { width: "100%", height: "100%" },
  zoomClose: {
    position: "absolute", top: 50, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  center: { alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyText: { color: "#6B5E4A", fontSize: 15 },
  tairDisclaimer: {
    marginTop: 14, marginBottom: 8, padding: 10, borderRadius: 10,
    backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: "#E6DCC8",
    flexDirection: "row-reverse", gap: 8, alignItems: "center",
  },
  tairDisclaimerText: { flex: 1, color: "#6B5E4A", fontSize: 11, fontWeight: "600", textAlign: "right", lineHeight: 18 },
  linkBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  linkText: { color: "#1B3D2F", fontWeight: "700" },

  gallery: { position: "relative", backgroundColor: "#EFE4D2" },
  topActions: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  dotActive: { backgroundColor: "#fff", width: 18 },

  body: {
    marginTop: -22,
    padding: 16,
    paddingTop: 20,
    backgroundColor: "#F7F1E8",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  priceRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: { fontSize: 34, fontWeight: "800", color: "#1B3D2F", lineHeight: 42 },
  negotiable: { color: "#8A6A2E", fontSize: 12, fontWeight: "700", marginTop: 4 },
  viewsBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFE4D2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  viewsText: { color: "#6B5E4A", fontSize: 12 },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F241C",
    textAlign: "right",
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 30,
  },
  locationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  locationText: { color: "#1B3D2F", fontSize: 13, fontWeight: "600" },

  sellerCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#FFFDF8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6DCC8",
    marginBottom: 8,
    marginTop: 4,
    shadowColor: "#1B3D2F",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sellerAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#C6A15B",
    overflow: "hidden",
  },
  sellerAvatarImg: { width: "100%", height: "100%" },
  sellerAvatarPh: {
    width: "100%", height: "100%",
    backgroundColor: "#C6A15B",
    alignItems: "center", justifyContent: "center",
  },
  sellerAvatarInit: { color: "#fff", fontSize: 18, fontWeight: "800" },
  sellerNameRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F241C",
    textAlign: "right",
    flexShrink: 1,
  },
  sellerVerBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6DCC8",
  },
  sellerVerText: { fontSize: 10, fontWeight: "800", color: "#C6A15B" },
  sellerHint: {
    fontSize: 11,
    color: "#C6A15B",
    fontWeight: "700",
    marginTop: 2,
    textAlign: "right",
  },

  specGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  spec: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E6DCC8",
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  specLabel: { color: "#1B3D2F", fontSize: 11, fontWeight: "600" },
  specValue: { color: "#0F241C", fontSize: 14, fontWeight: "700" },

  h3: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F241C",
    marginTop: 20,
    marginBottom: 8,
    textAlign: "right",
  },
  desc: { color: "#6B5E4A", fontSize: 14, lineHeight: 22, textAlign: "right" },

  healthBox: {
    backgroundColor: "#F7F1E8",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  hrow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hlabel: { color: "#6B5E4A", fontSize: 13 },
  hvalue: { color: "#0F241C", fontSize: 13, fontWeight: "700" },

  reportBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    marginTop: 20,
  },
  reportText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFDF8",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(198,161,91,0.55)",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0F241C",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  videoBox: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0F241C",
    marginBottom: 8,
  },
  video: { width: "100%", aspectRatio: 16 / 9 },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#1B3D2F",
  },
  secondaryText: { color: "#1B3D2F", fontWeight: "700", fontSize: 14 },
  storefrontBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#FBF6EE", borderWidth: 1, borderColor: "#E6DCC8",
    alignItems: "center", justifyContent: "center",
  },
  whatsappBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#22c55e",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#22c55e", shadowOpacity: 0.35,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  primaryBtn: { flex: 1.5, borderRadius: 14, overflow: "hidden", backgroundColor: "#1B3D2F" },
  primaryGrad: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
