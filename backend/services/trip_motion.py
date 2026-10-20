"""نص تنبيه الحاجز عند تغيّر حركة الرحلة."""


def motion_copy(trip: dict, motion: str, stop_index: int):
    cities = [c for c in [trip.get("from_city"), *(trip.get("waypoints") or []), trip.get("to_city")] if c]
    last = max(len(cities) - 1, 0)
    idx = max(0, min(int(stop_index or 0), last))
    here = cities[idx] if cities else ""
    nxt = cities[idx + 1] if idx + 1 < len(cities) else (trip.get("to_city") or "")
    if motion == "arrived":
        return "وصلت الرحلة", f"وصل الموصل إلى {trip.get('to_city') or here}"
    if motion == "moving":
        return "تحركت الرحلة", f"تحرك الموصل من {here} نحو {nxt}".strip()
    return "توقفت الرحلة", f"توقف الموصل في {here or trip.get('from_city') or 'الطريق'}"
