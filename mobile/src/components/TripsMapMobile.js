// طير — Mobile Trips Map using Leaflet inside a WebView.
// Uses OpenStreetMap tiles (no API key required).
import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import { coordsFor } from "../constants/cityCoords";
import { journeyState } from "../utils/tripJourney";

function buildHtml(trips, focusedTripId) {
  const routes = [];
  const cities = new Map();

  for (const t of trips || []) {
    const journey = journeyState(t);
    const placed = journey.cities
      .map((name, index) => ({ name, index, pos: coordsFor(name) }))
      .filter((point) => point.pos);
    if (placed.length < 2) continue;
    const current = placed.filter((point) => point.index <= journey.stopIndex).pop() || placed[0];
    const upcoming = placed.find((point) => point.index > journey.stopIndex);
    let marker = current.pos;
    if (journey.motion === "moving" && upcoming) {
      marker = [(current.pos[0] + upcoming.pos[0]) / 2, (current.pos[1] + upcoming.pos[1]) / 2];
    }
    if (journey.motion === "arrived") marker = placed[placed.length - 1].pos;
    routes.push({
      id: t.trip_id,
      points: placed,
      marker,
      motion: journey.motion,
      label: journey.label,
      here: journey.here,
      stopIndex: journey.stopIndex,
      from: t.from_city,
      to: t.to_city,
      carrier: t.carrier_name || "موصّل",
      when: t.depart_at ? new Date(t.depart_at).toLocaleDateString("ar-SA") : "",
      focused: t.trip_id === focusedTripId,
    });
    placed.forEach((point) => {
      const kind = point.index === 0 ? "from" : point.index === journey.last ? "to" : "stop";
      if (!cities.has(point.name)) cities.set(point.name, { pos: point.pos, type: kind });
    });
  }

  const cityArr = Array.from(cities.entries());
  const focusedRoute = routes.find((r) => r.focused);

  return `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; height: 100%; width: 100%; }
    body { font-family: -apple-system, "SF Arabic", "Tajawal", sans-serif; }
    .pin {
      width: 26px; height: 26px; border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    }
    .pin.from { background: #1B3D2F; }
    .pin.stop { background: #C6A15B; }
    .pin.to { background: #1B3D2F; box-shadow: 0 0 0 3px #C6A15B; }
    .pin.vehicle { background: #1B3D2F; border-color: #C6A15B; }
    .legend {
      position: absolute; bottom: 12px; right: 12px; z-index: 500;
      background: rgba(255,255,255,0.95); padding: 8px 12px;
      border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      font-size: 11px; font-weight: 800; direction: rtl;
    }
    .legend .row { display: flex; flex-direction: row-reverse; align-items: center; gap: 6px; margin: 2px 0; }
    .legend .dot { width: 10px; height: 10px; border-radius: 50%; }
    .popup-title { font-weight: 900; font-size: 14px; margin-bottom: 4px; direction: rtl; }
    .popup-meta { font-size: 12px; color: #6B5E4A; direction: rtl; }
    .open-btn {
      display: inline-block; margin-top: 8px; padding: 6px 12px;
      background: #1B3D2F; color: #fff; border-radius: 8px;
      text-decoration: none; font-weight: 800; font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <div class="row"><span class="dot" style="background:#C6A15B"></span><span>توقف</span></div>
    <div class="row"><span style="width:16px;height:3px;background:#1B3D2F;border-radius:2px;"></span><span>تحرك</span></div>
    <div class="row"><span class="dot" style="background:#1B3D2F"></span><span>وصول</span></div>
  </div>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([23.8859, 45.0792], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    const send = (payload) => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    };
    window.__openTrip = (id) => send({ type: 'open-trip', trip_id: id });
    window.__filterCity = (name, type) => send({ type: 'filter-city', city: name, filter: type });

    const routes = ${JSON.stringify(routes)};
    const cities = ${JSON.stringify(cityArr)};
    const focused = ${JSON.stringify(focusedRoute || null)};
    const bounds = [];

    routes.forEach(r => {
      const positions = r.points.map(p => p.pos);
      const done = r.points.filter(p => p.index <= r.stopIndex).map(p => p.pos);
      const rest = r.points.filter(p => p.index >= r.stopIndex).map(p => p.pos);
      if (rest.length > 1) {
        L.polyline(rest, { color: '#C6A15B', weight: 3, opacity: 0.85, dashArray: '7 7' }).addTo(map);
      }
      if (done.length > 1) {
        L.polyline(done, { color: '#1B3D2F', weight: r.focused ? 5 : 3, opacity: 0.95 }).addTo(map);
      } else if (positions.length > 1 && r.motion === 'stopped') {
        L.polyline(positions, { color: '#C6A15B', weight: 3, opacity: 0.8, dashArray: '7 7' }).addTo(map);
      }
      bounds.push(...positions);
      const vehicle = L.marker(r.marker, {
        icon: L.divIcon({ className: '', html: '<div class="pin vehicle"></div>', iconSize: [26, 26], iconAnchor: [13, 13] })
      }).addTo(map);
      vehicle.bindPopup(
        '<div class="popup-title">' + r.from + ' → ' + r.to + '</div>' +
        '<div class="popup-meta">' + r.label + (r.here ? ' · ' + r.here : '') + '</div>' +
        (r.when ? '<div class="popup-meta">📅 ' + r.when + '</div>' : '') +
        '<div class="popup-meta">🚗 ' + r.carrier + '</div>' +
        '<a href="#" class="open-btn" onclick="window.__openTrip(\\'' + r.id + '\\');return false;">فتح الرحلة</a>'
      );
    });

    cities.forEach(([name, info]) => {
      const iconHtml = '<div class="pin ' + info.type + '"></div>';
      const label = info.type === 'from' ? 'الرحلات من هنا' : info.type === 'stop' ? 'مدن التوقف' : 'الرحلات إلى هنا';
      L.marker(info.pos, {
        icon: L.divIcon({ className: '', html: iconHtml, iconSize: [26, 26], iconAnchor: [13, 13] })
      }).addTo(map).bindPopup(
        '<b>' + name + '</b>' +
        '<div style="margin-top:6px"><a href="#" class="open-btn" onclick="window.__filterCity(\\'' + name + '\\',\\'' + info.type + '\\');return false;">' + label + '</a></div>'
      );
    });

    // Fit map to visible routes (or the focused one)
    if (focused && focused.points) {
      map.fitBounds(focused.points.map(p => p.pos), { padding: [40, 40], maxZoom: 7, animate: true });
    } else if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7, animate: true });
    }
  </script>
</body>
</html>`;
}

export default function TripsMapMobile({
  trips = [],
  onTripPress,
  onCityFilter,
  focusedTripId = null,
  height = 460,
}) {
  const html = useMemo(() => buildHtml(trips, focusedTripId), [trips, focusedTripId]);

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg?.type === "open-trip" && msg.trip_id) {
        onTripPress?.(msg.trip_id);
      } else if (msg?.type === "filter-city" && msg.city) {
        onCityFilter?.(msg.city, msg.filter);
      }
    } catch (_) {}
  };

  return (
    <View style={[styles.wrapper, { height }]} data-testid="trips-map-mobile">
      <WebView
        source={{ html }}
        onMessage={handleMessage}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>جاري تحميل الخريطة…</Text>
          </View>
        )}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  web: { flex: 1, backgroundColor: "transparent" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F1E8",
  },
  loadingText: { color: "#6B5E4A", fontWeight: "700" },
});
