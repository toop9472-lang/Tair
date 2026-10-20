"""طير — End-to-end backend tests for the new Tair marketplace + logistics API.
Covers: species, listings, trips, orders (state machine), ratings, reports.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://saqr-ui-sync.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_ID = "user_93fd2a08e40e"


def _uid(prefix="u"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# =============== Species ===============
class TestSpecies:
    def test_list_seeds_and_has_arabic(self, s):
        r = s.get(f"{API}/species/list")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] >= 15, f"expected >=15 species, got {data['total']}"
        # Ensure Arabic names present
        for item in data["items"][:5]:
            assert item.get("name_ar")
            assert item.get("species_id")

    def test_filter_birds(self, s):
        r = s.get(f"{API}/species/list", params={"category": "birds"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) > 0
        assert all(i["category"] == "birds" for i in items)


# =============== Listings ===============
@pytest.fixture(scope="session")
def seller_id():
    return _uid("seller")


@pytest.fixture(scope="session")
def buyer_id():
    return _uid("buyer")


@pytest.fixture(scope="session")
def carrier_id():
    return _uid("carrier")


@pytest.fixture(scope="session")
def listing_payload():
    return {
        "title": "TEST_كناري ذكر",
        "category": "birds",
        "species": "canary",
        "breed": "Malinois",
        "gender": "male",
        "age_months": 8,
        "description": "TEST_طائر كناري بحالة ممتازة",
        "images": ["https://example.com/a.jpg", "https://example.com/b.jpg"],
        "price_sar": 450.0,
        "city": "Riyadh",
    }


class TestListings:
    def test_create_listing_and_cover(self, s, seller_id, listing_payload):
        r = s.post(f"{API}/listings/create", params={"user_id": seller_id}, json=listing_payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["listing_id"].startswith("lst_")
        assert d["seller_id"] == seller_id
        assert d["cover_image"] == listing_payload["images"][0]
        assert d["is_flagged"] is False
        pytest.listing_id = d["listing_id"]

    def test_feed_filters(self, s, listing_payload):
        r = s.get(f"{API}/listings/feed", params={"city": "Riyadh", "category": "birds", "species": "canary", "min_price": 100, "max_price": 1000, "q": "TEST"})
        assert r.status_code == 200
        data = r.json()
        assert any(it["listing_id"] == pytest.listing_id for it in data["items"])

    def test_get_view_count_increments_for_non_owner(self, s, buyer_id, seller_id):
        # owner view should NOT increment
        r1 = s.get(f"{API}/listings/{pytest.listing_id}", params={"viewer_id": seller_id})
        assert r1.status_code == 200
        vc_before = r1.json()["view_count"]
        # non-owner increments
        r2 = s.get(f"{API}/listings/{pytest.listing_id}", params={"viewer_id": buyer_id})
        # returned doc is pre-increment (find happens before update); fetch again
        r3 = s.get(f"{API}/listings/{pytest.listing_id}", params={"viewer_id": seller_id})
        assert r3.json()["view_count"] == vc_before + 1

    def test_favorite_toggle(self, s, buyer_id):
        r = s.post(f"{API}/listings/{pytest.listing_id}/favorite", params={"user_id": buyer_id})
        assert r.status_code == 200 and r.json()["favorited"] is True
        r2 = s.get(f"{API}/listings/{pytest.listing_id}")
        assert r2.json()["favorite_count"] >= 1
        r3 = s.post(f"{API}/listings/{pytest.listing_id}/favorite", params={"user_id": buyer_id})
        assert r3.json()["favorited"] is False

    def test_patch_owner_only(self, s, seller_id, buyer_id):
        # non-owner blocked
        rn = s.patch(f"{API}/listings/{pytest.listing_id}", params={"user_id": buyer_id}, json={"title": "hacked"})
        assert rn.status_code == 403
        # owner allowed
        r = s.patch(f"{API}/listings/{pytest.listing_id}", params={"user_id": seller_id}, json={"price_sar": 500.0})
        assert r.status_code == 200
        assert r.json()["price_sar"] == 500.0

    def test_prohibited_species_autoflag(self, s, seller_id, listing_payload):
        payload = dict(listing_payload)
        payload["species"] = "wild_hawk"
        payload["title"] = "TEST_illegal hawk"
        r = s.post(f"{API}/listings/create", params={"user_id": seller_id}, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_flagged"] is True
        assert "prohibited" in (d.get("moderation_notes") or "").lower()

    def test_delete_admin_can_soft_delete(self, s, seller_id, listing_payload):
        # Create a listing then have admin remove it.
        payload = dict(listing_payload)
        payload["title"] = "TEST_to_be_deleted_by_admin"
        r = s.post(f"{API}/listings/create", params={"user_id": seller_id}, json=payload)
        lid = r.json()["listing_id"]
        rd = s.delete(f"{API}/listings/{lid}", params={"user_id": ADMIN_ID})
        assert rd.status_code == 200, rd.text
        # Verify soft deletion (status=removed)
        rg = s.get(f"{API}/listings/{lid}")
        assert rg.json()["status"] == "removed"

    def test_delete_non_owner_forbidden(self, s, listing_payload):
        payload = dict(listing_payload)
        payload["title"] = "TEST_owner_only"
        r = s.post(f"{API}/listings/create", params={"user_id": _uid("owner")}, json=payload)
        lid = r.json()["listing_id"]
        rd = s.delete(f"{API}/listings/{lid}", params={"user_id": _uid("stranger")})
        assert rd.status_code == 403


# =============== Trips ===============
class TestTrips:
    def test_create_defaults_available(self, s, carrier_id):
        payload = {
            "from_city": "Riyadh",
            "to_city": "Jeddah",
            "depart_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "total_cages": 6,
        }
        r = s.post(f"{API}/trips/create", params={"user_id": carrier_id}, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["trip_id"].startswith("trip_")
        assert d["total_cages"] == 6
        assert d["available_cages"] == 6
        pytest.trip_id = d["trip_id"]

    def test_list_filters(self, s):
        r = s.get(f"{API}/trips/list", params={"from_city": "Riyadh", "to_city": "Jeddah"})
        assert r.status_code == 200
        assert any(t["trip_id"] == pytest.trip_id for t in r.json()["items"])

    def test_status_only_carrier(self, s, carrier_id):
        rn = s.patch(f"{API}/trips/{pytest.trip_id}/status", params={"user_id": _uid("other")}, json={"status": "departed"})
        assert rn.status_code == 403
        r = s.patch(f"{API}/trips/{pytest.trip_id}/status", params={"user_id": carrier_id}, json={"status": "departed", "note": "left"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "departed"
        assert len(d.get("status_updates", [])) >= 1


# =============== Orders ===============
@pytest.fixture(scope="session")
def order_ctx(s, seller_id, buyer_id, carrier_id):
    """Create a fresh trip + listing for order tests to avoid coupling."""
    # trip
    trip_payload = {
        "from_city": "Dammam",
        "to_city": "Riyadh",
        "depart_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "total_cages": 3,
    }
    tr = s.post(f"{API}/trips/create", params={"user_id": carrier_id}, json=trip_payload).json()

    # listing
    listing_payload = {
        "title": "TEST_order_listing",
        "category": "birds",
        "species": "budgie",
        "description": "TEST desc",
        "images": ["https://x/a.jpg"],
        "price_sar": 200.0,
        "city": "Dammam",
    }
    lst = s.post(f"{API}/listings/create", params={"user_id": seller_id}, json=listing_payload).json()
    return {"trip": tr, "listing": lst}


class TestOrders:
    def test_create_decrements_cages(self, s, buyer_id, seller_id, carrier_id, order_ctx):
        trip = order_ctx["trip"]
        listing = order_ctx["listing"]
        payload = {
            "listing_id": listing["listing_id"],
            "trip_id": trip["trip_id"],
            "seller_id": seller_id,
            "carrier_id": carrier_id,
            "quantity": 1,
            "agreed_price_sar": 200.0,
        }
        r = s.post(f"{API}/orders/create", params={"user_id": buyer_id}, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order_id"].startswith("ord_")
        assert d["status"] == "pending"
        assert any(ev["status"] == "pending" for ev in d.get("status_history", []))
        # trip should now have available_cages = total-1
        tg = s.get(f"{API}/trips/{trip['trip_id']}").json()
        assert tg["available_cages"] == trip["total_cages"] - 1
        pytest.order_id = d["order_id"]

    def test_state_machine_happy_path(self, s, buyer_id, carrier_id):
        oid = pytest.order_id
        # accept-carrier by wrong user -> 403
        rn = s.post(f"{API}/orders/{oid}/accept-carrier", params={"user_id": _uid("nope")})
        assert rn.status_code == 403
        # correct carrier
        r1 = s.post(f"{API}/orders/{oid}/accept-carrier", params={"user_id": carrier_id})
        assert r1.status_code == 200 and r1.json()["status"] == "accepted_by_carrier"
        # invalid transition: complete before delivered
        r_bad = s.post(f"{API}/orders/{oid}/complete", params={"user_id": buyer_id})
        assert r_bad.status_code == 400
        # start-transit
        r2 = s.post(f"{API}/orders/{oid}/start-transit", params={"user_id": carrier_id})
        assert r2.status_code == 200 and r2.json()["status"] == "in_transit"
        # mark-delivered
        r3 = s.post(f"{API}/orders/{oid}/mark-delivered", params={"user_id": carrier_id})
        assert r3.status_code == 200 and r3.json()["status"] == "delivered"
        # complete: only buyer
        rn2 = s.post(f"{API}/orders/{oid}/complete", params={"user_id": carrier_id})
        assert rn2.status_code == 403
        r4 = s.post(f"{API}/orders/{oid}/complete", params={"user_id": buyer_id})
        assert r4.status_code == 200 and r4.json()["status"] == "completed"
        assert r4.json().get("completed_at") is not None

    def test_dispute(self, s, buyer_id, seller_id, carrier_id, order_ctx):
        # New order to dispute
        payload = {
            "listing_id": order_ctx["listing"]["listing_id"],
            "seller_id": seller_id,
            "carrier_id": carrier_id,
            "quantity": 1,
            "agreed_price_sar": 200.0,
        }
        oid = s.post(f"{API}/orders/create", params={"user_id": buyer_id}, json=payload).json()["order_id"]
        r = s.post(f"{API}/orders/{oid}/dispute", params={"user_id": buyer_id, "reason": "damage", "details": "TEST"})
        assert r.status_code == 200, r.text
        g = s.get(f"{API}/orders/{oid}", params={"user_id": buyer_id}).json()
        assert g["status"] == "disputed"
        assert g["dispute"]["reason"] == "damage"

    def test_cancel_restores_cage(self, s, buyer_id, seller_id, carrier_id):
        # fresh trip + order
        trip_payload = {
            "from_city": "Abha",
            "to_city": "Riyadh",
            "depart_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "total_cages": 2,
        }
        trip = s.post(f"{API}/trips/create", params={"user_id": carrier_id}, json=trip_payload).json()
        listing = s.post(f"{API}/listings/create", params={"user_id": seller_id}, json={
            "title": "TEST_cancel", "category": "birds", "species": "canary",
            "description": "TEST", "images": ["https://x/y.jpg"], "price_sar": 100.0, "city": "Abha",
        }).json()
        oid = s.post(f"{API}/orders/create", params={"user_id": buyer_id}, json={
            "listing_id": listing["listing_id"], "trip_id": trip["trip_id"],
            "seller_id": seller_id, "carrier_id": carrier_id,
            "quantity": 1, "agreed_price_sar": 100.0,
        }).json()["order_id"]

        # after create: cages = 1
        assert s.get(f"{API}/trips/{trip['trip_id']}").json()["available_cages"] == 1
        # accept then cancel
        s.post(f"{API}/orders/{oid}/accept-carrier", params={"user_id": carrier_id})
        rc = s.post(f"{API}/orders/{oid}/cancel", params={"user_id": buyer_id, "note": "changed mind"})
        assert rc.status_code == 200, rc.text
        # cages restored to 2
        assert s.get(f"{API}/trips/{trip['trip_id']}").json()["available_cages"] == 2


# =============== Ratings ===============
class TestRatings:
    def test_rating_requires_completed(self, s, buyer_id, seller_id, carrier_id, order_ctx):
        # Create pending order
        payload = {
            "listing_id": order_ctx["listing"]["listing_id"],
            "seller_id": seller_id,
            "carrier_id": carrier_id,
            "quantity": 1,
            "agreed_price_sar": 200.0,
        }
        oid = s.post(f"{API}/orders/create", params={"user_id": buyer_id}, json=payload).json()["order_id"]
        r = s.post(f"{API}/ratings/create", params={"user_id": buyer_id}, json={
            "order_id": oid, "rated_id": seller_id, "rated_role": "seller", "stars": 5,
        })
        assert r.status_code == 400, r.text

    def test_rating_updates_avg_and_prevents_duplicate(self, s, buyer_id, seller_id):
        oid = getattr(pytest, "order_id", None)
        assert oid, "expected completed order from earlier test"
        r = s.post(f"{API}/ratings/create", params={"user_id": buyer_id}, json={
            "order_id": oid, "rated_id": seller_id, "rated_role": "seller", "stars": 5, "comment": "TEST great",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user_rating_avg"] == 5.0
        assert d["user_rating_count"] == 1
        # duplicate
        r2 = s.post(f"{API}/ratings/create", params={"user_id": buyer_id}, json={
            "order_id": oid, "rated_id": seller_id, "rated_role": "seller", "stars": 4,
        })
        assert r2.status_code == 400


# =============== Reports ===============
class TestReports:
    def test_auto_flag_after_3_reports(self, s, seller_id):
        # create fresh listing
        lst = s.post(f"{API}/listings/create", params={"user_id": seller_id}, json={
            "title": "TEST_report_target", "category": "birds", "species": "canary",
            "description": "TEST", "images": ["https://x/z.jpg"], "price_sar": 50.0, "city": "Mecca",
        }).json()
        lid = lst["listing_id"]
        assert lst["is_flagged"] is False

        for i in range(3):
            r = s.post(f"{API}/tair-reports/create", params={"user_id": _uid(f"reporter{i}")}, json={
                "target_type": "listing", "target_id": lid, "reason": "scam", "details": f"TEST_{i}",
            })
            assert r.status_code == 200, r.text

        got = s.get(f"{API}/listings/{lid}").json()
        assert got["report_count"] >= 3
        assert got["is_flagged"] is True
        assert "auto-flag" in (got.get("moderation_notes") or "").lower()
