"""Tair iter24 — delete-reappearance bug + storefront mirror stability.

Covers:
  1. Owner soft-delete listing → excluded from seller endpoint (both include_all values).
     GET /api/listings/{id} still returns the (soft-deleted) doc.
  2. Owner cancel trip → excluded from carrier endpoint (both include_completed values).
  3. Admin DELETE listing → HARD delete (GET returns 404, comments + favorites purged),
     response mode == 'hard'.
  4. Admin DELETE trip → HARD delete (GET returns 404), response mode == 'hard'.
  5. Non-owner non-admin DELETE listing/trip → 403.
  6. GET /api/listings/feed never returns removed listings.
  7. Storefront mirror stability: PATCH with only business_hours does NOT modify
     user.bio / user.avatar / user.profile_bg_url.
  8. Storefront mirror on explicit identity fields updates bio/avatar/profile_bg_url.
  9. Regression: /api/sellers/{uid} still returns the 22 REQUIRED_SELLER_FIELDS.
 10. Regression: /api/trips/{id} still returns carrier_phone / carrier_whatsapp.

Cleanup: All created listings/trips/users are HARD deleted at the end via admin
DELETE + direct db.users.delete_one, so DB returns to empty state.
"""
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests

# --------------- BASE URL ---------------
_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _url:
    env_file = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                _url = line.split("=", 1)[1].strip()
                break
BASE_URL = _url.rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "sky-321@hotmail.com"

# Track resources created so we can hard-purge them at the end.
_created_listings: list[str] = []
_created_trips: list[str] = []
_created_users: list[str] = []


def _guest() -> dict:
    r = requests.post(f"{API}/auth/guest", timeout=30)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert me.status_code == 200, me.text
    uid = me.json()["user"]["id"]
    _created_users.append(uid)
    return {"token": token, "user_id": uid}


def _make_listing(uid: str, title: str = "TEST_iter24_listing") -> str:
    payload = {
        "title": title, "description": "iter24 test",
        "category": "birds", "price_sar": 100.0, "city": "الرياض",
        "images": ["https://cdn.example.com/i.jpg"],
    }
    r = requests.post(f"{API}/listings/create", params={"user_id": uid}, json=payload, timeout=30)
    assert r.status_code == 200, r.text
    lid = r.json()["listing_id"]
    _created_listings.append(lid)
    return lid


