"""Tests for the 12 new forum categories added in this iteration."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"

NEW_CATEGORIES = [
    "animals_cats_dogs", "animals_reptiles_rodents", "animals_exotic",
    "fish_water", "fish_aquarium", "fish_breeding",
    "insects_ornamental", "insects_bees", "insects_food", "insects_projects",
    "outdoor_breeding", "outdoor_solutions",
]

ALL_EXPECTED = [
    "general", "tips", "experience", "health", "food", "breeding",
    "questions", "market", "import",
] + NEW_CATEGORIES  # 21 total


class TestForumCategories:
    def test_list_categories_total_21(self):
        r = requests.get(f"{API}/forum/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 21
        ids = [c["id"] for c in data["items"]]
        for cid in ALL_EXPECTED:
            assert cid in ids, f"Missing category id: {cid}"

    def test_categories_have_arabic_and_desc(self):
        r = requests.get(f"{API}/forum/categories", timeout=15)
        data = r.json()
        for c in data["items"]:
            assert c.get("name_ar"), f"missing name_ar for {c['id']}"
            assert c.get("desc_ar"), f"missing desc_ar for {c['id']}"
            assert c.get("icon"), f"missing icon for {c['id']}"
            assert c.get("color"), f"missing color for {c['id']}"

    def test_stats_returns_21_with_counters(self):
        r = requests.get(f"{API}/forum/stats", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 21
        ids = [c["id"] for c in data["items"]]
        for cid in ALL_EXPECTED:
            assert cid in ids
        for item in data["items"]:
            # every item should carry counter fields
            assert "threads" in item
            assert "posts" in item
            assert "views" in item
            assert "latest_post" in item  # can be None


class TestCreatePostForNewCategories:
    """POST /forum/create must accept every new category id (no 422)."""

    @pytest.mark.parametrize("cat", NEW_CATEGORIES)
    def test_create_post_each_new_category(self, cat):
        payload = {
            "title": f"TEST_{cat}_title",
            "body": f"TEST body for {cat}",
            "category": cat,
            "author_name": "TEST_Guest",
        }
        r = requests.post(
            f"{API}/forum/create",
            params={"user_id": "guest_test1"},
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, f"category {cat} failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["category"] == cat
        assert data["title"] == payload["title"]
        assert data["author_id"] == "guest_test1"
        assert "post_id" in data

        # Persistence check via feed
        f = requests.get(f"{API}/forum/feed", params={"category": cat}, timeout=15)
        assert f.status_code == 200
        titles = [it["title"] for it in f.json()["items"]]
        assert payload["title"] in titles


class TestFeedFiltering:
    def test_feed_filter_insects_bees(self):
        # ensure at least one post
        requests.post(
            f"{API}/forum/create",
            params={"user_id": "guest_test1"},
            json={"title": "TEST_bee_only", "body": "b", "category": "insects_bees"},
            timeout=15,
        )
        r = requests.get(f"{API}/forum/feed", params={"category": "insects_bees"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        for it in data["items"]:
            assert it["category"] == "insects_bees"

    def test_feed_no_500_for_all_new_cats(self):
        for cat in NEW_CATEGORIES:
            r = requests.get(f"{API}/forum/feed", params={"category": cat}, timeout=15)
            assert r.status_code == 200, f"feed 500 for {cat}"


class TestCleanup:
    def test_cleanup_test_posts(self):
        # Delete all TEST_ posts we created
        for cat in NEW_CATEGORIES:
            r = requests.get(f"{API}/forum/feed", params={"category": cat, "limit": 100}, timeout=15)
            if r.status_code == 200:
                for it in r.json().get("items", []):
                    if it.get("title", "").startswith("TEST_") and it.get("author_id") == "guest_test1":
                        requests.delete(
                            f"{API}/forum/post/{it['post_id']}",
                            params={"user_id": "guest_test1"},
                            timeout=10,
                        )
