"""Tair iteration 18 tests: clean data, listings, chat+notif fanout, KYC.

Endpoints covered:
  - GET  /api/listings/feed                 (empty state after cleanup)
  - GET  /api/trips/list                    (empty state)
  - POST /api/listings/create               (valid payload -> 200 + listing_id)
  - POST /api/chat/start                    (thread + initial_message)
  - POST /api/chat/thread/{tid}/message     (creates in-app notif for recipient)
  - GET  /api/tair-notifications/list       (unread notif for recipient)
  - GET  /api/chat/unread-count             (unread thread count)
  - POST /api/chat/thread/{tid}/read        (decrements unread)
  - POST /api/tair-notifications/{id}/read  (mark one read)
  - POST /api/tair-notifications/read-all   (mark all read)
  - GET  /api/kyc/me                        (initially not_submitted)
  - POST /api/kyc/submit                    (carrier valid, shop w/o license 400)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://saqr-ui-sync.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def users():
    tag = uuid.uuid4().hex[:6]
    return {"buyer": f"buyer_{tag}", "seller": f"seller_{tag}"}


# ---------------- Cleanup / empty state ----------------
class TestEmptyState:
    def test_listings_feed_empty(self, s):
        r = s.get(f"{API}/listings/feed", params={"limit": 5})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "total" in data
        assert data["total"] == 0, f"Expected clean state but total={data['total']}"
        assert data["items"] == []

    def test_trips_list_empty(self, s):
        r = s.get(f"{API}/trips/list", params={"status": "all", "limit": 5})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("total", 1) == 0, f"Expected clean state but total={data.get('total')}"
        assert data.get("items") == []


# ---------------- Listings ----------------
class TestListings:
    listing_id = None

    def test_create_listing(self, s, users):
        payload = {
            "title": "كناري ذكر ممتاز",
            "description": "كناري بصحة ممتازة، مطعّم بالكامل.",
            "species": "canary",
            "family": "finches",
            "category": "birds",
            "price_sar": 450.0,
            "city": "الرياض",
            "gender": "male",
        }
        r = s.post(f"{API}/listings/create", params={"user_id": users["seller"]}, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "listing_id" in data and data["listing_id"].startswith("lst_")
        assert data["title"] == payload["title"]
        assert data["price_sar"] == 450.0
        assert data["seller_id"] == users["seller"]
        assert data["status"] == "active"
        TestListings.listing_id = data["listing_id"]

        # GET to verify persistence
        g = s.get(f"{API}/listings/{data['listing_id']}")
        assert g.status_code == 200
        assert g.json()["listing_id"] == data["listing_id"]


# ---------------- Chat + Notifications fanout ----------------
class TestChatNotifications:
    thread_id = None
    notif_id_for_buyer = None

    def test_start_thread(self, s, users):
        payload = {
            "peer_id": users["buyer"],
            "listing_id": TestListings.listing_id,
            "listing_title": "كناري ذكر ممتاز",
            "initial_message": "مرحبا هل ما زال متوفراً؟",
        }
        r = s.post(f"{API}/chat/start", params={"user_id": users["seller"]}, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "thread_id" in data
        assert users["buyer"] in data["participants"] and users["seller"] in data["participants"]
        assert data.get("last_message")
        TestChatNotifications.thread_id = data["thread_id"]

    def test_initial_message_created_notif_for_buyer(self, s, users):
        # After chat/start with initial_message, buyer should have 1 unread notif
        time.sleep(0.3)
        r = s.get(f"{API}/tair-notifications/list", params={"user_id": users["buyer"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["unread_count"] >= 1, f"expected buyer unread notif, got {data}"
        assert len(data["items"]) >= 1
        assert data["items"][0]["type"] == "chat"
        assert data["items"][0]["is_read"] is False
        TestChatNotifications.notif_id_for_buyer = data["items"][0]["notif_id"]

    def test_unread_thread_count_for_buyer(self, s, users):
        r = s.get(f"{API}/chat/unread-count", params={"user_id": users["buyer"]})
        assert r.status_code == 200
        assert r.json()["count"] >= 1

    def test_send_second_message_and_notify(self, s, users):
        r = s.post(
            f"{API}/chat/thread/{TestChatNotifications.thread_id}/message",
            params={"user_id": users["seller"]},
            json={"body": "السعر قابل للتفاوض", "sender_name": "البائع"},
        )
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["body"] == "السعر قابل للتفاوض"
        assert msg["sender_id"] == users["seller"]

        time.sleep(0.3)
        r2 = s.get(f"{API}/tair-notifications/list", params={"user_id": users["buyer"]})
        assert r2.status_code == 200
        assert r2.json()["unread_count"] >= 2

    def test_mark_thread_read_decrements(self, s, users):
        r = s.post(
            f"{API}/chat/thread/{TestChatNotifications.thread_id}/read",
            params={"user_id": users["buyer"]},
        )
        assert r.status_code == 200
        r2 = s.get(f"{API}/chat/unread-count", params={"user_id": users["buyer"]})
        assert r2.status_code == 200
        assert r2.json()["count"] == 0

    def test_mark_notif_read(self, s, users):
        assert TestChatNotifications.notif_id_for_buyer
        r = s.post(
            f"{API}/tair-notifications/{TestChatNotifications.notif_id_for_buyer}/read",
            params={"user_id": users["buyer"]},
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_mark_all_notifs_read(self, s, users):
        r = s.post(f"{API}/tair-notifications/read-all", params={"user_id": users["buyer"]})
        assert r.status_code == 200
        assert r.json()["success"] is True
        r2 = s.get(f"{API}/tair-notifications/list", params={"user_id": users["buyer"]})
        assert r2.json()["unread_count"] == 0


# ---------------- KYC ----------------
class TestKYC:
    def test_kyc_me_initial(self, s):
        uid = f"kycuser_{uuid.uuid4().hex[:6]}"
        r = s.get(f"{API}/kyc/me", params={"user_id": uid})
        assert r.status_code == 200
        assert r.json().get("status") == "not_submitted"

    def test_kyc_submit_carrier_success(self, s):
        uid = f"kyccarrier_{uuid.uuid4().hex[:6]}"
        payload = {
            "role": "carrier",
            "full_name": "محمد عبدالله",
            "id_number": "1234567890",
            "phone": "0501234567",
            "id_front_url": "https://example.com/front.jpg",
            "selfie_url": "https://example.com/selfie.jpg",
            "city": "الرياض",
        }
        r = s.post(f"{API}/kyc/submit", params={"user_id": uid}, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert "kyc_id" in data
        assert data["role"] == "carrier"

        # Verify via /kyc/me
        r2 = s.get(f"{API}/kyc/me", params={"user_id": uid})
        assert r2.status_code == 200
        assert r2.json()["status"] == "pending"
        assert r2.json()["kyc_id"] == data["kyc_id"]

    def test_kyc_submit_shop_missing_license_400(self, s):
        uid = f"kycshop_{uuid.uuid4().hex[:6]}"
        payload = {
            "role": "shop",
            "full_name": "متجر النخبة",
            "id_number": "1122334455",
            "phone": "0509876543",
            "id_front_url": "https://example.com/front.jpg",
            "selfie_url": "https://example.com/selfie.jpg",
            # business_license_url missing
        }
        r = s.post(f"{API}/kyc/submit", params={"user_id": uid}, json=payload)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_kyc_invalid_role(self, s):
        r = s.post(
            f"{API}/kyc/submit",
            params={"user_id": "u1"},
            json={"role": "invalid", "full_name": "Test User", "id_number": "1234567890",
                  "phone": "0500000000", "id_front_url": "u", "selfie_url": "u"},
        )
        assert r.status_code == 400