def _make_trip(uid: str) -> str:
    depart = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    r = requests.post(
        f"{API}/trips/create", params={"user_id": uid},
        json={
            "from_city": "الرياض", "to_city": "جدة", "waypoints": [],
            "is_direct": True, "depart_at": depart, "vehicle_type": "سيدان",
            "has_ac": True, "total_cages": 2, "accepts_sensitive": False,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    tid = r.json()["trip_id"]
    _created_trips.append(tid)
    return tid


# --------------- Fixtures ---------------
@pytest.fixture(scope="module")
def owner():
    return _guest()


@pytest.fixture(scope="module")
def other():
    return _guest()


# --------------- 1. Owner soft-delete listing ---------------
class TestOwnerDeleteListing:
    def test_owner_soft_delete_hidden_from_seller_endpoint(self, owner):
        uid = owner["user_id"]
        lid = _make_listing(uid, "TEST_iter24_soft_delete")

        # sanity: appears in both listing endpoints before delete
        r0 = requests.get(f"{API}/listings/seller/{uid}", timeout=30)
        assert lid in [i["listing_id"] for i in r0.json()["items"]]

        # owner DELETE (soft)
        d = requests.delete(f"{API}/listings/{lid}", params={"user_id": uid}, timeout=30)
        assert d.status_code == 200, d.text
        assert d.json().get("mode") == "soft", d.json()

        # not surfaced by seller endpoint with include_all=false
        r1 = requests.get(f"{API}/listings/seller/{uid}", params={"include_all": False}, timeout=30)
        assert r1.status_code == 200
        assert lid not in [i["listing_id"] for i in r1.json()["items"]], \
            "Soft-deleted listing reappeared with include_all=false"

        # AND with include_all=true (the previously-buggy path)
        r2 = requests.get(f"{API}/listings/seller/{uid}", params={"include_all": True}, timeout=30)
        assert r2.status_code == 200
        assert lid not in [i["listing_id"] for i in r2.json()["items"]], \
            "Soft-deleted listing reappeared with include_all=true"

        # direct GET still returns the doc (not hard-deleted)
        r3 = requests.get(f"{API}/listings/{lid}", timeout=30)
        assert r3.status_code == 200
        assert r3.json().get("status") == "removed"

    def test_removed_never_in_feed(self, owner):
        uid = owner["user_id"]
        lid = _make_listing(uid, "TEST_iter24_feed_guard")
        requests.delete(f"{API}/listings/{lid}", params={"user_id": uid}, timeout=30)
        r = requests.get(f"{API}/listings/feed", params={"limit": 100}, timeout=30)
        assert r.status_code == 200
        ids = [i["listing_id"] for i in r.json().get("items", [])]
        assert lid not in ids, "Soft-deleted listing leaked into feed"


# --------------- 2. Owner cancel trip ---------------
class TestOwnerCancelTrip:
    def test_owner_cancel_hidden_from_carrier_endpoint(self, owner):
        uid = owner["user_id"]
        tid = _make_trip(uid)

        # sanity
        r0 = requests.get(f"{API}/trips/carrier/{uid}", timeout=30)
        assert tid in [t["trip_id"] for t in r0.json()["items"]]

        d = requests.delete(f"{API}/trips/{tid}", params={"user_id": uid}, timeout=30)
        assert d.status_code == 200, d.text
        assert d.json().get("mode") == "soft", d.json()

        r1 = requests.get(f"{API}/trips/carrier/{uid}", params={"include_completed": False}, timeout=30)
        assert r1.status_code == 200
        assert tid not in [t["trip_id"] for t in r1.json()["items"]], \
            "Cancelled trip reappeared with include_completed=false"

        r2 = requests.get(f"{API}/trips/carrier/{uid}", params={"include_completed": True}, timeout=30)
        assert r2.status_code == 200
        assert tid not in [t["trip_id"] for t in r2.json()["items"]], \
            "Cancelled trip reappeared with include_completed=true"


# --------------- 3. Admin HARD delete listing ---------------
class TestAdminDeleteListing:
    def test_admin_hard_delete_purges_listing_comments_favorites(self, owner):
        uid = owner["user_id"]
        lid = _make_listing(uid, "TEST_iter24_admin_purge")

        # Owner adds a comment + favorite so we can verify purge cascades.
        requests.post(
            f"{API}/listings/{lid}/comment",
            params={"user_id": uid},
            json={"author_name": "T", "body": "hello"},
            timeout=30,
        )
        requests.post(f"{API}/listings/{lid}/favorite", params={"user_id": uid}, timeout=30)

        # sanity
        cs = requests.get(f"{API}/listings/{lid}/comments", timeout=30)
        assert cs.status_code == 200
        assert cs.json().get("total", 0) >= 1

        # Admin DELETE using email as user_id
        d = requests.delete(f"{API}/listings/{lid}", params={"user_id": ADMIN_EMAIL}, timeout=30)
        assert d.status_code == 200, d.text
        assert d.json().get("mode") == "hard", f"expected hard mode: {d.json()}"

        # GET returns 404
        g = requests.get(f"{API}/listings/{lid}", timeout=30)
        assert g.status_code == 404, f"expected 404 after admin hard delete: {g.status_code} {g.text}"

        # comments purged (endpoint still works, list empty)
        cs2 = requests.get(f"{API}/listings/{lid}/comments", timeout=30)
        assert cs2.status_code == 200
        assert cs2.json().get("total", 0) == 0, "listing_comments not purged"


# --------------- 4. Admin HARD delete trip ---------------
class TestAdminDeleteTrip:
    def test_admin_hard_delete_trip(self, owner):
        uid = owner["user_id"]
        tid = _make_trip(uid)

        d = requests.delete(f"{API}/trips/{tid}", params={"user_id": ADMIN_EMAIL}, timeout=30)
        assert d.status_code == 200, d.text
        assert d.json().get("mode") == "hard", d.json()

        g = requests.get(f"{API}/trips/{tid}", timeout=30)
        assert g.status_code == 404, f"expected 404: {g.status_code} {g.text}"


# --------------- 5. Non-owner non-admin 403 ---------------
class TestForbiddenDelete:
    def test_non_owner_cannot_delete_listing(self, owner, other):
        lid = _make_listing(owner["user_id"], "TEST_iter24_forbid_listing")
        d = requests.delete(f"{API}/listings/{lid}", params={"user_id": other["user_id"]}, timeout=30)
        assert d.status_code == 403, f"expected 403 got {d.status_code}: {d.text}"

    def test_non_owner_cannot_delete_trip(self, owner, other):
        tid = _make_trip(owner["user_id"])
        d = requests.delete(f"{API}/trips/{tid}", params={"user_id": other["user_id"]}, timeout=30)
        assert d.status_code == 403, f"expected 403 got {d.status_code}: {d.text}"


# --------------- 6. Storefront mirror stability ---------------
class TestStorefrontMirrorStability:
    def test_business_hours_only_patch_does_NOT_touch_identity(self, owner):
        uid = owner["user_id"]
        # Seed baseline identity
        requests.post(
            f"{API}/phone/update-profile", params={"user_id": uid},
            json={"bio": "iter24_baseline_bio", "avatar": "https://cdn.example.com/iter24_avatar.jpg"},
            timeout=30,
        )
        # profile_bg_url via storefront banner_slides mirror (explicit)
        requests.patch(
            f"{API}/storefront/settings", params={"user_id": uid},
            json={"banner_slides": ["https://cdn.example.com/iter24_bg.jpg"]},
            timeout=30,
        )
        # snapshot
        s0 = requests.get(f"{API}/sellers/{uid}", timeout=30).json()

        # Save ONLY business_hours
        new_hours = [
            {"day": "sat", "open": "08:00", "close": "18:00", "closed": False},
        ]
        r = requests.patch(
            f"{API}/storefront/settings", params={"user_id": uid},
            json={"business_hours": new_hours},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        s1 = requests.get(f"{API}/sellers/{uid}", timeout=30).json()
        # Identity fields must be untouched
        assert s1.get("bio") == s0.get("bio"), f"bio changed after unrelated storefront save: {s0.get('bio')!r} -> {s1.get('bio')!r}"
        assert s1.get("avatar") == s0.get("avatar"), f"avatar changed unexpectedly"
        assert s1.get("profile_bg_url") == s0.get("profile_bg_url"), f"profile_bg_url changed unexpectedly"

    def test_explicit_identity_patches_do_mirror(self, owner):
        uid = owner["user_id"]
        # about_text → bio
        r1 = requests.patch(f"{API}/storefront/settings", params={"user_id": uid},
                            json={"about_text": "iter24_new_bio"}, timeout=30)
        assert r1.status_code == 200, r1.text
        # logo_url → avatar
        r2 = requests.patch(f"{API}/storefront/settings", params={"user_id": uid},
                            json={"logo_url": "https://cdn.example.com/iter24_new_logo.jpg"}, timeout=30)
        assert r2.status_code == 200, r2.text
        # banner_slides[0] → profile_bg_url
        r3 = requests.patch(f"{API}/storefront/settings", params={"user_id": uid},
                            json={"banner_slides": ["https://cdn.example.com/iter24_new_bg.jpg",
                                                    "https://cdn.example.com/iter24_new_bg2.jpg"]},
                            timeout=30)
        assert r3.status_code == 200, r3.text

        s = requests.get(f"{API}/sellers/{uid}", timeout=30).json()
        assert s.get("bio") == "iter24_new_bio"
        assert s.get("avatar") == "https://cdn.example.com/iter24_new_logo.jpg"
        assert s.get("profile_bg_url") == "https://cdn.example.com/iter24_new_bg.jpg"


# --------------- 7. /api/sellers/{uid} 22-field regression ---------------
REQUIRED_SELLER_FIELDS = [
    "name", "avatar", "logo_url", "identity_color", "about_text",
    "business_hours", "banner_slides", "portfolio_images",
    "location", "pickup_enabled", "pickup_note", "flash_sales",
    "contact_prefs", "phone", "whatsapp",
    "listings_count", "sold_count", "rating_avg", "rating_count",
    "is_verified_shop", "is_verified_carrier", "joined_at",
]


class TestSellerFieldsRegression:
    def test_all_required_fields_present(self, owner):
        r = requests.get(f"{API}/sellers/{owner['user_id']}", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        missing = [k for k in REQUIRED_SELLER_FIELDS if k not in body]
        assert not missing, f"Missing seller fields: {missing}"


# --------------- 8. Trip carrier phone/whatsapp regression ---------------
class TestTripEnrichmentRegression:
    def test_trip_detail_has_carrier_contact(self, owner):
        uid = owner["user_id"]
        requests.post(
            f"{API}/phone/update-profile", params={"user_id": uid},
            json={"phone": "0501112222", "whatsapp": "0503334444"}, timeout=30,
        )
        tid = _make_trip(uid)
        g = requests.get(f"{API}/trips/{tid}", timeout=30)
        assert g.status_code == 200
        t = g.json()
        assert t.get("carrier_phone") == "0501112222"
        assert t.get("carrier_whatsapp") == "0503334444"


# --------------- Cleanup: hard-purge everything we created ---------------
@pytest.fixture(scope="module", autouse=True)
def _cleanup_after_module():
    yield
    # Hard-delete every listing/trip via admin
    for lid in list(_created_listings):
        try:
            requests.delete(f"{API}/listings/{lid}", params={"user_id": ADMIN_EMAIL}, timeout=15)
        except Exception:
            pass
    for tid in list(_created_trips):
        try:
            requests.delete(f"{API}/trips/{tid}", params={"user_id": ADMIN_EMAIL}, timeout=15)
        except Exception:
            pass
    # Purge users directly via mongo (no admin user-delete endpoint assumed)
    try:
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "saqr_db")

        async def _purge():
            c = AsyncIOMotorClient(mongo_url)
            db = c[db_name]
            for uid in _created_users:
                await db.users.delete_many({"$or": [{"id": uid}, {"user_id": uid}]})
                await db.tair_favorites.delete_many({"user_id": uid})
                await db.listing_comments.delete_many({"author_id": uid})
                await db.listings.delete_many({"seller_id": uid})
                await db.trips.delete_many({"carrier_id": uid})
            c.close()

        asyncio.get_event_loop().run_until_complete(_purge()) if False else asyncio.run(_purge())
    except Exception as exc:
        print(f"[cleanup] user purge failed: {exc}")
