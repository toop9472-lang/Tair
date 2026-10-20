"""
Saqr App API Tests
Tests for authentication, ads, advertiser, and admin APIs
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = f"test_{uuid.uuid4().hex[:8]}@saqr.com"
TEST_USER_PASSWORD = "test123456"
TEST_USER_NAME = "مستخدم اختبار"

ADMIN_EMAIL = "admin@saqr.com"
ADMIN_PASSWORD = "admin123"


class TestHealthCheck:
    """Basic API health check tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ API root: {data['message']}")


class TestEmailAuthentication:
    """Email/Password authentication tests"""
    
    def test_register_new_user(self):
        """Test user registration with email/password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "name": TEST_USER_NAME
            }
        )
        print(f"Register response: {response.status_code} - {response.text}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        assert data["user"]["name"] == TEST_USER_NAME
        print(f"✅ User registered: {data['user']['email']}")
    
    def test_register_duplicate_email(self):
        """Test registration with duplicate email fails"""
        # First register
        requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"dup_{uuid.uuid4().hex[:8]}@saqr.com",
                "password": TEST_USER_PASSWORD,
                "name": TEST_USER_NAME
            }
        )
        
        # Try to register again with same email
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_USER_EMAIL,  # Already registered
                "password": TEST_USER_PASSWORD,
                "name": TEST_USER_NAME
            }
        )
        # Should fail with 400
        assert response.status_code == 400
        print(f"✅ Duplicate email rejected correctly")
    
    def test_login_with_email(self):
        """Test login with email/password"""
        # First register a user
        unique_email = f"login_{uuid.uuid4().hex[:8]}@saqr.com"
        requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": TEST_USER_PASSWORD,
                "name": TEST_USER_NAME
            }
        )
        
        # Now login
        response = requests.post(
            f"{BASE_URL}/api/auth/login/email",
            json={
                "email": unique_email,
                "password": TEST_USER_PASSWORD
            }
        )
        print(f"Login response: {response.status_code} - {response.text}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "user" in data
        assert data["user"]["email"] == unique_email
        print(f"✅ User logged in: {data['user']['email']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login/email",
            json={
                "email": "nonexistent@saqr.com",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
        print(f"✅ Invalid credentials rejected correctly")
    
    def test_get_current_user_unauthorized(self):
        """Test /auth/me without authentication returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print(f"✅ Unauthorized access rejected correctly")


class TestAdsAPI:
    """Ads API tests"""
    
    def test_get_ads_public(self):
        """Test getting ads (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/ads")
        print(f"Get ads response: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} ads")
        
        # If there are ads, verify structure
        if len(data) > 0:
            ad = data[0]
            assert "id" in ad
            assert "title" in ad
            assert "description" in ad
            print(f"✅ Ad structure verified: {ad.get('title', 'N/A')}")


class TestAdvertiserAPI:
    """Advertiser API tests"""
    
    def test_get_pricing(self):
        """Test getting advertiser pricing"""
        response = requests.get(f"{BASE_URL}/api/advertiser/pricing")
        print(f"Pricing response: {response.status_code} - {response.text}")
        assert response.status_code == 200
        
        data = response.json()
        assert "price_per_month" in data
        assert "currency" in data
        assert "features" in data
        assert "payment_methods" in data
        
        assert data["price_per_month"] == 500
        assert data["currency"] == "SAR"
        print(f"✅ Pricing: {data['price_per_month']} {data['currency']}/month")
    
    def test_create_advertiser_ad(self):
        """Test creating an advertiser ad request"""
        ad_data = {
            "advertiser_name": "شركة اختبار",
            "advertiser_email": f"advertiser_{uuid.uuid4().hex[:8]}@test.com",
            "advertiser_phone": "0512345678",
            "title": "إعلان اختبار",
            "description": "وصف الإعلان للاختبار",
            "video_url": "https://example.com/video.mp4",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "duration": 60,
            "duration_months": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advertiser/ads",
            json=ad_data
        )
        print(f"Create ad response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "ad" in data
        assert "payment" in data
        
        ad = data["ad"]
        assert ad["title"] == ad_data["title"]
        assert ad["status"] == "pending"
        
        payment = data["payment"]
        assert payment["amount"] == 500  # 500 SAR for 1 month
        print(f"✅ Advertiser ad created: {ad['id']}")
        
        return ad["id"]


class TestAdminAuth:
    """Admin authentication tests"""
    
    @pytest.fixture(autouse=True)
    def setup_admin(self):
        """Ensure admin exists before tests"""
        # Try to create admin (will fail if exists, which is fine)
        requests.post(
            f"{BASE_URL}/api/admin/auth/create",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "name": "مدير النظام",
                "role": "super_admin"
            }
        )
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        print(f"Admin login response: {response.status_code} - {response.text}")
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "admin" in data
        assert data["admin"]["email"] == ADMIN_EMAIL
        print(f"✅ Admin logged in: {data['admin']['email']}")
        
        return data["token"]
    
    def test_admin_login_invalid(self):
        """Test admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
        print(f"✅ Invalid admin credentials rejected")


class TestAdminDashboard:
    """Admin dashboard tests"""
    
    def get_admin_token(self):
        """Helper to get admin token"""
        # Ensure admin exists
        requests.post(
            f"{BASE_URL}/api/admin/auth/create",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "name": "مدير النظام",
                "role": "super_admin"
            }
        )
        
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_dashboard_stats(self):
        """Test getting dashboard stats"""
        token = self.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Dashboard stats response: {response.status_code} - {response.text}")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_users" in data
        assert "total_ads" in data
        assert "active_ads" in data
        assert "pending_ads" in data
        assert "total_revenue" in data
        print(f"✅ Dashboard stats: {data['total_users']} users, {data['total_ads']} ads")
    
    def test_dashboard_stats_unauthorized(self):
        """Test dashboard stats without auth fails"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard/stats")
        # Should fail without token
        assert response.status_code in [401, 403, 422]
        print(f"✅ Unauthorized dashboard access rejected")


class TestLogout:
    """Logout tests"""
    
    def test_logout(self):
        """Test logout endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print(f"✅ Logout successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
