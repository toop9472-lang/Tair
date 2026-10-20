"""
Test Analytics and 2FA (Two-Factor Authentication) APIs
Tests for iteration 12 - Saqr App Analytics Dashboard and 2FA Email Notifications

Features tested:
1. GET /api/analytics/platform/overview - Platform analytics
2. GET /api/analytics/top-ads - Top performing ads
3. POST /api/2fa/enable - Enable 2FA (requires auth)
4. POST /api/2fa/send-login-code - Send 2FA login code via email
5. GET /api/2fa/status - 2FA status check (requires auth)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestAnalyticsAPIs:
    """Test Analytics endpoints for admin dashboard"""
    
    def test_platform_overview_returns_200(self):
        """GET /api/analytics/platform/overview should return platform stats"""
        response = requests.get(f"{BASE_URL}/api/analytics/platform/overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert 'users' in data, "Response should contain 'users' field"
        assert 'ads' in data, "Response should contain 'ads' field"
        assert 'engagement' in data, "Response should contain 'engagement' field"
        assert 'financials' in data, "Response should contain 'financials' field"
        assert 'daily_active_users' in data, "Response should contain 'daily_active_users' field"
        
        # Verify users structure
        users = data['users']
        assert 'total' in users, "Users should have 'total' field"
        assert 'active_last_7_days' in users, "Users should have 'active_last_7_days' field"
        assert 'activity_rate' in users, "Users should have 'activity_rate' field"
        
        # Verify ads structure
        ads = data['ads']
        assert 'total' in ads, "Ads should have 'total' field"
        assert 'active' in ads, "Ads should have 'active' field"
        
        # Verify engagement structure
        engagement = data['engagement']
        assert 'total_views' in engagement, "Engagement should have 'total_views' field"
        
        # Verify financials structure
        financials = data['financials']
        assert 'total_revenue' in financials, "Financials should have 'total_revenue' field"
        assert 'total_payouts' in financials, "Financials should have 'total_payouts' field"
        assert 'net_profit' in financials, "Financials should have 'net_profit' field"
        
        print(f"✓ Platform overview returned successfully with {users['total']} users, {ads['total']} ads")
    
    def test_platform_overview_daily_stats(self):
        """Verify daily_active_users contains proper date structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/platform/overview")
        
        assert response.status_code == 200
        
        data = response.json()
        daily_stats = data.get('daily_active_users', [])
        
        # Should have up to 30 days of data
        assert len(daily_stats) <= 30, "Daily stats should have at most 30 days"
        
        if daily_stats:
            # Check first entry structure
            first_day = daily_stats[0]
            assert 'date' in first_day, "Daily stat should have 'date' field"
            assert 'active_users' in first_day, "Daily stat should have 'active_users' field"
            
            # Verify date format (YYYY-MM-DD)
            date_str = first_day['date']
            assert len(date_str) == 10, f"Date should be in YYYY-MM-DD format, got {date_str}"
        
        print(f"✓ Daily active users contains {len(daily_stats)} days of data")
    
    def test_top_ads_returns_200(self):
        """GET /api/analytics/top-ads should return top performing ads"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-ads")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert 'top_ads' in data, "Response should contain 'top_ads' field"
        assert isinstance(data['top_ads'], list), "'top_ads' should be a list"
        
        print(f"✓ Top ads endpoint returned {len(data['top_ads'])} ads")
    
    def test_top_ads_with_limit(self):
        """GET /api/analytics/top-ads with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-ads?limit=5")
        
        assert response.status_code == 200
        
        data = response.json()
        top_ads = data.get('top_ads', [])
        
        # Should not exceed the limit
        assert len(top_ads) <= 5, f"Should have at most 5 ads, got {len(top_ads)}"
        
        # If there are ads, verify structure
        if top_ads:
            first_ad = top_ads[0]
            assert 'ad_id' in first_ad, "Ad should have 'ad_id' field"
            assert 'title' in first_ad, "Ad should have 'title' field"
            assert 'views' in first_ad, "Ad should have 'views' field"
        
        print(f"✓ Top ads with limit=5 returned {len(top_ads)} ads")


