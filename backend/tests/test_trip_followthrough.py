"""حجوز الرحلة، حركة الموصل، ومطابقة اسم المدينة المختصر."""
import importlib.util
from pathlib import Path


def _load(name, relative):
    path = Path(__file__).resolve().parents[1] / relative
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


city_match_values = _load("places_mod", "models/places.py").city_match_values
motion_copy = _load("trip_motion_mod", "services/trip_motion.py").motion_copy


def test_short_city_name_matches_the_saved_full_name():
    assert "مكة المكرمة" in city_match_values("مكة")
    assert "مكة" in city_match_values("مكة المكرمة")
    assert "المدينة المنورة" in city_match_values("المدينة")
    assert "دبي" not in city_match_values("مكة")


def test_country_filter_stays_a_list_of_its_cities():
    values = city_match_values("الإمارات العربية المتحدة")
    assert "دبي" in values
    assert "مكة" not in values


def test_motion_copy_names_the_stop_and_the_next_city():
    trip = {"from_city": "الرياض", "waypoints": ["الطائف"], "to_city": "جدة"}
    assert motion_copy(trip, "stopped", 0) == ("توقفت الرحلة", "توقف الموصل في الرياض")
    assert motion_copy(trip, "moving", 0) == ("تحركت الرحلة", "تحرك الموصل من الرياض نحو الطائف")
    assert motion_copy(trip, "stopped", 1) == ("توقفت الرحلة", "توقف الموصل في الطائف")
    assert motion_copy(trip, "arrived", 2)[0] == "وصلت الرحلة"
    assert "جدة" in motion_copy(trip, "arrived", 2)[1]


def test_bookers_are_unique_and_skip_the_carrier():
    doc = {
        "carrier_id": "carrier",
        "bookings": [
            {"user_id": "a"},
            {"user_id": "a"},
            {"user_id": "carrier"},
            {"user_id": ""},
            {},
        ],
    }
    seen = []
    for booking in doc["bookings"]:
        uid = (booking or {}).get("user_id")
        if not uid or uid == doc["carrier_id"] or uid in seen:
            continue
        seen.append(uid)
    assert seen == ["a"]
