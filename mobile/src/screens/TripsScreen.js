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
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { profileApi, tripsApi } from "../services/tairApi";
import TripsMapMobile from "../components/TripsMapMobile";
import TripRequestSection from "../components/TripRequestSection";
import { CityTriggerButton, CitySelectorSheet } from "../components/CitySelectorSheet";
import ScreenHeader from "../components/ScreenHeader";
import TairHeader from "../components/TairHeader";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { EmptyState, ErrorState, ListSkeleton, PressableScale, SoftPulse, TairImage } from "../components/TairUI";
import { displayLocalPhone, openWhatsApp, savedContactPhone, toTel } from "../utils/contactPhone";
import { tripPhase } from "../utils/tripStatus";

const VEHICLES = ["سيدان", "SUV", "بيك أب", "شاحنة صغيرة"];

function localDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayFromNow(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDay(date);
}

const DEPART_HOURS = [
  { h: 6, label: "6 ص" },
  { h: 9, label: "9 ص" },
  { h: 12, label: "12 ظ" },
  { h: 15, label: "3 م" },
  { h: 18, label: "6 م" },
  { h: 21, label: "9 م" },
];

function nearestHour(date) {
  const h = date.getHours();
  return DEPART_HOURS.reduce((best, item) => (
    Math.abs(item.h - h) < Math.abs(best - h) ? item.h : best
  ), 9);
}

const STATUS_FILTERS = [
  { id: "active", label: "المتاحة" },
  { id: "upcoming", label: "قادمة" },
  { id: "live", label: "جارية" },
  { id: "completed", label: "مكتملة" },
];

const TripCard = React.memo(function TripCard({ trip, onPress, onViewOnMap, onContact }) {
  const dt = trip.depart_at ? new Date(trip.depart_at) : null;
  const carrierName = trip.carrier_name || "موصل طير";
  const carrierAvatar = trip.carrier_avatar;
  const rating = trip.carrier_rating_avg;
  const completed = trip.carrier_trips_completed || 0;
  const phone = trip.carrier_whatsapp || trip.carrier_phone;
  const phase = tripPhase(trip.status, trip);
  const hasWaypoints = Array.isArray(trip.waypoints) && trip.waypoints.length > 0;

  const moving = phase.key === "moving";

  return (
    <PressableScale
      style={styles.card}
      scaleTo={0.985}
      onPress={() => onPress(trip)}
      data-testid={`trip-card-${trip.trip_id}`}
    >
      {/* Carrier header */}
      <View style={styles.carrierHead}>
        <View style={styles.carrierAvatarWrap}>
          {carrierAvatar ? (
            <TairImage uri={carrierAvatar} style={styles.carrierAvatar} icon="person" iconSize={16} />
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
        <View style={[styles.statusPill, { backgroundColor: phase.bg }]}>
          {moving ? (
            <SoftPulse size={10} color={phase.fg} />
          ) : (
            <View style={[styles.statusDot, { backgroundColor: phase.fg }]} />
          )}
          <Text style={[styles.statusText, { color: phase.fg }]}>{phase.label}</Text>
        </View>
      </View>

      {/* Route visualization */}
      <View style={styles.routeVisual}>
        <View style={styles.routeCityBlock}>
          <Text style={styles.routeCityName}>{trip.from_city}</Text>
          <Text style={styles.routeCityLabel}>الانطلاق</Text>
        </View>
        <View style={styles.routeLine}>
          {moving ? <SoftPulse size={12} color={TAIR.gold} /> : <View style={styles.routeDotStart} />}
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

      <Text style={styles.factsLine} numberOfLines={2}>
        {dt
          ? `${dt.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })} · ${dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`
          : "الموعد لاحقاً"}
        {"  ·  "}
        {trip.available_cages}/{trip.total_cages} قفص
        {"  ·  "}
        {trip.price_hint_sar ? `${trip.price_hint_sar} ر.س` : "عند الاتفاق"}
        {trip.is_direct ? "  ·  مباشرة" : ""}
        {trip.has_ac ? "  ·  مكيّف" : ""}
      </Text>

      {/* Contact action buttons */}
      <View style={styles.contactRow}>
        {phone ? (
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: "#25D366" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              openWhatsApp(phone, `السلام عليكم، أنا مهتم برحلتك من ${trip.from_city} إلى ${trip.to_city}`);
            }}
            data-testid={`trip-whatsapp-${trip.trip_id}`}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>واتساب</Text>
          </TouchableOpacity>
        ) : null}
        {phone ? (
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: "#1B3D2F" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              const tel = toTel(phone);
              if (tel) Linking.openURL(`tel:${tel}`);
            }}
            data-testid={`trip-call-${trip.trip_id}`}
          >
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>اتصال</Text>
          </TouchableOpacity>
        ) : null}
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
            style={[styles.contactBtn, { backgroundColor: TAIR.goldDark }]}
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
    </PressableScale>
  );
});

