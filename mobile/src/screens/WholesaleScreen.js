// طير — Mobile Wholesale / Suppliers Screen (mirrors web)
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../services/api";
import ScreenHeader from "../components/ScreenHeader";
import { openWhatsApp, toTel } from "../utils/contactPhone";

const req = (path) => api.fetch(path);

function SupplierCard({ supplier, onPress }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(supplier)}
      data-testid={`supplier-${supplier.supplier_id}`}
    >
      <View style={styles.cardHead}>
        <View style={styles.logoWrap}>
          {supplier.logo_url ? (
            <Image source={{ uri: supplier.logo_url }} style={styles.logo} />
          ) : (
            <Ionicons name="storefront" size={30} color="#1B3D2F" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {supplier.name}
            </Text>
            {supplier.is_verified ? (
              <Ionicons name="checkmark-circle" size={16} color="#0891b2" />
            ) : null}
          </View>
          {supplier.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color="#8A7B66" />
              <Text style={styles.metaText}>{supplier.city}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {supplier.description ? (
        <Text style={styles.desc} numberOfLines={2}>
          {supplier.description}
        </Text>
      ) : null}

      {Array.isArray(supplier.categories) && supplier.categories.length > 0 ? (
        <View style={styles.chipsRow}>
          {supplier.categories.slice(0, 4).map((c) => (
            <View key={c.id || c} style={styles.miniChip}>
              <Text style={styles.miniChipText}>{c.label || c.name || c}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {supplier.whatsapp ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#25d366" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              openWhatsApp(supplier.whatsapp, "السلام عليكم، أستفسر عن التوريد بالجملة");
            }}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={styles.actionText}>واتساب</Text>
          </TouchableOpacity>
        ) : null}
        {supplier.phone ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#1B3D2F" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              const tel = toTel(supplier.phone);
              if (tel) Linking.openURL(`tel:${tel}`);
            }}
          >
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={styles.actionText}>اتصال</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function WholesaleScreen({ onBack }) {
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    req(`/api/wholesale/categories`)
      .then((r) =>
        setCategories(
          (r?.items || []).map((c) => ({
            id: c.id,
            label: c.name_ar || c.label || c.name,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeCat !== "all") params.set("category_id", activeCat);
      params.set("limit", "50");
      const r = await req(`/api/wholesale/suppliers?${params}`);
      setSuppliers(r?.items || []);
    } catch (e) {
      console.warn("wholesale load", e?.message);
      setSuppliers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCat]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="الموردون بالجملة"
        subtitle="تجار موثوقون للطيور والمستلزمات"
        onBack={onBack}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catsBar}
      >
        <TouchableOpacity
          onPress={() => setActiveCat("all")}
          style={[styles.chip, activeCat === "all" && styles.chipActive]}
        >
          <Text style={[styles.chipText, activeCat === "all" && styles.chipTextActive]}>
            الكل
          </Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => setActiveCat(c.id)}
            style={[styles.chip, activeCat === c.id && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, activeCat === c.id && styles.chipTextActive]}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={suppliers}
        keyExtractor={(s) => s.supplier_id || s.id}
        renderItem={({ item }) => <SupplierCard supplier={item} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#1B3D2F"
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#1B3D2F" size="large" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={64} color="#a7f3d0" />
              <Text style={styles.emptyTitle}>لا يوجد موردون في هذه الفئة</Text>
              <Text style={styles.emptyText}>جرّب تصفح فئة أخرى قريباً</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "900" },

  catsBar: {
    flexDirection: "row-reverse",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "#1B3D2F" },
  chipText: { color: "#6B5E4A", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 8 },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: "100%", height: "100%" },
  nameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  name: { fontSize: 15, fontWeight: "900", color: "#0F241C", textAlign: "right" },
  metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontSize: 12, color: "#6B5E4A" },
  desc: { fontSize: 13, color: "#475569", lineHeight: 19, textAlign: "right", marginTop: 4 },
  chipsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 8 },
  miniChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f0fdfa",
    borderRadius: 8,
  },
  miniChipText: { color: "#1B3D2F", fontSize: 11, fontWeight: "800" },
  actionRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F241C",
    marginTop: 12,
    textAlign: "center",
  },
  emptyText: { fontSize: 13, color: "#6B5E4A", marginTop: 6, textAlign: "center" },
});
