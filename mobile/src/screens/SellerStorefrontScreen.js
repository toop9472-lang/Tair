// طير — Mobile: Seller Storefront (public buyer view)
// Rich merchant page: banner + logo + verified badges + contact + business hours
// + pickup + about + policies + listings grid + reviews.
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Linking,
  Share,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import api from "../services/api";
import { TAIR_PALETTE, TAIR_BANNER_IMAGE } from "../constants/tairDesign";

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

const money = (v) => new Intl.NumberFormat("ar-SA").format(v || 0);

const DAYS_AR = {
  sat: "السبت", sun: "الأحد", mon: "الاثنين",
  tue: "الثلاثاء", wed: "الأربعاء", thu: "الخميس", fri: "الجمعة",
};

async function fetchJson(path) {
  const r = await api.fetch(path);
  if (!r) throw new Error("NO_RESPONSE");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default function SellerStorefrontScreen({
  userId,
  viewerId,
  onBack,
  onOpenListing,
  onContactSeller,
}) {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState("listings");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [openHighlight, setOpenHighlight] = useState(null);
  const [openPortfolio, setOpenPortfolio] = useState(null); // { images: [...], startIndex }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const vSuffix = viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : "";
        const [p, ls, rs] = await Promise.all([
          fetchJson(`/api/sellers/${encodeURIComponent(userId)}${vSuffix}`),
          fetchJson(`/api/sellers/${encodeURIComponent(userId)}/listings`).catch(() => ({ items: [] })),
          fetchJson(`/api/sellers/${encodeURIComponent(userId)}/reviews`).catch(() => ({ items: [] })),
        ]);
        if (!alive) return;
        setProfile(p);
        setListings(ls.items || []);
        setReviews(rs.items || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "تعذّر تحميل صفحة البائع");
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Follow status
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const vid = viewerId || `guest_public_${Math.random().toString(36).slice(2, 8)}`;
        const r = await fetchJson(`/api/phone/follow-status/${encodeURIComponent(userId)}?user_id=${encodeURIComponent(vid)}`);
        if (!alive) return;
        if (viewerId && viewerId !== userId) setFollowing(!!r?.following);
        setFollowersCount(r?.followers_count || 0);
      } catch {}
    })();
    return () => { alive = false; };
  }, [userId, viewerId]);

  const canFollow = !!viewerId && viewerId !== userId;
  const onToggleFollow = async () => {
    if (!canFollow || followBusy) return;
    setFollowBusy(true);
    const prev = following;
    setFollowing(!prev);
    setFollowersCount((c) => Math.max(0, c + (prev ? -1 : 1)));
    try {
      const r = await api.fetch(`/api/phone/follow/${encodeURIComponent(userId)}?user_id=${encodeURIComponent(viewerId)}`, { method: "POST" });
      const data = r && r.ok ? await r.json() : null;
      if (data && typeof data.following === "boolean") setFollowing(data.following);
    } catch {
      setFollowing(prev);
      setFollowersCount((c) => Math.max(0, c + (prev ? 1 : -1)));
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={s.wrap}>
        <TopBar onBack={onBack} title="متجر البائع" />
        <View style={s.center}><ActivityIndicator color={TAIR_PALETTE.primary} size="large" /></View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.wrap}>
        <TopBar onBack={onBack} title="متجر البائع" />
        <View style={s.center}>
          <Ionicons name="storefront-outline" size={56} color="#94a3b8" />
          <Text style={s.emptyTitle}>لم يتم العثور على البائع</Text>
          <Text style={s.emptyText}>{err ? "حاول مرة أخرى بعد قليل." : "قد يكون الحساب محذوفاً."}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={onBack}>
            <Text style={s.retryText}>عودة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const identity = profile.identity_color || TAIR_PALETTE.primary;
  const bannerSlides = Array.isArray(profile.banner_slides) ? profile.banner_slides : [];
  const highlights = Array.isArray(profile.highlights) ? profile.highlights : [];
  const backgroundImage = profile.profile_bg_url || profile.bg_image; // full-page bg
  const banner = bannerSlides[0];
  const rawPhone = profile.whatsapp || profile.phone;
  const digits = rawPhone ? String(rawPhone).replace(/[^0-9]/g, "") : "";
  const prefs = profile.contact_prefs || { whatsapp: true, call: false, chat: true };
  const hours = profile.business_hours || [];
  const openToday = (() => {
    if (!hours.length) return null;
    const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const d = new Date();
    const key = map[d.getDay()];
    const row = hours.find((h) => h.day === key);
    if (!row) return null;
    if (row.closed) return { closed: true };
    return { closed: false, open: row.open, close: row.close };
  })();

  const openWhatsapp = async () => {
    if (!digits) {
      return Alert.alert(
        "لا يوجد رقم",
        "لم يشارك البائع رقم واتساب. يمكنك التواصل عبر المحادثة الداخلية.",
      );
    }
    // Try native WhatsApp scheme first — if the app is installed AND the
    // number is registered on WhatsApp, this opens the chat instantly.
    // Otherwise we fall through to wa.me which shows a friendly error page.
    const msg = encodeURIComponent(`السلام عليكم، أنا مهتم بمتجرك: ${profile.name || ""}`);
    const nativeUrl = `whatsapp://send?phone=${digits}&text=${msg}`;
    const webUrl = `https://wa.me/${digits}?text=${msg}`;
    try {
      const canNative = await Linking.canOpenURL(nativeUrl);
      if (canNative) {
        return Linking.openURL(nativeUrl).catch(() => Linking.openURL(webUrl));
      }
    } catch {}
    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert(
        "تعذّر فتح واتساب",
        "قد يكون الرقم لا يستخدم واتساب أو أن التطبيق غير مثبّت على جهازك.",
      );
    }
  };
  const openCall = () => {
    if (!digits) return Alert.alert("لا يوجد رقم", "لم يشارك البائع رقم اتصال.");
    Linking.openURL(`tel:${digits}`).catch(() => Alert.alert("خطأ", "تعذّر إجراء الاتصال"));
  };
  const openChat = () => onContactSeller?.(profile.user_id, profile.name);
  const isOwnStore = !!viewerId && viewerId === userId;
  const shareStorefront = async () => {
    try {
      const base = process.env.EXPO_PUBLIC_BACKEND_URL || "https://saqr-ui-sync.emergent.host";
      const storeUrl = `${base}/share/store/${encodeURIComponent(userId)}`;
      const msg = `🏪 ${profile.name || "متجر طير"}\n🦜 تفضل بزيارة المتجر على تطبيق طير\n\n${storeUrl}`;
      await Share.share({
        message: msg,
        url: storeUrl,
        title: profile.name || "متجر طير",
      });
    } catch {}
  };
  const openMap = () => {
    const lat = profile.location?.lat;
    const lng = profile.location?.lng;
    if (!lat || !lng) return Alert.alert("لا يوجد موقع", "لم يحدد البائع موقعاً على الخريطة.");
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() =>
      Alert.alert("خطأ", "تعذّر فتح الخريطة"),
    );
  };

  return (
    <View style={s.wrap}>
      {/* ==== Clean solid page background — NO tinting on any hero image ==== */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#F7F1E8" }]} pointerEvents="none" />

      <TopBar onBack={onBack} title={profile.name || "متجر البائع"} onShare={shareStorefront} color={identity} />

      <ScrollView
        style={{ backgroundColor: "transparent" }}
        contentContainerStyle={{ paddingBottom: 40, backgroundColor: "transparent" }}
      >
        {/* ==== Hero banner — auto-sliding carousel OR profile background image ==== */}
        <BannerCarousel
          slides={
            bannerSlides.length > 0
              ? bannerSlides.map(resolveMediaUrl).filter(Boolean)
              : backgroundImage
                ? [resolveMediaUrl(backgroundImage)]
                : []
          }
          identity={identity}
          height={260}
          hasBg={false}
        >
          <View style={s.bannerContent} pointerEvents="box-none">
            <View style={[s.logoWrap, { borderColor: "#ffffff" }]}>
              {profile.logo_url || profile.avatar ? (
                <Image
                  source={{ uri: resolveMediaUrl(profile.logo_url || profile.avatar) }}
                  style={s.logo}
                />
              ) : (
                <View style={[s.logo, { backgroundColor: identity, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
                    {(profile.name || "؟")[0]}
                  </Text>
                </View>
              )}
            </View>
            <Text style={s.bannerName} numberOfLines={1}>{profile.name}</Text>
            <View style={s.badgesRow}>
              {profile.is_verified_shop && (
                <Badge icon="storefront" text="متجر موثوق" color={identity} />
              )}
              {profile.is_verified_carrier && (
                <Badge icon="car" text="موصل معتمد" color="#2563eb" />
              )}
              {openToday && (
                <Badge
                  icon={openToday.closed ? "close-circle" : "time"}
                  text={openToday.closed ? "مغلق اليوم" : `مفتوح ${openToday.open} - ${openToday.close}`}
                  color={openToday.closed ? "#dc2626" : "#059669"}
                />
              )}
            </View>

            {/* Follow button — brand-tinted glass pill */}
            {canFollow && (
              <TouchableOpacity
                style={[
                  s.followBtn,
                  following
                    ? { backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.4)" }
                    : { backgroundColor: "#ffffff", borderColor: "#ffffff" },
                ]}
                onPress={onToggleFollow}
                disabled={followBusy}
                testID="storefront-follow-btn"
              >
                <Ionicons
                  name={following ? "checkmark-circle" : "add-circle"}
                  size={16}
                  color={following ? "#ffffff" : identity}
                />
                <Text style={[s.followText, { color: following ? "#ffffff" : identity }]}>
                  {following ? "متابع" : "متابعة"}
                </Text>
                {followersCount > 0 && (
                  <View style={[
                    s.followCountPill,
                    following
                      ? { backgroundColor: "rgba(255,255,255,0.14)" }
                      : { backgroundColor: identity + "22" },
                  ]}>
                    <Ionicons name="people" size={10} color={following ? "#ffffff" : identity} />
                    <Text style={[s.followCountText, { color: following ? "#ffffff" : identity }]}>
                      {new Intl.NumberFormat("ar-SA").format(followersCount)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            {!canFollow && followersCount > 0 && (
              <View style={s.followerCountRow}>
                <Ionicons name="people" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={s.followerCountText}>
                  {new Intl.NumberFormat("ar-SA").format(followersCount)} متابع
                </Text>
              </View>
            )}
          </View>
        </BannerCarousel>

        {/* Owner-only prominent "Share my store" button */}
        {isOwnStore && (
          <TouchableOpacity
            style={s.shareStoreCta}
            onPress={shareStorefront}
            activeOpacity={0.85}
            testID="share-my-store-btn"
          >
            <Ionicons name="share-social" size={18} color="#fff" />
            <Text style={s.shareStoreCtaText}>شارك متجري</Text>
          </TouchableOpacity>
        )}

        {/* ==== Highlights row (Instagram-style story pills) ==== */}
        {highlights.length > 0 && (
          <View style={s.highlightsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.highlightsRow}
            >
              {highlights.map((h, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.highlightItem}
                  activeOpacity={0.7}
                  onPress={() => setOpenHighlight(h)}
                  testID={`highlight-${i}`}
                >
                  <LinearGradient
                    colors={[identity, identity + "99", identity + "44"]}
                    style={s.highlightRing}
                  >
                    <View style={s.highlightInner}>
                      {h.cover ? (
                        <Image source={{ uri: resolveMediaUrl(h.cover) }} style={s.highlightImg} />
                      ) : (
                        <View style={[s.highlightImg, { backgroundColor: identity + "22", alignItems: "center", justifyContent: "center" }]}>
                          <Ionicons name="images" size={22} color={identity} />
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                  <Text style={s.highlightLabel} numberOfLines={1}>{h.title || "—"}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ==== About "من نحن" — merchant message above KPIs ==== */}
        {profile.about_text ? (
          <View style={[s.aboutCard, { borderColor: identity + "22" }]}>
            <View style={[s.aboutIconWrap, { backgroundColor: identity + "16" }]}>
              <Ionicons name="information-circle" size={20} color={identity} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.aboutTitle, { color: identity }]}>من نحن</Text>
              <Text style={s.aboutText}>{profile.about_text}</Text>
            </View>
          </View>
        ) : null}

        {/* ==== KPI strip — merchant identity ==== */}
        <View style={s.kpiStrip}>
          <Kpi
            icon="storefront"
            label="بضاعة معروضة"
            value={profile.listings_count || 0}
            color={identity}
          />
          <Kpi
            icon="ribbon"
            label="صفقات ناجحة"
            value={profile.sold_count || 0}
            color={identity}
          />
          <Kpi
            icon="heart-circle"
            label="رضا العملاء"
            value={profile.rating_avg != null ? profile.rating_avg.toFixed(1) : "—"}
            color={identity}
            hint={profile.rating_count ? `${profile.rating_count} تقييم` : "لا تقييمات بعد"}
          />
          <Kpi
            icon="eye"
            label="زيارة"
            value={new Intl.NumberFormat("ar-SA").format(profile.visits_count || 0)}
            color={identity}
          />
        </View>

        {/* ==== Contact action bar ==== */}
        <View style={s.contactBar}>
          {prefs.whatsapp && digits ? (
            <TouchableOpacity style={[s.contactBtn, { backgroundColor: "#25D366" }]} onPress={openWhatsapp} testID="seller-whatsapp">
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={s.contactText}>واتساب</Text>
            </TouchableOpacity>
          ) : null}
          {prefs.call && digits ? (
            <TouchableOpacity style={[s.contactBtn, { backgroundColor: identity }]} onPress={openCall} testID="seller-call">
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={s.contactText}>اتصال</Text>
            </TouchableOpacity>
          ) : null}
          {prefs.chat !== false ? (
            <TouchableOpacity style={[s.contactBtn, { backgroundColor: "#0369a1" }]} onPress={openChat} testID="seller-chat">
              <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
              <Text style={s.contactText}>مراسلة</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ==== Location / Pickup ==== */}
        {(profile.location?.lat || profile.pickup_enabled) ? (
          <SectionCard icon="map-outline" title="الموقع والاستلام" color={identity}>
            {profile.location?.lat ? (
              <TouchableOpacity style={s.locRow} onPress={openMap} testID="seller-open-map">
                <Ionicons name="location" size={18} color={identity} />
                <View style={{ flex: 1 }}>
                  <Text style={s.locLabel}>{profile.location.address_label || "افتح الموقع على الخريطة"}</Text>
                  <Text style={s.locHint}>اضغط لفتح خرائط قوقل</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
            {profile.pickup_enabled ? (
              <View style={s.pickupBox}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={s.pickupLabel}>الاستلام من المتجر متاح</Text>
                  {profile.pickup_note ? (
                    <Text style={s.pickupNote}>{profile.pickup_note}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ==== Portfolio (media gallery) — Instagram-style circles + tap to open ==== */}
        {profile.portfolio_images?.length ? (
          <SectionCard icon="camera-outline" title="معرض المتجر" color={identity}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.portfolioCirclesRow}
            >
              {profile.portfolio_images.map((u, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.75}
                  onPress={() => setOpenPortfolio({ images: profile.portfolio_images, startIndex: i })}
                  testID={`portfolio-circle-${i}`}
                  style={s.portfolioCircleItem}
                >
                  <LinearGradient
                    colors={[identity, identity + "88", identity + "33"]}
                    style={s.portfolioCircleRing}
                  >
                    <View style={s.portfolioCircleInner}>
                      <Image source={{ uri: resolveMediaUrl(u) }} style={s.portfolioCircleImg} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SectionCard>
        ) : null}

        {/* ==== Flash sales ==== */}
        {profile.flash_sales?.length ? (
          <SectionCard icon="flash-outline" title="عروض الآن" color="#dc2626">
            {profile.flash_sales.map((sale) => (
              <View key={sale.id} style={s.saleRow}>
                <View style={s.discountBadge}>
                  <Text style={s.discountText}>{sale.discount_pct}%</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.saleTitle}>{sale.title}</Text>
                  <Text style={s.saleMeta}>
                    ينتهي {new Date(sale.ends_at).toLocaleString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {/* ==== Coupons ==== */}
        {profile.coupons?.length ? (
          <SectionCard icon="pricetag-outline" title="كوبونات خصم" color={identity}>
            {profile.coupons.map((c, i) => (
              <TouchableOpacity
                key={c.code || i}
                activeOpacity={0.7}
                onPress={() => {
                  try {
                    // Just show for now — copy is native module; alert works everywhere
                    Alert.alert("كوبون خصم", `الكود: ${c.code}\nاستخدمه عند التواصل مع البائع.`);
                  } catch {}
                }}
                style={[s.couponRow, { borderColor: identity + "40", backgroundColor: identity + "0F" }]}
              >
                <View style={[s.couponPct, { backgroundColor: identity }]}>
                  <Text style={s.couponPctText}>{c.discount_pct || 0}%</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.couponCode, { color: identity }]}>{c.code}</Text>
                  <Text style={s.couponHint}>خصم {c.discount_pct || 0}% — اضغط للنسخ</Text>
                </View>
                <Ionicons name="copy-outline" size={18} color={identity} />
              </TouchableOpacity>
            ))}
          </SectionCard>
        ) : null}

        {/* ==== Trust & safety notice — moved to end ==== */}

        {/* ==== Tabs ==== */}
        <View style={s.tabs}>
          <TouchableOpacity
            onPress={() => setTab("listings")}
            style={[s.tab, tab === "listings" && { backgroundColor: identity }]}
            testID="tab-listings"
          >
            <Ionicons name="pricetags" size={14} color={tab === "listings" ? "#fff" : "#64748b"} />
            <Text style={[s.tabText, tab === "listings" && { color: "#fff" }]}>
              الإعلانات ({profile.listings_count || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("reviews")}
            style={[s.tab, tab === "reviews" && { backgroundColor: identity }]}
            testID="tab-reviews"
          >
            <Ionicons name="star" size={14} color={tab === "reviews" ? "#fff" : "#64748b"} />
            <Text style={[s.tabText, tab === "reviews" && { color: "#fff" }]}>
              التقييمات ({profile.rating_count || 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ==== Content ==== */}
        {tab === "listings" ? (
          listings.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="pricetags-outline" size={40} color="#cbd5e1" />
              <Text style={s.emptyMuted}>لا توجد إعلانات نشطة</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {listings.map((l) => (
                <TouchableOpacity
                  key={l.listing_id}
                  style={s.gridCard}
                  onPress={() => onOpenListing?.(l)}
                  testID={`seller-listing-${l.listing_id}`}
                >
                  <View style={s.gridImg}>
                    {l.cover_image || l.images?.[0] ? (
                      <Image
                        source={{ uri: resolveMediaUrl(l.cover_image || l.images[0]) }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <Ionicons name="image-outline" size={30} color="#94a3b8" />
                    )}
                    {l.status === "sold" && (
                      <View style={s.soldBadge}><Text style={s.soldText}>مباع</Text></View>
                    )}
                    {l.status === "paused" && (
                      <View style={[s.soldBadge, { backgroundColor: "rgba(100,116,139,0.9)" }]}>
                        <Text style={s.soldText}>موقوف</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.gridTitle} numberOfLines={2}>{l.title}</Text>
                  <Text style={[s.gridPrice, { color: identity }]}>{money(l.price_sar)} ر.س</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : reviews.length === 0 ? (
          <View style={{ padding: 12 }}>
            <View style={s.emptyBox}>
              <Ionicons name="star-outline" size={40} color="#cbd5e1" />
              <Text style={s.emptyMuted}>لا توجد تقييمات بعد</Text>
            </View>
            {canFollow ? (
              <TouchableOpacity
                onPress={async () => {
                  Alert.alert(
                    "تقييم المتجر",
                    "اختر التقييم من 1 إلى 5",
                    [1,2,3,4,5].map((n) => ({
                      text: "★".repeat(n),
                      onPress: async () => {
                        try {
                          const { sellerRatingsApi } = await import("../services/tairApi");
                          await sellerRatingsApi.rate(userId, n, "", viewerId);
                          Alert.alert("✔", `تم تسجيل تقييمك (${n} نجوم)`);
                        } catch (e) {
                          Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر التقييم");
                        }
                      },
                    })).concat([{ text: "إلغاء", style: "cancel" }])
                  );
                }}
                style={{
                  flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
                  backgroundColor: identity, borderRadius: 12, paddingVertical: 12,
                  marginTop: 12, borderWidth: 1, borderColor: "#C6A15B",
                }}
                testID="rate-seller-btn-empty"
              >
                <Ionicons name="star" size={18} color="#C6A15B" />
                <Text style={{ color: "#C6A15B", fontSize: 14, fontWeight: "900" }}>كن أول من يقيّم هذا المتجر</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={{ padding: 12 }}>
            {/* Rate seller CTA (only for logged-in non-owner) */}
            {canFollow ? (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    "تقييم المتجر",
                    "اختر التقييم من 1 إلى 5",
                    [1,2,3,4,5].map((n) => ({
                      text: "★".repeat(n),
                      onPress: async () => {
                        try {
                          const { sellerRatingsApi } = await import("../services/tairApi");
                          await sellerRatingsApi.rate(userId, n, "", viewerId);
                          Alert.alert("✔", `تم تسجيل تقييمك (${n} نجوم)`);
                        } catch (e) {
                          Alert.alert("خطأ", e?.data?.detail || e?.message || "تعذّر التقييم");
                        }
                      },
                    })).concat([{ text: "إلغاء", style: "cancel" }])
                  );
                }}
                style={{
                  flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
                  backgroundColor: identity, borderRadius: 12, paddingVertical: 12,
                  marginBottom: 14, borderWidth: 1, borderColor: "#C6A15B",
                }}
                testID="rate-seller-btn"
              >
                <Ionicons name="star" size={18} color="#C6A15B" />
                <Text style={{ color: "#C6A15B", fontSize: 14, fontWeight: "900" }}>قيّم هذا المتجر</Text>
              </TouchableOpacity>
            ) : null}
            {reviews.map((r, i) => (
              <View key={i} style={s.reviewCard}>
                <View style={s.reviewHead}>
                  <View style={s.starsRow}>
                    {[0, 1, 2, 3, 4].map((k) => (
                      <Ionicons
                        key={k}
                        name={k < (r.stars || 0) ? "star" : "star-outline"}
                        size={14}
                        color="#f59e0b"
                      />
                    ))}
                  </View>
                  <Text style={s.reviewDate}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("ar-SA") : ""}
                  </Text>
                </View>
                {r.comment ? <Text style={s.reviewText}>{r.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* ==== Trust & safety notice — bottom of page ==== */}
        <View style={s.safety}>
          <Ionicons name="shield-checkmark" size={16} color={identity} />
          <Text style={s.safetyText}>
            طير وسيط بين المشتري والبائع — نوثّق الحسابات ونعرض التقييمات ولكن الاتفاق النهائي بينكما.
          </Text>
        </View>
      </ScrollView>

      {/* ==== Highlights modal ==== */}
      <HighlightViewer
        highlight={openHighlight}
        identity={identity}
        onClose={() => setOpenHighlight(null)}
      />

      {/* ==== Portfolio full-screen viewer ==== */}
      <PortfolioViewer
        payload={openPortfolio}
        identity={identity}
        onClose={() => setOpenPortfolio(null)}
      />
    </View>
  );
}

// ---- BannerCarousel: auto-sliding hero WITHOUT identity color tint on images ----
function BannerCarousel({ slides, identity, height = 260, hasBg, children }) {
  const screenW = Dimensions.get("window").width;
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);
  const total = Array.isArray(slides) ? slides.length : 0;

  useEffect(() => {
    if (total <= 1) return undefined;
    const t = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % total;
        try { listRef.current?.scrollToIndex({ index: next, animated: true }); } catch {}
        return next;
      });
    }, 4200);
    return () => clearInterval(t);
  }, [total]);

  const onMomentumEnd = (e) => {
    const x = e.nativeEvent?.contentOffset?.x || 0;
    const w = e.nativeEvent?.layoutMeasurement?.width || screenW;
    const i = Math.round(x / w);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={{ height, backgroundColor: "transparent" }}>
      {total > 0 ? (
        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(_, i) => `slide-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          getItemLayout={(_, i) => ({ length: screenW, offset: screenW * i, index: i })}
          renderItem={({ item }) => (
            <ImageBackground
              source={{ uri: item }}
              style={{ width: screenW, height }}
              resizeMode="cover"
            >
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.55)"]}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFillObject}
              />
            </ImageBackground>
          )}
        />
      ) : hasBg ? (
        // Full-page bg image exists → keep hero fully transparent so image shows through
        <View style={{ width: "100%", height }} />
      ) : (
        // Neutral hero — no identity color tint per user preference
        <View style={{ width: "100%", height, backgroundColor: "#e2e8f0" }} />
      )}

      {/* Foreground content */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "flex-end" }} pointerEvents="box-none">
        {children}
      </View>

      {/* Slide indicators */}
      {total > 1 && (
        <View style={s.dotsRow} pointerEvents="none">
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === index ? { width: 20, backgroundColor: "#fff" } : { width: 6, backgroundColor: "rgba(255,255,255,0.55)" },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ---- HighlightViewer: full-screen modal Instagram-style ----
function HighlightViewer({ highlight, identity, onClose }) {
  const visible = !!highlight;
  const items = (highlight?.items || []).filter((x) => x && x.image);
  const [idx, setIdx] = useState(0);

  useEffect(() => { setIdx(0); }, [highlight]);

  useEffect(() => {
    if (!visible || items.length === 0) return undefined;
    const t = setTimeout(() => {
      if (idx + 1 < items.length) setIdx(idx + 1);
      else onClose && onClose();
    }, 4500);
    return () => clearTimeout(t);
  }, [idx, items.length, visible]);

  if (!visible) return null;
  const active = items[idx];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.hvBackdrop}>
        {/* Progress bars */}
        <View style={s.hvProgress}>
          {items.map((_, i) => (
            <View key={i} style={s.hvProgTrack}>
              <View style={[s.hvProgFill, {
                width: i < idx ? "100%" : i === idx ? "60%" : "0%",
                backgroundColor: "#fff",
              }]} />
            </View>
          ))}
        </View>
        {/* Header */}
        <View style={s.hvHeader}>
          <Text style={s.hvTitle} numberOfLines={1}>{highlight.title || "إبراز"}</Text>
          <TouchableOpacity onPress={onClose} style={s.hvClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Image tap regions: left=prev, right=next */}
        <View style={s.hvImageArea}>
          {active?.image ? (
            <Image
              source={{ uri: (active.image.startsWith("http") ? active.image : `${API_BASE}${active.image}`) }}
              style={s.hvImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={s.hvTapLeft}
            activeOpacity={1}
            onPress={() => setIdx((i) => Math.max(0, i - 1))}
          />
          <TouchableOpacity
            style={s.hvTapRight}
            activeOpacity={1}
            onPress={() => (idx + 1 < items.length ? setIdx(idx + 1) : onClose && onClose())}
          />
        </View>

        {active?.caption ? (
          <View style={[s.hvCaption, { borderColor: identity }]}>
            <Text style={s.hvCaptionText}>{active.caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// ---- PortfolioViewer: full-screen pinch-friendly gallery ----
function PortfolioViewer({ payload, identity, onClose }) {
  const [idx, setIdx] = useState(payload?.startIndex || 0);
  const listRef = useRef(null);
  const screenW = Dimensions.get("window").width;
  useEffect(() => {
    setIdx(payload?.startIndex || 0);
  }, [payload]);
  if (!payload) return null;
  const images = payload.images || [];
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.hvBackdrop}>
        <View style={s.hvHeader}>
          <Text style={s.hvTitle}>{`صور المتجر · ${idx + 1} / ${images.length}`}</Text>
          <TouchableOpacity onPress={onClose} style={s.hvClose} testID="portfolio-close">
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(_, i) => `p-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={payload.startIndex || 0}
          getItemLayout={(_, i) => ({ length: screenW - 24, offset: (screenW - 24) * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const w = e.nativeEvent?.layoutMeasurement?.width || (screenW - 24);
            const i = Math.round((e.nativeEvent?.contentOffset?.x || 0) / w);
            if (i !== idx) setIdx(i);
          }}
          renderItem={({ item }) => (
            <View style={{ width: screenW - 24, alignItems: "center", justifyContent: "center" }}>
              <Image
                source={{ uri: (String(item).startsWith("http") ? item : `${API_BASE}${item}`) }}
                style={{ width: "100%", height: "80%", borderRadius: 12 }}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* dots */}
        {images.length > 1 && (
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 12 }}>
            {images.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                  backgroundColor: i === idx ? identity : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}





function TopBar({ onBack, title, onShare, color }) {
  return (
    <View style={[s.topBar, color ? { backgroundColor: color } : null]}>
      <TouchableOpacity onPress={onBack} style={s.topBtn} testID="storefront-back">
        <Ionicons name="chevron-forward" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={s.topTitle} numberOfLines={1}>{title}</Text>
      {onShare ? (
        <TouchableOpacity onPress={onShare} style={s.topBtn} testID="storefront-share">
          <Ionicons name="share-social-outline" size={20} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 42 }} />
      )}
    </View>
  );
}

function Badge({ icon, text, color }) {
  return (
    <View style={[s.badge, { borderColor: "rgba(255,255,255,0.4)" }]}>
      <Ionicons name={icon} size={11} color="#fff" />
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

function Kpi({ icon, label, value, color, hint }) {
  return (
    <View style={[s.kpi, { borderColor: `${color}1F` }]}>
      <View style={[s.kpiIcon, { backgroundColor: `${color}18`, borderColor: `${color}33` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.kpiVal, { color }]}>{value}</Text>
      <Text style={s.kpiLbl} numberOfLines={1}>{label}</Text>
      {hint ? <Text style={s.kpiHint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

function SectionCard({ icon, title, color, children }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={[s.sectionIcon, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={[s.sectionTitle, { color }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f1f5f9" },
  scrollBg: { backgroundColor: "transparent" },

  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 48, paddingBottom: 12, paddingHorizontal: 14,
    backgroundColor: TAIR_PALETTE.primary,
  },
  topTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: "900" },
  topBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: "#334155" },
  emptyText: { fontSize: 12, color: "#64748b" },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 26, backgroundColor: TAIR_PALETTE.primary, borderRadius: 12, marginTop: 6 },
  retryText: { color: "#fff", fontWeight: "800" },

  banner: {
    height: 240,
    justifyContent: "flex-end",
  },
  bannerContent: { padding: 18, alignItems: "center" },

  // Carousel dots
  dotsRow: {
    position: "absolute", bottom: 8, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },

  // Highlights row
  highlightsWrap: {
    backgroundColor: "rgba(255,255,255,0.82)",
    marginHorizontal: 12, marginTop: 12,
    borderRadius: 18,
    paddingVertical: 14,
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  highlightsRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: 12,
    gap: 12,
  },
  highlightItem: { alignItems: "center", width: 74 },
  highlightRing: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center",
    padding: 3,
  },
  highlightInner: {
    width: "100%", height: "100%", borderRadius: 32,
    backgroundColor: "#fff",
    padding: 2,
    alignItems: "center", justifyContent: "center",
  },
  highlightImg: {
    width: "100%", height: "100%", borderRadius: 30,
    backgroundColor: "#f1f5f9",
  },
  highlightLabel: {
    marginTop: 6,
    fontSize: 11, fontWeight: "800", color: "#334155",
    textAlign: "center",
  },

  // Highlight viewer modal
  hvBackdrop: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 48, paddingBottom: 30,
    paddingHorizontal: 12,
  },
  hvProgress: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  hvProgTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  hvProgFill: { height: "100%" },
  hvHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  hvTitle: { color: "#fff", fontSize: 15, fontWeight: "900", flex: 1, textAlign: "right" },
  hvClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  hvImageArea: { flex: 1, position: "relative" },
  hvImage: { width: "100%", height: "100%", borderRadius: 12 },
  hvTapLeft: { position: "absolute", top: 0, bottom: 0, left: 0, width: "35%" },
  hvTapRight: { position: "absolute", top: 0, bottom: 0, right: 0, width: "35%" },
  hvCaption: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
  },
  hvCaptionText: { color: "#fff", fontSize: 13, lineHeight: 20, textAlign: "right" },
  logoWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "#fff",
    borderWidth: 3, overflow: "hidden",
    marginBottom: 8,
  },
  logo: { width: "100%", height: "100%" },
  bannerName: {
    color: "#fff", fontSize: 20, fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  badgesRow: { flexDirection: "row-reverse", gap: 6, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  badge: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    backgroundColor: "rgba(15,23,42,0.4)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  badgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },

  shareStoreCta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: "#0ea5e9",
    borderRadius: 12,
    shadowColor: "#0ea5e9",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shareStoreCtaText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  followBtn: {
    marginTop: 12,
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14,
    elevation: 6,
  },
  followText: { fontSize: 13, fontWeight: "900" },
  followCountPill: {
    flexDirection: "row-reverse", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  followCountText: { fontSize: 11, fontWeight: "900" },
  followerCountRow: {
    marginTop: 10,
    flexDirection: "row-reverse", alignItems: "center", gap: 5,
  },
  followerCountText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "800" },

  hoursChip: {
    flexDirection: "row-reverse", alignItems: "center", gap: 12,
    marginHorizontal: 12, marginTop: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 0,
    backgroundColor: "rgba(255,255,255,0.82)",
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  hoursChipIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
  },
  hoursChipRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    paddingVertical: 2,
  },
  hoursChipDay: { fontSize: 12.5, color: "#334155", fontWeight: "800" },
  hoursChipDot: { width: 3, height: 3, borderRadius: 2 },
  hoursChipTime: { fontSize: 13, fontWeight: "900" },

  kpiStrip: {
    flexDirection: "row-reverse", gap: 8, padding: 12,
    marginHorizontal: 12, marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 18,
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  kpi: {
    flex: 1, alignItems: "center", gap: 5,
    paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  kpiIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  kpiVal: { fontSize: 17, fontWeight: "900" },
  kpiLbl: { fontSize: 10.5, color: "#475569", fontWeight: "800", textAlign: "center" },
  kpiHint: { fontSize: 9, color: "#94a3b8", fontWeight: "600", textAlign: "center" },

  contactBar: {
    flexDirection: "row-reverse", gap: 8, padding: 12,
    marginHorizontal: 12, marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 18,
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  contactBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderRadius: 14,
  },
  contactText: { color: "#fff", fontWeight: "900", fontSize: 13 },

  section: {
    backgroundColor: "rgba(255,255,255,0.82)",
    marginHorizontal: 12, marginTop: 12,
    padding: 14, borderRadius: 18,
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "900" },

  aboutText: { color: "#334155", fontSize: 13, lineHeight: 22, textAlign: "right" },

  aboutCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 12, marginTop: 12,
    padding: 14, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  aboutIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  aboutTitle: {
    fontSize: 13, fontWeight: "900", marginBottom: 4, textAlign: "right",
  },

  hourRow: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderColor: "#f1f5f9",
  },
  dayName: { fontSize: 12, color: "#0f172a", fontWeight: "800" },
  hourVal: { fontSize: 12, color: "#0ea5e9", fontWeight: "800" },

  locRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 4 },
  locLabel: { fontSize: 13, color: "#0f172a", fontWeight: "800", textAlign: "right" },
  locHint: { fontSize: 11, color: "#64748b", marginTop: 2, textAlign: "right" },
  pickupBox: {
    flexDirection: "row-reverse", gap: 8, alignItems: "flex-start",
    backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#a7f3d0",
    padding: 10, borderRadius: 10, marginTop: 10,
  },
  pickupLabel: { fontSize: 12, color: "#065f46", fontWeight: "800", textAlign: "right" },
  pickupNote: { fontSize: 11, color: "#059669", marginTop: 3, textAlign: "right" },

  portfolioImg: { width: 130, height: 90, borderRadius: 10, backgroundColor: "#f1f5f9" },
  // Instagram-style circular portfolio
  portfolioCirclesRow: {
    flexDirection: "row-reverse",
    gap: 14,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  portfolioCircleItem: { alignItems: "center", justifyContent: "center" },
  portfolioCircleRing: {
    width: 72, height: 72, borderRadius: 36,
    padding: 3,
    alignItems: "center", justifyContent: "center",
  },
  portfolioCircleInner: {
    width: "100%", height: "100%", borderRadius: 34,
    backgroundColor: "#fff",
    padding: 2,
    alignItems: "center", justifyContent: "center",
  },
  portfolioCircleImg: {
    width: "100%", height: "100%", borderRadius: 32,
    backgroundColor: "#f1f5f9",
  },

  saleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 8 },
  discountBadge: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#fef2f2",
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fecaca",
  },
  discountText: { color: "#dc2626", fontWeight: "900", fontSize: 12 },
  saleTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800", textAlign: "right" },
  saleMeta: { color: "#64748b", fontSize: 11, marginTop: 2, textAlign: "right" },

  // Coupons
  couponRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5, borderStyle: "dashed",
    marginBottom: 8,
  },
  couponPct: {
    minWidth: 48, height: 48, borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: "center", justifyContent: "center",
  },
  couponPctText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  couponCode: { fontSize: 15, fontWeight: "900", letterSpacing: 1, textAlign: "right" },
  couponHint: { fontSize: 11, color: "#64748b", fontWeight: "700", textAlign: "right", marginTop: 2 },

  safety: {
    flexDirection: "row-reverse", alignItems: "flex-start", gap: 8,
    marginHorizontal: 12, marginTop: 10, padding: 12,
    backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#a7f3d0",
    borderRadius: 12,
  },
  safetyText: { flex: 1, color: "#065f46", fontSize: 11.5, lineHeight: 19, textAlign: "right" },

  tabs: {
    flexDirection: "row-reverse",
    marginHorizontal: 12, marginTop: 12,
    padding: 4,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.82)",
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  tab: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 12,
  },
  tabText: { fontSize: 13, fontWeight: "800", color: "#64748b" },

  emptyBox: { alignItems: "center", padding: 40, gap: 8 },
  emptyMuted: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },

  grid: { flexDirection: "row-reverse", flexWrap: "wrap", padding: 12, gap: 10 },
  gridCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 16, overflow: "hidden",
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  gridImg: { height: 130, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", position: "relative" },
  soldBadge: {
    position: "absolute", top: 6, right: 6,
    backgroundColor: "rgba(239,68,68,0.95)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  soldText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  gridTitle: { paddingHorizontal: 8, paddingTop: 8, fontSize: 12, fontWeight: "800", color: "#0f172a", textAlign: "right" },
  gridPrice: { paddingHorizontal: 8, paddingBottom: 8, paddingTop: 3, fontSize: 13, fontWeight: "900", textAlign: "right" },

  reviewCard: {
    backgroundColor: "rgba(255,255,255,0.88)",
    padding: 14, borderRadius: 16, marginBottom: 10,
    marginHorizontal: 12,
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  reviewHead: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  starsRow: { flexDirection: "row-reverse", gap: 2 },
  reviewDate: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  reviewText: { marginTop: 6, fontSize: 13, color: "#334155", textAlign: "right", lineHeight: 21 },
});
