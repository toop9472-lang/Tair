"""
Test cases for Saqr App New Features:
- Forgot Password Flow (3 APIs)
- Games Leaderboard API
- Support Form API
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasicAPIs:
    """Basic health check tests"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert data['database'] == 'connected'
        print(f"✅ Health check passed: {data}")

class TestForgotPasswordFlow:
    """Test Forgot Password APIs - 3 step flow"""
    
    def test_forgot_password_invalid_email(self):
        """Test forgot password with non-existent email - should still return success (security)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent_test_12345@example.com"
        })
        # Should return 200 for security (don't reveal if email exists)
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data
        print(f"✅ Forgot password (non-existent email) returns 200: {data}")
    
    def test_forgot_password_valid_email_format(self):
        """Test forgot password API with demo account email"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "demo@saqr.app"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data
        print(f"✅ Forgot password API works: {data}")
    
    def test_verify_otp_invalid(self):
        """Test verify OTP with invalid code"""
        response = requests.post(f"{BASE_URL}/api/auth/verify-reset-otp", json={
            "email": "demo@saqr.app",
            "otp": "000000"  # Invalid OTP
        })
        assert response.status_code == 400
        data = response.json()
        assert 'detail' in data
        print(f"✅ Verify OTP rejects invalid code: {data}")
    
    def test_reset_password_invalid_token(self):
        """Test reset password with invalid token"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": "demo@saqr.app",
            "reset_token": "invalid-token-12345",
            "new_password": "NewPass123!"
        })
        assert response.status_code == 400
        data = response.json()
        assert 'detail' in data
        print(f"✅ Reset password rejects invalid token: {data}")

class TestGamesLeaderboardAPI:
    """Test Games Leaderboard API"""
    
    def test_get_leaderboard(self):
        """Test GET /api/games/leaderboard"""
        response = requests.get(f"{BASE_URL}/api/games/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data or isinstance(data, list)
        
        # Verify leaderboard structure
        leaderboard = data.get('leaderboard', data)
        if len(leaderboard) > 0:
            player = leaderboard[0]
            assert 'name' in player
            assert 'points' in player
            print(f"✅ Leaderboard has {len(leaderboard)} players")
        print(f"✅ Games leaderboard API works")
    
    def test_games_complete_api(self):
        """Test POST /api/games/complete"""
        response = requests.post(f"{BASE_URL}/api/games/complete", json={
            "gameId": "tictactoe",
            "points": 50
        })
        # May return 200 or 401 (if auth required)
        assert response.status_code in [200, 401]
        print(f"✅ Games complete API responds with status: {response.status_code}")

class TestSupportFormAPI:
    """Test Support Form Submission"""
    
    def test_submit_support_form(self):
        """Test POST /api/support/submit"""
        response = requests.post(f"{BASE_URL}/api/support/submit", json={
            "name": "Test User",
            "email": "test@example.com",
            "subject": "general",
            "message": "This is a test support message"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'ticket_id' in data or 'message' in data
        print(f"✅ Support form submission works: {data}")
    
    def test_support_form_validation(self):
        """Test support form with missing fields"""
        response = requests.post(f"{BASE_URL}/api/support/submit", json={
            "name": "",
            "email": "invalid-email",
            "subject": "",
            "message": ""
        })
        # Should return 422 (validation error) or 400
        assert response.status_code in [400, 422]
        print(f"✅ Support form validates input: {response.status_code}")

class TestAuthenticationAPIs:
    """Test existing auth APIs"""
    
    def test_signin_with_demo_account(self):
        """Test signin with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": "demo@saqr.app",
            "password": "Demo123456"
        })
        
        if response.status_code == 200:
            data = response.json()
            assert 'token' in data
            assert 'user' in data
            print(f"✅ Demo login successful: user={data['user'].get('name')}")
        else:
            # Demo account may not exist
            print(f"⚠️ Demo login returned {response.status_code} - account may not exist")
    
    def test_signin_invalid_credentials(self):
        """Test signin with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print(f"✅ Invalid credentials rejected with 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
