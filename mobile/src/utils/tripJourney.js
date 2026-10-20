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
