"""Tair iter25 — Auction backend + payments-disabled sanity + admin/users + tair-reports."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Read frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sky-321@hotmail.com"
ADMIN_PASSWORD = "Talal12@"


@pytest.fixture(scope="module")
def user_id():
    return f"testuser_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def user_id2():
    return f"testuser_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = data.get("token") or data.get("access_token") or data.get("jwt")
    if not tok:
        pytest.skip(f"no token in admin login response: {data}")
    return tok


# ==================== Auction Window ====================
class TestWindowStatus:
    def test_window_status_shape(self):
        r = requests.get(f"{API}/auctions/window-status", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["is_open", "opens_at", "closes_at", "now"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["is_open"], bool)
        # ISO UTC
        assert "T" in d["opens_at"] and ("+00:00" in d["opens_at"] or "Z" in d["opens_at"])
        assert "T" in d["closes_at"]
        assert "T" in d["now"]


# ==================== Oath ====================
class TestOath:
    def test_oath_initial_false(self, user_id):
        r = requests.get(f"{API}/auctions/oath/status", params={"user_id": user_id}, timeout=10)
        assert r.status_code == 200
        assert r.json()["accepted"] is False

    def test_oath_accept_and_status(self, user_id):
        r = requests.post(f"{API}/auctions/oath/accept", params={"user_id": user_id}, timeout=10)
        assert r.status_code == 200
        assert r.json()["success"] is True
        r2 = requests.get(f"{API}/auctions/oath/status", params={"user_id": user_id}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["accepted"] is True


# ==================== Create Auction ====================
class TestCreateAuction:
    def test_create_without_oath_returns_428(self):
        no_oath_uid = f"nooath_{uuid.uuid4().hex[:8]}"
        payload = {"title": "TEST_bird", "starting_price_sar": 500, "min_increment_sar": 50}
        r = requests.post(f"{API}/auctions/create", params={"user_id": no_oath_uid},
                          json=payload, timeout=10)
        assert r.status_code == 428, f"expected 428, got {r.status_code} {r.text}"

    def test_create_with_oath_succeeds(self, user_id):
        payload = {"title": "TEST_auction_bird", "description": "test",
                   "starting_price_sar": 500, "min_increment_sar": 50, "city": "Riyadh"}
        r = requests.post(f"{API}/auctions/create", params={"user_id": user_id},
                          json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["auction_id"].startswith("auc_")
        assert d["title"] == "TEST_auction_bird"
        assert d["current_bid_sar"] == 500
        assert d["status"] in ("live", "scheduled")
        pytest.auction_id = d["auction_id"]
        pytest.seller_uid = user_id


# ==================== List & Get ====================
class TestListAndGet:
    def test_list_all(self):
        r = requests.get(f"{API}/auctions/list", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "window_is_open" in d
        assert isinstance(d["items"], list)

    def test_get_auction(self):
        aid = getattr(pytest, "auction_id", None)
        if not aid:
            pytest.skip("no auction created")
        r = requests.get(f"{API}/auctions/{aid}", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["auction_id"] == aid
        assert "recent_bids" in d and isinstance(d["recent_bids"], list)
        # Timestamps ISO strings, not datetime
        assert isinstance(d["start_at"], str)
        assert isinstance(d["end_at"], str)


# ==================== Bidding ====================
class TestBidding:
    def test_bid_without_oath_428(self):
        aid = getattr(pytest, "auction_id", None)
        if not aid:
            pytest.skip("no auction")
        no_oath = f"nooath_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/auctions/{aid}/bid",
                          params={"user_id": no_oath}, json={"amount_sar": 600}, timeout=10)
        assert r.status_code == 428, f"got {r.status_code}: {r.text}"

    def test_seller_cannot_bid_own(self, user_id):
        aid = getattr(pytest, "auction_id", None)
        if not aid:
            pytest.skip("no auction")
        # Check window first
        ws = requests.get(f"{API}/auctions/window-status", timeout=10).json()
        r = requests.post(f"{API}/auctions/{aid}/bid",
                          params={"user_id": user_id}, json={"amount_sar": 600}, timeout=10)
        if not ws["is_open"]:
            # outside window → 423 for oath'd user; but oath check happens before window check
            # per code: _require_oath first then window; seller has oath → will get 423 (window closed)
            assert r.status_code == 423, f"outside window expected 423 got {r.status_code}"
        else:
            assert r.status_code == 403, f"seller bid should get 403 got {r.status_code}: {r.text}"

    def test_bid_below_minimum(self, user_id2):
        aid = getattr(pytest, "auction_id", None)
        if not aid:
            pytest.skip("no auction")
        # Accept oath for user2
        requests.post(f"{API}/auctions/oath/accept", params={"user_id": user_id2}, timeout=10)
        ws = requests.get(f"{API}/auctions/window-status", timeout=10).json()
        r = requests.post(f"{API}/auctions/{aid}/bid",
                          params={"user_id": user_id2}, json={"amount_sar": 100}, timeout=10)
        if not ws["is_open"]:
            assert r.status_code == 423
        else:
            assert r.status_code == 400, f"low bid → 400 expected, got {r.status_code}: {r.text}"

    def test_bid_success(self, user_id2):
        aid = getattr(pytest, "auction_id", None)
        if not aid:
            pytest.skip("no auction")
        ws = requests.get(f"{API}/auctions/window-status", timeout=10).json()
        r = requests.post(f"{API}/auctions/{aid}/bid",
                          params={"user_id": user_id2}, json={"amount_sar": 600}, timeout=10)
        if not ws["is_open"]:
            assert r.status_code == 423, f"expected 423 outside window, got {r.status_code}"
            pytest.skip("Outside 16-21 KSA window; bid path skipped")
        else:
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["success"] is True
            assert d["auction"]["current_bid_sar"] == 600
            assert "extended" in d


# ==================== Cancel ====================
class TestCancel:
    def test_seller_cancel(self, user_id):
        aid = getattr(pytest, "auction_id", None)
        if not aid:
            pytest.skip("no auction")
        r = requests.delete(f"{API}/auctions/{aid}", params={"user_id": user_id}, timeout=10)
        assert r.status_code == 200
        assert r.json()["success"] is True
        # verify status cancelled
        g = requests.get(f"{API}/auctions/{aid}", timeout=10).json()
        assert g["status"] == "cancelled"

    def test_admin_cancel(self, user_id):
        # create a new auction then cancel as admin
        payload = {"title": "TEST_admin_cancel", "starting_price_sar": 200}
        c = requests.post(f"{API}/auctions/create", params={"user_id": user_id},
                          json=payload, timeout=10)
        assert c.status_code == 200
        aid = c.json()["auction_id"]
        r = requests.delete(f"{API}/auctions/{aid}", params={"user_id": ADMIN_EMAIL}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True


# ==================== Payments Disabled ====================
class TestPaymentsDisabled:
    def test_orders_create_404(self):
        r = requests.post(f"{API}/orders/create", json={"listing_id": "x"}, timeout=10)
        assert r.status_code == 404, f"orders/create should be 404 got {r.status_code}"

    def test_stripe_disabled(self):
        # try a common stripe endpoint
        r = requests.get(f"{API}/stripe/status", timeout=10)
        assert r.status_code == 404
        r2 = requests.post(f"{API}/stripe/create-checkout", json={}, timeout=10)
        assert r2.status_code == 404

    def test_wallet_disabled(self):
        r = requests.get(f"{API}/wallet/balance", timeout=10)
        assert r.status_code == 404
        r2 = requests.get(f"{API}/wallet/transactions", timeout=10)
        assert r2.status_code == 404


# ==================== Admin Users ====================
class TestAdminUsers:
    def test_users_list_sorted(self, admin_token):
        r = requests.get(f"{API}/admin/users/list",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        items = d if isinstance(d, list) else d.get("items") or d.get("users") or []
        assert isinstance(items, list)
        if len(items) >= 2:
            # created_at desc
            def cat(x):
                return x.get("created_at") or ""
            cats = [cat(x) for x in items if cat(x)]
            assert cats == sorted(cats, reverse=True), "not sorted desc by created_at"
        pytest.sample_user_id = None
        for u in items:
            uid = u.get("user_id") or u.get("id") or u.get("_id")
            if uid:
                pytest.sample_user_id = uid
                break

    def test_user_detail(self, admin_token):
        uid = getattr(pytest, "sample_user_id", None)
        if not uid:
            pytest.skip("no user id")
        r = requests.get(f"{API}/admin/users/{uid}",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 200, r.text

    def test_ban_unban(self, admin_token):
        uid = getattr(pytest, "sample_user_id", None)
        if not uid:
            pytest.skip("no user id")
        h = {"Authorization": f"Bearer {admin_token}"}
        b = requests.put(f"{API}/admin/users/{uid}/ban", headers=h, timeout=10)
        assert b.status_code == 200, b.text
        u = requests.put(f"{API}/admin/users/{uid}/unban", headers=h, timeout=10)
        assert u.status_code == 200, u.text


# ==================== Tair Reports ====================
class TestTairReports:
    def test_reports_list(self, admin_token):
        # tair-reports uses ?user_id= admin email (not JWT)
        r = requests.get(f"{API}/tair-reports/list",
                         params={"user_id": ADMIN_EMAIL}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d


# ==================== Marketplace unchanged ====================
class TestMarketplaceIntact:
    def test_listings_feed(self):
        r = requests.get(f"{API}/listings/feed", timeout=10)
        assert r.status_code == 200, r.text

    def test_trips_list(self):
        # /trips/list is the trips feed
        r = requests.get(f"{API}/trips/list", timeout=10)
        assert r.status_code == 200, r.text
