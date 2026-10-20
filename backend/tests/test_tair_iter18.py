"""Tair iteration 18: forum, trips (waypoints/carrier), expanded species families."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to reading frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def user_id():
    return f"TEST_user_{uuid.uuid4().hex[:8]}"


# ---------------- SPECIES ----------------
class TestSpecies:
    def test_families_returns_17(self):
        r = requests.get(f"{API}/species/families", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        assert len(items) == 17, f"expected 17 families, got {len(items)}"
        ids = {i["family_id"] for i in items}
        for expected in ("livestock", "cats", "dogs", "insects", "feed",
                         "bird_supplies", "animal_supplies", "reserves", "services"):
            assert expected in ids

    def test_species_list_family_cats(self):
        r = requests.get(f"{API}/species/list", params={"family": "cats"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        assert len(items) == 5

    def test_species_list_family_livestock(self):
        r = requests.get(f"{API}/species/list", params={"family": "livestock"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        assert len(items) == 4
        names = {i["species_id"] for i in items}
        assert {"sheep", "goat", "camel", "cattle"}.issubset(names)

    def test_reseed_returns_58(self):
        r = requests.post(f"{API}/species/reseed", timeout=30)
        assert r.status_code in (200, 201)
        data = r.json()
        count = data.get("seeded") or data.get("count") or data.get("total")
        # Accept dict shape
        assert count == 58 or (isinstance(data, dict) and 58 in data.values()), f"reseed data: {data}"


# ---------------- FORUM ----------------
class TestForum:
    def test_categories_returns_8(self):
        r = requests.get(f"{API}/forum/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 8
        assert len(data["items"]) == 8
        ids = {c["id"] for c in data["items"]}
        assert {"general", "tips", "experience", "health", "food",
                "breeding", "questions", "market"} == ids

    def test_create_feed_like_reply_flow(self, user_id):
        # Create
        payload = {
            "title": "TEST_ Post title",
            "body": "TEST_ body content ...",
            "category": "tips",
            "author_name": "Tester",
        }
        r = requests.post(f"{API}/forum/create", params={"user_id": user_id},
                          json=payload, timeout=15)
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["title"] == payload["title"]
        assert post["category"] == "tips"
        assert "post_id" in post
        post_id = post["post_id"]

        # Feed contains post
        r = requests.get(f"{API}/forum/feed", timeout=15)
        assert r.status_code == 200
        feed = r.json()
        assert any(p["post_id"] == post_id for p in feed["items"])

        # Filter by category
        r = requests.get(f"{API}/forum/feed", params={"category": "tips"}, timeout=15)
        assert r.status_code == 200
        assert any(p["post_id"] == post_id for p in r.json()["items"])

        # Get post detail (as different viewer to increment views)
        r = requests.get(f"{API}/forum/post/{post_id}", params={"viewer_id": "TEST_viewer"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["post_id"] == post_id

        # Like toggle on
        r = requests.post(f"{API}/forum/post/{post_id}/like",
                          params={"user_id": user_id}, timeout=15)
        assert r.status_code == 200
        assert r.json()["liked"] is True

        # Toggle off
        r = requests.post(f"{API}/forum/post/{post_id}/like",
                          params={"user_id": user_id}, timeout=15)
        assert r.json()["liked"] is False

        # Reply
        r = requests.post(f"{API}/forum/post/{post_id}/reply",
                          params={"user_id": user_id},
                          json={"body": "TEST_ reply body", "author_name": "Tester"},
                          timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["post_id"] == post_id

        # Replies list
        r = requests.get(f"{API}/forum/post/{post_id}/replies", timeout=15)
        assert r.status_code == 200
        replies = r.json()
        assert replies["total"] >= 1

        # Cleanup: delete post
        r = requests.delete(f"{API}/forum/post/{post_id}",
                            params={"user_id": user_id}, timeout=15)
        assert r.status_code == 200

    def test_reply_to_missing_post_404(self, user_id):
        r = requests.post(f"{API}/forum/post/nonexistent/reply",
                          params={"user_id": user_id},
                          json={"body": "x"}, timeout=15)
        assert r.status_code == 404


# ---------------- TRIPS ----------------
class TestTripsCarrier:
    def test_create_trip_with_waypoints_and_carrier(self, user_id):
        payload = {
            "from_city": "الرياض",
            "to_city": "جدة",
            "waypoints": ["الطائف", "مكة"],
            "is_direct": False,
            "depart_at": "2026-12-01T08:00:00Z",
            "carrier_name": "TEST_Carrier",
            "carrier_phone": "+966500000000",
            "carrier_avatar": "https://example.com/a.png",
            "vehicle_type": "سيدان",
            "total_cages": 4,
        }
        r = requests.post(f"{API}/trips/create", params={"user_id": user_id},
                          json=payload, timeout=15)
        assert r.status_code == 200, r.text
        trip = r.json()
        assert trip["carrier_name"] == "TEST_Carrier"
        assert trip["carrier_phone"] == "+966500000000"
        assert trip["waypoints"] == ["الطائف", "مكة"]
        assert trip["is_direct"] is False
        assert trip["available_cages"] == 4
        # cleanup
        requests.delete(f"{API}/trips/{trip['trip_id']}", params={"user_id": user_id})

    def test_create_direct_trip(self, user_id):
        payload = {
            "from_city": "الرياض",
            "to_city": "الدمام",
            "waypoints": [],
            "is_direct": True,
            "depart_at": "2026-12-05T08:00:00Z",
            "carrier_name": "TEST_Direct",
            "carrier_phone": "+966500000001",
        }
        r = requests.post(f"{API}/trips/create", params={"user_id": user_id},
                          json=payload, timeout=15)
        assert r.status_code == 200, r.text
        trip = r.json()
        assert trip["is_direct"] is True
        assert trip["waypoints"] == []
        requests.delete(f"{API}/trips/{trip['trip_id']}", params={"user_id": user_id})


# ---------------- LISTINGS FAMILY FILTER ----------------
class TestListingsFamily:
    def test_feed_family_parrots(self):
        r = requests.get(f"{API}/listings/feed", params={"family": "parrots"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        # Should be non-empty from seeded parrot listings
        assert len(data["items"]) >= 1
