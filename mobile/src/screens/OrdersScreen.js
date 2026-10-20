// طير — Orders (buyer/seller/carrier)
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ordersApi } from "../services/tairApi";
import RateUserModal from "../components/RateUserModal";
import { logPositiveEvent, maybeAskForReview } from "../services/rateApp";

const statusMeta = {
  pending: { color: "#0891b2", label: "قيد الانتظار", icon: "time-outline" },
  accepted_by_carrier: { color: "#eab308", label: "قبله الموصل", icon: "checkmark-circle-outline" },
  in_transit: { color: "#f59e0b", label: "في الطريق", icon: "car" },
  delivered: { color: "#2F6B45", label: "تم التسليم", icon: "checkmark-done-outline" },
  completed: { color: "#1B3D2F", label: "مكتمل", icon: "trophy-outline" },
  disputed: { color: "#8B3A2F", label: "نزاع", icon: "alert-circle" },
  cancelled: { color: "#8A7B66", label: "ملغى", icon: "close-circle-outline" },
};

const roleLabel = {
  buyer: "كمشتري",
  seller: "كبائع",
  carrier: "كموصل",
  all: "جميع الأدوار",
};

function OrderCard({ order, onPress, currentUserId }) {
  const meta = statusMeta[order.status] || statusMeta.pending;
  const isBuyer = order.buyer_id === currentUserId;
  const [rateOpen, setRateOpen] = useState(null); // 'seller' | 'carrier'
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress(order)}
      data-testid={`order-card-${order.order_id}`}
    >
      <View style={styles.rowBetween}>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: meta.color + "22" },
          ]}
        >
          <Ionicons name={meta.icon} size={13} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.orderId}>#{order.order_id.slice(-6)}</Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{order.agreed_price_sar} ر.س</Text>
        {order.delivery_fee_hint_sar ? (
          <Text style={styles.deliveryHint}>
            + {order.delivery_fee_hint_sar} ر.س توصيل (إرشادي)
          </Text>
        ) : null}
      </View>

      <View style={styles.partiesRow}>
        <Party icon="storefront-outline" label="البائع" id={order.seller_id} />
        <Party icon="person-outline" label="المشتري" id={order.buyer_id} />
        {order.carrier_id ? (
          <Party icon="car-outline" label="الموصل" id={order.carrier_id} />
        ) : null}
      </View>

      {order.status === "completed" && isBuyer && (
        <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); setRateOpen("seller"); }}
            style={{
              flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
              gap: 6, padding: 10, backgroundColor: "#fef9c3", borderRadius: 12,
              borderWidth: 1, borderColor: "#fde68a",
            }}
            testID="rate-seller-btn"
          >
            <Ionicons name="star" size={14} color="#facc15" />
            <Text style={{ color: "#78350f", fontWeight: "800", fontSize: 12 }}>قيّم البائع</Text>
          </TouchableOpacity>
          {order.carrier_id && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setRateOpen("carrier"); }}
              style={{
                flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
                gap: 6, padding: 10, backgroundColor: "#fef9c3", borderRadius: 12,
                borderWidth: 1, borderColor: "#fde68a",
              }}
              testID="rate-carrier-btn"
            >
              <Ionicons name="star" size={14} color="#facc15" />
              <Text style={{ color: "#78350f", fontWeight: "800", fontSize: 12 }}>قيّم الناقل</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.timestampRow}>
        <Ionicons name="time-outline" size={12} color="#8A7B66" />
        <Text style={styles.timestamp}>
          {order.created_at ? new Date(order.created_at).toLocaleString("ar-SA") : ""}
        </Text>
      </View>

      <RateUserModal
        visible={!!rateOpen}
        raterId={currentUserId}
        targetId={rateOpen === "seller" ? order.seller_id : order.carrier_id}
        role={rateOpen || "seller"}
        orderId={order.order_id}
        onClose={() => setRateOpen(null)}
      />
    </TouchableOpacity>
  );
}

function Party({ icon, label, id }) {
  return (
    <View style={styles.party}>
      <Ionicons name={icon} size={14} color="#2F6B45" />
      <View>
        <Text style={styles.partyLabel}>{label}</Text>
        <Text style={styles.partyId}>#{id?.slice(-6) || "-"}</Text>
      </View>
    </View>
  );
}

export default function OrdersScreen({ user, onOpenOrder }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState("all");

  const load = useCallback(async () => {
    try {
      const userId = user?.user_id || user?.id;
      if (!userId) {
        setOrders([]);
        setLoading(false);
        return;
      }
      const res = await ordersApi.byUser(userId, role);
      const items = res.items || [];
      setOrders(items);
      // Rating prompt: after a completed order (positive moment), maybe show the native review sheet
      try {
        const completed = items.filter(
          (o) => o.status === "completed" && (o.buyer_id === userId),
        );
        if (completed.length > 0) {
          await logPositiveEvent();
          // Small delay so the UI settles first
          setTimeout(() => { maybeAskForReview().catch(() => {}); }, 1200);
        }
      } catch {}
    } catch (e) {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, role]);

  useEffect(() => {
    load();
  }, [load]);

  const renderHeader = (
    <View>
      <LinearGradient
        colors={["#1B3D2F", "#0F241C"]}
        style={styles.hero}
      >
        <Text style={styles.heroTitle}>طلباتي</Text>
        <Text style={styles.heroSubtitle}>تابع جميع صفقاتك في مكان واحد</Text>
      </LinearGradient>
      <View style={styles.rolesBar}>
        {["all", "buyer", "seller", "carrier"].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.roleChip, role === r && styles.roleChipActive]}
            onPress={() => setRole(r)}
            data-testid={`role-filter-${r}`}
          >
            <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
              {roleLabel[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.order_id}
        renderItem={({ item }) => <OrderCard order={item} onPress={onOpenOrder} currentUserId={user?.user_id || user?.id} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#2F6B45" size="large" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={64} color="#a7f3d0" />
              <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
              <Text style={styles.emptyText}>ستظهر هنا طلباتك من البيع أو الشراء أو التوصيل</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#2F6B45"
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  hero: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  heroTitle: { fontSize: 24, fontWeight: "800", color: "#C6A15B", textAlign: "right" },
  heroSubtitle: { fontSize: 13, color: "#F7F1E8", marginTop: 2, textAlign: "right" },

  rolesBar: {
    flexDirection: "row-reverse",
    padding: 10,
    gap: 6,
    backgroundColor: "#fff",
  },
  roleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  roleChipActive: { backgroundColor: "#1B3D2F" },
  roleText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  roleTextActive: { color: "#fff" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#0F241C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  orderId: { fontSize: 12, color: "#8A7B66", fontWeight: "700" },

  priceRow: { marginTop: 10 },
  price: { fontSize: 22, fontWeight: "800", color: "#1B3D2F", textAlign: "right" },
  deliveryHint: { fontSize: 11, color: "#6B5E4A", textAlign: "right", marginTop: 2 },

  partiesRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  party: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  partyLabel: { fontSize: 10, color: "#8A7B66", fontWeight: "600" },
  partyId: { fontSize: 11, color: "#0F241C", fontWeight: "700" },

  timestampRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginTop: 8,
  },
  timestamp: { fontSize: 10, color: "#8A7B66" },

  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  emptyText: { fontSize: 13, color: "#6B5E4A", textAlign: "center" },
});
