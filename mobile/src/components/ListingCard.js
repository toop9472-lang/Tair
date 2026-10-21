/**
 * كرت إعلان السوق — البطاقة الأساسية في طير.
 * صورة يمين، معلومات يسار، شارات هادئة، وظل زمردي خفيف.
 */
import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../services/api";
import { TAIR, TAIR_ELEVATION, toArabicNumerals } from "../constants/tairTheme";
import { PressableScale, TairImage } from "./TairUI";

export function resolveMediaUrl(u) {
  if (!u || typeof u !== "string") return "";
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_URL}${u}`;
  return u;
}

function ListingCard({ item, onPress, testID }) {
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
  const seller = item?.seller_name;
  const facts = [item?.city, species].filter(Boolean).join("  ·  ");
  const priceWord = priceType === "negotiable" ? "على السوم" : "حد";
  const mark = isSold ? "تم البيع" : isNew ? "جديد" : null;

  return (
    <PressableScale
      onPress={onPress}
      haptic
      scaleTo={0.985}
      style={[styles.card, isSold && styles.cardSold]}
      testID={testID || `listing-${item?.listing_id || item?.id}`}
    >
      <View style={styles.imgWrap}>
        <TairImage uri={img} style={styles.img} iconSize={26} />
        {isSold ? <View style={styles.imgDim} /> : null}
        {mark ? (
          <View style={[styles.mark, isSold && styles.markSold]}>
            <Text style={styles.markText}>{mark}</Text>
          </View>
        ) : null}
        {(item?.videos?.length || item?.video_url) ? (
          <View style={styles.videoMark}>
            <Ionicons name="play" size={11} color={TAIR.gold} />
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {item?.title || "بلا عنوان"}
        </Text>
        {seller ? (
          <Text style={styles.seller} numberOfLines={1}>
            {seller}
            {isVerified ? "  ·  موثّق" : ""}
          </Text>
        ) : isVerified ? (
          <Text style={styles.seller}>موثّق</Text>
        ) : null}
        <Text style={styles.facts} numberOfLines={1}>
          {facts || "السوق"}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {price != null ? toArabicNumerals(price) : "—"}
            <Text style={styles.currency}>  ر.س</Text>
          </Text>
          <Text style={styles.priceAside}>
            {priceWord}  ·  {toArabicNumerals(item?.view_count || 0)} مشاهدة
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

export default memo(ListingCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    backgroundColor: TAIR.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TAIR.line,
    ...TAIR_ELEVATION.card,
  },
  cardSold: { opacity: 0.88 },
  imgWrap: {
    width: 104,
    height: 104,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: TAIR.creamDeep,
  },
  img: { width: "100%", height: "100%" },
  mark: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: TAIR.emerald,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  markSold: { backgroundColor: TAIR.error },
  markText: { color: TAIR.gold, fontSize: 10, fontWeight: "800" },
  videoMark: {
    position: "absolute",
    left: 6,
    bottom: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(15,36,28,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  imgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,36,28,0.28)",
  },
  info: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  title: {
    color: TAIR.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "right",
    width: "100%",
  },
  seller: {
    color: TAIR.goldDark,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    width: "100%",
    marginTop: 2,
  },
  facts: {
    color: TAIR.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
    width: "100%",
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: TAIR.line,
  },
  price: { color: TAIR.emerald, fontSize: 18, fontWeight: "900" },
  currency: { fontSize: 12, fontWeight: "700", color: TAIR.emeraldSoft },
  priceAside: { color: TAIR.faint, fontSize: 11, fontWeight: "700", textAlign: "left" },
});
