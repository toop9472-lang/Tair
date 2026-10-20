// طير — Mobile Trips Map using Leaflet inside a WebView.
// Uses OpenStreetMap tiles (no API key required).
import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";

// Saudi city coordinates (subset — mirror of the web version)
const CITY_COORDS = {
  "الرياض":     [24.7136, 46.6753],
  "جدة":        [21.4858, 39.1925],
  "مكة":        [21.3891, 39.8579],
  "مكة المكرمة":[21.3891, 39.8579],
  "المدينة":    [24.5247, 39.5692],
  "المدينة المنورة": [24.5247, 39.5692],
  "الدمام":     [26.4207, 50.0888],
  "الخبر":      [26.2172, 50.1971],
  "الأحساء":    [25.3833, 49.5833],
  "الطائف":     [21.2703, 40.4158],
  "أبها":       [18.2164, 42.5053],
  "نجران":      [17.4924, 44.1277],
  "جازان":      [16.8892, 42.5511],
  "تبوك":       [28.3835, 36.5662],
  "حائل":       [27.5219, 41.6907],
  "بريدة":      [26.3260, 43.9750],
  "الجبيل":     [27.0114, 49.6580],
  "ينبع":       [24.0895, 38.0618],
  "الباحة":     [20.0129, 41.4677],
};

function coordsFor(city) {
  if (!city) return null;
  const key = city.trim();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  const found = Object.keys(CITY_COORDS).find(
    (k) => k.startsWith(key) || key.startsWith(k)
  );
  return found ? CITY_COORDS[found] : null;
}

function buildHtml(trips, focusedTripId) {
  const routes = [];
  const cities = new Map();

  for (const t of trips || []) {
    const a = coordsFor(t.from_city);
    const b = coordsFor(t.to_city);
    if (!a || !b) continue;
    routes.push({
      id: t.trip_id,
      a,
      b,
      from: t.from_city,
      to: t.to_city,
      carrier: t.carrier_name || "موصّل",
      when: t.depart_at ? new Date(t.depart_at).toLocaleDateString("ar-SA") : "",
      focused: t.trip_id === focusedTripId,
    });
    if (!cities.has(t.from_city)) cities.set(t.from_city, { pos: a, type: "from" });
    if (!cities.has(t.to_city)) cities.set(t.to_city, { pos: b, type: "to" });
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
    .pin.from { background: #0ea5e9; }
    .pin.to { background: #ec4899; }
    .legend {
      position: absolute; bottom: 12px; right: 12px; z-index: 500;
      background: rgba(255,255,255,0.95); padding: 8px 12px;
      border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      font-size: 11px; font-weight: 800; direction: rtl;
    }
    .legend .row { display: flex; flex-direction: row-reverse; align-items: center; gap: 6px; margin: 2px 0; }
    .legend .dot { width: 10px; height: 10px; border-radius: 50%; }
    .popup-title { font-weight: 900; font-size: 14px; margin-bottom: 4px; direction: rtl; }
    .popup-meta { font-size: 12px; color: #64748b; direction: rtl; }
    .open-btn {
      display: inline-block; margin-top: 8px; padding: 6px 12px;
      background: #0ea5e9; color: #fff; border-radius: 8px;
      text-decoration: none; font-weight: 800; font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <div class="row"><span class="dot" style="background:#0ea5e9"></span><span>الانطلاق</span></div>
    <div class="row"><span class="dot" style="background:#ec4899"></span><span>الوصول</span></div>
    <div class="row"><span style="width:16px;height:3px;background:#14b8a6;border-radius:2px;"></span><span>مسار الرحلة</span></div>
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
      const line = L.polyline([r.a, r.b], {
        color: r.focused ? '#ec4899' : '#14b8a6',
        weight: r.focused ? 5 : 3,
        opacity: r.focused ? 0.95 : 0.65,
        dashArray: r.focused ? null : '6 6'
      }).addTo(map);
      bounds.push(r.a, r.b);
      line.bindPopup(
        '<div class="popup-title">' + r.from + ' → ' + r.to + '</div>' +
        (r.when ? '<div class="popup-meta">📅 ' + r.when + '</div>' : '') +
        '<div class="popup-meta">🚗 ' + r.carrier + '</div>' +
        '<a href="#" class="open-btn" onclick="window.__openTrip(\\'' + r.id + '\\');return false;">فتح الرحلة</a>'
      );
    });

    cities.forEach(([name, info]) => {
      const iconHtml = '<div class="pin ' + info.type + '"></div>';
      const label = info.type === 'from' ? 'الرحلات من هنا' : 'الرحلات إلى هنا';
      L.marker(info.pos, {
        icon: L.divIcon({ className: '', html: iconHtml, iconSize: [26, 26], iconAnchor: [13, 13] })
      }).addTo(map).bindPopup(
        '<b>' + name + '</b>' +
        '<div style="margin-top:6px"><a href="#" class="open-btn" onclick="window.__filterCity(\\'' + name + '\\',\\'' + info.type + '\\');return false;">' + label + '</a></div>'
      );
    });

    // Fit map to visible routes (or the focused one)
    if (focused) {
      map.fitBounds([focused.a, focused.b], { padding: [40, 40], maxZoom: 7, animate: true });
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
  loadingText: { color: "#64748b", fontWeight: "700" },
});
