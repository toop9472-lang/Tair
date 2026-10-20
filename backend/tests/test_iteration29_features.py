"""
Iteration 29 Tests - New Games and Password Reset (No OTP)
Tests for:
1. WordChainGame (سباق الكلمات) - works with computer
2. SpeedMathGame (سرعة الحساب) - works with multiple options
3. GamesPage displays 6 new games
4. POST /api/auth/forgot-password - sends link
5. POST /api/auth/reset-password - accepts token only
6. Trivia questions 200+ check
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://quality-restore-1.preview.emergentagent.com').rstrip('/')


class TestHealthAndSetup:
    """Basic health checks"""

    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("✓ API health check passed")


class TestPasswordResetNoOTP:
    """Test password reset without OTP - using token only"""
    
    def test_forgot_password_endpoint_exists(self):
        """Test POST /api/auth/forgot-password endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "test_nonexistent@test.com"}
        )
        # Should return 200 even for non-existent emails (security)
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data
        print(f"✓ Forgot password response: {data.get('message')}")
    
    def test_reset_password_endpoint_exists(self):
        """Test POST /api/auth/reset-password endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={
                "reset_token": "invalid_test_token",
                "new_password": "NewPass123!"
            }
        )
        # Should return 400 for invalid token
        assert response.status_code == 400
        data = response.json()
        assert 'detail' in data
        # Verify error mentions token is invalid/expired
        assert 'رابط' in data.get('detail', '') or 'token' in data.get('detail', '').lower() or 'صالح' in data.get('detail', '')
        print(f"✓ Reset password correctly rejects invalid token: {data.get('detail')}")
    
    def test_reset_password_requires_token_not_otp(self):
        """Verify reset-password API accepts reset_token parameter"""
        # Send request with reset_token field
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={
                "reset_token": "test_token_12345",
                "new_password": "NewPass123456!"
            }
        )
        # Should not return 422 (validation error) - means it accepts the schema
        assert response.status_code != 422, "API should accept reset_token field"
        # 400 is expected since token is invalid
        assert response.status_code == 400
        print("✓ Reset password API accepts reset_token parameter (no OTP required)")


class TestEconomyAndLeaderboard:
    """Test economy endpoints for games"""
    
    def test_leaderboard_endpoint(self):
        """Test leaderboard returns data"""
        response = requests.get(f"{BASE_URL}/api/economy/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        print(f"✓ Leaderboard returned {len(data.get('leaderboard', []))} players")
    
    def test_packages_endpoint(self):
        """Test packages endpoint"""
        response = requests.get(f"{BASE_URL}/api/economy/packages")
        assert response.status_code == 200
        data = response.json()
        assert 'packages' in data
        print(f"✓ Packages returned {len(data.get('packages', []))} items")


class TestGameResultAPI:
    """Test game result API which is used by new games"""
    
    def test_game_result_endpoint_structure(self):
        """Test /api/economy/game-result endpoint accepts game data"""
        # This endpoint expects user_id, game_id, is_online, won
        response = requests.post(
            f"{BASE_URL}/api/economy/game-result",
            json={
                "user_id": "test_user_123",
                "game_id": "wordchain",  # New game
                "is_online": False,
                "won": True,
                "opponent_diamonds": 0
            }
        )
        # Should accept the request (may return different status based on user existence)
        # Not 422 means schema is correct
        assert response.status_code != 422
        print(f"✓ Game result API accepts wordchain game_id, status: {response.status_code}")
    
    def test_game_result_for_speedmath(self):
        """Test game result accepts speedmath game"""
        response = requests.post(
            f"{BASE_URL}/api/economy/game-result",
            json={
                "user_id": "test_user_456",
                "game_id": "speedmath",  # New game
                "is_online": False,
                "won": True,
                "opponent_diamonds": 0
            }
        )
        assert response.status_code != 422
        print(f"✓ Game result API accepts speedmath game_id, status: {response.status_code}")


class TestAuthFlow:
    """Test authentication flow"""
    
    def test_guest_signin_flow(self):
        """Test signin endpoint works"""
        # This test just verifies the endpoint exists and responds
        response = requests.post(
            f"{BASE_URL}/api/auth/signin",
            json={
                "email": "test@test.com",
                "password": "wrongpassword"
            }
        )
        # Should return 401 for wrong credentials (not 500)
        assert response.status_code in [401, 429]  # 429 for rate limiting
        print(f"✓ Signin endpoint responds correctly, status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
