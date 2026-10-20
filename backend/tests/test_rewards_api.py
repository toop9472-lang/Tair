"""
Test Rewards API Endpoints
Tests for /api/settings/public/rewards and admin rewards settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://quality-restore-1.preview.emergentagent.com')


class TestPublicRewardsAPI:
    """Test public rewards settings endpoint"""
    
    def test_get_public_rewards_settings(self):
        """Test GET /api/settings/public/rewards returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/settings/public/rewards")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        
        # Required fields
        assert 'points_per_ad' in data, "Missing points_per_ad field"
        assert 'min_watch_time' in data, "Missing min_watch_time field"
        assert 'points_per_dollar' in data, "Missing points_per_dollar field"
        assert 'daily_limit' in data, "Missing daily_limit field"
        assert 'daily_challenges' in data, "Missing daily_challenges field"
        assert 'tips' in data, "Missing tips field"
        
        # Type assertions
        assert isinstance(data['points_per_ad'], int), "points_per_ad should be int"
        assert isinstance(data['min_watch_time'], int), "min_watch_time should be int"
        assert isinstance(data['points_per_dollar'], int), "points_per_dollar should be int"
        assert isinstance(data['daily_limit'], int), "daily_limit should be int"
        assert isinstance(data['daily_challenges'], list), "daily_challenges should be list"
        assert isinstance(data['tips'], list), "tips should be list"
        
        # Value assertions
        assert data['points_per_ad'] > 0, "points_per_ad should be positive"
        assert data['min_watch_time'] > 0, "min_watch_time should be positive"
        assert data['points_per_dollar'] > 0, "points_per_dollar should be positive"
        assert data['daily_limit'] > 0, "daily_limit should be positive"
        
        print(f"✅ Public rewards settings: points_per_ad={data['points_per_ad']}, daily_limit={data['daily_limit']}")
    
    def test_daily_challenges_structure(self):
        """Test daily challenges have correct structure"""
        response = requests.get(f"{BASE_URL}/api/settings/public/rewards")
        assert response.status_code == 200
        
        data = response.json()
        challenges = data.get('daily_challenges', [])
        
        assert len(challenges) > 0, "Should have at least one daily challenge"
        
        for challenge in challenges:
            assert 'title' in challenge, "Challenge missing title"
            assert 'target' in challenge, "Challenge missing target"
            assert 'reward' in challenge, "Challenge missing reward"
            assert 'icon' in challenge, "Challenge missing icon"
            assert 'desc' in challenge, "Challenge missing desc"
            assert 'enabled' in challenge, "Challenge missing enabled"
            
        print(f"✅ Daily challenges: {len(challenges)} challenges found")
    
    def test_tips_structure(self):
        """Test tips have correct structure"""
        response = requests.get(f"{BASE_URL}/api/settings/public/rewards")
        assert response.status_code == 200
        
        data = response.json()
        tips = data.get('tips', [])
        
        assert len(tips) > 0, "Should have at least one tip"
        
        for tip in tips:
            assert 'icon' in tip, "Tip missing icon"
            assert 'text' in tip, "Tip missing text"
            assert 'enabled' in tip, "Tip missing enabled"
            
        print(f"✅ Tips: {len(tips)} tips found")


class TestHealthAPI:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """Test GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('status') == 'healthy', "Health status should be healthy"
        assert data.get('database') == 'connected', "Database should be connected"
        
        print(f"✅ Health check passed: {data}")


class TestPublicAdsAPI:
    """Test public ads endpoints"""
    
    def test_get_public_ads(self):
        """Test GET /api/ads returns ads list"""
        response = requests.get(f"{BASE_URL}/api/ads")
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Ads should be a list"
        
        print(f"✅ Public ads: {len(data)} ads found")


class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={
                "email": "sky-321@hotmail.com",
                "password": "Wsxzaq123"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'token' in data, "Response should contain token"
        assert 'admin' in data, "Response should contain admin data"
        
        print(f"✅ Admin login successful")
        return data['token']
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={
                "email": "invalid@test.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Invalid credentials rejected correctly")


class TestAdminRewardsSettings:
    """Test admin rewards settings endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={
                "email": "sky-321@hotmail.com",
                "password": "Wsxzaq123"
            }
        )
        if response.status_code == 200:
            return response.json().get('token')
        pytest.skip("Admin login failed")
    
    def test_get_admin_rewards_settings(self, admin_token):
        """Test GET /api/settings/rewards returns settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/rewards", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'points_per_ad' in data
        assert 'daily_limit' in data
        assert 'daily_challenges' in data
        
        print(f"✅ Admin rewards settings retrieved successfully")
    
    def test_update_admin_rewards_settings(self, admin_token):
        """Test PUT /api/settings/rewards updates settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/settings/rewards", headers=headers)
        assert get_response.status_code == 200
        current_settings = get_response.json()
        
        # Update with same values (to not break anything)
        update_data = {
            "points_per_ad": current_settings.get('points_per_ad', 5),
            "min_watch_time": current_settings.get('min_watch_time', 30),
            "points_per_dollar": current_settings.get('points_per_dollar', 500),
            "daily_limit": current_settings.get('daily_limit', 50),
            "min_withdrawal": current_settings.get('min_withdrawal', 500),
            "daily_challenges": current_settings.get('daily_challenges', []),
            "tips": current_settings.get('tips', [])
        }
        
        response = requests.put(
            f"{BASE_URL}/api/settings/rewards",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'message' in data
        
        print(f"✅ Admin rewards settings updated successfully")


class TestRewardedAdsAPI:
    """Test rewarded ads endpoints"""
    
    def test_get_rewarded_leaderboard(self):
        """Test GET /api/rewarded-ads/leaderboard returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/rewarded-ads/leaderboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'leaderboard' in data, "Response should contain leaderboard"
        assert 'period' in data, "Response should contain period"
        assert isinstance(data['leaderboard'], list), "Leaderboard should be a list"
        
        print(f"✅ Rewarded ads leaderboard: {len(data['leaderboard'])} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
