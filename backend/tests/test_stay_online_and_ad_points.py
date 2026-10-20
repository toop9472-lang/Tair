"""
Test Suite for:
1. stay_online_1hour challenge with timer countdown
2. New rewarded ads points system: 1 point per 60 seconds (min 1 point)

Testing features:
- GET /api/challenges/daily - Returns 'stay_online_1hour' with timer info
- POST /api/rewarded-ads/complete - 1 point per 60 seconds
- Challenge progress for online_time type
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@saqr.app"
TEST_PASSWORD = "Demo123456"


class TestAuth:
    """Authentication for test session"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/signin",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestStayOnlineChallenge(TestAuth):
    """Test the 'stay_online_1hour' (المثابر) challenge with timer"""
    
    def test_daily_challenges_returns_stay_online_1hour(self, auth_headers):
        """GET /api/challenges/daily should return stay_online_1hour challenge"""
        response = requests.get(f"{BASE_URL}/api/challenges/daily", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "challenges" in data
        
        # Find stay_online_1hour challenge
        challenges = data["challenges"]
        online_challenge = next((c for c in challenges if c["id"] == "stay_online_1hour"), None)
        
        assert online_challenge is not None, "stay_online_1hour challenge not found"
        print(f"Found challenge: {online_challenge}")
    
    def test_stay_online_challenge_has_correct_properties(self, auth_headers):
        """Verify stay_online_1hour has correct title, target, and points"""
        response = requests.get(f"{BASE_URL}/api/challenges/daily", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        challenges = data["challenges"]
        online_challenge = next((c for c in challenges if c["id"] == "stay_online_1hour"), None)
        
        assert online_challenge is not None
        assert online_challenge["title"] == "المثابر", f"Wrong title: {online_challenge['title']}"
        assert online_challenge["description"] == "ابقَ متصلاً لمدة ساعة واحدة"
        assert online_challenge["target"] == 60, f"Target should be 60 minutes, got {online_challenge['target']}"
        assert online_challenge["points"] == 14, f"Points should be 14, got {online_challenge['points']}"
        assert online_challenge["icon"] == "timer"
        print(f"Challenge properties verified: title={online_challenge['title']}, target={online_challenge['target']}min, points={online_challenge['points']}")
    
    def test_stay_online_challenge_has_timer_info(self, auth_headers):
        """Verify stay_online_1hour returns timer with elapsed_seconds and remaining_seconds"""
        response = requests.get(f"{BASE_URL}/api/challenges/daily", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        challenges = data["challenges"]
        online_challenge = next((c for c in challenges if c["id"] == "stay_online_1hour"), None)
        
        assert online_challenge is not None
        
        # Timer info should be present
        assert "timer" in online_challenge, "Timer info missing from stay_online_1hour challenge"
        timer = online_challenge["timer"]
        
        assert "elapsed_seconds" in timer, "elapsed_seconds missing from timer"
        assert "remaining_seconds" in timer, "remaining_seconds missing from timer"
        assert "target_seconds" in timer, "target_seconds missing from timer"
        assert "start_time" in timer, "start_time missing from timer"
        
        # Validate target_seconds = 60 minutes * 60 seconds = 3600 seconds
        assert timer["target_seconds"] == 3600, f"target_seconds should be 3600, got {timer['target_seconds']}"
        
        # Validate elapsed + remaining = target (approximately)
        total = timer["elapsed_seconds"] + timer["remaining_seconds"]
        assert abs(total - 3600) <= 2, f"elapsed + remaining should equal 3600, got {total}"
        
        print(f"Timer info: elapsed={timer['elapsed_seconds']}s, remaining={timer['remaining_seconds']}s, target={timer['target_seconds']}s")
    
    def test_online_time_progress_updates(self, auth_headers):
        """Verify online_time challenge progress calculates correctly"""
        response = requests.get(f"{BASE_URL}/api/challenges/daily", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        challenges = data["challenges"]
        online_challenge = next((c for c in challenges if c["id"] == "stay_online_1hour"), None)
        
        assert online_challenge is not None
        
        # Current should be in minutes (elapsed time in minutes)
        assert "current" in online_challenge
        assert online_challenge["current"] >= 0
        
        # If timer exists, current should match elapsed minutes
        if "timer" in online_challenge:
            elapsed_minutes = online_challenge["timer"]["elapsed_seconds"] // 60
            assert online_challenge["current"] == elapsed_minutes or abs(online_challenge["current"] - elapsed_minutes) <= 1
        
        print(f"Progress: {online_challenge['current']}/{online_challenge['target']} minutes")


class TestRewardedAdPoints(TestAuth):
    """Test the new rewarded ads points system: 1 point per 60 seconds"""
    
    def test_ad_complete_30_seconds_gives_1_point(self, auth_headers):
        """POST /api/rewarded-ads/complete with 30 seconds = 1 point (minimum)"""
        response = requests.post(
            f"{BASE_URL}/api/rewarded-ads/complete",
            headers=auth_headers,
            json={
                "ad_type": "personal",
                "ad_id": "test_ad_30sec",
                "completed": True,
                "watch_duration": 30
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["points_earned"] == 1, f"30 seconds should give 1 point (minimum), got {data['points_earned']}"
        print(f"30 seconds watch: earned {data['points_earned']} point(s)")
    
    def test_ad_complete_60_seconds_gives_1_point(self, auth_headers):
        """POST /api/rewarded-ads/complete with 60 seconds = 1 point"""
        # Wait for cooldown
        time.sleep(2)
        
        response = requests.post(
            f"{BASE_URL}/api/rewarded-ads/complete",
            headers=auth_headers,
            json={
                "ad_type": "personal",
                "ad_id": "test_ad_60sec",
                "completed": True,
                "watch_duration": 60
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["points_earned"] == 1, f"60 seconds should give 1 point, got {data['points_earned']}"
        print(f"60 seconds watch: earned {data['points_earned']} point(s)")
    
    def test_ad_complete_120_seconds_gives_2_points(self, auth_headers):
        """POST /api/rewarded-ads/complete with 120 seconds = 2 points"""
        # Wait for cooldown
        time.sleep(2)
        
        response = requests.post(
            f"{BASE_URL}/api/rewarded-ads/complete",
            headers=auth_headers,
            json={
                "ad_type": "personal",
                "ad_id": "test_ad_120sec",
                "completed": True,
                "watch_duration": 120
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["points_earned"] == 2, f"120 seconds should give 2 points, got {data['points_earned']}"
        print(f"120 seconds watch: earned {data['points_earned']} point(s)")
    
    def test_ad_complete_180_seconds_gives_3_points(self, auth_headers):
        """POST /api/rewarded-ads/complete with 180 seconds = 3 points"""
        # Wait for cooldown
        time.sleep(2)
        
        response = requests.post(
            f"{BASE_URL}/api/rewarded-ads/complete",
            headers=auth_headers,
            json={
                "ad_type": "personal",
                "ad_id": "test_ad_180sec",
                "completed": True,
                "watch_duration": 180
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["points_earned"] == 3, f"180 seconds should give 3 points, got {data['points_earned']}"
        print(f"180 seconds watch: earned {data['points_earned']} point(s)")
    
    def test_ad_complete_45_seconds_gives_1_point_minimum(self, auth_headers):
        """POST /api/rewarded-ads/complete with 45 seconds = 1 point (minimum applies)"""
        # Wait for cooldown
        time.sleep(2)
        
        response = requests.post(
            f"{BASE_URL}/api/rewarded-ads/complete",
            headers=auth_headers,
            json={
                "ad_type": "personal",
                "ad_id": "test_ad_45sec",
                "completed": True,
                "watch_duration": 45
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        # 45 seconds / 60 = 0, but minimum is 1
        assert data["points_earned"] == 1, f"45 seconds should give 1 point (minimum), got {data['points_earned']}"
        print(f"45 seconds watch: earned {data['points_earned']} point(s) (minimum applied)")
    
    def test_ad_incomplete_watch_rejected(self, auth_headers):
        """Short watch duration (< 24 seconds) should be rejected"""
        response = requests.post(
            f"{BASE_URL}/api/rewarded-ads/complete",
            headers=auth_headers,
            json={
                "ad_type": "personal",
                "ad_id": "test_ad_short",
                "completed": True,
                "watch_duration": 20  # Less than 24 seconds required
            }
        )
        assert response.status_code == 200  # Returns 200 but success=False
        
        data = response.json()
        assert data["success"] == False, "Short watch should be rejected"
        print(f"Short watch (20s) rejected: {data.get('message', 'N/A')}")


class TestMaxDailyPoints(TestAuth):
    """Verify max daily points is 69"""
    
    def test_max_daily_points_is_69(self, auth_headers):
        """GET /api/challenges/daily should show max_daily_points = 69"""
        response = requests.get(f"{BASE_URL}/api/challenges/daily", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["max_daily_points"] == 69, f"Max daily points should be 69, got {data.get('max_daily_points')}"
        
        # Verify sum of all challenge points = 69
        total_points = sum(c["points"] for c in data["challenges"])
        assert total_points == 69, f"Sum of challenge points should be 69, got {total_points}"
        print(f"Max daily points verified: {data['max_daily_points']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