function CreateTripModal({ visible, user, onClose, onCreated, editingTrip }) {
  const [saving, setSaving] = useState(false);
  const [citySheet, setCitySheet] = useState(null); // 'from' | 'to' | 'waypoint' | null
  const [form, setForm] = useState({
    from_city: "الرياض",
    to_city: "جدة",
    depart_day: dayFromNow(1),
    depart_hour: 9,
    vehicle_type: "سيدان",
    has_ac: true,
    total_cages: "4",
    accepts_sensitive: true,
    notes: "",
    price_hint_sar: "",
    is_direct: false,
    waypoints: [],
    contact_phone: "",
  });
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!visible || editingTrip) return;
    const saved = displayLocalPhone(savedContactPhone(user));
    if (saved) setForm((prev) => ({ ...prev, contact_phone: saved }));
  }, [visible, editingTrip, user]);

  // Pre-fill when editing
  useEffect(() => {
    if (visible && editingTrip) {
      setForm({
        from_city: editingTrip.from_city || "الرياض",
        to_city: editingTrip.to_city || "جدة",
        depart_day: editingTrip.depart_at ? localDay(new Date(editingTrip.depart_at)) : dayFromNow(1),
        depart_hour: editingTrip.depart_at ? nearestHour(new Date(editingTrip.depart_at)) : 9,
        vehicle_type: editingTrip.vehicle_type || "سيدان",
        has_ac: editingTrip.has_ac !== false,
        total_cages: String(editingTrip.total_cages || 4),
        accepts_sensitive: editingTrip.accepts_sensitive !== false,
        notes: editingTrip.notes || "",
        price_hint_sar: editingTrip.price_hint_sar ? String(editingTrip.price_hint_sar) : "",
        is_direct: !!editingTrip.is_direct,
        waypoints: editingTrip.waypoints || [],
        contact_phone: displayLocalPhone(editingTrip.carrier_whatsapp || editingTrip.carrier_phone || savedContactPhone(user)),
      });
    }
  }, [visible, editingTrip, user]);

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
        depart_at: new Date(`${form.depart_day}T${String(form.depart_hour).padStart(2, "0")}:00:00`).toISOString(),
        vehicle_type: form.vehicle_type,
        has_ac: form.has_ac,
        total_cages: Number(form.total_cages) || 4,
        accepts_sensitive: form.accepts_sensitive,
        notes: form.notes.trim() || null,
        price_hint_sar: form.price_hint_sar ? Number(form.price_hint_sar) : null,
        is_direct: form.is_direct,
        waypoints: form.is_direct ? [] : (form.waypoints || []),
        carrier_name: user?.name || null,
        carrier_phone: form.contact_phone.trim() || null,
      };
      if (form.contact_phone.trim()) {
        profileApi.update(userId, { whatsapp: form.contact_phone.trim() }).catch(() => {});
      }
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
              <Ionicons name="arrow-back" size={14} color="#8A7B66" />
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
                    <Ionicons name="close-circle" size={14} color="#8B3A2F" />
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

          <FormLabel>تاريخ الانطلاق</FormLabel>
          <View style={styles.choiceRow}>
            {[
              { label: "اليوم", day: dayFromNow(0) },
              { label: "غداً", day: dayFromNow(1) },
              { label: "بعد غد", day: dayFromNow(2) },
            ].map((item) => {
              const on = form.depart_day === item.day;
              return (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.choice, on && styles.choiceOn]}
                  onPress={() => set("depart_day", item.day)}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <FormLabel>ساعة الانطلاق</FormLabel>
          <View style={styles.choiceRow}>
            {DEPART_HOURS.map((item) => {
              const on = form.depart_hour === item.h;
              return (
                <TouchableOpacity
                  key={item.h}
                  style={[styles.choice, on && styles.choiceOn]}
                  onPress={() => set("depart_hour", item.h)}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
                placeholderTextColor="#8A7B66"
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

          <FormLabel>واتساب للتواصل — من متجرك</FormLabel>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            placeholder="05xxxxxxxx"
            placeholderTextColor="#8A7B66"
            value={form.contact_phone}
            onChangeText={(v) => set("contact_phone", v)}
            testID="create-trip-phone"
          />

          <FormLabel>ملاحظات</FormLabel>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            multiline
            placeholder="أي تفاصيل إضافية للمرسلين"
            placeholderTextColor="#8A7B66"
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
  const [section, setSection] = useState("trips"); // trips | request
  const [requestRefresh, setRequestRefresh] = useState(0);
  const [statusFilter, setStatusFilter] = useState("active");
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'map'
  const [focusedTripId, setFocusedTripId] = useState(null);
  const [citySheet, setCitySheet] = useState(null); // 'from' | 'to' | null

  const openOnMap = useCallback((trip) => {
    setFocusedTripId(trip.trip_id);
    setViewMode("map");
  }, []);

  const renderTrip = useCallback(({ item }) => (
    <TripCard
      trip={item}
      onPress={onOpenTrip}
      onViewOnMap={openOnMap}
      onContact={(t) => onContactCarrier?.(t.carrier_id, t.carrier_name)}
    />
  ), [onOpenTrip, openOnMap, onContactCarrier]);

  const filterByCity = useCallback((city, type) => {
    if (type === "from") setFromCity(city);
    else setToCity(city);
    setFocusedTripId(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const params = { status: statusFilter, limit: 50 };
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
  }, [fromCity, toCity, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const renderHeader = (
    <View>
      <TairHeader variant="trips" userId={user?.user_id || user?.id} onBellPress={onOpenNotifications} onMessagesPress={onOpenMessages} />
      <View style={styles.sectionSwitch} testID="trips-section-switch">
        <TouchableOpacity
          style={[styles.sectionBtn, section === "trips" && styles.sectionBtnOn]}
          onPress={() => setSection("trips")}
          testID="trips-tab-available"
        >
          <Text style={[styles.sectionBtnText, section === "trips" && styles.sectionBtnTextOn]}>الرحلات</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionBtn, section === "request" && styles.sectionBtnOn]}
          onPress={() => setSection("request")}
          testID="trips-tab-request"
        >
          <Text style={[styles.sectionBtnText, section === "request" && styles.sectionBtnTextOn]}>طلب رحلة</Text>
        </TouchableOpacity>
      </View>
      {section === "trips" ? (
        <PressableScale
          onPress={() => setCreateOpen(true)}
          scaleTo={0.97}
          haptic
          style={styles.addTripCta}
          testID="add-trip-cta"
          accessibilityLabel="أضف رحلة"
        >
          <View style={styles.addTripIcon}>
            <Ionicons name="add" size={24} color={TAIR.emerald} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addTripTitle}>أضف رحلتك</Text>
            <Text style={styles.addTripSub}>انشر رحلة واستقبل حجوزات الأقفاص</Text>
          </View>
          <Ionicons name="chevron-back" size={18} color={TAIR.gold} />
        </PressableScale>
      ) : null}
      {section === "trips" ? (
      <View style={styles.toolbar}>
        <View style={styles.tabRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={styles.tabScroll}
          >
            {STATUS_FILTERS.map((f) => {
              const on = statusFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.tabChip, on && styles.tabChipOn]}
                  onPress={() => setStatusFilter(f.id)}
                  testID={`trips-filter-${f.id}`}
                >
                  {f.id === "live" ? <SoftPulse size={8} color={on ? TAIR.gold : TAIR.goldDark} /> : null}
                  <Text style={[styles.tabChipText, on && styles.tabChipTextOn]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.tabTools} data-testid="trips-view-toggle">
            <TouchableOpacity
              style={[styles.toolBtn, viewMode === "list" && styles.toolBtnOn]}
              onPress={() => setViewMode("list")}
              data-testid="trips-view-list"
              accessibilityLabel="قائمة"
            >
              <Ionicons name="list" size={16} color={viewMode === "list" ? TAIR.gold : TAIR.emerald} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolBtn, viewMode === "map" && styles.toolBtnOn]}
              onPress={() => setViewMode("map")}
              data-testid="trips-view-map"
              accessibilityLabel="خريطة"
            >
              <Ionicons name="map" size={15} color={viewMode === "map" ? TAIR.gold : TAIR.emerald} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.routeRow}>
          <TouchableOpacity
            style={styles.cityChip}
            onPress={() => setCitySheet("from")}
            testID="trips-picker-from"
          >
            <Text style={styles.cityKicker}>من</Text>
            <Text style={styles.cityValue} numberOfLines={1}>{fromCity || "أي مدينة"}</Text>
          </TouchableOpacity>
          <Ionicons name="arrow-back" size={14} color={TAIR.faint} />
          <TouchableOpacity
            style={styles.cityChip}
            onPress={() => setCitySheet("to")}
            testID="trips-picker-to"
          >
            <Text style={styles.cityKicker}>إلى</Text>
            <Text style={styles.cityValue} numberOfLines={1}>{toCity || "أي مدينة"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setFromCity(null); setToCity(null); }}
            disabled={!fromCity && !toCity}
            style={[styles.clearBtn, !(fromCity || toCity) && styles.clearBtnIdle]}
            data-testid="trips-clear-filters"
            accessibilityLabel="مسح الفلاتر"
          >
            <Ionicons name="close-circle" size={18} color={fromCity || toCity ? "#8B3A2F" : TAIR.faint} />
          </TouchableOpacity>
        </View>
      </View>
      ) : null}
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
      {section === "request" ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRequestRefresh((n) => n + 1);
                setRefreshing(false);
              }}
              tintColor={TAIR.emerald}
            />
          }
        >
          {renderHeader}
          <TripRequestSection user={user} refreshKey={requestRefresh} />
        </ScrollView>
      ) : viewMode === "map" ? (
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
          renderItem={renderTrip}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={6}
          updateCellsBatchingPeriod={40}
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

  sectionSwitch: {
    flexDirection: "row-reverse",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: TAIR.creamDeep,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  sectionBtn: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center" },
  sectionBtnOn: { backgroundColor: TAIR.emerald },
  sectionBtnText: { color: TAIR.emerald, fontWeight: "800", fontSize: 14 },
  sectionBtnTextOn: { color: TAIR.gold },
  toolbar: {
    backgroundColor: TAIR.card,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TAIR.line,
    padding: 8,
    gap: 8,
  },
  tabRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  addTripCta: {
    flexDirection: "row-reverse", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginTop: 10, marginBottom: 2,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18,
    backgroundColor: TAIR.emerald, borderWidth: 1.5, borderColor: TAIR.gold,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  addTripIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: TAIR.gold, alignItems: "center", justifyContent: "center" },
  addTripTitle: { color: TAIR.gold, fontSize: 16, fontWeight: "900", textAlign: "right" },
  addTripSub: { color: "rgba(247,241,232,0.85)", fontSize: 12, fontWeight: "600", textAlign: "right", marginTop: 2 },
  tabScroll: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingVertical: 2 },
  tabChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: TAIR.creamDeep,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  tabChipOn: { backgroundColor: TAIR.emerald },
  tabChipText: { color: TAIR.emerald, fontWeight: "800", fontSize: 12 },
  tabChipTextOn: { color: TAIR.gold },
  tabTools: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  toolBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TAIR.creamDeep,
  },
  toolBtnOn: { backgroundColor: TAIR.emerald },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TAIR.emerald,
  },
  routeRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  cityChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: TAIR.cream,
    borderWidth: 1,
    borderColor: TAIR.line,
    paddingHorizontal: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  cityKicker: { color: TAIR.goldDark, fontSize: 11, fontWeight: "800" },
  cityValue: { flex: 1, color: TAIR.ink, fontSize: 12, fontWeight: "700", textAlign: "right" },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8EBE7",
  },
  clearBtnIdle: { backgroundColor: TAIR.creamDeep },
  filterChips: { flexDirection: "row-reverse", gap: 8, paddingVertical: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: TAIR.creamDeep,
  },
  filterChipOn: { backgroundColor: TAIR.emerald },
  filterChipText: { color: TAIR.emerald, fontWeight: "800", fontSize: 12 },
  filterChipTextOn: { color: TAIR.gold },
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
  clearFiltersText: { color: "#8B3A2F", fontWeight: "700", fontSize: 12 },

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
  cityLabel: { fontSize: 10, color: "#8A7B66", fontWeight: "600" },
  cityName: { fontSize: 18, fontWeight: "800", color: "#0F241C", marginTop: 2 },
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


  factsLine: {
    marginTop: 12,
    color: TAIR.emerald,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 18,
  },
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
  notes: { color: "#6B5E4A", fontSize: 12, marginTop: 10, textAlign: "right" },

  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  emptyText: { fontSize: 13, color: "#6B5E4A", textAlign: "center" },

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
  choiceRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: TAIR.surfaceMuted,
    borderWidth: 1,
    borderColor: TAIR.line,
  },
  choiceOn: { backgroundColor: TAIR.emerald, borderColor: TAIR.emerald },
  choiceText: { color: TAIR.emerald, fontWeight: "800", fontSize: 13 },
  choiceTextOn: { color: TAIR.gold },
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
