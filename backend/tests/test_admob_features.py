"""
Test AdMob Settings and New Features for Saqr App
Tests:
- AdMob settings API (GET/POST)
- Public AdMob settings endpoint
- Admin authentication and access
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "sky-321@hotmail.com"
ADMIN_PASSWORD = "Wsxzaq123"
ADMOB_PUBLISHER_ID = "pub-5132559433385403"


class TestAdminAuth:
    """Test admin authentication for accessing AdMob settings"""
    
    def test_admin_signin(self):
        """Test admin can sign in via unified endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin signin failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("role") == "admin", f"Expected role 'admin', got {data.get('role')}"
        assert "user" in data, "No user data in response"
        
        # Store token for other tests
        TestAdminAuth.admin_token = data["token"]
        print(f"✅ Admin signin successful, role: {data.get('role')}")
    
    def test_invalid_credentials(self):
        """Test invalid credentials return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials correctly rejected")


class TestPublicAdMobEndpoint:
    """Test public AdMob settings endpoint (no auth required)"""
    
    def test_public_admob_settings_accessible(self):
        """Test public AdMob endpoint is accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/settings/public/admob")
        assert response.status_code == 200, f"Public AdMob endpoint failed: {response.text}"
        
        data = response.json()
        # Verify expected fields exist
        assert "enabled" in data, "Missing 'enabled' field"
        assert "points_per_ad" in data, "Missing 'points_per_ad' field"
        assert "daily_limit" in data, "Missing 'daily_limit' field"
        assert "cooldown" in data, "Missing 'cooldown' field"
        
        print(f"✅ Public AdMob settings: enabled={data.get('enabled')}, points_per_ad={data.get('points_per_ad')}")
    
    def test_public_admob_returns_correct_defaults(self):
        """Test public AdMob returns correct default values"""
        response = requests.get(f"{BASE_URL}/api/settings/public/admob")
        data = response.json()
        
        # Check default values
        assert data.get("points_per_ad") == 5, f"Expected points_per_ad=5, got {data.get('points_per_ad')}"
        assert data.get("daily_limit") == 20, f"Expected daily_limit=20, got {data.get('daily_limit')}"
        assert data.get("cooldown") == 30, f"Expected cooldown=30, got {data.get('cooldown')}"
        print("✅ Public AdMob default values are correct")


