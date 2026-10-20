// طير — Trips list with premium standout cards + organized contact actions
import React, { useEffect, useState } from "react";
import {
  Truck, Plus, MapPin, Calendar, Package, Snowflake, ArrowLeftRight,
  X, Car, Wallet, Phone, MessageCircle, Star, Route, Send, Clock, Trash2,
  Map as MapIcon, List,
} from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi, SAUDI_CITIES, ALL_LOCATIONS, TRIP_STATUS_LABEL } from "./tairApi";
import { BottomSheet, SelectorItem, FilterChipButton, EmptyState, StatusPill } from "./TairUI";
import { toast } from "../hooks/use-toast";
import TripsMap from "./TripsMap";
import tripsHeader from "../assets/tair-design/headers/trips.jpg";
import { TAIR, TAIR_PAGE_STYLE, TairAppHeader } from "./TairAppChrome";

export default function TripsScreen({ user, onOpenTrip, onOpenNotifications }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCity, setFromCity] = useState(null);
  const [toCity, setToCity] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'map'
  const [focusedTripId, setFocusedTripId] = useState(null);

  const load = () => {
    setLoading(true);
    const params = { status: "active", limit: 60 };
    if (fromCity) params.from_city = fromCity;
    if (toCity) params.to_city = toCity;
    tairApi
      .listTrips(params)
      .then((d) => setTrips(d.items || []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [fromCity, toCity]);

  const uid = user?.id || user?.user_id;

  return (
    <div style={{ ...S.screen, ...TAIR_PAGE_STYLE }} data-testid="trips-screen">
      <TairAppHeader image={tripsHeader} onBell={onOpenNotifications} hasNotif={false} />

      {/* زر إضافة رحلة عائم */}
      <div style={{ display: "flex", flexDirection: "row-reverse", padding: "0 16px", marginTop: 12, marginBottom: 8 }}>
        <button
          onClick={() => setShowCreate(true)}
          data-testid="create-trip-btn"
          aria-label="رحلة جديدة"
          style={{
            display: "flex",
            flexDirection: "row-reverse",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
            height: 40,
            padding: "0 18px",
            borderRadius: 20,
            background: TAIR.emerald,
            color: TAIR.gold,
            border: "none",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 3px 6px rgba(27,61,47,0.16)",
          }}
        >
          <Plus size={18} strokeWidth={2.4} color={TAIR.gold} />
          <span>رحلة جديدة</span>
        </button>
      </div>

      {/* Route filter bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterInner}>
          <FilterChipButton
            icon={<MapPin size={15} strokeWidth={2.2} />}
            label="من"
            value={fromCity}
            onClick={() => setSheet("from")}
            testId="filter-from-btn"
          />
          <ArrowLeftRight size={16} color={T.textFaint} />
          <FilterChipButton
            icon={<MapPin size={15} strokeWidth={2.2} />}
            label="إلى"
            value={toCity}
            onClick={() => setSheet("to")}
            testId="filter-to-btn"
          />
          {(fromCity || toCity) && (
            <button
              onClick={() => { setFromCity(null); setToCity(null); }}
              style={styles.clearBtn}
              data-testid="clear-trip-filters"
            >
              مسح
            </button>
          )}
          <div style={{ flex: 1 }} />
          {/* View mode toggle */}
          <div style={styles.viewToggle} data-testid="trips-view-toggle">
            <button
              onClick={() => setViewMode("list")}
              style={{
                ...styles.viewToggleBtn,
                background: viewMode === "list" ? T.primary : "transparent",
                color: viewMode === "list" ? "#fff" : T.textMuted,
              }}
              data-testid="trips-view-list"
              aria-label="عرض قائمة"
            >
              <List size={14} strokeWidth={2.4} />
              <span>قائمة</span>
            </button>
            <button
              onClick={() => setViewMode("map")}
              style={{
                ...styles.viewToggleBtn,
                background: viewMode === "map" ? T.primary : "transparent",
                color: viewMode === "map" ? "#fff" : T.textMuted,
              }}
              data-testid="trips-view-map"
              aria-label="عرض خريطة"
            >
              <MapIcon size={14} strokeWidth={2.4} />
              <span>خريطة</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...S.container, paddingTop: 14 }}>
        {loading ? (
          <div style={S.loadingText}>جاري التحميل…</div>
        ) : trips.length === 0 ? (
          <EmptyState
            icon={<Truck size={36} strokeWidth={1.5} />}
            title="لا توجد رحلات مطابقة"
            desc="كن أول موصّل بين هاتين المدينتين واحصل على طلبات نقل"
            action={
              <button onClick={() => setShowCreate(true)} style={S.primaryBtn} data-testid="empty-create-trip">
                <Plus size={16} strokeWidth={2.6} />
                <span>سجّل رحلتك</span>
              </button>
            }
          />
        ) : viewMode === "map" ? (
          <TripsMap
            trips={trips}
            onTripClick={onOpenTrip}
            onCityClick={(city, type) => {
              if (type === "from") setFromCity(city);
              else setToCity(city);
              setFocusedTripId(null);
            }}
            focusedTripId={focusedTripId}
            height={520}
          />
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            {trips.map((t) => (
              <PremiumTripCard
                key={t.trip_id}
                trip={t}
                userId={uid}
                onClick={() => onOpenTrip(t.trip_id)}
                onViewOnMap={() => {
                  setFocusedTripId(t.trip_id);
                  setViewMode("map");
                }}
                onDeleted={load}
              />
            ))}
          </div>
        )}
      </div>

      {/* شريحة "رحلات الطيور القادمة" — عرض كامل تحت القائمة */}
      {!loading && trips.length > 0 && (
        <div style={{
          margin: "16px 0 20px",
          padding: "18px 20px",
          background: TAIR.emerald,
          color: TAIR.gold,
          borderTop: `1px solid ${TAIR.gold}`,
          borderBottom: `1px solid ${TAIR.gold}`,
          display: "flex",
          flexDirection: "row-reverse",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }} data-testid="upcoming-trips-strip">
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 3 }}>رحلات الطيور القادمة</div>
            <div style={{ fontSize: 12, color: TAIR.goldLight, opacity: 0.9 }}>تصفّح كل الرحلات المتاحة الآن</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{trips.length}</div>
        </div>
      )}

      <BottomSheet open={sheet === "from"} onClose={() => setSheet(null)} title="مدينة الانطلاق">
        <SelectorItem
          icon={<MapPin size={16} strokeWidth={2.2} />}
          label="الكل"
          active={!fromCity}
          onClick={() => { setFromCity(null); setSheet(null); }}
          testId="from-city-all"
        />
        {SAUDI_CITIES.map((c) => (
          <SelectorItem
            key={c}
            icon={<MapPin size={16} strokeWidth={2.2} />}
            label={c}
            active={fromCity === c}
            onClick={() => { setFromCity(c); setSheet(null); }}
            testId={`from-city-${c}`}
          />
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === "to"} onClose={() => setSheet(null)} title="مدينة الوصول">
        <SelectorItem
          icon={<MapPin size={16} strokeWidth={2.2} />}
          label="الكل"
          active={!toCity}
          onClick={() => { setToCity(null); setSheet(null); }}
          testId="to-city-all"
        />
        {SAUDI_CITIES.map((c) => (
          <SelectorItem
            key={c}
            icon={<MapPin size={16} strokeWidth={2.2} />}
            label={c}
            active={toCity === c}
            onClick={() => { setToCity(c); setSheet(null); }}
            testId={`to-city-${c}`}
          />
        ))}
      </BottomSheet>

      {showCreate && (
        <CreateTripModal
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

// ============ Live Countdown (updates every 30s) ============
function useLiveCountdown(targetISO) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetISO) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [targetISO]);
  if (!targetISO) return null;
  const diff = new Date(targetISO).getTime() - now;
  if (diff <= 0) return { label: "انطلقت", urgent: false, past: true };
  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rMin = mins % 60;
  let label = "";
  if (days > 0) label = `${days} ي ${hours} س`;
  else if (hours > 0) label = `${hours} س ${rMin} د`;
  else label = `${rMin} د`;
  return { label, urgent: mins < 180 && mins > 0, past: false };
}

function CountdownBadge({ depart_at }) {
  const cd = useLiveCountdown(depart_at);
  if (!cd) return null;
  const bg = cd.past
    ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)"
    : cd.urgent
    ? "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)"
    : "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)";
  const prefix = cd.past ? "" : "خلال ";
  return (
    <div style={{ ...cdStyles.badge, background: bg }} data-testid="trip-countdown">
      <Clock size={11} strokeWidth={2.6} color="#fff" />
      <span>{prefix}{cd.label}</span>
    </div>
  );
}