class TestTwoFactorAuthAPIs:
    """Test 2FA (Two-Factor Authentication) endpoints"""
    
    def test_send_login_code_valid_email(self):
        """POST /api/2fa/send-login-code should accept valid email"""
        response = requests.post(
            f"{BASE_URL}/api/2fa/send-login-code",
            json={"email": "demo@saqr.app"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert 'success' in data, "Response should contain 'success' field"
        assert data['success'] == True, "success should be True"
        assert 'message' in data, "Response should contain 'message' field"
        
        # email_sent depends on email configuration in admin settings
        # debug_code is returned when email is not configured
        
        print(f"✓ Send login code returned: {data.get('message')}")
        if 'debug_code' in data and data['debug_code']:
            print(f"  (Email not configured - debug_code returned for testing)")
    
    def test_send_login_code_nonexistent_email(self):
        """POST /api/2fa/send-login-code with non-existent email should still return success (security)"""
        response = requests.post(
            f"{BASE_URL}/api/2fa/send-login-code",
            json={"email": "nonexistent_test_user@example.com"}
        )
        
        assert response.status_code == 200, f"Expected 200 (security - don't reveal if user exists), got {response.status_code}"
        
        data = response.json()
        assert 'success' in data, "Response should contain 'success' field"
        assert data['success'] == True, "Should return success even for non-existent email (security)"
        
        print("✓ Non-existent email handled securely (no user enumeration)")
    
    def test_send_login_code_missing_email(self):
        """POST /api/2fa/send-login-code without email should return 422"""
        response = requests.post(
            f"{BASE_URL}/api/2fa/send-login-code",
            json={}
        )
        
        assert response.status_code == 422, f"Expected 422 (validation error), got {response.status_code}"
        
        print("✓ Missing email properly returns 422 validation error")
    
    def test_enable_2fa_requires_auth(self):
        """POST /api/2fa/enable should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/2fa/enable",
            json={"method": "email"}
        )
        
        # Should return 401 or 403 without auth token
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print("✓ Enable 2FA correctly requires authentication")
    
    def test_2fa_status_requires_auth(self):
        """GET /api/2fa/status should require authentication"""
        response = requests.get(f"{BASE_URL}/api/2fa/status")
        
        # Should return 401 or 403 without auth token
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print("✓ 2FA status correctly requires authentication")
    
    def test_verify_2fa_requires_auth(self):
        """POST /api/2fa/verify should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/2fa/verify",
            json={"code": "123456"}
        )
        
        # Should return 401 or 403 without auth token
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print("✓ Verify 2FA correctly requires authentication")
    
    def test_validate_2fa_invalid_code(self):
        """POST /api/2fa/validate with invalid code should return error"""
        response = requests.post(
            f"{BASE_URL}/api/2fa/validate",
            json={
                "user_id": "test_user_id",
                "code": "000000"
            }
        )
        
        # Should return 400 for invalid code
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        print("✓ Validate 2FA correctly rejects invalid code")


class TestAuthenticatedTwoFactorAPIs:
    """Test 2FA APIs with authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token using demo account"""
        # Use /api/auth/signin for email/password login
        response = requests.post(
            f"{BASE_URL}/api/auth/signin",
            json={
                "email": "demo@saqr.app",
                "password": "Demo123456"
            }
        )
        
        if response.status_code != 200:
            pytest.skip(f"Could not authenticate with demo account: {response.status_code} - {response.text}")
        
        data = response.json()
        return data.get('token')
    
    def test_enable_2fa_with_auth(self, auth_token):
        """POST /api/2fa/enable with valid auth should start 2FA setup"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/2fa/enable",
            json={"method": "email"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'success' in data, "Response should contain 'success' field"
        assert 'message' in data, "Response should contain 'message' field"
        assert 'expires_in' in data, "Response should contain 'expires_in' field"
        
        print(f"✓ 2FA enable started: {data.get('message')}")
        if 'debug_code' in data and data['debug_code']:
            print(f"  Debug code (email not configured): {data['debug_code']}")
    
    def test_2fa_status_with_auth(self, auth_token):
        """GET /api/2fa/status with valid auth should return status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/2fa/status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'enabled' in data, "Response should contain 'enabled' field"
        
        print(f"✓ 2FA status: enabled={data['enabled']}, method={data.get('method')}")


class TestHealthAndBasicEndpoints:
    """Basic health check tests"""
    
    def test_health_check(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        assert data.get('database') == 'connected'
        
        print("✓ Health check passed - database connected")
    
    def test_api_root(self):
        """GET /api/ should return welcome message"""
        response = requests.get(f"{BASE_URL}/api/")
        
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data
        
        print(f"✓ API root: {data.get('message')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
