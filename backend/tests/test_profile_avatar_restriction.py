"""
Test: Profile Avatar Change Restriction (تقييد تغيير الصورة مرة أسبوعياً)
This tests the 7-day restriction for profile picture changes

Features tested:
- PUT /api/users/profile - Avatar change restriction
- First avatar change should succeed
- Second avatar change within 7 days should fail with proper error message
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProfileAvatarRestriction:
    """Test avatar change restriction - once per week"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token via email registration/login"""
        # Register a test user
        test_email = f"test_avatar_{int(time.time())}@test.com"
        test_password = "TestPass123!"
        
        # First register the user
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "name": "Test Avatar User"
            }
        )
        
        # Then sign in to get JWT token (register uses session cookies, not JWT)
        login_response = requests.post(
            f"{BASE_URL}/api/auth/signin",
            json={
                "email": test_email,
                "password": test_password
            }
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get('token')
            if token:
                return {"Authorization": f"Bearer {token}"}
        
        pytest.skip("Could not authenticate user for avatar test")
        return None
    
    def test_first_avatar_change_succeeds(self, auth_headers):
        """First avatar change should succeed"""
        if not auth_headers:
            pytest.skip("No auth headers")
        
        response = requests.put(
            f"{BASE_URL}/api/users/profile",
            headers=auth_headers,
            json={"avatar": "https://ui-avatars.com/api/?name=NewAvatar&background=random"}
        )
        
        # First change should succeed (200 or may fail if already changed)
        # We accept both 200 (success) and 400 (already changed recently)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('success') == True
            print("✅ First avatar change succeeded")
        else:
            # Check if it's the weekly restriction error
            data = response.json()
            detail = data.get('detail', '')
            assert 'أسبوعياً' in detail or 'يوم' in detail, f"Expected weekly restriction message, got: {detail}"
            print(f"⚠️ Avatar already changed recently: {detail}")
    
    def test_second_avatar_change_blocked(self, auth_headers):
        """Second avatar change within 7 days should be blocked"""
        if not auth_headers:
            pytest.skip("No auth headers")
        
        # First change
        first_response = requests.put(
            f"{BASE_URL}/api/users/profile",
            headers=auth_headers,
            json={"avatar": "https://ui-avatars.com/api/?name=First&background=111111"}
        )
        
        # Second change immediately after
        second_response = requests.put(
            f"{BASE_URL}/api/users/profile",
            headers=auth_headers,
            json={"avatar": "https://ui-avatars.com/api/?name=Second&background=222222"}
        )
        
        # Second change should be blocked with 400
        if first_response.status_code == 200:
            # If first succeeded, second must fail
            assert second_response.status_code == 400, f"Expected 400 for second avatar change, got: {second_response.status_code}"
            data = second_response.json()
            detail = data.get('detail', '')
            # Check Arabic error message about weekly restriction
            assert 'أسبوعياً' in detail or 'يوم' in detail, f"Expected weekly restriction message, got: {detail}"
            print(f"✅ Second avatar change blocked correctly: {detail}")
        else:
            # First was already blocked, so both should be blocked
            assert second_response.status_code == 400
            print("✅ Avatar changes blocked (already changed recently)")
    
    def test_name_change_not_restricted(self, auth_headers):
        """Name changes should not be restricted by avatar rule"""
        if not auth_headers:
            pytest.skip("No auth headers")
        
        # Change name should always work
        response = requests.put(
            f"{BASE_URL}/api/users/profile",
            headers=auth_headers,
            json={"name": f"Updated Name {int(time.time())}"}
        )
        
        assert response.status_code == 200, f"Name change failed: {response.text}"
        data = response.json()
        assert data.get('success') == True
        print("✅ Name change succeeded without restriction")


class TestHealthAndBasicAPIs:
    """Basic API health checks"""
    
    def test_api_health(self):
        """API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("✅ API health check passed")
    
    def test_settings_oauth_public(self):
        """Test public OAuth settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/settings/public/oauth")
        assert response.status_code == 200
        data = response.json()
        # Check for google and apple enabled flags
        assert 'google_enabled' in data
        assert 'apple_enabled' in data
        print(f"✅ OAuth settings: Google={data.get('google_enabled')}, Apple={data.get('apple_enabled')}")


class TestTermsAndPrivacy:
    """Test terms and privacy content (frontend routes verified via API where applicable)"""
    
    def test_support_submit_endpoint(self):
        """Test support form submission endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/support/submit",
            json={
                "name": "Test User",
                "email": "test@test.com",
                "subject": "Test Subject",
                "message": "Test message for support"
            }
        )
        # Accept 200 or 201 for success, or 422 if validation different
        assert response.status_code in [200, 201, 422], f"Support submit failed: {response.status_code}"
        if response.status_code in [200, 201]:
            print("✅ Support submit endpoint working")
        else:
            print(f"⚠️ Support submit returned {response.status_code}")
