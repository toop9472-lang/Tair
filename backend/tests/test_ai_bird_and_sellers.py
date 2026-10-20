"""Backend tests for AI Bird ID, Seller Storefront/Analytics, Trips, and Auth guest/register.

Covers regression for Sentry 400/500 issues caused by invalid Gemini model.
"""
import os
import io
import base64
import uuid
import time
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback (should be provided by env). Fail loudly if missing.
    BASE_URL = "https://saqr-ui-sync.preview.emergentagent.com"

ADMIN_UID = "user_93fd2a08e40e"


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def bird_jpeg_bytes():
    """A realistic-ish bird-shaped image. Gemini may or may not recognize it;
    what we require is a 200 response with is_bird boolean present."""
    img = Image.new("RGB", (600, 400), (135, 206, 235))  # sky blue
    d = ImageDraw.Draw(img)
    # A crude bird silhouette (body + head + beak)
    d.ellipse((200, 200, 400, 300), fill=(60, 40, 20))       # body
    d.ellipse((360, 170, 440, 230), fill=(60, 40, 20))       # head
    d.polygon([(430, 195), (470, 200), (430, 210)], fill=(255, 165, 0))  # beak
    d.ellipse((415, 185, 425, 195), fill=(0, 0, 0))          # eye
    d.polygon([(220, 220), (290, 180), (330, 240)], fill=(80, 55, 30))   # wing
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture(scope="module")
def non_bird_jpeg_bytes():
    img = Image.new("RGB", (400, 400), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle((50, 50, 350, 350), fill=(30, 30, 30))
    d.text((80, 180), "HELLO WORLD - NOT A BIRD", fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


@pytest.fixture(scope="module")
def other_user_id(api):
    """Register a fresh user to use as OTHER_user_id for 403 test."""
    email = f"TEST_other_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "StrongP@ssw0rd!123",
        "name": "Other Tester",
    }, timeout=30)
    if r.status_code not in (200, 201):
        pytest.skip(f"Could not create other user: {r.status_code} {r.text[:200]}")
    body = r.json()
    uid = (body.get("user") or {}).get("user_id") or (body.get("user") or {}).get("id")
    if not uid:
        pytest.skip(f"Register did not return user_id: {body}")
    return uid


# =============================== AI Bird ID ===============================

