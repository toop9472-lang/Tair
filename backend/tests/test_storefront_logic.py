import importlib.util
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(rel):
    path = ROOT / rel
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


logic = load("services/storefront_logic.py")


def at(iso):
    return datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)


HOURS = [
    {"day": "sat", "open": "09:00", "close": "22:00", "closed": False},
    {"day": "fri", "open": "16:00", "close": "22:00", "closed": True},
]


def test_open_hours_follow_riyadh():
    # Saturday 2026-10-17 07:30 UTC = 10:30 in Riyadh
    assert logic.is_open_now(HOURS, at("2026-10-17T07:30:00"))
    # Saturday 20:30 UTC = 23:30 Riyadh, after close
    assert not logic.is_open_now(HOURS, at("2026-10-17T20:30:00"))
    # Friday is marked closed. 2026-10-16 is a Friday.
    assert not logic.is_open_now(HOURS, at("2026-10-16T12:00:00"))
    assert logic.is_open_now([], at("2026-10-16T12:00:00"))


def test_flash_sales_drop_expired():
    now = at("2026-10-21T12:00:00")
    sales = [
        {"id": "a", "ends_at": "2026-10-22T12:00:00+00:00"},
        {"id": "b", "ends_at": "2026-10-20T12:00:00+00:00"},
        {"id": "c"},
    ]
    assert [s["id"] for s in logic.active_flash_sales(sales, now)] == ["a"]


def test_coupon_and_copy_limits():
    assert logic.normalize_coupon_code("  طير١٠ ") == "طير10"
    try:
        logic.normalize_coupon_code("ab")
        raise AssertionError("short code")
    except ValueError:
        pass
    patch = logic.sanitize_settings_patch({
        "announcement": "  عرض  " + ("ن" * 300),
        "delivery_cities": [" الرياض ", "الرياض", "جدة", "مكة", "الطائف", "أبها", "تبوك", "حائل", "جازان", "زائد"],
        "store_paused": 1,
        "banner_slides": ["a", "", "b", "c", "d", "e", "f"],
    })
    assert len(patch["announcement"]) == 180
    assert patch["delivery_cities"][0] == "الرياض"
    assert patch["delivery_cities"].count("الرياض") == 1
    assert len(patch["delivery_cities"]) == 8
    assert patch["store_paused"] is True
    assert patch["banner_slides"] == ["a", "b", "c", "d", "e"]


def test_auto_reply_is_limited():
    closed = at("2026-10-17T20:30:00")
    opened = at("2026-10-17T07:30:00")
    assert logic.auto_reply_text({"auto_reply_enabled": True, "business_hours": HOURS, "auto_reply_message": "نرد غداً"}, opened) is None
    reply = logic.auto_reply_text({"auto_reply_enabled": True, "business_hours": HOURS, "auto_reply_message": "نرد غداً"}, closed)
    assert reply == "رد آلي: نرد غداً"
    paused = logic.auto_reply_text({"store_paused": True, "announcement": "نعود الأحد"}, opened)
    assert paused.startswith("رد آلي: المتجر متوقف مؤقتاً.")
    assert "نعود الأحد" in paused
    assert logic.auto_reply_text({"auto_reply_enabled": False, "business_hours": HOURS}, closed) is None
