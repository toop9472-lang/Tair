export function routeCities(trip) {
  if (!trip) return [];
  return [trip.from_city, ...(trip.waypoints || []), trip.to_city].filter(Boolean);
}

export function journeyState(trip) {
  const cities = routeCities(trip);
  const last = Math.max(cities.length - 1, 0);
  const status = trip?.status;
  let motion = trip?.motion;
  let stopIndex = Number.isInteger(trip?.stop_index) ? trip.stop_index : null;
  if (motion !== "stopped" && motion !== "moving" && motion !== "arrived") {
    if (status === "arrived" || status === "completed") {
      motion = "arrived";
      stopIndex = last;
    } else if (status === "departed" || status === "in_transit") {
      motion = "moving";
      stopIndex = stopIndex ?? 0;
    } else {
      motion = "stopped";
      stopIndex = 0;
    }
  }
  stopIndex = Math.max(0, Math.min(stopIndex ?? 0, last));
  if (motion === "arrived") stopIndex = last;
  const here = cities[stopIndex] || cities[0] || "";
  const next = stopIndex < last ? cities[stopIndex + 1] : null;
  const label = motion === "arrived" ? "وصول" : motion === "moving" ? "تحرك" : "توقف";
  return { motion, stopIndex, last, cities, here, next, label };
}

const LIVE_WINDOW_MS = 12 * 60 * 60 * 1000;

export function vehiclePosition(trip, journey, placed) {
  const lat = Number(trip?.live_lat);
  const lng = Number(trip?.live_lng);
  const at = Date.parse(trip?.live_at || "");
  const fresh = Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && Number.isFinite(at)
    && Date.now() - at < LIVE_WINDOW_MS
    && Date.now() - at > -60 * 1000;
  if (fresh && journey?.motion !== "arrived" && placed?.length) {
    return { pos: [lat, lng], live: true };
  }
  const current = [...(placed || [])].reverse().find((point) => point.index <= journey.stopIndex) || placed?.[0];
  const upcoming = (placed || []).find((point) => point.index > journey.stopIndex);
  if (journey.motion === "moving" && upcoming && current) {
    return {
      pos: [(current.pos[0] + upcoming.pos[0]) / 2, (current.pos[1] + upcoming.pos[1]) / 2],
      live: false,
    };
  }
  if (journey.motion === "arrived" && placed?.length) {
    return { pos: placed[placed.length - 1].pos, live: false };
  }
  return { pos: current?.pos, live: false };
}

export function nextJourneyAction(trip) {
  if (!trip || trip.status === "cancelled" || trip.status === "completed") return null;
  const j = journeyState(trip);
  if (j.motion === "arrived") {
    return { status: "completed", motion: "arrived", stop_index: j.last, label: "إغلاق الرحلة" };
  }
  if (j.motion === "stopped") {
    return {
      status: j.stopIndex === 0 ? "departed" : "in_transit",
      motion: "moving",
      stop_index: j.stopIndex,
      label: "تحرك",
    };
  }
  if (j.stopIndex + 1 >= j.last) {
    return { status: "arrived", motion: "arrived", stop_index: j.last, label: "وصول" };
  }
  const city = j.cities[j.stopIndex + 1];
  return {
    status: "in_transit",
    motion: "stopped",
    stop_index: j.stopIndex + 1,
    label: `توقف في ${city}`,
  };
}