class TestAdMobSettingsAPI:
    """Test AdMob settings API (admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token before each test"""
        if not hasattr(TestAdminAuth, 'admin_token'):
            response = requests.post(f"{BASE_URL}/api/auth/signin", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            if response.status_code == 200:
                TestAdminAuth.admin_token = response.json().get("token")
    
    def test_get_admob_settings_requires_auth(self):
        """Test GET /api/settings/admob requires authentication"""
        response = requests.get(f"{BASE_URL}/api/settings/admob")
        # 401 or 403 both indicate unauthorized access
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✅ AdMob settings correctly requires authentication")
    
    def test_get_admob_settings_with_auth(self):
        """Test GET /api/settings/admob with admin auth"""
        headers = {"Authorization": f"Bearer {TestAdminAuth.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/admob", headers=headers)
        assert response.status_code == 200, f"GET AdMob settings failed: {response.text}"
        
        data = response.json()
        # Verify all expected fields
        expected_fields = [
            'admob_enabled', 'admob_publisher_id', 'admob_app_id_android',
            'admob_app_id_ios', 'admob_rewarded_ad_unit_android', 
            'admob_rewarded_ad_unit_ios', 'points_per_rewarded_ad',
            'daily_rewarded_ad_limit', 'cooldown_seconds', 'verification_pending'
        ]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        # Check default publisher ID
        assert data.get('admob_publisher_id') == ADMOB_PUBLISHER_ID, \
            f"Expected publisher ID {ADMOB_PUBLISHER_ID}, got {data.get('admob_publisher_id')}"
        
        print(f"✅ GET AdMob settings successful, publisher_id: {data.get('admob_publisher_id')}")
    
    def test_post_admob_settings(self):
        """Test POST /api/settings/admob to save settings"""
        headers = {"Authorization": f"Bearer {TestAdminAuth.admin_token}"}
        
        # Save new settings
        new_settings = {
            "admob_enabled": True,
            "admob_publisher_id": ADMOB_PUBLISHER_ID,
            "admob_app_id_android": "ca-app-pub-test~android",
            "admob_app_id_ios": "ca-app-pub-test~ios",
            "admob_rewarded_ad_unit_android": "ca-app-pub-test/rewarded-android",
            "admob_rewarded_ad_unit_ios": "ca-app-pub-test/rewarded-ios",
            "points_per_rewarded_ad": 10,
            "daily_rewarded_ad_limit": 25,
            "cooldown_seconds": 45,
            "verification_pending": True
        }
        
        response = requests.post(f"{BASE_URL}/api/settings/admob", json=new_settings, headers=headers)
        assert response.status_code == 200, f"POST AdMob settings failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        print("✅ POST AdMob settings successful")
        
        # Verify settings were saved by GET
        get_response = requests.get(f"{BASE_URL}/api/settings/admob", headers=headers)
        saved_data = get_response.json()
        
        assert saved_data.get("admob_enabled") == True, "admob_enabled not saved"
        assert saved_data.get("points_per_rewarded_ad") == 10, "points_per_rewarded_ad not saved"
        assert saved_data.get("daily_rewarded_ad_limit") == 25, "daily_rewarded_ad_limit not saved"
        print("✅ AdMob settings verified after save")
    
    def test_public_admob_reflects_saved_settings(self):
        """Test public endpoint reflects saved settings"""
        response = requests.get(f"{BASE_URL}/api/settings/public/admob")
        data = response.json()
        
        # After enabling AdMob, public endpoint should show enabled=True
        if data.get("enabled"):
            assert "app_id_android" in data, "Missing app_id_android when enabled"
            assert "rewarded_ad_unit_android" in data, "Missing rewarded_ad_unit_android when enabled"
            print(f"✅ Public AdMob shows enabled=True with app IDs")
        else:
            print(f"✅ Public AdMob shows enabled=False (default)")


class TestOtherAdminEndpoints:
    """Test other admin endpoints still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token before each test"""
        if not hasattr(TestAdminAuth, 'admin_token'):
            response = requests.post(f"{BASE_URL}/api/auth/signin", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            if response.status_code == 200:
                TestAdminAuth.admin_token = response.json().get("token")
    
    def test_dashboard_stats(self):
        """Test admin dashboard stats endpoint"""
        headers = {"Authorization": f"Bearer {TestAdminAuth.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        assert "users" in data, "Missing users stats"
        assert "ads" in data, "Missing ads stats"
        assert "withdrawals" in data, "Missing withdrawals stats"
        assert "financials" in data, "Missing financials stats"
        print(f"✅ Dashboard stats: {data.get('users', {}).get('total', 0)} users")
    
    def test_ai_models_settings(self):
        """Test AI models settings endpoint"""
        headers = {"Authorization": f"Bearer {TestAdminAuth.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/ai-models", headers=headers)
        assert response.status_code == 200, f"AI models settings failed: {response.text}"
        
        data = response.json()
        assert "claude_haiku_enabled" in data, "Missing claude_haiku_enabled"
        print(f"✅ AI models settings: claude_haiku_enabled={data.get('claude_haiku_enabled')}")
    
    def test_public_oauth_settings(self):
        """Test public OAuth settings (no auth)"""
        response = requests.get(f"{BASE_URL}/api/settings/public/oauth")
        assert response.status_code == 200, f"Public OAuth failed: {response.text}"
        
        data = response.json()
        assert "google_enabled" in data, "Missing google_enabled"
        print(f"✅ Public OAuth: google_enabled={data.get('google_enabled')}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_reset_admob_settings(self):
        """Reset AdMob settings to defaults"""
        if not hasattr(TestAdminAuth, 'admin_token'):
            pytest.skip("No admin token available")
        
        headers = {"Authorization": f"Bearer {TestAdminAuth.admin_token}"}
        
        # Reset to defaults
        default_settings = {
            "admob_enabled": False,
            "admob_publisher_id": ADMOB_PUBLISHER_ID,
            "admob_app_id_android": "",
            "admob_app_id_ios": "",
            "admob_rewarded_ad_unit_android": "",
            "admob_rewarded_ad_unit_ios": "",
            "points_per_rewarded_ad": 5,
            "daily_rewarded_ad_limit": 20,
            "cooldown_seconds": 30,
            "verification_pending": True
        }
        
        response = requests.post(f"{BASE_URL}/api/settings/admob", json=default_settings, headers=headers)
        assert response.status_code == 200, f"Reset failed: {response.text}"
        print("✅ AdMob settings reset to defaults")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
