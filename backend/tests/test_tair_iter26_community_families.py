"""Iteration 26 — Tair: Families, Listings feed filter, Community (Stories/Pride),
Auctions (window/oath/bid/delete), Payments disabled, Admin, Reports."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://saqr-ui-sync.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sky-321@hotmail.com"
ADMIN_PASSWORD = "Talal12@"

EXPECTED_FAMILIES = {
    "livestock", "horses", "songbirds", "poultry", "pigeons", "parrots", "falcons", "fish",
    "small_mammals", "pets", "reptiles", "insects", "cats", "dogs",
    "feed", "bird_supplies", "animal_supplies", "reserves", "services",
    "hotel_services", "training",
}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, "No token in admin login response"
    return tok


# ==================== 1. Species families ====================
class TestFamilies:
    def test_families_catalog(self, s):
        r = s.get(f"{API}/species/families")
        assert r.status_code == 200
        data = r.json()
        assert data.get("total") == 21
        ids = {f["family_id"] for f in data["items"]}
        assert ids == EXPECTED_FAMILIES, f"Missing: {EXPECTED_FAMILIES - ids}, Extra: {ids - EXPECTED_FAMILIES}"
        # Each family must have name_ar and icon
        for f in data["items"]:
            assert f.get("name_ar")
            assert f.get("icon")


# ==================== 2. Listings feed by family ====================
class TestListingsFeed:
    def test_feed_no_filter(self, s):
        r = s.get(f"{API}/listings/feed")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_feed_family_songbirds(self, s):
        r = s.get(f"{API}/listings/feed", params={"family": "songbirds"})
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        # All returned items (if any) should be relevant to songbirds
        for it in body["items"]:
            fam = it.get("family")
            if fam:
                assert fam == "songbirds"

    def test_feed_family_invalid(self, s):
        r = s.get(f"{API}/listings/feed", params={"family": "nonexistent_xyz"})
        assert r.status_code == 200
        assert r.json().get("items") == [] or isinstance(r.json().get("items"), list)


# ==================== 3. Community — Stories ====================
class TestCommunityStories:
    story_id = None

    def test_stories_list_empty_ok(self, s):
        r = s.get(f"{API}/community/stories/list")
        assert r.status_code == 200
        b = r.json()
        assert "items" in b and "count" in b
        assert isinstance(b["items"], list)

    def test_create_story(self, s):
        r = s.post(
            f"{API}/community/stories/create",
            params={"user_id": "TEST_user_iter26"},
            json={"image_url": "https://example.com/story.jpg", "caption": "TEST story"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("story_id", "").startswith("sty_")
        assert d.get("expires_at")
        assert d.get("image_url") == "https://example.com/story.jpg"
        TestCommunityStories.story_id = d["story_id"]

    def test_stories_appear_in_list(self, s):
        r = s.get(f"{API}/community/stories/list")
        assert r.status_code == 200
        ids = [i.get("story_id") for i in r.json()["items"]]
        assert TestCommunityStories.story_id in ids

    def test_delete_story_forbidden_for_random(self, s):
        assert TestCommunityStories.story_id is not None
        r = s.delete(
            f"{API}/community/stories/{TestCommunityStories.story_id}",
            params={"user_id": "TEST_random_intruder"},
        )
        assert r.status_code == 403

    def test_delete_story_admin_ok(self, s):
        assert TestCommunityStories.story_id is not None
        r = s.delete(
            f"{API}/community/stories/{TestCommunityStories.story_id}",
            params={"user_id": ADMIN_EMAIL},
        )
        assert r.status_code == 200
        assert r.json().get("success") is True


# ==================== 4. Community — Pride ====================
class TestPride:
    def test_pride_list(self, s):
        r = s.get(f"{API}/community/pride/list")
        assert r.status_code == 200
        b = r.json()
        assert "items" in b and isinstance(b["items"], list)
        assert "count" in b


# ==================== 5. Auctions — Window Status ====================
class TestAuctionWindow:
    def test_window_status(self, s):
        r = s.get(f"{API}/auctions/window-status")
        assert r.status_code == 200
        d = r.json()
        for key in ["is_open", "opens_at", "closes_at", "now"]:
            assert key in d
        assert d.get("open_hour_ksa") == 16
        assert d.get("close_hour_ksa") == 21
        assert d.get("ksa_offset_hours") == 3
        assert isinstance(d["is_open"], bool)


# ==================== 6. Auctions — Oath + Create + Bid ====================
class TestAuctionFlow:
    USER = f"TEST_auction_user_{int(time.time())}"
    SELLER = f"TEST_auction_seller_{int(time.time())}"
    auction_id = None
    window_open = False

    def test_oath_status_initial(self, s):
        r = s.get(f"{API}/auctions/oath/status", params={"user_id": self.SELLER})
        assert r.status_code == 200
        # It may already be accepted from previous runs — either is fine
        assert "accepted" in r.json()
        assert "text" in r.json()

    def test_create_without_oath_returns_428(self, s):
        # Use a fresh user with no oath
        fresh_user = f"TEST_no_oath_{int(time.time()*1000)}"
        r = s.post(
            f"{API}/auctions/create",
            params={"user_id": fresh_user},
            json={"title": "TEST no-oath", "starting_price_sar": 100},
        )
        assert r.status_code == 428, f"Expected 428, got {r.status_code}: {r.text}"

    def test_oath_accept(self, s):
        r = s.post(f"{API}/auctions/oath/accept", params={"user_id": self.SELLER})
        assert r.status_code == 200
        assert r.json().get("success") is True
        # Bidder oath
        r2 = s.post(f"{API}/auctions/oath/accept", params={"user_id": self.USER})
        assert r2.status_code == 200

    def test_create_auction_after_oath(self, s):
        r = s.post(
            f"{API}/auctions/create",
            params={"user_id": self.SELLER},
            json={
                "title": "TEST Canary Auction",
                "description": "Testing",
                "starting_price_sar": 100,
                "min_increment_sar": 50,
                "city": "Riyadh",
                "images": ["https://example.com/a.jpg"],
                "category": "birds",
            },
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("auction_id", "").startswith("auc_")
        assert d.get("status") in ("live", "scheduled")
        TestAuctionFlow.auction_id = d["auction_id"]

    def test_list_auctions(self, s):
        r = s.get(f"{API}/auctions/list")
        assert r.status_code == 200
        b = r.json()
        assert "items" in b and "window_is_open" in b
        TestAuctionFlow.window_open = b["window_is_open"]
        # Our created auction should exist
        ids = [i["auction_id"] for i in b["items"]]
        assert TestAuctionFlow.auction_id in ids

    def test_get_auction_detail(self, s):
        assert TestAuctionFlow.auction_id
        r = s.get(f"{API}/auctions/{TestAuctionFlow.auction_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["auction_id"] == TestAuctionFlow.auction_id
        assert "recent_bids" in d
        # ISO dates
        assert isinstance(d.get("start_at"), str)
        assert isinstance(d.get("end_at"), str)

    def test_bid_seller_forbidden(self, s):
        assert TestAuctionFlow.auction_id
        r = s.post(
            f"{API}/auctions/{TestAuctionFlow.auction_id}/bid",
            params={"user_id": self.SELLER},
            json={"amount_sar": 500},
        )
        # If window closed → 423, else 403 for seller-on-own
        if TestAuctionFlow.window_open:
            assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        else:
            assert r.status_code == 423

    def test_bid_outside_or_insufficient(self, s):
        assert TestAuctionFlow.auction_id
        r = s.post(
            f"{API}/auctions/{TestAuctionFlow.auction_id}/bid",
            params={"user_id": self.USER},
            json={"amount_sar": 10},  # too low
        )
        if TestAuctionFlow.window_open:
            assert r.status_code == 400, f"Expected 400 for low bid, got {r.status_code}: {r.text}"
        else:
            assert r.status_code == 423, f"Expected 423 outside window, got {r.status_code}"

    def test_delete_by_random_forbidden(self, s):
        assert TestAuctionFlow.auction_id
        r = s.delete(
            f"{API}/auctions/{TestAuctionFlow.auction_id}",
            params={"user_id": "TEST_random_evil"},
        )
        assert r.status_code == 403

    def test_delete_by_admin(self, s):
        assert TestAuctionFlow.auction_id
        r = s.delete(
            f"{API}/auctions/{TestAuctionFlow.auction_id}",
            params={"user_id": ADMIN_EMAIL},
        )
        assert r.status_code == 200


# ==================== 7. Payments disabled ====================
class TestPaymentsDisabled:
    @pytest.mark.parametrize("path", [
        "/payments/create",
        "/wallet/balance",
        "/stripe/checkout",
        "/iap/verify",
    ])
    def test_payments_return_404(self, s, path):
        r = s.get(f"{API}{path}")
        # These routers are disabled — should be 404
        assert r.status_code == 404, f"{path} returned {r.status_code} (expected 404)"


# ==================== 8. Admin ====================
class TestAdmin:
    def test_admin_users_list_requires_auth(self, s):
        r = s.get(f"{API}/admin/users/list")
        assert r.status_code in (401, 403)

    def test_admin_users_list_ok(self, s, admin_token):
        r = s.get(f"{API}/admin/users/list", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        b = r.json()
        # Should return a list under some key
        assert isinstance(b, (list, dict))


# ==================== 9. Tair reports ====================
class TestReports:
    def test_reports_list_requires_user(self, s):
        r = s.get(f"{API}/tair-reports/list")
        assert r.status_code == 422  # missing required user_id

    def test_reports_list_admin(self, s):
        r = s.get(f"{API}/tair-reports/list", params={"user_id": ADMIN_EMAIL})
        assert r.status_code == 200, r.text
        b = r.json()
        assert "items" in b and "total" in b

    def test_reports_list_non_admin_forbidden(self, s):
        r = s.get(f"{API}/tair-reports/list", params={"user_id": "TEST_random_user"})
        assert r.status_code == 403
