"""Tair iter23 backend tests — comprehensive SellerStorefrontScreen backing endpoints.

Covers:
  1. GET /api/sellers/{user_id} returns ALL required merchant storefront fields.
  2. GET /api/sellers/{user_id}/listings items have cover_image/title/price_sar/status.
  3. GET /api/sellers/{user_id}/reviews returns items list (possibly empty).
  4. GET /api/sellers/nonexistent_user returns 404 with detail 'Seller not found'.
  5. PATCH /api/storefront/settings full-payload persistence & GET roundtrip.
  6. Identity mirror after PATCH (bio, avatar, profile_bg_url via /api/sellers/{id}).
  7. R2 upload endpoints return absolute pub-*.r2.dev URLs, and URLs are reachable.
  8. Regression: /api/trips/{id} still returns carrier_phone + carrier_whatsapp.
"""
import io
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


# --------------- Fixtures ---------------
@pytest.fixture(scope="module")
def guest():
    r = requests.post(f"{API}/auth/guest", timeout=30)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert me.status_code == 200
    uid = me.json()["user"]["id"]
    return {"token": token, "user_id": uid}


# 1×1 PNG (67 bytes)
_TINY_PNG = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
    "0000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)


# --------------- 1. GET /api/sellers/{user_id} field coverage ---------------
REQUIRED_SELLER_FIELDS = [
    "name", "avatar", "logo_url", "identity_color", "about_text",
    "business_hours", "banner_slides", "portfolio_images",
    "location", "pickup_enabled", "pickup_note", "flash_sales",
    "contact_prefs", "phone", "whatsapp",
    "listings_count", "sold_count", "rating_avg", "rating_count",
    "is_verified_shop", "is_verified_carrier", "joined_at",
]


