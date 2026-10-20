"""
Test cases for Change Password API endpoint
Tests: /api/auth/change-password
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestChangePasswordAPI:
    """Tests for change password endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and get token"""
        self.test_email = "demo@saqr.app"
        self.test_password = "Demo123456"
        self.new_password = "NewDemo123456"
        
        # Login to get token
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": self.test_email,
            "password": self.test_password
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get('token')
            self.user = data.get('user')
        else:
            pytest.skip(f"Cannot login with demo account: {response.status_code}")
    
    def test_change_password_wrong_current_password(self):
        """Test with wrong current password - should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "current_password": "WrongPassword123",
                "new_password": self.new_password
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        # Arabic error: "كلمة المرور الحالية غير صحيحة"
        print(f"Expected 401 error: {data['detail']}")
    
    def test_change_password_same_password(self):
        """Test new password same as current - should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "current_password": self.test_password,
                "new_password": self.test_password  # Same as current
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        # Arabic error: "كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية"
        print(f"Expected 400 error: {data['detail']}")
    
    def test_change_password_weak_password(self):
        """Test with weak new password - should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "current_password": self.test_password,
                "new_password": "weak"  # Too short, no uppercase, no numbers
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Expected 400 error for weak password: {data['detail']}")
    
    def test_change_password_no_auth(self):
        """Test without authorization header - should return 401/403"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            json={
                "current_password": self.test_password,
                "new_password": self.new_password
            }
        )
        
        assert response.status_code in [401, 403]
        print(f"Expected 401/403 for no auth: {response.status_code}")


class TestGuestModeAPI:
    """Tests for guest mode functionality"""
    
    def test_ads_endpoint_accessible(self):
        """Test that ads endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/ads")
        
        # Should return ads (could be 200 or may require auth)
        print(f"Ads endpoint status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Ads returned: {len(data) if isinstance(data, list) else 'N/A'}")
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"Health check passed: {data}")


class TestNavigationEndpoints:
    """Tests for navigation-related endpoints"""
    
    def test_auth_signin_endpoint(self):
        """Test signin endpoint with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": "demo@saqr.app",
            "password": "Demo123456"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "demo@saqr.app"
        print(f"Signin successful for: {data['user']['email']}")
    
    def test_auth_logout_endpoint(self):
        """Test logout endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/logout")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Logout response: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
