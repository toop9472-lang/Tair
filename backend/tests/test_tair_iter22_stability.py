"""Tair iter22 stability fixes — backend regression tests.

Covers:
  - /api/auth/me extended fields (bio, phone, whatsapp, profile_bg_url, is_admin, is_verified_*)
  - /api/phone/update-profile accepting phone + whatsapp
  - /api/storefront/settings mirroring about_text/logo_url/banner_slides[0] to user identity
    fields even when top-level user fields already have values
  - /api/trips/{id} + /api/trips/list carrier_* enrichment
  - /api/listings/{id} + /api/listings/feed seller_* enrichment
"""
import os
from datetime import datetime, timezone, timedelta

import pytest
import requests

_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _url:
    # Load from frontend/.env
    from pathlib import Path
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
    data = r.json()
    token = data["token"]
    # decode user_id from /auth/me
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert me.status_code == 200, me.text
    uid = me.json()["user"]["id"]
    return {"token": token, "user_id": uid}


@pytest.fixture(scope="module")
def guest2():
    r = requests.post(f"{API}/auth/guest", timeout=30)
    assert r.status_code == 200
    token = r.json()["token"]
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    uid = me.json()["user"]["id"]
    return {"token": token, "user_id": uid}


# --------------- /api/auth/me ---------------
class TestAuthMe:
    def test_no_token_returns_403(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_me_with_token_returns_extended_fields(self, guest):
        r = requests.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {guest['token']}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "user" in body
        u = body["user"]
        for k in [
            "id", "user_id", "email", "name", "avatar",
            "bio", "phone", "whatsapp", "profile_bg_url",
            "is_admin", "role", "is_verified_shop", "is_verified_carrier",
        ]:
            assert k in u, f"missing field {k}"
        assert isinstance(u["is_admin"], bool)
        assert isinstance(u["is_verified_shop"], bool)
        assert isinstance(u["is_verified_carrier"], bool)


# --------------- /api/phone/update-profile ---------------
class TestUpdateProfilePhoneWhatsapp:
    def test_update_phone_and_whatsapp_persists(self, guest):
        uid = guest["user_id"]
        phone = "0501112233"
        wa = "0509998877"
        r = requests.post(
            f"{API}/phone/update-profile",
            params={"user_id": uid},
            json={"phone": phone, "whatsapp": wa, "bio": "Test carrier bio"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # Verify via public seller endpoint
        s = requests.get(f"{API}/sellers/{uid}", timeout=30)
        assert s.status_code == 200, s.text
        data = s.json()
        # sellers endpoint may nest under 'user' or return flat
        user = data.get("user", data)
        assert user.get("phone") == phone, f"phone not persisted: got {user.get('phone')}"
        assert user.get("whatsapp") == wa, f"whatsapp not persisted: got {user.get('whatsapp')}"


# --------------- /api/storefront/settings mirroring ---------------
class TestStorefrontMirroring:
    def test_storefront_overwrites_existing_identity_fields(self, guest):
        uid = guest["user_id"]
        # 1) Pre-populate top-level user fields to non-empty values via phone update-profile
        pre = requests.post(
            f"{API}/phone/update-profile",
            params={"user_id": uid},
            json={"bio": "OLD BIO", "avatar": "https://example.com/old-avatar.png",
                  "profile_bg_url": "https://example.com/old-bg.png"},
            timeout=30,
        )
        assert pre.status_code == 200, pre.text

        # 2) Now patch storefront settings — must OVERWRITE
        new_bio = "NEW ABOUT TEXT " + datetime.utcnow().isoformat()
        new_logo = "https://cdn.example.com/logo-new.png"
        new_banner = "https://cdn.example.com/banner-new.png"
        r = requests.patch(
            f"{API}/storefront/settings",
            params={"user_id": uid},
            json={
                "about_text": new_bio,
                "logo_url": new_logo,
                "banner_slides": [new_banner, "https://cdn.example.com/b2.png"],
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text

        # 3) Verify mirror via /api/auth/me
        me = requests.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {guest['token']}"},
            timeout=30,
        )
        assert me.status_code == 200
        u = me.json()["user"]
        assert u["bio"] == new_bio, f"about_text→bio not mirrored, got {u['bio']!r}"
        assert u["avatar"] == new_logo, f"logo_url→avatar not mirrored, got {u['avatar']!r}"
        assert u["profile_bg_url"] == new_banner, (
            f"banner_slides[0]→profile_bg_url not mirrored, got {u['profile_bg_url']!r}"
        )


# --------------- Trips enrichment ---------------
class TestTripEnrichment:
    def test_create_trip_and_get_enriches_carrier_fields(self, guest2):
        uid = guest2["user_id"]
        # Register carrier phone + whatsapp
        p = requests.post(
            f"{API}/phone/update-profile",
            params={"user_id": uid},
            json={"phone": "0507770001", "whatsapp": "0507770002",
                  "name": "TEST Carrier"},
            timeout=30,
        )
        assert p.status_code == 200, p.text

        # Create trip
        depart = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        payload = {
            "from_city": "الرياض",
            "to_city": "جدة",
            "waypoints": ["مكة"],
            "is_direct": False,
            "depart_at": depart,
            "vehicle_type": "سيدان",
            "has_ac": True,
            "total_cages": 4,
            "accepts_sensitive": True,
        }
        c = requests.post(f"{API}/trips/create", params={"user_id": uid}, json=payload, timeout=30)
        assert c.status_code == 200, c.text
        trip_id = c.json()["trip_id"]

        # GET /trips/{trip_id}
        g = requests.get(f"{API}/trips/{trip_id}", timeout=30)
        assert g.status_code == 200, g.text
        t = g.json()
        for k in [
            "carrier_name", "carrier_avatar", "carrier_phone", "carrier_whatsapp",
            "carrier_rating_avg", "carrier_trips_completed", "waypoints", "is_direct",
        ]:
            assert k in t, f"missing {k} in trip detail"
        assert t["carrier_phone"] == "0507770001"
        assert t["carrier_whatsapp"] == "0507770002"
        assert t["is_direct"] is False
        assert t["waypoints"] == ["مكة"]
        assert isinstance(t["carrier_trips_completed"], int)

    def test_trips_list_enriches_carrier_fields(self, guest2):
        r = requests.get(f"{API}/trips/list", params={"limit": 20}, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        assert len(items) > 0, "trips list empty — cannot verify enrichment"
        # find one from our test carrier
        target = next((i for i in items if i.get("carrier_id") == guest2["user_id"]), items[0])
        for k in ["carrier_name", "carrier_avatar", "carrier_phone",
                  "carrier_whatsapp", "carrier_rating_avg", "carrier_trips_completed"]:
            assert k in target, f"list item missing {k}"


# --------------- Listings enrichment (regression) ---------------
class TestListingEnrichment:
    def test_listing_detail_and_feed_enrich_seller_fields(self, guest):
        uid = guest["user_id"]
        # ensure seller phone/wa present
        requests.post(
            f"{API}/phone/update-profile",
            params={"user_id": uid},
            json={"phone": "0506665544", "whatsapp": "0506665500", "name": "TEST Seller"},
            timeout=30,
        )
        # Create listing
        payload = {
            "title": "TEST_ Cockatiel Pair",
            "description": "Test listing for enrichment",
            "category": "birds",
            "price_sar": 250.0,
            "city": "الرياض",
            "images": ["https://cdn.example.com/img1.jpg"],
        }
        c = requests.post(f"{API}/listings/create", params={"user_id": uid}, json=payload, timeout=30)
        assert c.status_code == 200, c.text
        lst_id = c.json()["listing_id"]

        # GET detail
        d = requests.get(f"{API}/listings/{lst_id}", timeout=30)
        assert d.status_code == 200, d.text
        det = d.json()
        for k in ["seller_name", "seller_avatar", "seller_phone", "seller_whatsapp"]:
            assert k in det, f"listing detail missing {k}"
        assert det["seller_phone"] == "0506665544"
        assert det["seller_whatsapp"] == "0506665500"

        # Feed enrichment
        f = requests.get(f"{API}/listings/feed", params={"limit": 30}, timeout=30)
        assert f.status_code == 200
        items = f.json().get("items", [])
        assert items, "feed empty"
        mine = next((i for i in items if i.get("listing_id") == lst_id), None)
        assert mine is not None, "created listing not in feed"
        for k in ["seller_name", "seller_avatar", "seller_phone", "seller_whatsapp"]:
            assert k in mine, f"feed item missing {k}"
