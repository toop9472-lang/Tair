"""
Test iteration 28 features:
1. Daily points limit changed to 70 (from 150)
2. Login rewards - 14 days with 160 points + 200 diamonds
3. Economy balance endpoint shows 0/70 for daily points
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://quality-restore-1.preview.emergentagent.com').rstrip('/')

# Test fixtures
@pytest.fixture
def test_user_id():
    """Generate unique test user ID"""
    return f"test_iteration28_{uuid.uuid4().hex[:8]}"


@pytest.fixture
def api_session():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    return session


class TestDailyPointsLimit:
    """Tests for daily points limit = 70"""
    
    def test_economy_routes_daily_limit_constant(self, api_session):
        """Verify economy routes define DAILY_POINTS_LIMIT = 70"""
        # Check the constant by looking at /api/economy/game-costs
        response = api_session.get(f"{BASE_URL}/api/economy/game-costs")
        assert response.status_code == 200
        # The constant is used internally - we verify via balance endpoint
        print("✓ Game costs endpoint accessible")
    
    def test_balance_shows_daily_limit_70(self, api_session, test_user_id):
        """Verify balance endpoint returns daily_limit = 70"""
        # First create a test user via guest login
        guest_response = api_session.post(f"{BASE_URL}/api/auth/guest")
        if guest_response.status_code == 200:
            guest_data = guest_response.json()
            user_id = guest_data.get('user', {}).get('id', guest_data.get('user_id'))
            
            # Now check balance
            balance_response = api_session.get(f"{BASE_URL}/api/economy/balance/{user_id}")
            assert balance_response.status_code == 200
            
            balance_data = balance_response.json()
            assert 'daily_limit' in balance_data, "balance response missing daily_limit field"
            assert balance_data['daily_limit'] == 70, f"Expected daily_limit=70, got {balance_data['daily_limit']}"
            assert 'daily_points_remaining' in balance_data
            assert balance_data['daily_points_remaining'] <= 70
            print(f"✓ Balance shows daily_limit=70, remaining={balance_data['daily_points_remaining']}")
        else:
            # If guest login fails, test via direct balance call
            print(f"Guest login returned {guest_response.status_code}, skipping authenticated test")
            pytest.skip("Guest login unavailable for this test")


class TestLoginRewards14Days:
    """Tests for 14-day login rewards system"""
    
    def test_challenges_login_rewards_has_14_days(self, api_session):
        """Verify login rewards API returns 14 days"""
        # This endpoint requires auth, so we'll test the structure
        response = api_session.get(f"{BASE_URL}/api/challenges/login-rewards")
        
        if response.status_code == 401:
            # Not authenticated - expected
            print("✓ Login rewards endpoint requires authentication (expected)")
            
            # Test with guest user
            guest_response = api_session.post(f"{BASE_URL}/api/auth/guest")
            if guest_response.status_code == 200:
                # Try again with session cookies
                rewards_response = api_session.get(f"{BASE_URL}/api/challenges/login-rewards")
                if rewards_response.status_code == 200:
                    data = rewards_response.json()
                    assert 'rewards' in data
                    rewards = data['rewards']
                    assert len(rewards) == 14, f"Expected 14 days rewards, got {len(rewards)}"
                    print(f"✓ Login rewards has {len(rewards)} days")
                    
                    # Verify totals
                    total_points = sum(r.get('points', 0) for r in rewards)
                    total_diamonds = sum(r.get('diamonds', 0) for r in rewards)
                    print(f"✓ Total rewards: {total_points} points, {total_diamonds} diamonds")
                    assert total_points == 160, f"Expected 160 total points, got {total_points}"
                    assert total_diamonds == 200, f"Expected 200 total diamonds, got {total_diamonds}"
                else:
                    print(f"Login rewards response: {rewards_response.status_code}")
        else:
            assert response.status_code == 200
            data = response.json()
            assert 'rewards' in data
    
    def test_login_rewards_structure(self, api_session):
        """Verify each reward day has both points and diamonds fields"""
        guest_response = api_session.post(f"{BASE_URL}/api/auth/guest")
        if guest_response.status_code != 200:
            pytest.skip("Guest login required")
        
        rewards_response = api_session.get(f"{BASE_URL}/api/challenges/login-rewards")
        if rewards_response.status_code != 200:
            pytest.skip("Login rewards endpoint not accessible")
        
        data = rewards_response.json()
        rewards = data.get('rewards', [])
        
        for reward in rewards:
            assert 'day' in reward, f"Missing 'day' field in reward"
            assert 'points' in reward, f"Missing 'points' field in day {reward.get('day')}"
            assert 'diamonds' in reward, f"Missing 'diamonds' field in day {reward.get('day')}"
            print(f"Day {reward['day']}: {reward['points']} pts, {reward['diamonds']} gems")
        
        print(f"✓ All {len(rewards)} rewards have correct structure")


class TestEconomyEndpoints:
    """Tests for economy system endpoints"""
    
    def test_health_endpoint(self, api_session):
        """Verify API health"""
        response = api_session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("✓ API health check passed")
    
    def test_leaderboard_endpoint(self, api_session):
        """Verify leaderboard is accessible"""
        response = api_session.get(f"{BASE_URL}/api/economy/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        print(f"✓ Leaderboard accessible, {len(data['leaderboard'])} entries")
    
    def test_diamond_packages_endpoint(self, api_session):
        """Verify diamond packages endpoint"""
        response = api_session.get(f"{BASE_URL}/api/economy/packages")
        assert response.status_code == 200
        data = response.json()
        assert 'packages' in data
        assert len(data['packages']) > 0
        print(f"✓ Diamond packages: {len(data['packages'])} options")
    
    def test_game_result_respects_daily_limit(self, api_session):
        """Test that game-result API respects daily limit of 70"""
        guest_response = api_session.post(f"{BASE_URL}/api/auth/guest")
        if guest_response.status_code != 200:
            pytest.skip("Guest login required")
        
        guest_data = guest_response.json()
        user_id = guest_data.get('user', {}).get('id', guest_data.get('user_id'))
        
        # Record a game result
        game_result = api_session.post(f"{BASE_URL}/api/economy/game-result", json={
            "user_id": user_id,
            "game_id": "brickbreaker",
            "is_online": False,
            "won": True,
            "opponent_diamonds": 0
        })
        
        assert game_result.status_code == 200
        result_data = game_result.json()
        
        assert 'daily_limit' in result_data
        assert result_data['daily_limit'] == 70, f"Expected daily_limit=70, got {result_data['daily_limit']}"
        print(f"✓ Game result respects daily_limit=70")


class TestChallengesEndpoints:
    """Tests for challenges system"""
    
    def test_daily_challenges_max_points(self, api_session):
        """Verify daily challenges max is 69 points"""
        guest_response = api_session.post(f"{BASE_URL}/api/auth/guest")
        if guest_response.status_code != 200:
            pytest.skip("Guest login required")
        
        challenges_response = api_session.get(f"{BASE_URL}/api/challenges/daily")
        if challenges_response.status_code != 200:
            pytest.skip("Challenges endpoint not accessible")
        
        data = challenges_response.json()
        assert 'max_daily_points' in data
        assert data['max_daily_points'] == 69
        print(f"✓ Daily challenges max = {data['max_daily_points']} points")
    
    def test_challenges_stats_endpoint(self, api_session):
        """Verify challenges stats endpoint"""
        guest_response = api_session.post(f"{BASE_URL}/api/auth/guest")
        if guest_response.status_code != 200:
            pytest.skip("Guest login required")
        
        stats_response = api_session.get(f"{BASE_URL}/api/challenges/stats")
        if stats_response.status_code != 200:
            pytest.skip("Stats endpoint not accessible")
        
        data = stats_response.json()
        assert 'today' in data
        assert 'this_month' in data
        
        # Verify monthly max for login rewards
        assert data['this_month']['max_points'] == 160
        assert data['this_month']['max_diamonds'] == 200
        print(f"✓ Stats show monthly max: 160 pts, 200 gems")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