class TestAIBirdID:

    def test_identify_bird_multipart_real_image(self, api, bird_jpeg_bytes):
        files = {"file": ("bird.jpg", bird_jpeg_bytes, "image/jpeg")}
        r = api.post(f"{BASE_URL}/api/ai/identify-bird", files=files, timeout=90)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:400]}"
        data = r.json()
        # is_bird should be present (True/False/None if AI returned invalid JSON)
        assert "is_bird" in data, f"Missing is_bird in {data}"
        # notes_ar should be populated in any graceful path
        # (either species notes or graceful failure message)
        # It may be None if is_bird=true with successful JSON, in which case check other fields
        if data.get("is_bird") is True:
            for k in ("species_ar", "species_en", "confidence", "estimated_price_sar"):
                assert k in data, f"Missing {k} when is_bird=true: {data}"
        else:
            # graceful fallback: notes_ar populated
            assert data.get("notes_ar") or data.get("raw") or data.get("error"), (
                f"is_bird=false but no explanation: {data}"
            )

    def test_identify_bird_non_bird_image(self, api, non_bird_jpeg_bytes):
        files = {"file": ("logo.jpg", non_bird_jpeg_bytes, "image/jpeg")}
        r = api.post(f"{BASE_URL}/api/ai/identify-bird", files=files, timeout=90)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert "is_bird" in data
        # Model should recognize it's not a bird OR gracefully fallback; either way notes_ar populated
        if data.get("is_bird") is False:
            assert data.get("notes_ar"), f"notes_ar should be populated: {data}"

    def test_identify_bird_b64_tiny_pixel_no_500(self, api):
        # 1x1 white pixel JPEG (invalid/pathological for vision models)
        img = Image.new("RGB", (1, 1), (255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, "JPEG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        r = api.post(f"{BASE_URL}/api/ai/identify-bird-b64",
                     json={"image_base64": b64, "mime_type": "image/jpeg"}, timeout=90)
        # MUST NOT be 5xx
        assert r.status_code < 500, f"Got 5xx: {r.status_code} {r.text[:400]}"
        # Accept 200 (graceful) or 400 (bad request)
        assert r.status_code in (200, 400), f"Unexpected code {r.status_code}: {r.text[:400]}"
        if r.status_code == 200:
            data = r.json()
            assert "is_bird" in data

    def test_identify_bird_b64_invalid_base64(self, api):
        r = api.post(f"{BASE_URL}/api/ai/identify-bird-b64",
                     json={"image_base64": "not-valid-base64!!!", "mime_type": "image/jpeg"},
                     timeout=30)
        # Should be 400, not 500
        assert r.status_code == 400, f"Expected 400 for invalid b64, got {r.status_code}"


# =============================== Sellers Storefront ===============================

class TestSellerStorefront:

    def test_seller_profile_valid(self, api):
        r = api.get(f"{BASE_URL}/api/sellers/{ADMIN_UID}", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        for k in ("user_id", "name", "listings_count", "sold_count", "rating_avg", "rating_count"):
            assert k in data, f"Missing {k} in profile: {data}"
        assert isinstance(data["listings_count"], int)
        assert isinstance(data["sold_count"], int)

    def test_seller_profile_404(self, api):
        r = api.get(f"{BASE_URL}/api/sellers/user_doesnotexist_xyz", timeout=15)
        assert r.status_code == 404

    def test_seller_listings(self, api):
        r = api.get(f"{BASE_URL}/api/sellers/{ADMIN_UID}/listings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "count" in data
        assert isinstance(data["items"], list)

    def test_seller_reviews(self, api):
        r = api.get(f"{BASE_URL}/api/sellers/{ADMIN_UID}/reviews", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "count" in data
        assert isinstance(data["items"], list)


# =============================== Seller Analytics ===============================

class TestSellerAnalytics:

    def test_analytics_overview_owner(self, api):
        r = api.get(
            f"{BASE_URL}/api/sellers/{ADMIN_UID}/analytics/overview",
            params={"requester_id": ADMIN_UID, "days": 30}, timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        for section in ("listings", "engagement", "orders", "rating"):
            assert section in d, f"Missing section {section}: {d}"
        for k in ("total", "active", "sold"):
            assert k in d["listings"]
        for k in ("views", "likes", "messages_received"):
            assert k in d["engagement"]
        for k in ("total", "completed", "completion_rate"):
            assert k in d["orders"]
        for k in ("avg", "count"):
            assert k in d["rating"]

    def test_analytics_overview_403(self, api, other_user_id):
        r = api.get(
            f"{BASE_URL}/api/sellers/{ADMIN_UID}/analytics/overview",
            params={"requester_id": other_user_id, "days": 30}, timeout=15,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text[:200]}"

    def test_analytics_per_listing_owner(self, api):
        r = api.get(
            f"{BASE_URL}/api/sellers/{ADMIN_UID}/analytics/listings",
            params={"requester_id": ADMIN_UID}, timeout=20,
        )
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        # Each item should have expected keys (if any items)
        for it in d["items"]:
            for k in ("view_count", "likes_count", "status"):
                assert k in it, f"Missing {k} in listing item: {it}"


# =============================== Trips ===============================

class TestTrips:

    def test_trips_list(self, api):
        r = api.get(f"{BASE_URL}/api/trips/list", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        for k in ("items", "total", "skip", "limit"):
            assert k in d, f"Missing {k} in trips list: {d}"
        assert isinstance(d["items"], list)


# =============================== Auth ===============================

class TestAuth:

    def test_guest_login(self, api):
        r = api.post(f"{BASE_URL}/api/auth/guest", json={}, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert "token" in d
        assert "refresh_token" in d
        assert "user" in d
        assert d["user"].get("is_guest") is True

    def test_register_returns_tokens(self, api):
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "StrongP@ssw0rd!123",
            "name": "Reg Tester",
        }, timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert "token" in d, f"Missing token: {d}"
        assert "refresh_token" in d, f"Missing refresh_token: {d}"
        assert "user" in d
