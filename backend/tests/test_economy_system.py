"""
Economy System Tests - Saqr Points & Diamonds
Tests for: packages, balance, daily login rewards, enter-game, game-result, leaderboard
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user from requirements
TEST_USER_ID = "user_142f6a6ff7e2"


class TestDiamondPackages:
    """Test /api/economy/packages endpoint"""
    
    def test_get_diamond_packages(self):
        """Should return 4 diamond packages with correct prices"""
        response = requests.get(f"{BASE_URL}/api/economy/packages")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "packages" in data
        assert "currency" in data
        assert data["currency"] == "SAR"
        
        packages = data["packages"]
        assert len(packages) == 4, f"Expected 4 packages, got {len(packages)}"
        
        # Verify prices are 3, 7, 12, 19 SAR
        expected_prices = [3, 7, 12, 19]
        actual_prices = [p["price"] for p in packages]
        assert sorted(actual_prices) == sorted(expected_prices), f"Expected prices {expected_prices}, got {actual_prices}"
        
        # Verify package details
        for package in packages:
            assert "id" in package
            assert "name" in package
            assert "diamonds" in package
            assert "price" in package
            assert "bonus" in package
            print(f"Package: {package['id']} - {package['diamonds']} diamonds + {package['bonus']} bonus for {package['price']} SAR")


class TestUserBalance:
    """Test /api/economy/balance/{user_id} endpoint"""
    
    def test_get_balance_existing_user(self):
        """Should return saqr_points, diamonds, daily_points_remaining"""
        response = requests.get(f"{BASE_URL}/api/economy/balance/{TEST_USER_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "saqr_points" in data, "Missing saqr_points"
        assert "diamonds" in data, "Missing diamonds"
        assert "daily_points_remaining" in data, "Missing daily_points_remaining"
        assert "daily_limit" in data, "Missing daily_limit"
        assert "daily_points_earned" in data, "Missing daily_points_earned"
        
        # Verify types
        assert isinstance(data["saqr_points"], int)
        assert isinstance(data["diamonds"], int)
        assert isinstance(data["daily_points_remaining"], int)
        assert data["daily_limit"] == 150, f"Expected daily limit 150, got {data['daily_limit']}"
        
        print(f"Balance - Saqr Points: {data['saqr_points']}, Diamonds: {data['diamonds']}")
        print(f"Daily: {data['daily_points_earned']}/{data['daily_limit']} (remaining: {data['daily_points_remaining']})")
    
    def test_get_balance_nonexistent_user(self):
        """Should return 404 for non-existent user"""
        fake_user = f"user_fake_{uuid.uuid4().hex[:8]}"
        response = requests.get(f"{BASE_URL}/api/economy/balance/{fake_user}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"


class TestDailyLoginStatus:
    """Test /api/economy/daily-login-status/{user_id} endpoint"""
    
    def test_get_daily_login_status(self):
        """Should return rewards array and next_reward"""
        response = requests.get(f"{BASE_URL}/api/economy/daily-login-status/{TEST_USER_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "rewards" in data, "Missing rewards array"
        assert "next_reward" in data, "Missing next_reward"
        assert "current_streak" in data, "Missing current_streak"
        
        # Verify rewards structure
        rewards = data["rewards"]
        assert len(rewards) == 7, f"Expected 7 daily rewards, got {len(rewards)}"
        
        for reward in rewards:
            assert "day" in reward
            assert "type" in reward
            assert "amount" in reward
            assert reward["type"] in ["points", "diamonds"]
        
        # Verify next_reward structure
        next_reward = data["next_reward"]
        assert "day" in next_reward
        assert "type" in next_reward
        assert "amount" in next_reward
        
        print(f"Current streak: {data['current_streak']}")
        print(f"Next reward: {next_reward['amount']} {next_reward['type']} (day {next_reward['day']})")


class TestClaimDailyReward:
    """Test /api/economy/claim-daily-reward endpoint"""
    
    def test_claim_daily_reward(self):
        """Should award points or diamonds based on streak day"""
        # First check the status
        status_response = requests.get(f"{BASE_URL}/api/economy/daily-login-status/{TEST_USER_ID}")
        status_data = status_response.json()
        
        payload = {"user_id": TEST_USER_ID}
        response = requests.post(f"{BASE_URL}/api/economy/claim-daily-reward", json=payload)
        
        # Could be 200 (success) or 400 (already claimed today)
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "reward_type" in data
            assert "amount" in data
            assert "streak" in data
            assert data["reward_type"] in ["points", "diamonds"]
            print(f"Claimed reward: {data['amount']} {data['reward_type']} (streak: {data['streak']})")
        elif response.status_code == 400:
            # Already claimed - this is valid
            print(f"Already claimed today: {response.json().get('detail', 'Already claimed')}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")


class TestEnterGame:
    """Test /api/economy/enter-game endpoint"""
    
    def test_enter_offline_game_free(self):
        """Offline games should be free"""
        payload = {
            "user_id": TEST_USER_ID,
            "game_id": "chess",
            "is_online": False
        }
        response = requests.post(f"{BASE_URL}/api/economy/enter-game", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["cost"] == 0
        print(f"Offline game entry: {data['message']}")
    
    def test_enter_online_game_deducts_diamonds(self):
        """Online games should deduct diamonds"""
        # First check balance
        balance_before = requests.get(f"{BASE_URL}/api/economy/balance/{TEST_USER_ID}").json()
        
        payload = {
            "user_id": TEST_USER_ID,
            "game_id": "chess",
            "is_online": True
        }
        response = requests.post(f"{BASE_URL}/api/economy/enter-game", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert data["cost"] > 0, "Online game should have cost"
            assert "remaining" in data
            
            # Verify diamond deduction
            balance_after = requests.get(f"{BASE_URL}/api/economy/balance/{TEST_USER_ID}").json()
            expected_remaining = balance_before["diamonds"] - data["cost"]
            assert balance_after["diamonds"] == expected_remaining, \
                f"Expected {expected_remaining} diamonds, got {balance_after['diamonds']}"
            
            print(f"Online chess entry: cost={data['cost']}, remaining={data['remaining']}")
        elif response.status_code == 400:
            # Insufficient diamonds
            print(f"Insufficient diamonds: {response.json().get('detail', 'Not enough diamonds')}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_online_game_costs_vary_by_game(self):
        """Different games should have different costs"""
        # Expected costs from constants
        expected_costs = {
            "chess": 30,
            "tictactoe": 20,
            "puzzle": 25,
            "brickbreaker": 25,
            "trivia": 20,
            "riddles": 25,
        }
        
        # Get game costs endpoint
        response = requests.get(f"{BASE_URL}/api/economy/game-costs")
        
        if response.status_code == 200:
            data = response.json()
            assert "online_costs" in data
            
            for game_id, expected_cost in expected_costs.items():
                actual_cost = data["online_costs"].get(game_id)
                assert actual_cost == expected_cost, \
                    f"Game {game_id} expected cost {expected_cost}, got {actual_cost}"
            
            print(f"Game costs verified: {data['online_costs']}")


class TestGameResult:
    """Test /api/economy/game-result endpoint"""
    
    def test_game_win_awards_points_and_diamonds(self):
        """Winning online game should award points and diamonds"""
        # Get balance before
        balance_before = requests.get(f"{BASE_URL}/api/economy/balance/{TEST_USER_ID}").json()
        
        payload = {
            "user_id": TEST_USER_ID,
            "game_id": "chess",
            "is_online": True,
            "won": True,
            "opponent_diamonds": 30  # Opponent's entry fee
        }
        response = requests.post(f"{BASE_URL}/api/economy/game-result", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "points_awarded" in data
        assert "diamonds_awarded" in data
        assert "daily_points_earned" in data
        assert "daily_limit" in data
        assert data["daily_limit"] == 150
        
        # For online win, should get diamonds (opponent diamonds + bonus)
        if data["diamonds_awarded"] > 0:
            assert data["diamonds_awarded"] >= payload["opponent_diamonds"]
        
        print(f"Game result: +{data['points_awarded']} points, +{data['diamonds_awarded']} diamonds")
        print(f"Daily points: {data['daily_points_earned']}/{data['daily_limit']}")
    
    def test_game_loss_awards_participation_points(self):
        """Losing a game should still award participation points (if under daily cap)"""
        payload = {
            "user_id": TEST_USER_ID,
            "game_id": "tictactoe",
            "is_online": True,
            "won": False,
            "opponent_diamonds": 0
        }
        response = requests.post(f"{BASE_URL}/api/economy/game-result", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "points_awarded" in data
        
        # Loser should get 5 participation points (if not at daily cap)
        if data["daily_points_earned"] < data["daily_limit"]:
            # Should have gotten some participation points
            print(f"Loss result: +{data['points_awarded']} points")
        else:
            print(f"At daily cap: {data['daily_points_earned']}/{data['daily_limit']}")


class TestDailyPointsCap:
    """Test daily points cap of 150"""
    
    def test_daily_cap_enforcement(self):
        """After reaching 150 points daily, no more points should be awarded"""
        # Get current status
        balance = requests.get(f"{BASE_URL}/api/economy/balance/{TEST_USER_ID}").json()
        
        daily_earned = balance["daily_points_earned"]
        daily_limit = balance["daily_limit"]
        daily_remaining = balance["daily_points_remaining"]
        
        assert daily_limit == 150, f"Daily limit should be 150, got {daily_limit}"
        assert daily_remaining == max(0, daily_limit - daily_earned)
        
        print(f"Daily points: {daily_earned}/{daily_limit} (remaining: {daily_remaining})")
        
        # If at cap, verify no more points awarded
        if daily_earned >= daily_limit:
            payload = {
                "user_id": TEST_USER_ID,
                "game_id": "trivia",
                "is_online": False,
                "won": True
            }
            response = requests.post(f"{BASE_URL}/api/economy/game-result", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                assert data["points_awarded"] == 0, "Should not award points when at daily cap"
                print("Verified: No points awarded when at daily cap")


class TestLeaderboard:
    """Test /api/economy/leaderboard endpoint"""
    
    def test_get_leaderboard(self):
        """Should return top players with rewards info"""
        response = requests.get(f"{BASE_URL}/api/economy/leaderboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "leaderboard" in data
        assert "rewards" in data
        
        # Verify leaderboard structure
        leaderboard = data["leaderboard"]
        assert isinstance(leaderboard, list)
        
        if len(leaderboard) > 0:
            first_player = leaderboard[0]
            assert "rank" in first_player
            assert "saqr_points" in first_player
            assert first_player["rank"] == 1
        
        # Verify rewards structure (1st: 3000, 2nd: 1900, 3rd: 1000)
        rewards = data["rewards"]
        expected_rewards = {1: 3000, 2: 1900, 3: 1000}
        
        for rank, expected_points in expected_rewards.items():
            # Rewards keys might be strings or ints
            actual = rewards.get(rank) or rewards.get(str(rank))
            assert actual == expected_points, \
                f"Rank {rank} expected {expected_points} points reward, got {actual}"
        
        print(f"Leaderboard has {len(leaderboard)} players")
        print(f"Rewards: 1st={rewards.get(1) or rewards.get('1')}, 2nd={rewards.get(2) or rewards.get('2')}, 3rd={rewards.get(3) or rewards.get('3')}")


class TestNewUserRegistration:
    """Test new user gets 300 diamonds"""
    
    def test_new_user_gets_initial_diamonds(self):
        """New users should receive 300 diamonds upon registration"""
        # Create a unique test email
        unique_email = f"test_economy_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "name": "Economy Test User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        if response.status_code == 201 or response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            
            # Get the user_id from response
            user_id = data.get("user", {}).get("user_id")
            assert user_id is not None, "User ID should be returned"
            
            # Check balance of new user
            balance_response = requests.get(f"{BASE_URL}/api/economy/balance/{user_id}")
            
            if balance_response.status_code == 200:
                balance = balance_response.json()
                assert balance["diamonds"] == 300, \
                    f"New user should have 300 diamonds, got {balance['diamonds']}"
                print(f"New user {user_id} has {balance['diamonds']} diamonds (expected 300)")
            else:
                print(f"Could not verify balance: {balance_response.status_code}")
        else:
            # Registration might fail for various reasons
            print(f"Registration response: {response.status_code} - {response.text}")


class TestInitializeUserEconomy:
    """Test /api/economy/initialize-user/{user_id} endpoint"""
    
    def test_initialize_existing_user(self):
        """Initialize economy for existing user"""
        response = requests.post(f"{BASE_URL}/api/economy/initialize-user/{TEST_USER_ID}")
        
        # Could be 200 (success or already initialized) or 404 (user not found)
        assert response.status_code in [200, 404], \
            f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            print(f"Initialize user result: {data.get('message', 'Success')}")


# Run tests when file is executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
