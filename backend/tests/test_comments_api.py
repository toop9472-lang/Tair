# Tests for Comments API - نظام التعليقات على الإعلانات
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCommentsAPI:
    """Tests for Comments feature API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        # Get first ad id from API
        try:
            response = requests.get(f"{BASE_URL}/api/ads")
            if response.status_code == 200:
                ads = response.json()
                if ads and len(ads) > 0:
                    self.test_ad_id = ads[0].get('id')
                else:
                    self.test_ad_id = "a98ce130-98a0-4d0d-b549-da2fa7b3fb84"
            else:
                self.test_ad_id = "a98ce130-98a0-4d0d-b549-da2fa7b3fb84"
        except Exception:
            self.test_ad_id = "a98ce130-98a0-4d0d-b549-da2fa7b3fb84"
    
    def test_get_comments_for_ad_returns_200(self):
        """GET /api/comments/ad/{ad_id} - should return 200 with comments list"""
        response = requests.get(f"{BASE_URL}/api/comments/ad/{self.test_ad_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET comments for ad returned {len(data)} comments")
    
    def test_get_comments_for_nonexistent_ad_returns_empty_list(self):
        """GET /api/comments/ad/{nonexistent_ad_id} - should return empty list"""
        fake_ad_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/comments/ad/{fake_ad_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 0, "Comments list should be empty for non-existent ad"
        print("SUCCESS: GET comments for non-existent ad returned empty list")
    
    def test_get_comments_with_pagination(self):
        """GET /api/comments/ad/{ad_id}?limit=10&skip=0 - pagination should work"""
        response = requests.get(f"{BASE_URL}/api/comments/ad/{self.test_ad_id}?limit=10&skip=0")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) <= 10, "Should respect limit parameter"
        print("SUCCESS: Pagination works correctly")
    
    def test_post_comment_without_auth_returns_error(self):
        """POST /api/comments/ without auth - should return 401 or 403"""
        payload = {
            "ad_id": self.test_ad_id,
            "content": "Test comment",
            "parent_id": None
        }
        response = requests.post(
            f"{BASE_URL}/api/comments/",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"SUCCESS: POST comment without auth returned {response.status_code}")
    
    def test_like_comment_without_auth_returns_error(self):
        """POST /api/comments/like without auth - should return 401 or 403"""
        payload = {"comment_id": "CMT-test-123"}
        response = requests.post(
            f"{BASE_URL}/api/comments/like",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"SUCCESS: POST like without auth returned {response.status_code}")
    
    def test_delete_comment_without_auth_returns_error(self):
        """DELETE /api/comments/{comment_id} without auth - should return 401 or 403"""
        response = requests.delete(
            f"{BASE_URL}/api/comments/CMT-test-123"
        )
        
        assert response.status_code in [401, 403, 404], f"Expected 401/403/404, got {response.status_code}"
        print(f"SUCCESS: DELETE comment without auth returned {response.status_code}")
    
    def test_get_user_comments_without_auth_returns_error(self):
        """GET /api/comments/user without auth - should return 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/comments/user")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"SUCCESS: GET user comments without auth returned {response.status_code}")


class TestAdsAPI:
    """Tests for Ads API to verify ads are available"""
    
    def test_get_ads_returns_200(self):
        """GET /api/ads - should return 200 with ads list"""
        response = requests.get(f"{BASE_URL}/api/ads")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one ad"
        
        # Verify ad structure
        ad = data[0]
        assert "id" in ad, "Ad should have id"
        assert "title" in ad, "Ad should have title"
        print(f"SUCCESS: GET ads returned {len(data)} ads")


class TestHealthAPI:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """GET /api/health - should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        print("SUCCESS: Health endpoint is healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