class TestSellerProfileFields:
    def test_all_required_fields_present(self, guest):
        r = requests.get(f"{API}/sellers/{guest['user_id']}", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        missing = [k for k in REQUIRED_SELLER_FIELDS if k not in body]
        assert not missing, f"Missing fields: {missing}"
        # Type sanity
        assert isinstance(body["business_hours"], list)
        assert isinstance(body["banner_slides"], list)
        assert isinstance(body["portfolio_images"], list)
        assert isinstance(body["flash_sales"], list)
        assert isinstance(body["contact_prefs"], dict)
        assert isinstance(body["pickup_enabled"], bool)
        assert isinstance(body["is_verified_shop"], bool)
        assert isinstance(body["is_verified_carrier"], bool)

    def test_nonexistent_seller_returns_404(self):
        r = requests.get(f"{API}/sellers/nonexistent_user_xyz_123", timeout=30)
        assert r.status_code == 404, f"expected 404 got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("detail") == "Seller not found"


# --------------- 2. Listings & Reviews endpoints ---------------
class TestSellerListingsAndReviews:
    def test_listings_endpoint_shape(self, guest):
        uid = guest["user_id"]
        # Seed one listing
        payload = {
            "title": "TEST_Iter23 Canary",
            "description": "iter23 test",
            "category": "birds",
            "price_sar": 199.0,
            "city": "الرياض",
            "images": ["https://cdn.example.com/x1.jpg"],
        }
        c = requests.post(f"{API}/listings/create", params={"user_id": uid}, json=payload, timeout=30)
        assert c.status_code == 200, c.text

        r = requests.get(f"{API}/sellers/{uid}/listings", timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        assert items, "seller listings empty after creating one"
        item = items[0]
        for k in ("cover_image", "title", "price_sar", "status"):
            assert k in item, f"listing item missing {k}"

    def test_reviews_endpoint_returns_list(self, guest):
        r = requests.get(f"{API}/sellers/{guest['user_id']}/reviews", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert isinstance(body["items"], list)


# --------------- 3. PATCH storefront full payload roundtrip ---------------
FULL_PAYLOAD = {
    "identity_color": "#ff6600",
    "logo_url": "https://cdn.example.com/iter23-logo.png",
    "about_text": "متجر اختبار iter23",
    "contact_prefs": {"whatsapp": True, "call": True, "chat": False},
    "business_hours": [
        {"day": "sat", "open": "10:00", "close": "20:00", "closed": False},
        {"day": "sun", "open": "10:00", "close": "20:00", "closed": False},
        {"day": "mon", "open": "10:00", "close": "20:00", "closed": False},
        {"day": "tue", "open": "10:00", "close": "20:00", "closed": False},
        {"day": "wed", "open": "10:00", "close": "20:00", "closed": False},
        {"day": "thu", "open": "10:00", "close": "20:00", "closed": False},
        {"day": "fri", "open": "00:00", "close": "00:00", "closed": True},
    ],
    "banner_slides": [
        "https://cdn.example.com/iter23-b1.jpg",
        "https://cdn.example.com/iter23-b2.jpg",
        "https://cdn.example.com/iter23-b3.jpg",
    ],
    "portfolio_images": [
        "https://cdn.example.com/p1.jpg",
        "https://cdn.example.com/p2.jpg",
        "https://cdn.example.com/p3.jpg",
        "https://cdn.example.com/p4.jpg",
    ],
    "location": {"lat": 24.7136, "lng": 46.6753, "address_label": "الرياض - العليا"},
    "pickup_enabled": True,
    "pickup_note": "يمكن الاستلام من المتجر",
    "auto_reply_enabled": True,
    "auto_reply_message": "شكراً لتواصلك",
}


class TestStorefrontFullPersistence:
    def test_patch_and_get_full_roundtrip(self, guest):
        uid = guest["user_id"]
        headers = {"Authorization": f"Bearer {guest['token']}"}
        r = requests.patch(
            f"{API}/storefront/settings",
            params={"user_id": uid},
            json=FULL_PAYLOAD,
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text

        g = requests.get(f"{API}/storefront/settings", params={"user_id": uid}, headers=headers, timeout=30)
        assert g.status_code == 200, g.text
        s = g.json()
        # Field-by-field comparison
        for key, expected in FULL_PAYLOAD.items():
            assert s.get(key) == expected, f"field {key} mismatch: got {s.get(key)!r} expected {expected!r}"

    def test_patch_reflected_in_public_seller_endpoint(self, guest):
        # Depends on previous test having applied FULL_PAYLOAD
        uid = guest["user_id"]
        r = requests.get(f"{API}/sellers/{uid}", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["identity_color"] == FULL_PAYLOAD["identity_color"]
        assert body["logo_url"] == FULL_PAYLOAD["logo_url"]
        assert body["about_text"] == FULL_PAYLOAD["about_text"]
        assert body["contact_prefs"] == FULL_PAYLOAD["contact_prefs"]
        assert body["business_hours"] == FULL_PAYLOAD["business_hours"]
        assert body["banner_slides"] == FULL_PAYLOAD["banner_slides"]
        assert body["portfolio_images"] == FULL_PAYLOAD["portfolio_images"]
        assert body["location"] == FULL_PAYLOAD["location"]
        assert body["pickup_enabled"] is True
        assert body["pickup_note"] == FULL_PAYLOAD["pickup_note"]

    def test_identity_mirror_bio_avatar_bg(self, guest):
        uid = guest["user_id"]
        r = requests.get(f"{API}/sellers/{uid}", timeout=30)
        assert r.status_code == 200
        body = r.json()
        # Mirror: about_text→bio, logo_url→avatar, banner_slides[0]→profile_bg_url
        assert body.get("bio") == FULL_PAYLOAD["about_text"], f"bio mirror failed: {body.get('bio')!r}"
        assert body.get("avatar") == FULL_PAYLOAD["logo_url"], f"avatar mirror failed: {body.get('avatar')!r}"
        assert body.get("profile_bg_url") == FULL_PAYLOAD["banner_slides"][0], \
            f"profile_bg_url mirror failed: {body.get('profile_bg_url')!r}"


# --------------- 4. R2 upload endpoints ---------------
class TestR2Uploads:
    def test_listings_upload_image_returns_absolute_r2_url(self, guest):
        files = {"file": ("iter23.png", io.BytesIO(_TINY_PNG), "image/png")}
        data = {"user_id": guest["user_id"]}
        r = requests.post(f"{API}/listings/upload-image", files=files, data=data, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        url = body.get("url") or body.get("image_url")
        assert url, f"no url in response: {body}"
        assert url.startswith("https://"), f"url not absolute https: {url}"
        assert "r2.dev" in url, f"url is not an R2 public URL (got {url}) — likely local fallback"
        # Fetch it back
        head = requests.get(url, timeout=30)
        assert 200 <= head.status_code < 300, f"uploaded url not reachable: {head.status_code} {url}"

    def test_storefront_upload_media_logo_returns_absolute_r2_url(self, guest):
        files = {"file": ("logo.png", io.BytesIO(_TINY_PNG), "image/png")}
        r = requests.post(
            f"{API}/storefront/upload-media",
            params={"user_id": guest["user_id"], "kind": "logo"},
            files=files,
            headers={"Authorization": f"Bearer {guest['token']}"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        url = body.get("url")
        assert url and url.startswith("https://"), f"url not absolute https: {url}"
        assert "r2.dev" in url, f"storefront upload not using R2 public URL (got {url})"
        got = requests.get(url, timeout=30)
        assert 200 <= got.status_code < 300, f"uploaded url unreachable: {got.status_code} {url}"


# --------------- 5. Trip regression ---------------
class TestTripCarrierRegression:
    def test_trip_detail_has_carrier_phone_and_whatsapp(self, guest):
        uid = guest["user_id"]
        requests.post(
            f"{API}/phone/update-profile",
            params={"user_id": uid},
            json={"phone": "0501234567", "whatsapp": "0507654321"},
            timeout=30,
        )
        depart = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        c = requests.post(
            f"{API}/trips/create",
            params={"user_id": uid},
            json={
                "from_city": "الرياض", "to_city": "الدمام",
                "waypoints": [], "is_direct": True,
                "depart_at": depart, "vehicle_type": "سيدان",
                "has_ac": True, "total_cages": 2, "accepts_sensitive": False,
            },
            timeout=30,
        )
        assert c.status_code == 200, c.text
        tid = c.json()["trip_id"]
        g = requests.get(f"{API}/trips/{tid}", timeout=30)
        assert g.status_code == 200
        t = g.json()
        assert t.get("carrier_phone") == "0501234567"
        assert t.get("carrier_whatsapp") == "0507654321"
