// طير — Trips Map (Leaflet + OpenStreetMap, no API key required)
import React, { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Truck, MapPin, Calendar } from "lucide-react";
import { T } from "./tairTheme";
import { coordsFor, SAUDI_CENTER, SAUDI_ZOOM } from "./saudiCityCoords";

// Fix Leaflet's default icon path (breaks in webpack builds)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom teal pin for departure and pink pin for arrival
const makeDivIcon = (bg) =>
  L.divIcon({
    className: "tair-map-pin",
    html: `<div style="
      width: 30px; height: 30px; border-radius: 50%;
      background: ${bg}; border: 3px solid #fff;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 14px; font-weight: 900;
    ">•</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const fromIcon = makeDivIcon("#0f766e");
const toIcon = makeDivIcon("#ec4899");

// Auto-fit the map to a set of coordinates whenever they change.
function FitBounds({ positions, focusedRoute }) {
  const map = useMap();
  useEffect(() => {
    if (focusedRoute && focusedRoute.length === 2) {
      map.fitBounds(focusedRoute, { padding: [60, 60], maxZoom: 7, animate: true });
      return;
    }
    if (positions && positions.length > 0) {
      map.fitBounds(positions, { padding: [40, 40], maxZoom: 7, animate: true });
    }
  }, [focusedRoute && focusedRoute.join(","), positions.length]); // eslint-disable-line
  return null;
}

export default function TripsMap({
  trips = [],
  onTripClick,
  onCityClick,
  focusedTripId,
  height = 460,
}) {
  // Build the list of route lines and unique city markers
  const { routes, cityMarkers, allPositions, focusedRoute } = useMemo(() => {
    const routes = [];
    const seen = new Map();
    const allPositions = [];

    for (const t of trips) {
      const a = coordsFor(t.from_city);
      const b = coordsFor(t.to_city);
      if (!a || !b) continue;

      routes.push({
        id: t.trip_id,
        trip: t,
        positions: [a, b],
      });
      allPositions.push(a, b);

      if (!seen.has(t.from_city)) seen.set(t.from_city, { pos: a, type: "from" });
      if (!seen.has(t.to_city)) seen.set(t.to_city, { pos: b, type: "to" });
    }

    const focusedRoute = focusedTripId
      ? routes.find((r) => r.id === focusedTripId)?.positions
      : null;

    return { routes, cityMarkers: Array.from(seen.entries()), allPositions, focusedRoute };
  }, [trips, focusedTripId]);

  return (
    <div style={{ ...styles.wrapper, height }} data-testid="trips-map">
      <MapContainer
        center={SAUDI_CENTER}
        zoom={SAUDI_ZOOM}
        style={{ height: "100%", width: "100%", borderRadius: 16 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds positions={allPositions} focusedRoute={focusedRoute} />

        {/* Trip route polylines */}
        {routes.map((r) => {
          const isFocused = r.id === focusedTripId;
          return (
          <Polyline
            key={r.id}
            positions={r.positions}
            pathOptions={{
              color: isFocused ? "#ec4899" : "#14b8a6",
              weight: isFocused ? 5 : 3,
              opacity: isFocused ? 0.95 : 0.65,
              dashArray: isFocused ? null : "6 6",
            }}
            eventHandlers={{ click: () => onTripClick?.(r.trip.trip_id) }}
          >
            <Popup>
              <div style={styles.popup} dir="rtl">
                <div style={styles.popupTitle}>
                  {r.trip.from_city} → {r.trip.to_city}
                </div>
                {r.trip.depart_at && (
                  <div style={styles.popupMeta}>
                    <Calendar size={12} strokeWidth={2.4} />
                    {new Date(r.trip.depart_at).toLocaleDateString("ar-SA", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
                {r.trip.carrier_name && (
                  <div style={styles.popupMeta}>
                    <Truck size={12} strokeWidth={2.4} />
                    {r.trip.carrier_name}
                  </div>
                )}
                <button
                  onClick={() => onTripClick?.(r.trip.trip_id)}
                  style={styles.popupBtn}
                  data-testid={`map-open-trip-${r.trip.trip_id}`}
                >
                  فتح الرحلة
                </button>
              </div>
            </Popup>
          </Polyline>
        );})}

        {/* City markers */}
        {cityMarkers.map(([city, info]) => (
          <Marker
            key={city}
            position={info.pos}
            icon={info.type === "from" ? fromIcon : toIcon}
            eventHandlers={{ click: () => onCityClick?.(city, info.type) }}
          >
            <Popup>
              <div style={{ direction: "rtl", fontFamily: "inherit", fontWeight: 800 }}>
                <MapPin size={12} strokeWidth={2.4} style={{ marginLeft: 4, verticalAlign: "middle" }} />
                {city}
                {onCityClick && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => onCityClick(city, info.type)}
                      style={styles.popupBtn}
                      data-testid={`map-filter-city-${city}`}
                    >
                      {info.type === "from" ? "الرحلات من هنا" : "الرحلات إلى هنا"}
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div style={styles.legend} dir="rtl">
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#0f766e" }} />
          <span>الانطلاق</span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#ec4899" }} />
          <span>الوصول</span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendLine }} />
          <span>مسار الرحلة</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
    border: `1px solid ${T.border}`,
  },
  popup: { fontFamily: "'Tajawal', system-ui, sans-serif", minWidth: 180 },
  popupTitle: { fontSize: 14, fontWeight: 900, color: T.textStrong, marginBottom: 6 },
  popupMeta: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 6, fontSize: 12, color: T.textMuted, fontWeight: 700, marginTop: 4,
  },
  popupBtn: {
    width: "100%", marginTop: 10, padding: "8px 12px",
    background: T.primary, color: "#fff", border: "none",
    borderRadius: 8, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit", fontSize: 12,
  },
  legend: {
    position: "absolute", bottom: 12, right: 12, zIndex: 500,
    background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
    padding: "10px 14px", borderRadius: 12,
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    display: "flex", flexDirection: "column", gap: 6,
    fontSize: 11, fontWeight: 800, color: T.text,
    fontFamily: "'Tajawal', system-ui, sans-serif",
  },
  legendItem: {
    display: "flex", flexDirection: "row-reverse",
    alignItems: "center", gap: 6,
  },
  legendDot: {
    width: 12, height: 12, borderRadius: 6,
    border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  },
  legendLine: {
    width: 16, height: 3, background: "#14b8a6",
    borderRadius: 2,
  },
};
