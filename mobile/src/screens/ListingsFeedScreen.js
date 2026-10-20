// طير — Listings Feed (Home tab)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { listingsApi, speciesApi } from "../services/tairApi";
import { TairBanner } from "../components/TairBanner";
import { CitySelectorSheet } from "../components/CitySelectorSheet";
import { ALL_LOCATIONS } from "../constants/saudiCities";

// Resolve possibly-relative media URLs from backend (when R2 is unavailable)
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

const CITIES = [
  "الكل",
  "الرياض",
  "جدة",
  "مكة",
  "المدينة",
  "الدمام",
  "الأحساء",
  "الطائف",
  "بريدة",
  "تبوك",
  "أبها",
];

const formatPrice = (sar) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(sar) + " ر.س";

function ListingCard({ item, onPress }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress(item)}
      data-testid={`listing-card-${item.listing_id}`}
    >
      <View style={styles.imageWrap}>
        {item.cover_image ? (
          <Image source={{ uri: resolveMediaUrl(item.cover_image) }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="images-outline" size={40} color="#8A7B66" />
          </View>
        )}
        {item.price_negotiable ? (
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>قابل للتفاوض</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color="#6B5E4A" />
          <Text style={styles.metaText}>{item.city}</Text>
          {item.district ? (
            <Text style={styles.metaText}> · {item.district}</Text>
          ) : null}
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(item.price_sar)}</Text>
          <View style={styles.stats}>
            <Ionicons name="eye-outline" size={13} color="#8A7B66" />
            <Text style={styles.statText}>{item.view_count || 0}</Text>
            <Ionicons
              name="heart-outline"
              size={13}
              color="#8A7B66"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.statText}>{item.favorite_count || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ListingsFeedScreen({
  user,
  onOpenListing,
  onCreateListing,
  onOpenWholesale,
}) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [q, setQ] = useState("");
  const [families, setFamilies] = useState([]);
  const [citySheetOpen, setCitySheetOpen] = useState(false);

  const load = useCallback(
    async (reset = false) => {
      try {
        if (reset) setLoading(true);
        const params = { limit: 30 };
        if (selectedCity) params.city = selectedCity;
        if (selectedFamily) params.family = selectedFamily;
        if (q.trim()) params.q = q.trim();
        const res = await listingsApi.feed(params);
        setListings(res.items || []);
        setTotal(res.total || 0);
      } catch (e) {
        console.warn("feed error", e?.message || e);
        setListings([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCity, selectedFamily, q],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    speciesApi
      .families()
      .then((r) => {
        const items = Array.isArray(r) ? r : r?.items || [];
        setFamilies(items);
      })
      .catch(() => {});
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const renderItem = ({ item }) => (
    <ListingCard item={item} onPress={onOpenListing} />
  );

  const renderHeader = useMemo(
    () => (
      <View>
        {/* Unified banner (compact) — city + create moved BELOW the categories row */}
        <TairBanner tall />

        {/* Families / categories row (mirrors web) */}
        {families.length > 0 || onOpenWholesale ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.speciesRow}
            contentContainerStyle={{ paddingHorizontal: 14 }}
          >
            <TouchableOpacity
              style={[styles.speciesChip, !selectedFamily && styles.speciesChipActive]}
              onPress={() => setSelectedFamily(null)}
              data-testid="chip-family-all"
            >
              <Text
                style={[
                  styles.speciesChipText,
                  !selectedFamily && styles.speciesChipTextActive,
                ]}
              >
                الكل
              </Text>
            </TouchableOpacity>
            {onOpenWholesale ? (
              <TouchableOpacity
                style={[styles.speciesChip, styles.suppliersChip]}
                onPress={onOpenWholesale}
                data-testid="chip-suppliers"
              >
                <Ionicons
                  name="storefront"
                  size={13}
                  color="#8A6A2E"
                  style={{ marginLeft: 4 }}
                />
                <Text style={[styles.speciesChipText, { color: "#1B3D2F", fontWeight: "800" }]}>
                  الموردون
                </Text>
              </TouchableOpacity>
            ) : null}
            {families.map((f) => {
              const active = f.family_id === selectedFamily;
              return (
                <TouchableOpacity
                  key={f.family_id}
                  style={[styles.speciesChip, active && styles.speciesChipActive]}
                  onPress={() => setSelectedFamily(f.family_id)}
                  data-testid={`chip-family-${f.family_id}`}
                >
                  <Text
                    style={[
                      styles.speciesChipText,
                      active && styles.speciesChipTextActive,
                    ]}
                  >
                    {f.name_ar}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.cityBtn}
            onPress={() => setCitySheetOpen(true)}
            testID="home-city-btn"
          >
            <Ionicons name="location" size={13} color="#1B3D2F" />
            <Text style={styles.cityBtnText} numberOfLines={1}>
              {selectedCity || "جميع المدن"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createBtn}
            onPress={onCreateListing}
            testID="home-create-btn"
          >
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={styles.createBtnText}>أضف إعلان</Text>
          </TouchableOpacity>

          <Text style={styles.resultCountInline}>{total} إعلان</Text>
        </View>
      </View>
    ),
    [
      selectedCity,
      selectedFamily,
      families,
      total,
      onCreateListing,
      onOpenWholesale,
    ],
  );

  const renderEmpty = () =>
    loading ? (
      <View style={styles.emptyBox}>
        <ActivityIndicator color="#2F6B45" size="large" />
      </View>
    ) : (
      <View style={styles.emptyBox}>
        <Ionicons name="egg-outline" size={64} color="#a7f3d0" />
        <Text style={styles.emptyTitle}>لا توجد إعلانات مطابقة</Text>
        <Text style={styles.emptyText}>
          جرّب تغيير المدينة أو النوع، أو انشر إعلانك الآن
        </Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.listing_id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 10 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2F6B45" />
        }
        showsVerticalScrollIndicator={false}
      />

      <CitySelectorSheet
        visible={citySheetOpen}
        title="اختر المدينة"
        selected={selectedCity}
        onSelect={(c) => setSelectedCity(c)}
        onClose={() => setCitySheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },

  hero: {
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  heroRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#065f46",
    textAlign: "right",
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#1B3D2F",
    textAlign: "right",
    marginTop: 2,
  },
  ctaButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: {
    color: "#065f46",
    fontWeight: "700",
    fontSize: 13,
  },
  searchWrap: {
    marginTop: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    color: "#0F241C",
    fontSize: 14,
    textAlign: "right",
    padding: 0,
  },

  chipsRow: { paddingVertical: 8, backgroundColor: "#fff" },
  chip: {
    marginHorizontal: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  chipActive: { backgroundColor: "#065f46" },
  chipText: { color: "#475569", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#fff" },

  speciesRow: {
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  speciesChip: {
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  speciesChipActive: { backgroundColor: "#1B3D2F", borderColor: "#1B3D2F" },
  speciesChipText: { color: "#1B3D2F", fontWeight: "600", fontSize: 12 },
  speciesChipTextActive: { color: "#fff" },
  suppliersChip: {
    backgroundColor: "#F7F1E8",
    borderColor: "rgba(198,161,91,0.7)",
  },

  resultBar: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  resultCount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
    textAlign: "right",
  },
  actionsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  cityBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#99f6e4",
    maxWidth: 150,
  },
  cityBtnText: { color: "#1B3D2F", fontSize: 11.5, fontWeight: "800", maxWidth: 110 },
  createBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#1B3D2F",
  },
  createBtnText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
  resultCountInline: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: "#8A7B66",
    textAlign: "left",
  },

  card: {
    flex: 1,
    margin: 6,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F241C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  imageWrap: { position: "relative", aspectRatio: 1 },
  image: { width: "100%", height: "100%", backgroundColor: "#f1f5f9" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  priceBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(6, 95, 70, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  cardBody: { padding: 10 },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F241C",
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  metaText: { color: "#6B5E4A", fontSize: 11 },
  priceRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  price: { color: "#065f46", fontSize: 16, fontWeight: "800" },
  stats: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },
  statText: { color: "#8A7B66", fontSize: 11, fontWeight: "600" },

  emptyBox: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  emptyText: {
    fontSize: 13,
    color: "#6B5E4A",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
