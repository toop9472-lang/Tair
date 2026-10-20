/**
 * MarketScreen (طير — السوق) — النموذج الرسمي.
 *
 * ترتيب الشاشة من فوق:
 *   1. TairHeader "market" ثابت 158
 *   2. TairEmeraldRibbon 40
 *   3. صف: زر "الفئات" 44 + حقل "ابحث في السوق" 44
 *   4. قائمة الإعلانات (كرت: صورة يمين 96 + معلومات، سعر ر.س، شارة "جديد")
 *   5. زر "رحلات الطيور القادمة" (كبسولة كريمية)
 *   6. TairBottomBar
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TairHeader from "../components/TairHeader";
import { TAIR, TAIR_ORNAMENTS, toArabicNumerals } from "../constants/tairTheme";
import { listingsApi } from "../services/tairApi";
import { API_URL as API_BASE } from "../services/api";

const resolveMediaUrl = (u) => {
  if (!u || typeof u !== "string") return "";
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
};

// الفئات: رموز Ionicons بدلاً من الإيموجي
const CATEGORIES = [
  { key: "livestock",       label: "مواشي",                          icon: "paw-outline" },
  { key: "songbirds",       label: "طيور مغردة",                       icon: "musical-notes-outline" },
  { key: "poultry",         label: "دواجن",                          icon: "egg-outline" },
  { key: "pigeons",         label: "حمام",                           icon: "airplane-outline" },
  { key: "parrots",         label: "ببغاوات",                         icon: "flower-outline" },
  { key: "fish",            label: "أسماك",                          icon: "fish-outline" },
  { key: "small_mammals",   label: "ثدييات صغيرة",                     icon: "bonfire-outline" },
  { key: "pets",            label: "حيوانات أليفة",                     icon: "heart-outline" },
  { key: "reptiles",        label: "زواحف",                          icon: "bug-outline" },
  { key: "insects",         label: "حشرات",                          icon: "prism-outline" },
  { key: "cats",            label: "قطط",                            icon: "paw" },
  { key: "dogs",            label: "كلاب",                           icon: "logo-octocat" },
  { key: "feed",            label: "أعلاف",                          icon: "leaf-outline" },
  { key: "bird_supplies",   label: "مستلزمات الطيور",                   icon: "basket-outline" },
  { key: "animal_supplies", label: "مستلزمات الحيوانات",                 icon: "cube-outline" },
  { key: "reserves",        label: "المحميات",                        icon: "earth-outline" },
  { key: "services",        label: "خدمات تركيب الأقفاص والمحميات",       icon: "construct-outline" },
];

export default function MarketScreen({
  user,
  activeTab = "market",
  onTabChange,
  onOpenListing,
  onOpenTrips,
  onOpenAuction,
  onOpenNotifications,
  onOpenMessages,
  onOpenAskExperts,
  onCreateListing,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [pickedCat, setPickedCat] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listingsApi.feed({ limit: 40, family: pickedCat, q: query });
      setItems(Array.isArray(r?.items) ? r.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pickedCat, query]);

  useEffect(() => {
    load();
  }, [load]);

  const listData = useMemo(() => items, [items]);

  return (
    <View style={styles.page}>
      {/* 1) هيدر ثابت */}
      <TairHeader
        variant="market"
        onBellPress={onOpenNotifications}
        onMessagesPress={onOpenMessages}
      />

      {/* 2) صف البحث + الفئات — ثابت لا يتحرك */}
      <View style={styles.stickyBar}>
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.catBtn}
            onPress={() => setCatOpen(true)}
            testID="market-categories-btn"
            activeOpacity={0.8}
          >
            <View style={styles.catIconInner}>
              <Ionicons name="grid" size={20} color={TAIR.gold} />
            </View>
          </TouchableOpacity>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={TAIR.textSoft} />
            <TextInput
              style={styles.searchInput}
              placeholder={pickedCat ? CATEGORIES.find((c) => c.key === pickedCat)?.label : "ابحث في السوق"}
              placeholderTextColor={TAIR.textSoft}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={load}
              returnKeyType="search"
              testID="market-search-input"
            />
          </View>
        </View>

        {/* زر "المزاد العام" النحيف — أسفل البحث */}
        <TouchableOpacity
          onPress={onOpenAuction}
          activeOpacity={0.85}
          style={styles.auctionBtn}
          testID="market-auction-banner"
        >
          <View style={styles.auctionIconBox}>
            <Ionicons name="hammer" size={14} color={TAIR.gold} />
          </View>
          <Text style={styles.auctionTitle}>المزاد العام</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-back" size={16} color={TAIR.gold} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(it) => String(it.listing_id || it.id)}
        renderItem={({ item }) => (
          <ListingCard item={item} onPress={() => onOpenListing?.(item.listing_id || item.id)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        ListFooterComponent={
          <View style={{ paddingHorizontal: TAIR.pagePadX, paddingBottom: 24, paddingTop: 12 }}>
            <TouchableOpacity
              style={styles.tripsCta}
              onPress={onOpenTrips}
              testID="market-trips-cta"
              activeOpacity={0.85}
            >
              <Text style={styles.tripsCtaText}>رحلات الطيور القادمة</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="basket-outline" size={54} color={TAIR.divider} />
              <Text style={styles.emptyText}>
                {pickedCat
                  ? `لا توجد إعلانات في «${CATEGORIES.find((c) => c.key === pickedCat)?.label || "هذه الفئة"}» حالياً`
                  : "لا توجد عروض حالياً"}
              </Text>
              {pickedCat ? (
                <TouchableOpacity onPress={() => setPickedCat(null)} style={styles.emptyCta} testID="clear-category">
                  <Text style={styles.emptyCtaText}>عرض جميع الفئات</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: TAIR.tabBarH + 40, backgroundColor: TAIR.bg }}
        style={{ backgroundColor: TAIR.bg }}
        showsVerticalScrollIndicator={false}
      />

      {loading && items.length === 0 ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={TAIR.emerald} />
        </View>
      ) : null}

      {/* زر عائم لإضافة إعلان جديد */}
      <TouchableOpacity
        onPress={onCreateListing}
        activeOpacity={0.85}
        style={styles.fab}
        testID="market-create-listing-fab"
      >
        <Ionicons name="add" size={30} color={TAIR.gold} />
      </TouchableOpacity>

      {/* قائمة الفئات — Bottom Sheet قابلة للتمرير */}
      <Modal transparent visible={catOpen} animationType="slide" onRequestClose={() => setCatOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setCatOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {/* Handle grabber */}
            <View style={styles.sheetGrabber} />

            {/* Header row */}
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setCatOpen(false)} hitSlop={12} testID="cat-close">
                <Ionicons name="close" size={24} color={TAIR.emerald} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>اختر فئة</Text>
              <TouchableOpacity onPress={() => { setPickedCat(null); setCatOpen(false); }}>
                <Text style={styles.sheetClearInline}>مسح</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
            >
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={styles.sheetRow}
                  onPress={() => {
                    setPickedCat(pickedCat === c.key ? null : c.key);
                    setCatOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
                    <View style={styles.sheetIconWrap}>
                      <Ionicons name={c.icon} size={18} color={TAIR.emerald} />
                    </View>
                    <Text style={styles.sheetRowText}>{c.label}</Text>
                  </View>
                  {pickedCat === c.key ? (
                    <Ionicons name="checkmark-circle" size={20} color={TAIR.gold} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------- كرت الإعلان ----------
function ListingCard({ item, onPress }) {
  const isNew = useMemo(() => {
    if (!item.created_at) return false;
    const t = new Date(item.created_at).getTime();
    return Date.now() - t < 1000 * 60 * 60 * 24 * 3; // 3 أيام
  }, [item.created_at]);
  const img = item.cover_image || (Array.isArray(item.images) ? item.images[0] : null);
  const price = item.price_sar != null ? item.price_sar : item.price;
  const isVerified = !!(item.seller_verified_shop || item.seller_verified_merchant);
  const priceType = item.price_type || (item.is_negotiable ? "negotiable" : "fixed");
  const isSold = item.status === "sold" || !!item.sold_at;

  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, isVerified && styles.cardVerified, isSold && styles.cardSold]} activeOpacity={0.86} testID={`listing-${item.listing_id || item.id}`}>
      {isSold ? (
        <View style={styles.soldOverlay} pointerEvents="none">
          <View style={styles.soldStamp}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.soldStampText}>تم البيع</Text>
          </View>
        </View>
      ) : null}
      {isVerified ? (
        <View style={styles.verifiedRibbon}>
          <Ionicons name="shield-checkmark" size={11} color="#fff" />
          <Text style={styles.verifiedRibbonText}>موثّق</Text>
        </View>
      ) : null}
      <View style={styles.cardBody}>
        {/* الصورة — على اليمين في RTL */}
        <View style={styles.cardImgWrap}>
          {img ? (
            <Image source={{ uri: resolveMediaUrl(img) }} style={styles.cardImg} resizeMode="cover" />
          ) : (
            <View style={[styles.cardImg, styles.cardImgPh]}>
              <Ionicons name="image-outline" size={28} color={TAIR.textSoft} />
            </View>
          )}
        </View>

        {/* معلومات — على اليسار في RTL */}
        <View style={styles.cardInfo}>
          {isNew ? (
            <View style={styles.badgeNew}>
              <Text style={styles.badgeNewText}>جديد</Text>
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={1}>{item.title || "بلا عنوان"}</Text>
          {item.city ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{item.city}</Text>
              <Ionicons name="location-outline" size={14} color={TAIR.textSoft} />
            </View>
          ) : null}
          <View style={styles.priceRow}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
              <Text style={styles.price}>
                {price != null ? `${toArabicNumerals(price)} ر.س` : "—"}
              </Text>
              <View style={[styles.priceTypeChip, priceType === "negotiable" ? styles.priceTypeNego : styles.priceTypeFixed]}>
                <Text style={[styles.priceTypeText, priceType === "negotiable" ? { color: "#8B5E00" } : { color: TAIR.emerald }]}>
                  {priceType === "negotiable" ? "على السوم" : "حد"}
                </Text>
              </View>
            </View>
            <View style={styles.viewsChip}>
              <Ionicons name="eye-outline" size={12} color={TAIR.textSoft} />
              <Text style={styles.viewsText}>{toArabicNumerals(item.view_count || 0)}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  loading: {
    position: "absolute", top: TAIR.headerH + 60, left: 0, right: 0, alignItems: "center",
  },

  // شريط ثابت (لا يتحرك مع التمرير)
  stickyBar: {
    backgroundColor: TAIR.bg,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: TAIR.divider,
    zIndex: 5,
  },

  // صف البحث
  searchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: TAIR.pagePadX,
  },
  catBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: TAIR.gold,
    shadowColor: TAIR.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  catIconInner: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  searchBox: {
    flex: 1,
    height: TAIR.searchH,
    borderRadius: TAIR.searchH / 2,
    backgroundColor: TAIR.card,
    borderWidth: 1,
    borderColor: TAIR.divider,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: TAIR.text,
    fontSize: TAIR.fontPlaceholder,
    textAlign: "right",
    padding: 0,
  },

  // كرت — بدون فراغ بين الإعلانات + خط رفيع
  card: {
    backgroundColor: TAIR.card,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    position: "relative",
  },
  cardVerified: {
    borderRightWidth: 4,
    borderRightColor: "#2563EB",
    backgroundColor: "#F8FBFF",
  },
  verifiedRibbon: {
    position: "absolute",
    top: 8, left: TAIR.pagePadX,
    zIndex: 5,
    flexDirection: "row-reverse", alignItems: "center", gap: 3,
    backgroundColor: "#2563EB",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedRibbonText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cardSold: {
    borderWidth: 2, borderColor: "#DC2626",
  },
  soldOverlay: {
    position: "absolute",
    top: 0, right: 0, left: 0, bottom: 0,
    backgroundColor: "rgba(220,38,38,0.10)",
    zIndex: 3,
    alignItems: "center", justifyContent: "center",
    pointerEvents: "none",
  },
  soldStamp: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    backgroundColor: "#DC2626",
    paddingHorizontal: 18, paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2, borderColor: "#fff",
    transform: [{ rotate: "-8deg" }],
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  soldStampText: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  priceTypeChip: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 0.5,
  },
  priceTypeFixed: { backgroundColor: "#E9F3EC", borderColor: TAIR.emerald + "55" },
  priceTypeNego: { backgroundColor: "#FFF3D9", borderColor: "#B8860B55" },
  priceTypeText: { fontSize: 10, fontWeight: "900" },
  rowDivider: {
    height: 1,
    backgroundColor: TAIR.divider,
    marginHorizontal: TAIR.pagePadX,
  },
  cardBody: {
    flexDirection: "row-reverse",   // RTL: صورة يمين، معلومات يسار
    alignItems: "center",
    paddingHorizontal: TAIR.pagePadX,
    paddingVertical: 12,
    gap: 12,
  },
  cardInfo: { flex: 1, alignItems: "flex-end" },
  badgeNew: {
    backgroundColor: TAIR.goldLight,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  badgeNewText: {
    color: TAIR.goldDark,
    fontSize: TAIR.fontBadge,
    fontWeight: "800",
  },
  title: {
    color: TAIR.emerald,
    fontWeight: "800",
    fontSize: TAIR.fontItemTitle,
    textAlign: "right",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  metaText: { color: TAIR.textSoft, fontSize: TAIR.fontMeta },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 2,
  },
  price: { color: TAIR.emerald, fontSize: TAIR.fontPrice, fontWeight: "900" },
  viewsChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#F0EAD8",
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: TAIR.divider,
  },
  viewsText: {
    color: TAIR.textSoft,
    fontSize: 11,
    fontWeight: "800",
  },
  cardImgWrap: {
    width: TAIR.listingImg,
    height: TAIR.listingImg,
    borderRadius: TAIR.listingImgRadius,
    overflow: "hidden",
    backgroundColor: TAIR.divider,
  },
  cardImg: { width: "100%", height: "100%" },
  cardImgPh: { alignItems: "center", justifyContent: "center", backgroundColor: TAIR.divider },

  // زر "رحلات الطيور القادمة"
  // زر عائم لإضافة إعلان
  fab: {
    position: "absolute",
    bottom: 100,
    left: 20,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: TAIR.emerald,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: TAIR.gold,
    shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  // زر "المزاد العام" — كبسولة نحيفة أسفل شريط البحث
  auctionBtn: {
    marginTop: 8,
    marginHorizontal: TAIR.pagePadX,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: TAIR.emerald,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
  auctionIconBox: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#0F241C",
    alignItems: "center", justifyContent: "center",
    borderWidth: 0.5, borderColor: TAIR.gold,
  },
  auctionTitle: { color: TAIR.gold, fontSize: 12, fontWeight: "800", textAlign: "right" },
  auctionSub: { color: "#E0C580", fontSize: 11, marginTop: 2, textAlign: "right" },
  auctionBanner: {
    marginTop: -6, marginBottom: 4, marginHorizontal: 40, height: 42,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10,
  },
  auctionLabel: { color: TAIR.gold, fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  auctionOrnament: { width: 42, height: 1, backgroundColor: TAIR.gold, opacity: 0.6 },
  auctionBannerWrap: {
    height: 62,
    marginTop: -8,
    marginBottom: 6,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  auctionBannerImg: {
    width: "70%",
    height: 62,
  },

  tripsCta: {
    marginTop: 20,
    height: 44,
    borderRadius: 22,
    backgroundColor: TAIR.card,
    borderWidth: 1,
    borderColor: TAIR.divider,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TAIR.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tripsCtaText: {
    color: TAIR.emerald,
    fontSize: TAIR.fontGoldBtn,
    fontWeight: "800",
  },

  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyText: { color: TAIR.textSoft, fontSize: 14, textAlign: "center", fontWeight: "700", lineHeight: 22 },
  emptyCta: {
    backgroundColor: TAIR.emerald, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1, borderColor: TAIR.gold, marginTop: 6,
  },
  emptyCtaText: { color: TAIR.gold, fontSize: 12, fontWeight: "900" },

  // شيت الفئات (Bottom Sheet مُحسّن)
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,36,28,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: TAIR.card,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: TAIR.divider,
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: TAIR.divider,
    marginBottom: 8,
  },
  sheetTitle: {
    color: TAIR.emerald,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  sheetClearInline: {
    color: TAIR.goldDark,
    fontSize: 13,
    fontWeight: "800",
  },
  sheetRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TAIR.divider,
  },
  sheetRowText: { color: TAIR.text, fontSize: 15, fontWeight: "600" },
  sheetIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F0EAD8",
    alignItems: "center", justifyContent: "center",
    marginLeft: 10,
    borderWidth: 1, borderColor: TAIR.divider,
  },
});