const cdStyles = {
  badge: {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 999,
    color: "#fff", fontSize: 11, fontWeight: 800,
    boxShadow: "0 4px 10px rgba(15,118,110,0.25)",
    letterSpacing: 0.2,
  },
};

// ============ Premium Trip Card ============
function PremiumTripCard({ trip, userId, onClick, onViewOnMap, onDeleted }) {
  const dt = trip.depart_at ? new Date(trip.depart_at) : null;
  const statusColor = { scheduled: T.info, departed: T.warning, in_transit: T.warning, arrived: T.success }[trip.status] || T.textMuted;
  const carrierInitial = (trip.carrier_name || trip.carrier_id || "?").charAt(0).toUpperCase();
  const isVerified = trip.carrier_verified_carrier || trip.carrier_verified_shop;
  const isOwn = trip.carrier_id === userId;
  const [deleting, setDeleting] = useState(false);

  const cleanPhone = (trip.carrier_phone || "").replace(/[^\d+]/g, "");
  const intl = cleanPhone.startsWith("+") ? cleanPhone.slice(1) :
              (cleanPhone.startsWith("0") ? "966" + cleanPhone.slice(1) : cleanPhone);
  const waText = encodeURIComponent(`السلام عليكم، بخصوص رحلتك من ${trip.from_city} إلى ${trip.to_city}`);

  const openWhatsApp = (e) => {
    e.stopPropagation();
    window.open(`https://wa.me/${intl}?text=${waText}`, "_blank");
  };
  const openCall = (e) => {
    e.stopPropagation();
    window.open(`tel:${cleanPhone}`, "_self");
  };
  const openChat = async (e) => {
    e.stopPropagation();
    try {
      const r = await tairApi.chatStart({
        peer_id: trip.carrier_id,
        listing_id: null,
        listing_title: `رحلة ${trip.from_city} → ${trip.to_city}`,
        initial_message: `مرحباً، أريد الاستفسار عن رحلتك من ${trip.from_city} إلى ${trip.to_city}`,
      }, userId);
      // Best-effort: navigate to messages
      window.dispatchEvent(new CustomEvent("tair:open-thread", { detail: { threadId: r.thread_id } }));
    } catch (err) { /* ignore */ }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm("هل تريد حذف هذه الرحلة نهائياً؟ لا يمكن التراجع.")) return;
    setDeleting(true);
    try {
      await tairApi.deleteTrip(trip.trip_id, userId);
      toast({ title: "تم حذف الرحلة" });
      onDeleted?.();
    } catch (err) {
      toast({ title: "تعذّر الحذف", description: err.response?.data?.detail || err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={onClick}
      style={styles.premiumCard}
      data-testid={`trip-card-${trip.trip_id}`}
    >
      {/* Top accent stripe */}
      <div style={styles.accentBar} />

      {/* Countdown ribbon */}
      {trip.depart_at && (
        <div style={styles.countdownRow}>
          <CountdownBadge depart_at={trip.depart_at} />
        </div>
      )}

      {/* Route Hero */}
      <div style={styles.routeHero}>
        <div style={styles.routeCity}>
          <div style={styles.routeLabel}>الانطلاق</div>
          <div style={styles.routeCityName}>{trip.from_city}</div>
          {dt && (
            <div style={styles.routeDate}>
              {dt.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
        <div style={styles.routeConnector}>
          <div style={styles.routeLine} />
          <div style={styles.routeCircle}>
            <Truck size={16} strokeWidth={2.4} color="#fff" />
          </div>
          <div style={styles.routeLine} />
        </div>
        <div style={styles.routeCity}>
          <div style={styles.routeLabel}>الوصول</div>
          <div style={styles.routeCityName}>{trip.to_city}</div>
          {dt && (
            <div style={styles.routeDate}>
              {dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* Waypoint / direct */}
      {trip.is_direct ? (
        <div style={styles.directBadge}>
          <Route size={13} strokeWidth={2.4} />
          <span>رحلة مباشرة — بدون توقف</span>
        </div>
      ) : trip.waypoints?.length > 0 ? (
        <div style={styles.waypointsRow}>
          <Route size={13} strokeWidth={2.2} color={T.textMuted} />
          <span style={styles.waypointsLabel}>تمر بـ:</span>
          <div style={styles.waypointsList}>
            {trip.waypoints.map((wp, i) => (
              <span key={i} style={styles.waypointPill}>{wp}</span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Carrier + status */}
      <div style={styles.carrierRow}>
        <div style={styles.carrierAvatar}>
          {trip.carrier_avatar ? (
            <img src={trip.carrier_avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : carrierInitial}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <div style={styles.carrierNameRow}>
            <div style={styles.carrierName}>
              {trip.carrier_name || `الموصّل #${(trip.carrier_id || "").slice(-4)}`}
            </div>
            {isVerified && (
              <span style={styles.verifiedBadge}>
                <Truck size={9} strokeWidth={2.6} />
                <span>موثوق</span>
              </span>
            )}
          </div>
          <div style={styles.carrierMeta}>
            {trip.carrier_rating_avg > 0 && (
              <span style={styles.carrierRating}>
                <Star size={11} strokeWidth={0} fill={T.accent} color={T.accent} />
                {trip.carrier_rating_avg}
              </span>
            )}
            <span>{trip.carrier_trips_completed || 0} رحلة</span>
          </div>
        </div>
        <StatusPill label={TRIP_STATUS_LABEL[trip.status] || trip.status} color={statusColor} />
        {isOwn && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={styles.tripDeleteBtn}
            data-testid={`delete-trip-${trip.trip_id}`}
            aria-label="حذف الرحلة"
            title="حذف الرحلة"
          >
            <Trash2 size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* Meta grid */}
      <div style={styles.metaGrid}>
        <MetaCell icon={Package} label="أقفاص متاحة" value={`${trip.available_cages}/${trip.total_cages}`} />
        <MetaCell icon={Car} label="المركبة" value={trip.vehicle_type} />
        {trip.has_ac && <MetaCell icon={Snowflake} label="التكييف" value="مكيّف" color={T.info} />}
        {trip.price_hint_sar && <MetaCell icon={Wallet} label="السعر التقريبي" value={`${trip.price_hint_sar} ر.س`} />}
      </div>

      {trip.notes && <p style={styles.tripNotes}>{trip.notes}</p>}

      {/* View on Map — always visible, opens the map view focused on this route */}
      {onViewOnMap && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onViewOnMap(); }}
          style={styles.viewOnMapBtn}
          data-testid={`view-on-map-${trip.trip_id}`}
        >
          <MapIcon size={14} strokeWidth={2.4} />
          <span>عرض على الخريطة</span>
        </button>
      )}

      {/* Organized Contact Actions — 3 clear buttons */}
      {trip.carrier_phone && (
        <div style={styles.contactRow}>
          <button
            onClick={openChat}
            style={{ ...styles.contactBtn, background: T.primary, color: "#fff" }}
            data-testid={`contact-chat-${trip.trip_id}`}
          >
            <Send size={16} strokeWidth={2.4} />
            <span>رسالة</span>
          </button>
          <button
            onClick={openWhatsApp}
            style={{ ...styles.contactBtn, background: "#25d366", color: "#fff" }}
            data-testid={`contact-wa-${trip.trip_id}`}
          >
            <MessageCircle size={16} strokeWidth={2.4} />
            <span>واتساب</span>
          </button>
          <button
            onClick={openCall}
            style={{ ...styles.contactBtn, background: "#3b82f6", color: "#fff" }}
            data-testid={`contact-call-${trip.trip_id}`}
          >
            <Phone size={16} strokeWidth={2.4} />
            <span>اتصال</span>
          </button>
        </div>
      )}
    </div>
  );
}

function MetaCell({ icon: Icon, label, value, color }) {
  return (
    <div style={styles.metaCell}>
      <Icon size={14} strokeWidth={2.2} color={color || T.textMuted} />
      <div style={{ minWidth: 0 }}>
        <div style={styles.metaLabel}>{label}</div>
        <div style={{ ...styles.metaValue, color: color || T.text }}>{value}</div>
      </div>
    </div>
  );
}

// ==================== Create Trip Modal ====================
function CreateTripModal({ user, onClose, onCreated }) {
  const [form, setForm] = useState({
    from_city: SAUDI_CITIES[0],
    to_city: SAUDI_CITIES[1],
    depart_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    vehicle_type: "سيدان",
    has_ac: true,
    total_cages: 4,
    accepts_sensitive: true,
    notes: "",
    price_hint_sar: "",
    is_direct: false,
    waypoints: [],
    carrier_name: user?.name && user.name !== "زائر" ? user.name : "",
    carrier_phone: user?.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [waypointSheetOpen, setWaypointSheetOpen] = useState(false);
  const [fromSheetOpen, setFromSheetOpen] = useState(false);
  const [toSheetOpen, setToSheetOpen] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleWaypoint = (city) => {
    setForm((f) => {
      const has = f.waypoints.includes(city);
      return { ...f, waypoints: has ? f.waypoints.filter((w) => w !== city) : [...f.waypoints, city] };
    });
  };

  const submit = async () => {
    setError("");
    if (form.from_city === form.to_city) return setError("مدينة الانطلاق والوجهة يجب أن تكونا مختلفتين");
    if (!form.carrier_phone.trim()) return setError("رقم الجوال / واتساب مطلوب للتواصل");
    setSaving(true);
    try {
      const payload = {
        from_city: form.from_city,
        to_city: form.to_city,
        depart_at: new Date(form.depart_at).toISOString(),
        vehicle_type: form.vehicle_type,
        has_ac: form.has_ac,
        total_cages: Number(form.total_cages) || 4,
        accepts_sensitive: form.accepts_sensitive,
        notes: form.notes || null,
        price_hint_sar: form.price_hint_sar ? Number(form.price_hint_sar) : null,
        is_direct: form.is_direct,
        waypoints: form.is_direct ? [] : form.waypoints,
        carrier_name: form.carrier_name || null,
        carrier_phone: form.carrier_phone.trim(),
      };
      await tairApi.createTrip(payload, user.id || user.user_id);
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.detail || "فشل إنشاء الرحلة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()} data-testid="create-trip-modal">
        <div style={modalStyles.header}>
          <button onClick={onClose} style={S.iconBtn} data-testid="close-create-trip" aria-label="إغلاق">
            <X size={18} strokeWidth={2.2} />
          </button>
          <h2 style={modalStyles.title}>رحلة جديدة</h2>
          <div style={{ width: 40 }} />
        </div>

        <div style={modalStyles.body}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={S.label}>من *</label>
              <button type="button" onClick={() => setFromSheetOpen(true)} style={styles.selectBtn} data-testid="trip-from-city-btn">
                <MapPin size={14} strokeWidth={2.2} color={T.primary} />
                <span>{form.from_city}</span>
              </button>
            </div>
            <div>
              <label style={S.label}>إلى *</label>
              <button type="button" onClick={() => setToSheetOpen(true)} style={styles.selectBtn} data-testid="trip-to-city-btn">
                <MapPin size={14} strokeWidth={2.2} color={T.primary} />
                <span>{form.to_city}</span>
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={S.label}>نوع الرحلة</label>
            <div style={styles.checkRow}>
              <CheckOption label="مباشرة" icon={<Route size={16} strokeWidth={2.2} />} checked={form.is_direct} onChange={(v) => set("is_direct", v)} testId="trip-is-direct" />
              <CheckOption label="بمحطات" icon={<MapPin size={16} strokeWidth={2.2} />} checked={!form.is_direct} onChange={(v) => set("is_direct", !v)} testId="trip-has-waypoints" />
            </div>
          </div>

          {!form.is_direct && (
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>المحافظات (اختياري)</label>
              <button type="button" onClick={() => setWaypointSheetOpen(true)} style={styles.waypointsPicker} data-testid="trip-waypoints-btn">
                {form.waypoints.length === 0 ? (
                  <span style={{ color: T.textMuted }}>+ إضافة محافظات</span>
                ) : (
                  <div style={styles.waypointsPickerList}>
                    {form.waypoints.map((wp) => (
                      <span key={wp} style={styles.waypointPill} onClick={(e) => { e.stopPropagation(); toggleWaypoint(wp); }}>{wp} ✕</span>
                    ))}
                  </div>
                )}
              </button>
            </div>
          )}

          <label style={{ ...S.label, marginTop: 14 }}>موعد الانطلاق *</label>
          <input type="datetime-local" style={S.input} value={form.depart_at} onChange={(e) => set("depart_at", e.target.value)} data-testid="trip-depart-at" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <div>
              <label style={S.label}>نوع المركبة</label>
              <input style={S.input} value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} placeholder="سيدان / GMC" data-testid="trip-vehicle" />
            </div>
            <div>
              <label style={S.label}>عدد الأقفاص</label>
              <input type="number" min="1" style={S.input} value={form.total_cages} onChange={(e) => set("total_cages", e.target.value)} data-testid="trip-cages" />
            </div>
          </div>

          <label style={{ ...S.label, marginTop: 14 }}>سعر إرشادي (ر.س)</label>
          <input type="number" style={S.input} value={form.price_hint_sar} onChange={(e) => set("price_hint_sar", e.target.value)} placeholder="اختياري" data-testid="trip-price" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <div>
              <label style={S.label}>اسم الموصّل</label>
              <input style={S.input} value={form.carrier_name} onChange={(e) => set("carrier_name", e.target.value)} placeholder="اسمك أو اسم الشركة" data-testid="trip-carrier-name" />
            </div>
            <div>
              <label style={S.label}>واتساب / جوال *</label>
              <input style={S.input} type="tel" value={form.carrier_phone} onChange={(e) => set("carrier_phone", e.target.value)} placeholder="+9665xxxxxxxx" data-testid="trip-carrier-phone" />
            </div>
          </div>

          <div style={styles.checkRow}>
            <CheckOption label="مكيّف" icon={<Snowflake size={16} strokeWidth={2.2} />} checked={form.has_ac} onChange={(v) => set("has_ac", v)} testId="trip-has-ac" />
            <CheckOption label="طيور حساسة" icon={<Truck size={16} strokeWidth={2.2} />} checked={form.accepts_sensitive} onChange={(v) => set("accepts_sensitive", v)} testId="trip-sensitive" />
          </div>

          <label style={{ ...S.label, marginTop: 14 }}>ملاحظات</label>
          <textarea style={{ ...S.input, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="تفاصيل إضافية…" data-testid="trip-notes" />

          {error && <div style={S.errorBox} data-testid="trip-error">{error}</div>}

          <button onClick={submit} disabled={saving} style={{ ...S.primaryBtn, width: "100%", marginTop: 18, opacity: saving ? 0.7 : 1 }} data-testid="submit-trip">
            {saving ? "جاري النشر…" : "انشر الرحلة"}
          </button>
        </div>
      </div>

      <BottomSheet open={fromSheetOpen} onClose={() => setFromSheetOpen(false)} title="مدينة الانطلاق">
        {ALL_LOCATIONS.map((c) => (
          <SelectorItem key={c} icon={<MapPin size={16} strokeWidth={2.2} />} label={c} active={form.from_city === c} onClick={() => { set("from_city", c); setFromSheetOpen(false); }} testId={`from-loc-${c}`} />
        ))}
      </BottomSheet>

      <BottomSheet open={toSheetOpen} onClose={() => setToSheetOpen(false)} title="مدينة الوصول">
        {ALL_LOCATIONS.map((c) => (
          <SelectorItem key={c} icon={<MapPin size={16} strokeWidth={2.2} />} label={c} active={form.to_city === c} onClick={() => { set("to_city", c); setToSheetOpen(false); }} testId={`to-loc-${c}`} />
        ))}
      </BottomSheet>

      <BottomSheet open={waypointSheetOpen} onClose={() => setWaypointSheetOpen(false)} title="اختر المحافظات">
        <div style={{ padding: "6px 12px 12px", color: T.textMuted, fontSize: 12, textAlign: "right" }}>
          اختر المدن التي تمر بها الرحلة.
        </div>
        {ALL_LOCATIONS.filter((c) => c !== form.from_city && c !== form.to_city).map((c) => (
          <SelectorItem key={c} icon={<MapPin size={16} strokeWidth={2.2} />} label={c} active={form.waypoints.includes(c)} onClick={() => toggleWaypoint(c)} testId={`wp-loc-${c}`} />
        ))}
      </BottomSheet>
    </div>
  );
}

function CheckOption({ label, icon, checked, onChange, testId }) {
  return (
    <button onClick={() => onChange(!checked)} type="button" style={{
      flex: 1, display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8,
      padding: "10px 12px", borderRadius: T.radius,
      border: `1.5px solid ${checked ? T.primary : T.border}`,
      background: checked ? "#f0fdfa" : T.surface,
      color: checked ? T.primary : T.text,
      fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    }} data-testid={testId}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ==================== Styles ====================
const styles = {
  filterBar: {
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    borderBottom: `1px solid ${T.border}`,
    padding: "12px 0",
  },
  filterInner: {
    maxWidth: 900, margin: "0 auto", padding: "0 16px",
    display: "flex", flexDirection: "row-reverse",
    gap: 8, alignItems: "center", overflowX: "auto", scrollbarWidth: "none",
  },
  clearBtn: {
    background: "transparent", border: "none", color: T.danger,
    fontSize: 12, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", padding: "6px 4px",
  },
  viewToggle: {
    display: "flex", flexDirection: "row-reverse",
    gap: 4, padding: 3,
    background: T.bgAlt, borderRadius: 999,
    border: `1px solid ${T.border}`,
    flexShrink: 0,
  },
  viewToggleBtn: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 4, padding: "6px 12px", borderRadius: 999,
    border: "none", cursor: "pointer",
    fontFamily: "inherit", fontSize: 12, fontWeight: 800,
    transition: "background 0.15s, color 0.15s",
  },

  // ===== Premium Card =====
  premiumCard: {
    position: "relative",
    background: T.surface,
    borderRadius: 20,
    padding: 0,
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)",
    border: `1px solid ${T.border}`,
    overflow: "hidden",
    transition: "transform 0.15s, box-shadow 0.2s",
  },
  accentBar: {
    height: 5,
    background: "linear-gradient(90deg, #0f766e 0%, #14b8a6 45%, #ec4899 100%)",
  },
  countdownRow: {
    display: "flex", justifyContent: "flex-end",
    padding: "10px 20px 0",
  },

  routeHero: {
    display: "flex", flexDirection: "row-reverse",
    alignItems: "center", justifyContent: "space-between",
    padding: "18px 20px 14px",
    background: "linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)",
  },
  routeCity: {
    flex: 1, minWidth: 0, textAlign: "center",
  },
  routeLabel: {
    fontSize: 10, color: T.textFaint, fontWeight: 800,
    letterSpacing: 1, textTransform: "uppercase",
  },
  routeCityName: {
    fontSize: 22, fontWeight: 900, color: T.textStrong,
    letterSpacing: "-0.01em", margin: "4px 0 3px",
  },
  routeDate: {
    fontSize: 11, color: T.textMuted, fontWeight: 700,
  },
  routeConnector: {
    flex: 1.2, display: "flex", flexDirection: "row-reverse",
    alignItems: "center", gap: 4, padding: "0 8px",
  },
  routeLine: {
    flex: 1, height: 2,
    background: "repeating-linear-gradient(90deg, " + T.primary + " 0 4px, transparent 4px 8px)",
  },
  routeCircle: {
    width: 34, height: 34, borderRadius: 17,
    background: T.primary,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 12px rgba(15,118,110,0.35)",
    flexShrink: 0,
  },

  directBadge: {
    display: "inline-flex", alignItems: "center", gap: 6,
    margin: "0 20px 8px",
    padding: "5px 12px", borderRadius: 999,
    background: "#eff6ff", color: T.info,
    fontSize: 11, fontWeight: 800,
  },
  waypointsRow: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 6, padding: "6px 20px 10px",
    fontSize: 11, color: T.textMuted, fontWeight: 700,
    flexWrap: "wrap",
  },
  waypointsLabel: { fontWeight: 800 },
  waypointsList: {
    display: "flex", flexDirection: "row-reverse",
    flexWrap: "wrap", gap: 4,
  },
  waypointPill: {
    background: T.bgAlt, color: T.text,
    padding: "3px 10px", borderRadius: 999,
    fontSize: 11, fontWeight: 700,
    border: `1px solid ${T.border}`,
  },

  carrierRow: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 10, padding: "14px 20px", borderTop: `1px solid ${T.divider}`,
  },
  carrierAvatar: {
    width: 42, height: 42, borderRadius: 21,
    background: "#f0fdfa", color: T.primary,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, fontWeight: 900, overflow: "hidden",
    flexShrink: 0, border: `2px solid ${T.primary}22`,
  },
  carrierNameRow: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 6, flexWrap: "wrap",
  },
  carrierName: { fontSize: 14, fontWeight: 800, color: T.text },
  verifiedBadge: {
    display: "inline-flex", alignItems: "center", gap: 3,
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#fff", fontSize: 9, fontWeight: 800,
    padding: "2px 6px", borderRadius: 999,
  },
  carrierMeta: {
    display: "flex", flexDirection: "row-reverse",
    gap: 8, fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2,
  },
  carrierRating: {
    display: "inline-flex", alignItems: "center", gap: 3,
    color: T.accent, fontWeight: 800,
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 8,
    padding: "0 20px 12px",
  },
  metaCell: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 8, padding: "10px 12px",
    background: T.bgAlt, borderRadius: 12,
  },
  metaLabel: { fontSize: 10, color: T.textFaint, fontWeight: 700 },
  metaValue: { fontSize: 13, fontWeight: 800, color: T.text, marginTop: 1 },

  tripNotes: {
    fontSize: 12, color: T.textMuted, lineHeight: 1.6,
    padding: "0 20px 4px", margin: 0, textAlign: "right",
  },

  contactRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    padding: "12px 16px 16px",
    borderTop: `1px solid ${T.divider}`,
    background: "#fafafa",
  },
  viewOnMapBtn: {
    display: "flex", flexDirection: "row-reverse",
    alignItems: "center", justifyContent: "center", gap: 6,
    margin: "0 20px 12px",
    padding: "10px 14px", borderRadius: 12,
    background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    color: "#fff", fontSize: 13, fontWeight: 800,
    border: "none", cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(15,118,110,0.25)",
    width: "calc(100% - 40px)",
  },
  contactBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 6,
    padding: "12px 8px",
    border: "none", borderRadius: 12,
    fontSize: 13, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 2px 6px rgba(15,23,42,0.10)",
  },
  tripDeleteBtn: {
    width: 30, height: 30, borderRadius: 15,
    background: "rgba(239, 68, 68, 0.10)",
    border: "1px solid rgba(239, 68, 68, 0.35)",
    color: T.danger,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
    marginInlineStart: 6,
  },

  // Modal fields
  selectBtn: {
    width: "100%", display: "flex", flexDirection: "row-reverse",
    alignItems: "center", gap: 8, padding: "12px 14px",
    background: T.surface, border: `1.5px solid ${T.border}`,
    borderRadius: T.radius, fontFamily: "inherit",
    fontSize: 14, fontWeight: 700, color: T.text,
    cursor: "pointer", textAlign: "right",
  },
  waypointsPicker: {
    width: "100%", minHeight: 44, background: T.surface,
    border: `1.5px dashed ${T.borderStrong}`,
    borderRadius: T.radius, padding: 10, cursor: "pointer",
    display: "flex", flexDirection: "row-reverse",
    alignItems: "center", fontFamily: "inherit", textAlign: "right",
  },
  waypointsPickerList: {
    display: "flex", flexDirection: "row-reverse",
    flexWrap: "wrap", gap: 4, width: "100%",
  },
  checkRow: {
    display: "flex", flexDirection: "row-reverse", gap: 8, marginTop: 8,
  },
};

const modalStyles = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(3, 7, 18, 0.55)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  modal: {
    background: T.surface, borderRadius: T.radiusLg,
    maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto",
    fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    direction: "rtl",
  },
  header: {
    position: "sticky", top: 0, background: T.surface,
    padding: "14px 18px", borderBottom: `1px solid ${T.border}`,
    display: "flex", flexDirection: "row-reverse",
    alignItems: "center", justifyContent: "space-between",
  },
  title: {
    margin: 0, fontSize: 17, fontWeight: 800, color: T.text,
    flex: 1, textAlign: "center",
  },
  body: { padding: 18 },
};
