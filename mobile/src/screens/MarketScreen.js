/**
 * MarketScreen (طير — السوق)
 * هيدر فني، بحث هادئ، دعوة مزاد رفيعة، ثم بطاقات إعلان بظل ناعم.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TairHeader from "../components/TairHeader";
import ListingCard from "../components/ListingCard";
import { EmptyState, ErrorState, ListingSkeleton, PressableScale } from "../components/TairUI";
import AuctionMark from "../components/AuctionMark";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { listingsApi, speciesApi } from "../services/tairApi";
import { FALLBACK_FAMILIES, familyIcon, groupFamilies } from "../constants/marketFamilies";

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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [pickedCat, setPickedCat] = useState(null);
  const [families, setFamilies] = useState(FALLBACK_FAMILIES);

  useEffect(() => {
    speciesApi
      .families()
      .then((r) => {
        const items = Array.isArray(r) ? r : r?.items || [];
        if (items.length) setFamilies(items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (mode = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const r = await listingsApi.feed({ limit: 40, family: pickedCat, q: debouncedQuery });
      setItems(Array.isArray(r?.items) ? r.items : []);
      setError(null);
    } catch (e) {
      setError(e?.message || "تعذّر تحميل السوق");
      if (mode !== "refresh") setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pickedCat, debouncedQuery]);

  useEffect(() => {
    load();
  }, [pickedCat, debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const listData = useMemo(() => items, [items]);
  const catLabel = families.find((c) => c.family_id === pickedCat)?.name_ar;
  const familyGroups = useMemo(() => groupFamilies(families), [families]);
  const showSkeleton = loading && items.length === 0 && !error;

  return (
    <View style={styles.page}>
      <TairHeader
        variant="market"
        onBellPress={onOpenNotifications}
        onMessagesPress={onOpenMessages}
      />

      <View style={styles.stickyBar}>
        <View style={styles.searchRow}>
          <PressableScale
            style={[styles.catBtn, pickedCat && styles.catBtnOn]}
            onPress={() => setCatOpen(true)}
            haptic
            scaleTo={0.94}
            testID="market-categories-btn"
          >
            <Ionicons name="grid" size={18} color={TAIR.gold} />
          </PressableScale>

          <View style={[styles.searchBox, searchFocus && styles.searchBoxOn]}>
            <Ionicons name="search" size={18} color={searchFocus ? TAIR.emerald : TAIR.faint} />
            <TextInput
              style={styles.searchInput}
              placeholder={catLabel || "ابحث في السوق"}
              placeholderTextColor={TAIR.faint}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              onSubmitEditing={() => setDebouncedQuery(query.trim())}
              returnKeyType="search"
              testID="market-search-input"
            />
            {query ? (
              <PressableScale onPress={() => { setQuery(""); setDebouncedQuery(""); }} scaleTo={0.9} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={TAIR.faint} />
              </PressableScale>
            ) : null}
          </View>
        </View>

        {pickedCat ? (
          <View style={styles.filterRow}>
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>{catLabel}</Text>
              <PressableScale
                onPress={() => setPickedCat(null)}
                scaleTo={0.9}
                hitSlop={8}
                testID="clear-category"
              >
                <Ionicons name="close" size={14} color={TAIR.gold} />
              </PressableScale>
            </View>
          </View>
        ) : null}

        <PressableScale
          onPress={onOpenAuction}
          haptic
          scaleTo={0.985}
          style={styles.auctionBtn}
          testID="market-auction-banner"
        >
          <AuctionMark size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.auctionTitle}>المزاد العام</Text>
            <Text style={styles.auctionSub}>نافذة المساء · زايد بهدوء</Text>
          </View>
          <Ionicons name="chevron-back" size={16} color={TAIR.goldDark} />
        </PressableScale>
      </View>

      {showSkeleton ? (
        <ListingSkeleton />
      ) : (
        <FlatList
          data={error && listData.length === 0 ? [] : listData}
          keyExtractor={(it) => String(it.listing_id || it.id)}
          renderItem={({ item }) => (
            <ListingCard item={item} onPress={() => onOpenListing?.(item.listing_id || item.id)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor={TAIR.emerald}
              colors={[TAIR.emerald]}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.catalogHead}>
                <Text style={styles.catalogTitle}>الإعلانات المنشورة</Text>
                <Text style={styles.catalogCount}>
                  {listData.length ? `${listData.length} إعلان` : "لا نتائج"}
                </Text>
              </View>
              {error && listData.length > 0 ? (
              <PressableScale onPress={() => load("refresh")} style={styles.inlineError} scaleTo={0.99}>
                <Ionicons name="cloud-offline-outline" size={16} color={TAIR.error} />
                <Text style={styles.inlineErrorText}>تعذّر التحديث — اضغط لإعادة المحاولة</Text>
              </PressableScale>
              ) : null}
            </>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              <PressableScale
                style={styles.tripsCta}
                onPress={onOpenTrips}
                haptic
                testID="market-trips-cta"
              >
                <Ionicons name="airplane-outline" size={16} color={TAIR.emerald} />
                <Text style={styles.tripsCtaText}>رحلات الطيور القادمة</Text>
                <Ionicons name="chevron-back" size={16} color={TAIR.goldDark} />
              </PressableScale>
            </View>
          }
          ListEmptyComponent={
            error ? (
              <ErrorState
                title="تعذّر فتح السوق"
                subtitle="تحقق من الاتصال. إعلاناتك محفوظة وستظهر فور عودة الشبكة."
                onRetry={() => load("initial")}
                testID="market-error"
              />
            ) : (
              <EmptyState
                icon="storefront-outline"
                title={pickedCat ? `لا توجد إعلانات في «${catLabel}»` : "لا توجد عروض حالياً"}
                subtitle={pickedCat ? "جرّب فئة أخرى أو اعرض السوق كاملاً." : "كن أول من يعرض اليوم."}
                actionLabel={pickedCat ? "عرض جميع الفئات" : undefined}
                onAction={pickedCat ? () => setPickedCat(null) : undefined}
                testID="market-empty"
              />
            )
          }
          contentContainerStyle={styles.listContent}
          style={{ backgroundColor: TAIR.bg }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <PressableScale
        onPress={onCreateListing}
        haptic
        scaleTo={0.94}
        style={styles.fab}
        testID="market-create-listing-fab"
      >
        <Ionicons name="add" size={28} color={TAIR.gold} />
      </PressableScale>

      <Modal transparent visible={catOpen} animationType="slide" onRequestClose={() => setCatOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setCatOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetGrabber} />
            <View style={styles.sheetHeader}>
              <PressableScale onPress={() => setCatOpen(false)} scaleTo={0.9} hitSlop={12} testID="cat-close">
                <Ionicons name="close" size={22} color={TAIR.emerald} />
              </PressableScale>
              <Text style={styles.sheetTitle}>اختر فئة</Text>
              <PressableScale onPress={() => { setPickedCat(null); setCatOpen(false); }} scaleTo={0.96}>
                <Text style={styles.sheetClearInline}>الكل</Text>
              </PressableScale>
            </View>
            <ScrollView
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {familyGroups.map((group) => (
                <View key={group.id}>
                  <Text style={styles.sheetGroup}>{group.label}</Text>
                  {group.items.map((c) => {
                    const on = pickedCat === c.family_id;
                    return (
                      <PressableScale
                        key={c.family_id}
                        style={[styles.sheetRow, on && styles.sheetRowOn]}
                        onPress={() => {
                          setPickedCat(on ? null : c.family_id);
                          setCatOpen(false);
                        }}
                        haptic
                        scaleTo={0.99}
                      >
                        <View style={styles.sheetRowMain}>
                          <View style={[styles.sheetIconWrap, on && styles.sheetIconOn]}>
                            <Ionicons name={familyIcon(c.family_id)} size={18} color={on ? TAIR.gold : TAIR.emerald} />
                          </View>
                          <Text style={[styles.sheetRowText, on && styles.sheetRowTextOn]}>{c.name_ar}</Text>
                        </View>
                        {on ? <Ionicons name="checkmark-circle" size={20} color={TAIR.gold} /> : null}
                      </PressableScale>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  stickyBar: {
    backgroundColor: TAIR.bg,
    paddingTop: 4,
    paddingBottom: 10,
    zIndex: 5,
  },
  searchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  catBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.7)",
    ...TAIR_ELEVATION.hair,
  },
  catBtnOn: { backgroundColor: TAIR.emeraldDeep },
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: TAIR.card,
    borderWidth: 1,
    borderColor: TAIR.divider,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  searchBoxOn: {
    borderColor: TAIR.gold,
    ...TAIR_ELEVATION.hair,
  },
  searchInput: {
    flex: 1,
    color: TAIR.ink,
    fontSize: 14,
    textAlign: "right",
    padding: 0,
    fontWeight: "600",
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: "flex-end",
  },
  filterPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: TAIR.emerald,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 5,
  },
  filterPillText: { color: TAIR.gold, fontSize: 12, fontWeight: "800" },
  auctionBtn: {
    marginTop: 10,
    marginHorizontal: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: TAIR.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.4)",
    ...TAIR_ELEVATION.hair,
  },
  auctionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
  },
  auctionTitle: { color: TAIR.emerald, fontSize: 14, fontWeight: "800", textAlign: "right" },
  auctionSub: { color: TAIR.muted, fontSize: 11, marginTop: 1, textAlign: "right", fontWeight: "600" },
  catalogHead: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  catalogTitle: { color: TAIR.emerald, fontSize: 16, fontWeight: "900" },
  catalogCount: { color: TAIR.muted, fontSize: 12, fontWeight: "700" },
  listContent: {
    paddingTop: 12,
    paddingBottom: TAIR.tabBarH + 88,
    backgroundColor: TAIR.bg,
    flexGrow: 1,
  },
  footer: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  tripsCta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: TAIR.card,
    borderWidth: 1,
    borderColor: TAIR.divider,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...TAIR_ELEVATION.hair,
  },
  tripsCtaText: {
    color: TAIR.emerald,
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
  },
  fab: {
    position: "absolute",
    bottom: TAIR.tabBarH + 18,
    left: 18,
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TAIR.gold,
    ...TAIR_ELEVATION.float,
  },
  inlineError: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: TAIR.dangerSoft,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  inlineErrorText: { color: TAIR.error, fontSize: 12, fontWeight: "700", flex: 1, textAlign: "right" },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,36,28,0.48)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: TAIR.card,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...TAIR_ELEVATION.float,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: TAIR.divider,
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    marginBottom: 4,
  },
  sheetTitle: { color: TAIR.emerald, fontSize: 17, fontWeight: "800" },
  sheetGroup: {
    color: TAIR.goldDark || TAIR.gold,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  sheetClearInline: { color: TAIR.goldDark, fontSize: 13, fontWeight: "800" },
  sheetRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    marginBottom: 4,
  },
  sheetRowOn: { backgroundColor: TAIR.emeraldWash },
  sheetRowMain: { flexDirection: "row-reverse", alignItems: "center", flex: 1 },
  sheetRowText: { color: TAIR.ink, fontSize: 15, fontWeight: "600" },
  sheetRowTextOn: { color: TAIR.emerald, fontWeight: "800" },
  sheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: TAIR.creamDeep,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  sheetIconOn: { backgroundColor: TAIR.emerald },
});
