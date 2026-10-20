// طير — Mobile: Seller Analytics (owner-only)
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR_PALETTE } from "../constants/tairDesign";

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  "https://saqr4u.com";

const fmt = (v) => new Intl.NumberFormat("ar-SA").format(v || 0);

async function api(path) {
  const r = await fetch(`${API_URL.replace(/\/+$/, "")}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default function SellerAnalyticsScreen({ user, onBack }) {
  const [overview, setOverview] = useState(null);
  const [listings, setListings] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const uid = user?.user_id || user?.id;

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    (async () => {
      try {
        const [ov, ls] = await Promise.all([
          api(`/api/sellers/${uid}/analytics/overview?requester_id=${uid}&days=${days}`),
          api(`/api/sellers/${uid}/analytics/listings?requester_id=${uid}&limit=50`),
        ]);
        setOverview(ov);
        setListings(ls.items || []);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, days]);

  return (
    <View style={s.wrap}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>إحصائياتي</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={s.chipRow}>
        {[7, 30, 90].map((d) => (
          <TouchableOpacity
            key={d}
            onPress={() => setDays(d)}
            style={[s.chip, days === d && s.chipActive]}
          >
            <Text style={[s.chipText, days === d && s.chipTextActive]}>آخر {d} يوم</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={TAIR_PALETTE.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          <View style={s.kpiGrid}>
            <Kpi icon="eye" color="#1B3D2F" label="مشاهدات" value={fmt(overview?.engagement?.views)} />
            <Kpi icon="heart" color="#ec4899" label="إعجابات" value={fmt(overview?.engagement?.likes)} />
            <Kpi icon="chatbubble" color="#1B3D2F" label={`رسائل ${days}ي`} value={fmt(overview?.engagement?.messages_received)} />
            <Kpi icon="bag" color="#f59e0b" label="طلبات" value={fmt(overview?.orders?.total)} />
          </View>

          <View style={s.summary}>
            <Row label="إعلانات نشطة" value={overview?.listings?.active || 0} total={overview?.listings?.total || 0} />
            <Row label="إعلانات مباعة" value={overview?.listings?.sold || 0} total={overview?.listings?.total || 0} />
            <Row label="نسبة إتمام الطلبات" value={overview?.orders?.total ? `${Math.round((overview?.orders?.completion_rate || 0) * 100)}%` : "—"} />
            <Row label="متوسط التقييم" value={overview?.rating?.avg != null ? `${overview.rating.avg.toFixed(1)} ⭐` : "—"} last />
          </View>

          <Text style={s.section}>أداء كل إعلان</Text>
          {listings.length === 0 ? (
            <Text style={s.muted}>لا توجد إعلانات بعد</Text>
          ) : (
            listings.map((l) => (
              <View key={l.listing_id} style={s.listingRow}>
                <View style={s.listingImg}>
                  {l.cover && <Image source={{ uri: l.cover }} style={{ width: "100%", height: "100%" }} />}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.listingTitle} numberOfLines={1}>{l.title}</Text>
                  <View style={s.listingStats}>
                    <View style={s.statBox}>
                      <Ionicons name="eye-outline" size={13} color="#6B5E4A" />
                      <Text style={s.statItem}>{fmt(l.view_count)}</Text>
                    </View>
                    <View style={s.statBox}>
                      <Ionicons name="heart-outline" size={13} color="#6B5E4A" />
                      <Text style={s.statItem}>{fmt(l.likes_count)}</Text>
                    </View>
                    <Text style={[s.statItem, {
                      color: l.status === "sold" ? "#8B3A2F" : l.status === "paused" ? "#f59e0b" : "#1B3D2F",
                      fontWeight: "800",
                    }]}>
                      {l.status === "sold" ? "مباع" : l.status === "paused" ? "متوقف" : "نشط"}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Kpi({ icon, color, label, value }) {
  return (
    <View style={s.kpi}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={s.kpiVal}>{value}</Text>
      <Text style={s.kpiLbl}>{label}</Text>
    </View>
  );
}
function Row({ label, value, total, last }) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>
        {value}{total != null && <Text style={s.rowTotal}> / {total}</Text>}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F7F1E8" },
  topBar: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingTop: 48, paddingBottom: 12, paddingHorizontal: 14, backgroundColor: TAIR_PALETTE.primary,
  },
  topTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  chipRow: {
    flexDirection: "row-reverse", padding: 10, gap: 6, backgroundColor: "#fff",
    borderBottomWidth: 1, borderColor: "#e2e8f0",
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#F7F1E8",
  },
  chipActive: { backgroundColor: TAIR_PALETTE.primary, borderColor: TAIR_PALETTE.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  chipTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#6B5E4A", padding: 20, textAlign: "center" },

  kpiGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  kpi: {
    width: "48%", backgroundColor: "#fff", padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  kpiVal: { fontSize: 22, fontWeight: "900", color: "#0F241C", marginTop: 6 },
  kpiLbl: { fontSize: 11, color: "#6B5E4A", fontWeight: "700", marginTop: 2 },

  summary: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  row: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    padding: 12, borderBottomWidth: 1, borderColor: "#f1f5f9",
  },
  rowLabel: { fontSize: 13, color: "#6B5E4A", fontWeight: "600" },
  rowValue: { fontSize: 14, fontWeight: "800", color: "#0F241C" },
  rowTotal: { color: "#8A7B66", fontWeight: "600" },

  section: { fontSize: 15, fontWeight: "800", color: "#0F241C", marginBottom: 8, textAlign: "right" },
  listingRow: {
    flexDirection: "row-reverse", backgroundColor: "#fff",
    padding: 10, borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center",
  },
  listingImg: { width: 56, height: 56, borderRadius: 10, overflow: "hidden", backgroundColor: "#f1f5f9" },
  listingTitle: { fontSize: 13, fontWeight: "700", color: "#0F241C", textAlign: "right" },
  listingStats: { flexDirection: "row-reverse", gap: 10, marginTop: 6 },
  statItem: { fontSize: 11, color: "#6B5E4A", fontWeight: "700" },
  statBox: { flexDirection: "row-reverse", alignItems: "center", gap: 3 },
});
