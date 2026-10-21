import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.listing_watch import parse_price, watch_matches  # noqa: E402
from services.notification_face import notification_face  # noqa: E402
from services.return_nudge import should_nudge  # noqa: E402


def test_watch_matches_bird_and_optional_price():
    listing = {
        "listing_id": "lst_1",
        "seller_id": "seller",
        "title": "ببغاء كاسكو أليف",
        "family": "parrots",
        "price_sar": 1800,
        "status": "active",
        "city": "الرياض",
    }
    assert watch_matches({"user_id": "buyer", "bird": "كاسكو", "active": True}, listing)
    assert watch_matches(
        {"user_id": "buyer", "bird": "كاسكو", "max_price": 2000, "active": True},
        listing,
    )
    assert not watch_matches(
        {"user_id": "buyer", "bird": "كاسكو", "max_price": 900, "active": True},
        listing,
    )
    assert watch_matches(
        {"user_id": "buyer", "bird": "ببغاوات", "max_price": 2000, "active": True},
        {"listing_id": "lst_2", "seller_id": "seller", "title": "زوج", "family": "parrots", "price_sar": 500, "status": "active"},
    )
    assert not watch_matches({"user_id": "seller", "bird": "كاسكو", "active": True}, listing)
    assert not watch_matches({"user_id": "buyer", "bird": "كاسكو", "active": False}, listing)
    assert not watch_matches({"user_id": "buyer", "bird": "كناري", "active": True}, listing)
    assert parse_price("٥٠٠") == 500


def test_return_nudge_once_per_absence():
    now = datetime(2026, 10, 21, tzinfo=timezone.utc)
    away = {"user_id": "u1", "last_seen": now - timedelta(days=3)}
    assert should_nudge(away, now)
    nudged = {**away, "last_return_nudge": now - timedelta(days=1)}
    assert not should_nudge(nudged, now)
    back = {"user_id": "u1", "last_seen": now - timedelta(hours=5), "last_return_nudge": now - timedelta(days=10)}
    assert not should_nudge(back, now)
    assert not should_nudge({"user_id": "guest_1", "last_seen": now - timedelta(days=9)}, now)
    assert notification_face("listing_watch")["label"] == "طلبك في السوق"
    assert notification_face("return_nudge")["channel"] == "general"


def test_inbox_keeps_the_badge_until_a_notification_is_opened():
    screen = Path(__file__).resolve().parents[2].joinpath("mobile/src/screens/NotificationsScreen.js").read_text(encoding="utf-8")
    account = Path(__file__).resolve().parents[2].joinpath("mobile/src/screens/ProfileScreen.js").read_text(encoding="utf-8")
    assert "markRead" in screen
    assert "readAll(uid)" not in screen.split("const load")[1].split("const openOne")[0]
    assert "menu-listing-watch" in account
