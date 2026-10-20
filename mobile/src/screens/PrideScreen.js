/**
 * PrideScreen (Mobile) — شبكة كاملة لأفضل الإعلانات
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR } from "../constants/tairTheme";
import { communityApi } from "../services/tairApi";

export default function PrideScreen({ onBack, onOpenListing }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi.pride()
      .then((d) => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={s.page}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Ionicons name="chevron-forward" size={26} color={TAIR.gold} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 6, marginRight: 12 }}>
          <Ionicons name="trophy-outline" size={20} color={TAIR.gold} />
          <Text style={[s.title, { color: TAIR.gold }]}>فخر المُربّي</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={TAIR.emerald} />
      ) : items.length === 0 ? (
        <Text style={s.emptyText}>
          لا توجد إعلانات مميّزة بعد.
          {"\n"}الإعلانات ذات الإعجابات الأعلى ستظهر هنا.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={s.grid}>
          {items.map((it) => (
            <TouchableOpacity key={it.listing_id} style={s.card} onPress={() => onOpenListing?.(it.listing_id)}>
              <View style={s.imgWrap}>
                {it.image_url ? (
                  <Image source={{ uri: it.image_url }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <View style={{ width: "100%", height: "100%", backgroundColor: TAIR.divider }} />
                )}
                {it.is_new && (
                  <View style={s.newBadge}>
                    <Text style={s.newBadgeText}>★ جديد</Text>
                  </View>
                )}
              </View>
              <View style={{ padding: 10 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{it.title}</Text>
                <Text style={s.cardMeta}>
                  {it.city ? `${it.city} — ` : ""}{it.price_sar ? `${it.price_sar} ر.س` : ""}
                </Text>
                <View style={s.cardFooter}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                    <Ionicons name="heart" size={14} color="#DC2626" />
                    <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "800" }}>{it.likes || 0}</Text>
                  </View>
                  <Ionicons name="bookmark-outline" size={16} color={TAIR.textSoft} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  topBar: { flexDirection: "row-reverse", alignItems: "center", padding: 16, paddingTop: 48, backgroundColor: TAIR.emerald },
  title: { color: TAIR.emerald, fontSize: 18, fontWeight: "900" },
  emptyText: { color: TAIR.textSoft, fontSize: 13, textAlign: "center", padding: 40 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", padding: 12, gap: 10 },
  card: { width: "47%", backgroundColor: TAIR.card, borderRadius: 14, borderWidth: 1, borderColor: TAIR.divider, overflow: "hidden" },
  imgWrap: { width: "100%", aspectRatio: 1.4, backgroundColor: TAIR.divider, position: "relative" },
  newBadge: { position: "absolute", top: 8, left: 8, backgroundColor: TAIR.emerald, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  newBadgeText: { color: TAIR.gold, fontSize: 11, fontWeight: "900" },
  cardTitle: { color: TAIR.emerald, fontSize: 13, fontWeight: "900", marginBottom: 3, textAlign: "right" },
  cardMeta: { color: TAIR.textSoft, fontSize: 11, marginBottom: 8, textAlign: "right" },
  cardFooter: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
});
