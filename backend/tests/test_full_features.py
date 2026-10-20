# Full feature tests for Saqr App
# Tests: Login, Ads Viewer Navigation, Comments, Payment APIs
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAPI:
    """Authentication API tests"""
    
    def test_signin_with_valid_credentials(self):
        """POST /api/auth/signin - demo account login"""
        payload = {
            "email": "demo@saqr.app",
            "password": "Demo123456"
        }
        response = requests.post(f"{BASE_URL}/api/auth/signin", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user" in data or "token" in data, "Response should contain user or token"
        print(f"SUCCESS: Login returned user data")
    
    def test_signin_with_invalid_credentials(self):
        """POST /api/auth/signin - invalid credentials"""
        payload = {
            "email": "invalid@test.com",
            "password": "wrongpassword"
        }
        response = requests.post(f"{BASE_URL}/api/auth/signin", json=payload)
        
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print(f"SUCCESS: Invalid credentials returned {response.status_code}")


class TestAdsAPI:
    """Ads API tests"""
    
    def test_get_all_ads(self):
        """GET /api/ads - should return ads list"""
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
    
    def test_get_ads_with_local_filter(self):
        """GET /api/ads?ad_type=local - should filter by local type"""
        response = requests.get(f"{BASE_URL}/api/ads?ad_type=local")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: Local ads filter returned {len(data)} ads")
    
    def test_get_ads_with_global_filter(self):
        """GET /api/ads?ad_type=global - should filter by global type"""
        response = requests.get(f"{BASE_URL}/api/ads?ad_type=global")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: Global ads filter returned {len(data)} ads")


class TestCommentsAPI:
    """Comments API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get first ad ID"""
        try:
            response = requests.get(f"{BASE_URL}/api/ads")
            if response.status_code == 200:
                ads = response.json()
                self.test_ad_id = ads[0].get('id') if ads else "demo1"
            else:
                self.test_ad_id = "demo1"
        except Exception:
            self.test_ad_id = "demo1"
    
    def test_get_comments_for_ad(self):
        """GET /api/comments/ad/{ad_id} - should return comments"""
        response = requests.get(f"{BASE_URL}/api/comments/ad/{self.test_ad_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET comments returned {len(data)} comments for ad")
    
    def test_post_comment_requires_auth(self):
        """POST /api/comments/ - should require authentication"""
        payload = {
            "ad_id": self.test_ad_id,
            "content": "Test comment"
        }
        response = requests.post(f"{BASE_URL}/api/comments/", json=payload)
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"SUCCESS: Comment POST requires auth (got {response.status_code})")
    
    def test_like_comment_requires_auth(self):
        """POST /api/comments/like - should require authentication"""
        payload = {"comment_id": "CMT-test"}
        response = requests.post(f"{BASE_URL}/api/comments/like", json=payload)
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"SUCCESS: Like comment requires auth (got {response.status_code})")


class TestPaymentAPI:
    """Payment API tests"""
    
    def test_get_payment_packages(self):
        """GET /api/payments/packages - should return hourly packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "packages" in data, "Response should contain packages"
        packages = data["packages"]
        assert len(packages) == 7, f"Expected 7 packages, got {len(packages)}"
        
        # Verify package prices
        expected_prices = {
            "ad_1_hour": 79.0,
            "ad_3_hours": 119.0,
            "ad_6_hours": 149.0,
            "ad_12_hours": 199.0,
            "ad_24_hours": 275.0,
            "ad_48_hours": 399.0,
            "ad_7_days": 999.0
        }
        
        for pkg in packages:
            pkg_id = pkg["id"]
            if pkg_id in expected_prices:
                assert pkg["amount"] == expected_prices[pkg_id], f"Package {pkg_id} price mismatch"
        
        print(f"SUCCESS: Payment packages API returns all 7 packages with correct prices")
    
    def test_checkout_requires_all_fields(self):
        """POST /api/payments/checkout - should validate required fields"""
        # Missing ad_id and origin_url
        payload = {"package_id": "ad_1_hour"}
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json=payload)
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"SUCCESS: Checkout validates required fields")
    
    def test_checkout_validates_package_id(self):
        """POST /api/payments/checkout - should reject invalid package_id"""
        payload = {
            "package_id": "invalid_package",
            "ad_id": "test-ad-123",
            "origin_url": "https://example.com"
        }
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json=payload)
        
        # Should return 400 for invalid package
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print(f"SUCCESS: Checkout rejects invalid package_id")


class TestHealthAPI:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """GET /api/health - should return healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        print("SUCCESS: Health endpoint is healthy")


class TestAdvertiserAPI:
    """Advertiser API tests"""
    
    def test_get_advertiser_pricing(self):
        """GET /api/advertiser/pricing - should return pricing info"""
        response = requests.get(f"{BASE_URL}/api/advertiser/pricing")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "packages" in data, "Response should contain packages"
        print(f"SUCCESS: Advertiser pricing API works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
