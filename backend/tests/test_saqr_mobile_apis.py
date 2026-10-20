"""
Test Suite for Saqr Mobile App Backend APIs - Iteration 35
Tests: Health, Games Leaderboard, Economy Balance, Chat Servers, Auth Login
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAPI:
    """Health check endpoint tests"""
    
    def test_health_endpoint_returns_200(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert data["service"] == "saqr-api"
        print("PASS: /api/health returns healthy status with connected database")


class TestGamesLeaderboard:
    """Games leaderboard API tests"""
    
    def test_leaderboard_returns_200(self):
        """Test /api/games/leaderboard returns valid response"""
        response = requests.get(f"{BASE_URL}/api/games/leaderboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "leaderboard" in data, "Response should contain 'leaderboard' key"
        assert isinstance(data["leaderboard"], list), "Leaderboard should be a list"
        print(f"PASS: /api/games/leaderboard returns {len(data['leaderboard'])} entries")
    
    def test_leaderboard_entry_structure(self):
        """Test leaderboard entries have correct structure"""
        response = requests.get(f"{BASE_URL}/api/games/leaderboard")
        data = response.json()
        
        if len(data["leaderboard"]) > 0:
            entry = data["leaderboard"][0]
            assert "rank" in entry, "Entry should have 'rank'"
            assert "name" in entry, "Entry should have 'name'"
            assert "points" in entry, "Entry should have 'points'"
            assert "gamesPlayed" in entry, "Entry should have 'gamesPlayed'"
            assert isinstance(entry["rank"], int), "Rank should be integer"
            assert isinstance(entry["points"], int), "Points should be integer"
            print(f"PASS: Leaderboard entry structure is correct - rank={entry['rank']}, name={entry['name']}, points={entry['points']}")
    
    def test_leaderboard_with_user_id_param(self):
        """Test leaderboard with user_id parameter"""
        response = requests.get(f"{BASE_URL}/api/games/leaderboard?user_id=test-user")
        assert response.status_code == 200
        
        data = response.json()
        assert "userStats" in data, "Response should contain userStats when user_id provided"
        print("PASS: Leaderboard with user_id parameter returns userStats")


class TestEconomyBalance:
    """Economy balance API tests"""
    
    def test_balance_nonexistent_user_returns_404(self):
        """Test /api/economy/balance returns 404 for nonexistent user"""
        fake_user_id = f"nonexistent-{uuid.uuid4()}"
        response = requests.get(f"{BASE_URL}/api/economy/balance/{fake_user_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: /api/economy/balance returns 404 for nonexistent user")
    
    def test_balance_response_structure(self):
        """Test balance endpoint returns correct structure for existing user"""
        # First create a user via login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": f"test_balance_{uuid.uuid4().hex[:8]}@test.com",
                "provider": "google",
                "provider_id": f"google-{uuid.uuid4()}",
                "name": "Balance Test User"
            }
        )
        assert login_response.status_code == 200, "Failed to create test user"
        
        user_id = login_response.json()["user"]["id"]
        
        # Now test balance
        response = requests.get(f"{BASE_URL}/api/economy/balance/{user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        expected_fields = ["saqr_points", "diamonds", "daily_points_earned", "daily_points_remaining", "daily_limit"]
        for field in expected_fields:
            assert field in data, f"Balance response should contain '{field}'"
        
        print(f"PASS: Balance endpoint returns correct structure - diamonds={data['diamonds']}, saqr_points={data['saqr_points']}")


class TestChatServers:
    """Chat servers API tests"""
    
    def test_chat_servers_returns_200(self):
        """Test /api/economy/chat/servers returns list of servers"""
        response = requests.get(f"{BASE_URL}/api/economy/chat/servers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "servers" in data, "Response should contain 'servers'"
        assert isinstance(data["servers"], list), "Servers should be a list"
        assert len(data["servers"]) >= 3, "Should have at least 3 servers"
        print(f"PASS: /api/economy/chat/servers returns {len(data['servers'])} servers")
    
    def test_chat_server_structure(self):
        """Test chat server entries have correct structure"""
        response = requests.get(f"{BASE_URL}/api/economy/chat/servers")
        data = response.json()
        
        for server in data["servers"]:
            assert "id" in server, "Server should have 'id'"
            assert "name" in server, "Server should have 'name'"
            assert "language" in server, "Server should have 'language'"
            assert "description" in server, "Server should have 'description'"
        
        # Check for expected servers
        server_ids = [s["id"] for s in data["servers"]]
        assert "arabic" in server_ids, "Arabic server should exist"
        assert "english" in server_ids, "English server should exist"
        assert "global" in server_ids, "Global server should exist"
        print("PASS: Chat servers have correct structure with arabic, english, global servers")
    
    def test_chat_message_cost(self):
        """Test chat message cost is included"""
        response = requests.get(f"{BASE_URL}/api/economy/chat/servers")
        data = response.json()
        
        assert "message_cost" in data, "Response should include message_cost"
        assert data["message_cost"] == 5, "Message cost should be 5 diamonds"
        print(f"PASS: Chat message cost = {data['message_cost']} diamonds")


class TestAuthLogin:
    """Authentication login API tests"""
    
    def test_oauth_login_creates_user(self):
        """Test /api/auth/login creates new user for OAuth"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": f"test_oauth_{unique_id}@test.com",
                "provider": "google",
                "provider_id": f"google-{unique_id}",
                "name": "Test OAuth User"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "token" in data, "Response should contain 'token'"
        assert "user" in data, "Response should contain 'user'"
        assert "id" in data["user"], "User should have 'id'"
        assert "email" in data["user"], "User should have 'email'"
        print(f"PASS: OAuth login creates user successfully - id={data['user']['id'][:8]}...")
    
    def test_oauth_login_returns_existing_user(self):
        """Test /api/auth/login returns existing user"""
        unique_id = uuid.uuid4().hex[:8]
        user_data = {
            "email": f"test_existing_{unique_id}@test.com",
            "provider": "google",
            "provider_id": f"google-existing-{unique_id}",
            "name": "Existing User"
        }
        
        # First login
        response1 = requests.post(f"{BASE_URL}/api/auth/login", json=user_data)
        user_id_1 = response1.json()["user"]["id"]
        
        # Second login - same user
        response2 = requests.post(f"{BASE_URL}/api/auth/login", json=user_data)
        user_id_2 = response2.json()["user"]["id"]
        
        assert user_id_1 == user_id_2, "Same OAuth user should return same ID"
        print(f"PASS: Existing OAuth user returns same ID on re-login")
    
    def test_email_signin_wrong_credentials(self):
        """Test /api/auth/signin rejects wrong credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/signin",
            json={
                "email": "nonexistent@test.com",
                "password": "wrongpassword123"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Email signin rejects wrong credentials with 401")


class TestGameCosts:
    """Game costs API tests"""
    
    def test_game_costs_returns_200(self):
        """Test /api/economy/game-costs returns valid data"""
        response = requests.get(f"{BASE_URL}/api/economy/game-costs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "online_costs" in data, "Response should contain 'online_costs'"
        assert "winner_bonuses" in data, "Response should contain 'winner_bonuses'"
        print(f"PASS: /api/economy/game-costs returns costs for {len(data['online_costs'])} games")
    
    def test_game_costs_structure(self):
        """Test game costs have correct values"""
        response = requests.get(f"{BASE_URL}/api/economy/game-costs")
        data = response.json()
        
        expected_games = ["chess", "tictactoe", "puzzle", "trivia"]
        for game in expected_games:
            assert game in data["online_costs"], f"'{game}' should be in online_costs"
            assert game in data["winner_bonuses"], f"'{game}' should be in winner_bonuses"
        
        # Verify specific costs
        assert data["online_costs"]["chess"] == 30, "Chess cost should be 30"
        assert data["online_costs"]["tictactoe"] == 20, "TicTacToe cost should be 20"
        print("PASS: Game costs structure verified - chess=30, tictactoe=20")


class TestEconomyLeaderboard:
    """Economy leaderboard API tests"""
    
    def test_economy_leaderboard_returns_200(self):
        """Test /api/economy/leaderboard returns valid response"""
        response = requests.get(f"{BASE_URL}/api/economy/leaderboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "leaderboard" in data, "Response should contain 'leaderboard'"
        assert "rewards" in data, "Response should contain 'rewards'"
        print(f"PASS: /api/economy/leaderboard returns valid data")


class TestDiamondPackages:
    """Diamond packages API tests"""
    
    def test_packages_returns_200(self):
        """Test /api/economy/packages returns diamond packages"""
        response = requests.get(f"{BASE_URL}/api/economy/packages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "packages" in data, "Response should contain 'packages'"
        assert "currency" in data, "Response should contain 'currency'"
        assert data["currency"] == "SAR", "Currency should be SAR (Saudi Riyal)"
        assert data["currency_symbol"] == "ر.س", "Currency symbol should be ر.س"
        print(f"PASS: /api/economy/packages returns {len(data['packages'])} packages in SAR")


class TestOnlinePlayers:
    """Online players API tests"""
    
    def test_online_players_returns_200(self):
        """Test /api/game/online-players returns player counts"""
        response = requests.get(f"{BASE_URL}/api/game/online-players")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "waiting" in data, "Response should contain 'waiting'"
        assert "playing" in data, "Response should contain 'playing'"
        assert "total" in data, "Response should contain 'total'"
        print(f"PASS: /api/game/online-players - waiting={data['waiting']}, playing={data['playing']}, total={data['total']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
