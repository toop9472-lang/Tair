/**
 * كرت إعلان السوق — البطاقة الأساسية في طير.
 * صورة يمين، معلومات يسار، شارات هادئة، وظل زمردي خفيف.
 */
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../services/api";
import { TAIR, TAIR_ELEVATION, toArabicNumerals } from "../constants/tairTheme";
import { PressableScale, TairBadge, TairImage } from "./TairUI";

export function resolveMediaUrl(u) {
  if (!u || typeof u !== "string") return "";
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_URL}${u}`;
  return u;
}

export default function ListingCard({ item, onPress, testID }) {
  const isNew = useMemo(() => {
    if (!item?.created_at) return false;
    const t = new Date(item.created_at).getTime();
    return Date.now() - t < 1000 * 60 * 60 * 24 * 3;
  }, [item?.created_at]);

  const raw = item?.cover_image || (Array.isArray(item?.images) ? item.images[0] : null);
  const img = resolveMediaUrl(raw);
  const price = item?.price_sar != null ? item.price_sar : item?.price;
  const isVerified = !!(item?.seller_verified_shop || item?.seller_verified_merchant);
  const priceType = item?.price_type || (item?.is_negotiable ? "negotiable" : "fixed");
  const isSold = item?.status === "sold" || !!item?.sold_at;
  const species = item?.species_name || item?.species || item?.family_name;

  return (
    <PressableScale
      onPress={onPress}
      haptic
      scaleTo={0.985}
      style={[styles.card, isVerified && styles.cardVerified, isSold && styles.cardSold]}
      testID={testID || `listing-${item?.listing_id || item?.id}`}
    >
      <View style={styles.imgWrap}>
        <TairImage uri={img} style={styles.img} iconSize={26} />
        {isSold ? <View style={styles.imgDim} /> : null}
      </View>

      <View style={styles.info}>
        <View style={styles.badgeRow}>
          {isSold ? <TairBadge label="تم البيع" tone="sold" icon="checkmark-circle" /> : null}
          {isVerified ? <TairBadge label="موثّق" tone="emerald" icon="shield-checkmark" /> : null}
          {isNew && !isSold ? <TairBadge label="جديد" tone="new" /> : null}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item?.title || "بلا عنوان"}
        </Text>

        <View style={styles.metaRow}>
          {item?.city ? (
            <View style={styles.metaChip}>
              <Ionicons name="location-outline" size={12} color={TAIR.muted} />
              <Text style={styles.metaText} numberOfLines={1}>{item.city}</Text>
            </View>
          ) : null}
          {species ? (
            <Text style={styles.species} numberOfLines={1}>{species}</Text>
          ) : null}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {price != null ? `${toArabicNumerals(price)} ` : "— "}
            <Text style={styles.currency}>ر.س</Text>
          </Text>
          <View style={styles.priceMeta}>
            <TairBadge
              label={priceType === "negotiable" ? "على السوم" : "حد"}
              tone={priceType === "negotiable" ? "gold" : "success"}
            />
            <View style={styles.views}>
              <Ionicons name="eye-outline" size={12} color={TAIR.faint} />
              <Text style={styles.viewsText}>{toArabicNumerals(item?.view_count || 0)}</Text>
            </View>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    backgroundColor: TAIR.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(230,220,200,0.9)",
    ...TAIR_ELEVATION.card,
  },
  cardVerified: {
    borderColor: "rgba(198,161,91,0.55)",
  },
  cardSold: {
    opacity: 0.92,
  },
  imgWrap: {
    width: 108,
    height: 108,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: TAIR.creamDeep,
  },
  img: { width: "100%", height: "100%" },
  imgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,36,28,0.28)",
  },
  info: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  badgeRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
    minHeight: 0,
  },
  title: {
    color: TAIR.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "right",
    width: "100%",
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    width: "100%",
    marginTop: 4,
  },
  metaChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },
  metaText: { color: TAIR.muted, fontSize: 12, fontWeight: "600" },
  species: { color: TAIR.faint, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  price: {
    color: TAIR.emerald,
    fontSize: 17,
    fontWeight: "900",
  },
  currency: { fontSize: 12, fontWeight: "700", color: TAIR.emeraldSoft },
  priceMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  views: { flexDirection: "row-reverse", alignItems: "center", gap: 3 },
  viewsText: { color: TAIR.faint, fontSize: 11, fontWeight: "700" },
});
