// طير — Trips List (Carrier network) + Create/Edit
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tripsApi } from "../services/tairApi";
import TripsMapMobile from "../components/TripsMapMobile";
import { CityTriggerButton, CitySelectorSheet } from "../components/CitySelectorSheet";
import { SAUDI_CITIES, ALL_LOCATIONS } from "../constants/saudiCities";
import ScreenHeader from "../components/ScreenHeader";
import TairHeader from "../components/TairHeader";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { EmptyState, ErrorState, ListSkeleton } from "../components/TairUI";

const CITIES = ALL_LOCATIONS;
const VEHICLES = ["سيدان", "SUV", "بيك أب", "شاحنة صغيرة"];

const statusColor = (s) =>
  ({
    scheduled: "#3D6B54",
    departed: "#eab308",
    in_transit: "#f59e0b",
    arrived: "#3D6B54",
    completed: "#064e3b",
    cancelled: "#ef4444",
  }[s] || "#64748b");
const statusLabel = (s) =>
  ({
    scheduled: "مجدولة",
    departed: "انطلقت",
    in_transit: "في الطريق",
    arrived: "وصلت",
    completed: "مكتملة",
    cancelled: "ملغاة",
  }[s] || s);

function TripCard({ trip, onPress, onViewOnMap, onContact }) {
  const dt = trip.depart_at ? new Date(trip.depart_at) : null;
  const carrierName = trip.carrier_name || "موصل طير";
  const carrierAvatar = trip.carrier_avatar;
  const rating = trip.carrier_rating_avg;
  const completed = trip.carrier_trips_completed || 0;
  const phone = trip.carrier_phone || trip.carrier_whatsapp;
  const digits = phone ? String(phone).replace(/[^0-9]/g, "") : "";
  const hasWaypoints = Array.isArray(trip.waypoints) && trip.waypoints.length > 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => onPress(trip)}
      data-testid={`trip-card-${trip.trip_id}`}
    >
      {/* Carrier header */}
      <View style={styles.carrierHead}>
        <View style={styles.carrierAvatarWrap}>
          {carrierAvatar ? (
            <Image source={{ uri: carrierAvatar }} style={styles.carrierAvatar} />
          ) : (
            <View style={[styles.carrierAvatar, styles.carrierAvatarPh]}>
              <Text style={styles.carrierInitial}>{carrierName.charAt(0)}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.carrierName} numberOfLines={1}>{carrierName}</Text>
          <View style={styles.carrierMeta}>
            {rating != null && (
              <View style={styles.starRow}>
                <Ionicons name="star" size={11} color="#facc15" />
                <Text style={styles.starText}>{Number(rating).toFixed(1)}</Text>
              </View>
            )}
            <Text style={styles.carrierSub}>{completed} رحلة مكتملة</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor(trip.status) + "22" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(trip.status) }]} />
          <Text style={[styles.statusText, { color: statusColor(trip.status) }]}>
            {statusLabel(trip.status)}
          </Text>
        </View>
      </View>

      {/* Route visualization */}
      <View style={styles.routeVisual}>
        <View style={styles.routeCityBlock}>
          <Text style={styles.routeCityName}>{trip.from_city}</Text>
          <Text style={styles.routeCityLabel}>الانطلاق</Text>
        </View>
        <View style={styles.routeLine}>
          <View style={styles.routeDotStart} />
          <View style={styles.routeLineFill} />
          {hasWaypoints && (
            <View style={styles.waypointsPill}>
              <Ionicons name="location" size={10} color="#1B3D2F" />
              <Text style={styles.waypointsText}>{trip.waypoints.join(" · ")}</Text>
            </View>
          )}
          <View style={styles.routeLineFill} />
          <View style={styles.routeDotEnd} />
        </View>
        <View style={styles.routeCityBlock}>
          <Text style={styles.routeCityName}>{trip.to_city}</Text>
          <Text style={styles.routeCityLabel}>الوصول</Text>
        </View>
      </View>

      {/* Trip meta chips */}
      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Ionicons name="calendar-outline" size={12} color="#1B3D2F" />
          <Text style={styles.metaText}>
            {dt
              ? `${dt.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })} · ${dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`
              : "-"}
          </Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="cube-outline" size={12} color="#3D6B54" />
          <Text style={[styles.metaText, { color: "#0F241C" }]}>
            {trip.available_cages}/{trip.total_cages} قفص
          </Text>
        </View>
        {trip.has_ac ? (
          <View style={styles.metaChip}>
            <Ionicons name="snow-outline" size={12} color="#3D6B54" />
            <Text style={[styles.metaText, { color: "#3D6B54" }]}>مكيّف</Text>
          </View>
        ) : null}
        {trip.is_direct && (
          <View style={[styles.metaChip, { backgroundColor: "#fef3c7" }]}>
            <Ionicons name="flash" size={12} color="#d97706" />
            <Text style={[styles.metaText, { color: "#d97706" }]}>مباشرة</Text>
          </View>
        )}
        {trip.price_hint_sar && (
          <View style={[styles.metaChip, { backgroundColor: "#f0fdfa" }]}>
            <Ionicons name="cash-outline" size={12} color="#1B3D2F" />
            <Text style={[styles.metaText, { color: "#1B3D2F", fontWeight: "800" }]}>
              {trip.price_hint_sar} ر.س
            </Text>
          </View>
        )}
      </View>

      {/* Contact action buttons */}
      <View style={styles.contactRow}>
        {digits && (
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: "#25D366" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              const msg = encodeURIComponent(`السلام عليكم، أنا مهتم برحلتك من ${trip.from_city} إلى ${trip.to_city}`);
              Linking.openURL(`https://wa.me/${digits}?text=${msg}`);
            }}
            data-testid={`trip-whatsapp-${trip.trip_id}`}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>واتساب</Text>
          </TouchableOpacity>
        )}
        {digits && (
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: "#1B3D2F" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              Linking.openURL(`tel:${digits}`);
            }}
            data-testid={`trip-call-${trip.trip_id}`}
          >
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>اتصال</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.contactBtn, { backgroundColor: "#0F241C" }]}
          onPress={(e) => {
            e?.stopPropagation?.();
            onContact?.(trip);
          }}
          data-testid={`trip-message-${trip.trip_id}`}
        >
          <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
          <Text style={styles.contactBtnText}>مراسلة</Text>
        </TouchableOpacity>
        {onViewOnMap && (
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: "#7c3aed" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              onViewOnMap(trip);
            }}
            data-testid={`view-on-map-${trip.trip_id}`}
          >
            <Ionicons name="map" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {trip.notes ? (
        <Text style={styles.notes} numberOfLines={2}>
          {trip.notes}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function CreateTripModal({ visible, user, onClose, onCreated, editingTrip }) {
  const [saving, setSaving] = useState(false);
  const [citySheet, setCitySheet] = useState(null); // 'from' | 'to' | 'waypoint' | null
  const [form, setForm] = useState({
    from_city: "الرياض",
    to_city: "جدة",
    depart_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    vehicle_type: "سيدان",
    has_ac: true,
    total_cages: "4",
    accepts_sensitive: true,
    notes: "",
    price_hint_sar: "",
    is_direct: false,
    waypoints: [],
  });
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  // Pre-fill when editing
  useEffect(() => {
    if (visible && editingTrip) {
      setForm({
        from_city: editingTrip.from_city || "الرياض",
        to_city: editingTrip.to_city || "جدة",
        depart_at: editingTrip.depart_at
          ? new Date(editingTrip.depart_at).toISOString().slice(0, 16)
          : new Date(Date.now() + 86400000).toISOString().slice(0, 16),
        vehicle_type: editingTrip.vehicle_type || "سيدان",
        has_ac: editingTrip.has_ac !== false,
        total_cages: String(editingTrip.total_cages || 4),
        accepts_sensitive: editingTrip.accepts_sensitive !== false,
        notes: editingTrip.notes || "",
        price_hint_sar: editingTrip.price_hint_sar ? String(editingTrip.price_hint_sar) : "",
        is_direct: !!editingTrip.is_direct,
        waypoints: editingTrip.waypoints || [],
      });
    }
  }, [visible, editingTrip]);

  const addWaypoint = (city) => {
    if (!city) return;
    if (form.waypoints.includes(city) || city === form.from_city || city === form.to_city) return;
    set("waypoints", [...form.waypoints, city]);
  };
  const removeWaypoint = (i) => set("waypoints", form.waypoints.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (form.from_city === form.to_city) {
      Alert.alert("تنبيه", "المدينتان يجب أن تكونا مختلفتين");
      return;
    }
    try {
      setSaving(true);
      const userId = user?.user_id || user?.id;
      const payload = {
        from_city: form.from_city,
        to_city: form.to_city,
        depart_at: new Date(form.depart_at).toISOString(),
        vehicle_type: form.vehicle_type,
        has_ac: form.has_ac,
        total_cages: Number(form.total_cages) || 4,
        accepts_sensitive: form.accepts_sensitive,
        notes: form.notes.trim() || null,
        price_hint_sar: form.price_hint_sar ? Number(form.price_hint_sar) : null,
        is_direct: form.is_direct,
        waypoints: form.is_direct ? [] : (form.waypoints || []),
      };
      let saved;
      if (editingTrip?.trip_id) {
        saved = await tripsApi.update(editingTrip.trip_id, userId, payload);
      } else {
        saved = await tripsApi.create(userId, payload);
      }
      onCreated && onCreated(saved);
      onClose();
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر حفظ الرحلة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: TAIR.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { backgroundColor: TAIR.emerald }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={26} color={TAIR.gold} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: TAIR.gold }]}>{editingTrip ? "تعديل الرحلة" : "رحلة جديدة"}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <FormLabel>مسار الرحلة *</FormLabel>
          <View style={styles.createRouteRow}>
            <CityTriggerButton
              iconName="location"
              iconColor="#1B3D2F"
              label="من"
              value={form.from_city}
              onPress={() => setCitySheet("from")}
              testId="create-trip-from"
            />
            <View style={styles.arrowBadgeSmall}>
              <Ionicons name="arrow-back" size={14} color="#94a3b8" />
            </View>
            <CityTriggerButton
              iconName="flag"
              iconColor="#C6A15B"
              label="إلى"
              value={form.to_city}
              onPress={() => setCitySheet("to")}
              testId="create-trip-to"
            />
          </View>

          <CitySelectorSheet
            visible={citySheet === "from"}
            title="من أي مدينة؟"
            selected={form.from_city}
            onSelect={(c) => set("from_city", c)}
            onClose={() => setCitySheet(null)}
          />
          <CitySelectorSheet
            visible={citySheet === "to"}
            title="إلى أي مدينة؟"
            selected={form.to_city}
            onSelect={(c) => set("to_city", c)}
            onClose={() => setCitySheet(null)}
          />
          <CitySelectorSheet
            visible={citySheet === "waypoint"}
            title="أضف مدينة مرور"
            selected={null}
            onSelect={(c) => addWaypoint(c)}
            onClose={() => setCitySheet(null)}
          />

          {/* Direct / Multi-stop toggle */}
          <View style={{ marginTop: 14, marginBottom: 4 }}>
            <FormLabel>نوع الرحلة</FormLabel>
            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              <TouchableOpacity
                style={[styles.pill, { flex: 1, alignItems: "center" }, form.is_direct && styles.pillActive]}
                onPress={() => set("is_direct", true)}
              >
                <Text style={[styles.pillText, form.is_direct && styles.pillTextActive]}>
                  مباشرة
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, { flex: 1, alignItems: "center" }, !form.is_direct && styles.pillActive]}
                onPress={() => set("is_direct", false)}
              >
                <Text style={[styles.pillText, !form.is_direct && styles.pillTextActive]}>
                  متعددة المحطات
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Waypoints picker — visible only for multi-stop trips */}
          {!form.is_direct && (
            <View style={{ marginTop: 8 }}>
              <FormLabel>مدن المرور (اختياري) — مثل جدة، مكة</FormLabel>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {form.waypoints.map((wp, i) => (
                  <TouchableOpacity
                    key={`${wp}-${i}`}
                    style={styles.waypointChip}
                    onPress={() => removeWaypoint(i)}
                  >
                    <Ionicons name="close-circle" size={14} color="#dc2626" />
                    <Text style={styles.waypointChipText}>{wp}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addWaypointBtn}
                  onPress={() => setCitySheet("waypoint")}
                  data-testid="add-waypoint-btn"
                >
                  <Ionicons name="add" size={14} color="#1B3D2F" />
                  <Text style={styles.addWaypointText}>إضافة مدينة مرور</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <FormLabel>تاريخ ووقت الانطلاق *</FormLabel>
          <TextInput
            style={styles.input}
            value={form.depart_at}
            onChangeText={(v) => set("depart_at", v)}
            placeholder="YYYY-MM-DDTHH:mm"
            placeholderTextColor="#94a3b8"
          />

          <FormLabel>نوع المركبة</FormLabel>
          <View style={{ flexDirection: "row-reverse", gap: 6 }}>
            {VEHICLES.map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.pill, { flex: 1, alignItems: "center" }, form.vehicle_type === v && styles.pillActive]}
                onPress={() => set("vehicle_type", v)}
              >
                <Text style={[styles.pillText, form.vehicle_type === v && styles.pillTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row-reverse", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <FormLabel>عدد الأقفاص</FormLabel>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={form.total_cages}
                onChangeText={(v) => set("total_cages", v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormLabel>سعر إرشادي (ر.س)</FormLabel>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="50"
                placeholderTextColor="#94a3b8"
                value={form.price_hint_sar}
                onChangeText={(v) => set("price_hint_sar", v)}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.checkbox} onPress={() => set("has_ac", !form.has_ac)}>
            <Ionicons name={form.has_ac ? "checkbox" : "square-outline"} size={22} color="#3D6B54" />
            <Text style={styles.checkLabel}>يوجد تكييف</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => set("accepts_sensitive", !form.accepts_sensitive)}
          >
            <Ionicons
              name={form.accepts_sensitive ? "checkbox" : "square-outline"}
              size={22}
              color="#3D6B54"
            />
            <Text style={styles.checkLabel}>أقبل الطيور الحساسة</Text>
          </TouchableOpacity>

          <FormLabel>ملاحظات</FormLabel>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            multiline
            placeholder="أي تفاصيل إضافية للمرسلين"
            placeholderTextColor="#94a3b8"
            value={form.notes}
            onChangeText={(v) => set("notes", v)}
          />
        </ScrollView>

        <View style={styles.submitBar}>
          <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitText}>نشر الرحلة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormLabel({ children }) {
  return <Text style={styles.formLabel}>{children}</Text>;
}

export default function TripsScreen({ user, onOpenTrip, onContactCarrier, onOpenNotifications, onOpenMessages, onOpenAskExperts, editingTrip: initialEditingTrip, initialCreateOpen, onDone }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [fromCity, setFromCity] = useState(null);
  const [toCity, setToCity] = useState(null);
  const [createOpen, setCreateOpen] = useState(!!initialCreateOpen);
  const [editingTrip, setEditingTrip] = useState(initialEditingTrip || null);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'map'
  const [focusedTripId, setFocusedTripId] = useState(null);
  const [citySheet, setCitySheet] = useState(null); // 'from' | 'to' | null

  const openOnMap = useCallback((trip) => {
    setFocusedTripId(trip.trip_id);
    setViewMode("map");
  }, []);

  const filterByCity = useCallback((city, type) => {
    if (type === "from") setFromCity(city);
    else setToCity(city);
    setFocusedTripId(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const params = { status: "active", limit: 50 };
      if (fromCity) params.from_city = fromCity;
      if (toCity) params.to_city = toCity;
      const res = await tripsApi.list(params);
      setTrips(res.items || []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e?.message || "تعذّر تحميل الرحلات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromCity, toCity]);

  useEffect(() => {
    load();
  }, [load]);

  const renderHeader = (
    <View>
      <TairHeader variant="trips" onBellPress={onOpenNotifications} onMessagesPress={onOpenMessages} />
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: TAIR.emerald, fontSize: 18, fontWeight: "900" }}>الرحلات المتاحة</Text>
        <TouchableOpacity
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: TAIR.emerald,
            alignItems: "center", justifyContent: "center",
          }}
          onPress={() => setCreateOpen(true)}
          data-testid="create-trip-cta"
        >
          <Ionicons name="add" size={22} color={TAIR.gold} />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <View style={styles.viewToggle} data-testid="trips-view-toggle">
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
            onPress={() => setViewMode("list")}
            data-testid="trips-view-list"
          >
            <Ionicons
              name="list"
              size={14}
              color={viewMode === "list" ? "#fff" : "#64748b"}
            />
            <Text
              style={[
                styles.viewToggleText,
                viewMode === "list" && styles.viewToggleTextActive,
              ]}
            >
              قائمة
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "map" && styles.viewToggleBtnActive]}
            onPress={() => setViewMode("map")}
            data-testid="trips-view-map"
          >
            <Ionicons
              name="map"
              size={14}
              color={viewMode === "map" ? "#fff" : "#64748b"}
            />
            <Text
              style={[
                styles.viewToggleText,
                viewMode === "map" && styles.viewToggleTextActive,
              ]}
            >
              خريطة
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <View style={styles.cityPickerRow}>
            <CityTriggerButton
              iconName="location"
              iconColor="#1B3D2F"
              label="من"
              value={fromCity}
              onPress={() => setCitySheet("from")}
              testId="trips-picker-from"
            />
            <View style={styles.arrowBadge}>
              <Ionicons name="arrow-back" size={16} color="#94a3b8" />
            </View>
            <CityTriggerButton
              iconName="flag"
              iconColor="#C6A15B"
              label="إلى"
              value={toCity}
              onPress={() => setCitySheet("to")}
              testId="trips-picker-to"
            />
          </View>
          {(fromCity || toCity) ? (
            <TouchableOpacity
              onPress={() => { setFromCity(null); setToCity(null); }}
              style={styles.clearFiltersBtn}
              data-testid="trips-clear-filters"
            >
              <Ionicons name="close-circle" size={16} color="#dc2626" />
              <Text style={styles.clearFiltersText}>مسح الفلاتر</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {/* Prominent "Add Trip" CTA — parity with "أضف إعلان" on Listings */}
        <TouchableOpacity
          style={styles.addTripCta}
          onPress={() => setCreateOpen(true)}
          testID="add-trip-cta"
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={18} color="#C6A15B" />
          <Text style={styles.addTripCtaText}>أضف رحلة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <CitySelectorSheet
        visible={citySheet === "from"}
        title="من أي مدينة؟"
        selected={fromCity}
        onSelect={(c) => setFromCity(c)}
        onClose={() => setCitySheet(null)}
      />
      <CitySelectorSheet
        visible={citySheet === "to"}
        title="إلى أي مدينة؟"
        selected={toCity}
        onSelect={(c) => setToCity(c)}
        onClose={() => setCitySheet(null)}
      />
      {viewMode === "map" ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#3D6B54"
            />
          }
        >
          {renderHeader}
          {loading ? (
            <ListSkeleton count={3} />
          ) : loadError && trips.length === 0 ? (
            <ErrorState title="تعذّر تحميل الرحلات" onRetry={load} />
          ) : trips.length === 0 ? (
            <EmptyState icon="map-outline" title="لا توجد رحلات على الخريطة" subtitle="غيّر الفلاتر أو انشر رحلة جديدة" />
          ) : (
            <TripsMapMobile
              trips={trips}
              onTripPress={onOpenTrip}
              onCityFilter={filterByCity}
              focusedTripId={focusedTripId}
              height={520}
            />
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.trip_id}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onPress={onOpenTrip}
              onViewOnMap={openOnMap}
              onContact={(t) => onContactCarrier?.(t.carrier_id, t.carrier_name)}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            loading ? (
              <ListSkeleton count={4} />
            ) : loadError ? (
              <ErrorState title="تعذّر تحميل الرحلات" subtitle="تحقق من الاتصال ثم أعد المحاولة." onRetry={load} />
            ) : (
              <EmptyState icon="airplane-outline" title="لا توجد رحلات حالياً" subtitle="كن أول موصل. انشر رحلتك واستقبل الطلبات." />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#3D6B54"
            />
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      <CreateTripModal
        visible={createOpen}
        user={user}
        editingTrip={editingTrip}
        onClose={() => {
          setCreateOpen(false);
          setEditingTrip(null);
          if (onDone) onDone();
        }}
        onCreated={() => {
          load();
          if (onDone) onDone();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TAIR.bg },
  hero: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: "#0F241C", textAlign: "right" },
  heroSubtitle: { fontSize: 13, color: "#1B3D2F", marginTop: 2, textAlign: "right" },
  ctaButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: { color: "#0F241C", fontWeight: "700", fontSize: 13 },

  filters: { backgroundColor: TAIR.card, paddingHorizontal: 14, paddingVertical: 10 },
  cityPickerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  arrowBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  clearFiltersBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    alignSelf: "flex-end",
  },
  clearFiltersText: { color: "#dc2626", fontWeight: "700", fontSize: 12 },

  addTripCta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    marginHorizontal: 4,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: "#1B3D2F",
    borderRadius: 14,
    shadowColor: "#1B3D2F",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  addTripCtaText: { color: "#C6A15B", fontWeight: "800", fontSize: 14 },
  createRouteRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  arrowBadgeSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  viewOnMapBtn: {
    marginTop: 10,
    backgroundColor: "#1B3D2F",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#1B3D2F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  viewOnMapText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  viewToggle: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
    gap: 4,
    padding: 3,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    marginBottom: 8,
  },
  viewToggleBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viewToggleBtnActive: { backgroundColor: "#1B3D2F" },
  viewToggleText: { color: "#6B5E4A", fontWeight: "800", fontSize: 12 },
  viewToggleTextActive: { color: "#C6A15B" },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0EAD8",
    borderWidth: 1,
    borderColor: "#E6DCC8",
  },
  filterChipActive: { backgroundColor: "#1B3D2F", borderColor: "#C6A15B" },
  filterText: { color: "#6B5E4A", fontWeight: "700", fontSize: 12 },
  filterTextActive: { color: "#C6A15B" },

  card: {
    backgroundColor: "#FFFDF8",
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E6DCC8",
    ...TAIR_ELEVATION.card,
  },

  // Carrier header (new redesigned card)
  carrierHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  carrierAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#C6A15B",
    overflow: "hidden",
  },
  carrierAvatar: { width: "100%", height: "100%" },
  carrierAvatarPh: {
    backgroundColor: "#1B3D2F",
    alignItems: "center",
    justifyContent: "center",
  },
  carrierInitial: { color: "#fff", fontSize: 18, fontWeight: "800" },
  carrierName: { fontSize: 14, fontWeight: "800", color: "#0F241C", textAlign: "right" },
  carrierMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  starRow: { flexDirection: "row-reverse", alignItems: "center", gap: 3 },
  starText: { fontSize: 11, color: "#334155", fontWeight: "700" },
  carrierSub: { fontSize: 11, color: "#8A7B66", fontWeight: "600" },

  // Route visual
  routeVisual: {
    marginTop: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  routeCityBlock: { flex: 1, alignItems: "center" },
  routeCityName: { fontSize: 15, fontWeight: "800", color: "#0F241C" },
  routeCityLabel: { fontSize: 10, color: "#8A7B66", fontWeight: "600", marginTop: 2 },
  routeLine: {
    flex: 1.4,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  routeLineFill: {
    flex: 1,
    height: 2,
    backgroundColor: "#C6A15B",
    borderRadius: 1,
  },
  routeDotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1B3D2F",
  },
  routeDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#C6A15B",
  },
  waypointsPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F3EDE2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  waypointsText: { fontSize: 9, fontWeight: "700", color: "#0F241C" },

  // Contact buttons
  contactRow: {
    flexDirection: "row-reverse",
    gap: 6,
    marginTop: 12,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
  },
  contactBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  cageBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3EDE2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cageText: { color: "#0F241C", fontSize: 11, fontWeight: "700" },

  routeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  cityBox: { flex: 1, alignItems: "center" },
  cityLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "600" },
  cityName: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginTop: 2 },
  routeArrow: { paddingHorizontal: 4 },

  waypointChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#C6A15B",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  waypointChipText: { color: "#0F241C", fontSize: 12, fontWeight: "700" },
  addWaypointBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3EDE2",
    borderWidth: 1,
    borderColor: "#C6A15B",
    borderStyle: "dashed",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addWaypointText: { color: "#1B3D2F", fontSize: 12, fontWeight: "700" },


  metaRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  metaChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F7F1E8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaText: { color: "#475569", fontSize: 11, fontWeight: "600" },
  notes: { color: "#64748b", fontSize: 12, marginTop: 10, textAlign: "right" },

  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  emptyText: { fontSize: 13, color: "#64748b", textAlign: "center" },

  // Create modal
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F241C" },
  formLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    textAlign: "right",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E6DCC8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1B3D2F",
    textAlign: "right",
    backgroundColor: "#FFFDF8",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F0EAD8",
    borderWidth: 1,
    borderColor: "#E6DCC8",
  },
  pillActive: { backgroundColor: "#1B3D2F", borderColor: "#C6A15B" },
  pillText: { color: "#6B5E4A", fontWeight: "700", fontSize: 13 },
  pillTextActive: { color: "#C6A15B" },
  checkbox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    marginTop: 8,
  },
  checkLabel: { color: "#334155", fontSize: 13, fontWeight: "600" },
  submitBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 30,
    backgroundColor: "#FFFDF8",
    borderTopWidth: 1,
    borderTopColor: "#E6DCC8",
  },
  submitBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1B3D2F",
    paddingVertical: 14,
    borderRadius: 16,
  },
  submitText: { color: "#C6A15B", fontSize: 16, fontWeight: "800" },
});
