"""
Social APIs Test Suite - Testing Friends, Private Messages, Game Invites, Reports
نظام اختبار APIs الاجتماعية - الأصدقاء، الرسائل الخاصة، دعوات الألعاب، البلاغات
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user data
TEST_USER_1 = {
    "id": f"TEST_user1_{uuid.uuid4().hex[:8]}",
    "name": "مستخدم اختبار 1"
}

TEST_USER_2 = {
    "id": f"TEST_user2_{uuid.uuid4().hex[:8]}",
    "name": "مستخدم اختبار 2"
}

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealthCheck:
    """Health check - verify backend is running"""
    
    def test_api_health(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print("✅ API Health: PASS - Backend is healthy and database connected")


class TestUserSearch:
    """البحث عن مستخدمين - User Search API"""
    
    def test_search_users_basic(self, api_client):
        """GET /api/social/users/search?query=test"""
        response = api_client.get(f"{BASE_URL}/api/social/users/search?query=test")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "users" in data
        assert "count" in data
        assert isinstance(data["users"], list)
        assert isinstance(data["count"], int)
        print(f"✅ User Search: PASS - Found {data['count']} users")
    
    def test_search_users_with_limit(self, api_client):
        """GET /api/social/users/search?query=a&limit=5"""
        response = api_client.get(f"{BASE_URL}/api/social/users/search?query=a&limit=5")
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert len(data["users"]) <= 5
        print(f"✅ User Search with limit: PASS - Results limited correctly")
    
    def test_search_users_empty_query(self, api_client):
        """Test search with empty query should still return valid response"""
        response = api_client.get(f"{BASE_URL}/api/social/users/search?query=")
        # Should return 200 or 422 (validation error)
        assert response.status_code in [200, 422]
        print(f"✅ User Search empty query: PASS - Handled gracefully ({response.status_code})")


class TestFriendsSystem:
    """نظام الأصدقاء - Friends System APIs"""
    
    @pytest.fixture(scope="class")
    def friend_request_id(self, api_client):
        """Create a friend request for testing"""
        payload = {
            "from_user_id": TEST_USER_1["id"],
            "to_user_id": TEST_USER_2["id"],
            "from_user_name": TEST_USER_1["name"]
        }
        response = api_client.post(f"{BASE_URL}/api/social/friends/request", json=payload)
        if response.status_code == 200:
            data = response.json()
            return data.get("request_id")
        return None
    
    def test_send_friend_request(self, api_client):
        """POST /api/social/friends/request"""
        unique_id_1 = f"TEST_friend_req_{uuid.uuid4().hex[:8]}"
        unique_id_2 = f"TEST_friend_req_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "from_user_id": unique_id_1,
            "to_user_id": unique_id_2,
            "from_user_name": "مستخدم اختبار الصداقة"
        }
        response = api_client.post(f"{BASE_URL}/api/social/friends/request", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "request_id" in data
        assert "message" in data
        print(f"✅ Send Friend Request: PASS - Request ID: {data['request_id'][:8]}...")
        
        return data["request_id"]
    
    def test_send_duplicate_friend_request(self, api_client, friend_request_id):
        """Test sending duplicate friend request should fail"""
        if not friend_request_id:
            pytest.skip("No friend request created")
        
        payload = {
            "from_user_id": TEST_USER_1["id"],
            "to_user_id": TEST_USER_2["id"],
            "from_user_name": TEST_USER_1["name"]
        }
        response = api_client.post(f"{BASE_URL}/api/social/friends/request", json=payload)
        assert response.status_code == 400
        print("✅ Duplicate Friend Request: PASS - Correctly rejected")
    
    def test_accept_friend_request(self, api_client):
        """POST /api/social/friends/accept"""
        # First create a fresh request
        unique_id_1 = f"TEST_accept_{uuid.uuid4().hex[:8]}"
        unique_id_2 = f"TEST_accept_{uuid.uuid4().hex[:8]}"
        
        create_payload = {
            "from_user_id": unique_id_1,
            "to_user_id": unique_id_2,
            "from_user_name": "مستخدم قبول الصداقة"
        }
        create_response = api_client.post(f"{BASE_URL}/api/social/friends/request", json=create_payload)
        assert create_response.status_code == 200
        request_id = create_response.json()["request_id"]
        
        # Accept the request
        accept_payload = {
            "request_id": request_id,
            "user_id": unique_id_2
        }
        accept_response = api_client.post(f"{BASE_URL}/api/social/friends/accept", json=accept_payload)
        assert accept_response.status_code == 200
        
        data = accept_response.json()
        assert data["success"] == True
        print("✅ Accept Friend Request: PASS - Friendship created")
    
    def test_accept_invalid_request(self, api_client):
        """Test accepting non-existent request should fail"""
        accept_payload = {
            "request_id": "invalid_request_id_12345",
            "user_id": "some_user"
        }
        response = api_client.post(f"{BASE_URL}/api/social/friends/accept", json=accept_payload)
        assert response.status_code == 404
        print("✅ Accept Invalid Request: PASS - Correctly returned 404")
    
    def test_get_friends_list(self, api_client):
        """GET /api/social/friends/list/{user_id}"""
        test_user_id = f"TEST_list_{uuid.uuid4().hex[:8]}"
        response = api_client.get(f"{BASE_URL}/api/social/friends/list/{test_user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "friends" in data
        assert "count" in data
        assert isinstance(data["friends"], list)
        print(f"✅ Get Friends List: PASS - Found {data['count']} friends")
    
    def test_get_friend_requests(self, api_client):
        """GET /api/social/friends/requests/{user_id}"""
        test_user_id = f"TEST_requests_{uuid.uuid4().hex[:8]}"
        response = api_client.get(f"{BASE_URL}/api/social/friends/requests/{test_user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "incoming" in data
        assert "outgoing" in data
        print("✅ Get Friend Requests: PASS - Incoming and outgoing requests returned")


class TestPrivateMessages:
    """الرسائل الخاصة - Private Messages APIs"""
    
    @pytest.fixture(scope="class")
    def friends_pair(self, api_client):
        """Create two friends for message testing"""
        user1 = f"TEST_msg_user1_{uuid.uuid4().hex[:8]}"
        user2 = f"TEST_msg_user2_{uuid.uuid4().hex[:8]}"
        
        # Create friend request
        request_response = api_client.post(f"{BASE_URL}/api/social/friends/request", json={
            "from_user_id": user1,
            "to_user_id": user2,
            "from_user_name": "مرسل الرسائل"
        })
        
        if request_response.status_code != 200:
            return None
        
        request_id = request_response.json()["request_id"]
        
        # Accept friend request
        accept_response = api_client.post(f"{BASE_URL}/api/social/friends/accept", json={
            "request_id": request_id,
            "user_id": user2
        })
        
        if accept_response.status_code != 200:
            return None
        
        return {"user1": user1, "user2": user2}
    
    def test_send_private_message_friends(self, api_client, friends_pair):
        """POST /api/social/messages/send - between friends"""
        if not friends_pair:
            pytest.skip("Could not create friends pair")
        
        payload = {
            "from_user_id": friends_pair["user1"],
            "to_user_id": friends_pair["user2"],
            "from_user_name": "مرسل الرسائل",
            "message": "مرحباً! هذه رسالة اختبارية 🎮"
        }
        response = api_client.post(f"{BASE_URL}/api/social/messages/send", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "message_id" in data
        print(f"✅ Send Private Message: PASS - Message ID: {data['message_id'][:8]}...")
    
    def test_send_message_non_friends(self, api_client):
        """POST /api/social/messages/send - should fail for non-friends"""
        payload = {
            "from_user_id": f"TEST_stranger1_{uuid.uuid4().hex[:8]}",
            "to_user_id": f"TEST_stranger2_{uuid.uuid4().hex[:8]}",
            "from_user_name": "غريب",
            "message": "لا يجب أن تصل هذه الرسالة"
        }
        response = api_client.post(f"{BASE_URL}/api/social/messages/send", json=payload)
        assert response.status_code == 403
        print("✅ Send Message (Non-Friends): PASS - Correctly rejected with 403")
    
    def test_get_conversation(self, api_client, friends_pair):
        """GET /api/social/messages/conversation/{user_id}/{friend_id}"""
        if not friends_pair:
            pytest.skip("Could not create friends pair")
        
        # First send a message
        api_client.post(f"{BASE_URL}/api/social/messages/send", json={
            "from_user_id": friends_pair["user1"],
            "to_user_id": friends_pair["user2"],
            "from_user_name": "مرسل",
            "message": "رسالة للمحادثة"
        })
        
        # Get conversation
        response = api_client.get(
            f"{BASE_URL}/api/social/messages/conversation/{friends_pair['user1']}/{friends_pair['user2']}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "messages" in data
        assert "count" in data
        assert isinstance(data["messages"], list)
        print(f"✅ Get Conversation: PASS - Found {data['count']} messages")
    
    def test_get_inbox(self, api_client):
        """GET /api/social/messages/inbox/{user_id}"""
        test_user_id = f"TEST_inbox_{uuid.uuid4().hex[:8]}"
        response = api_client.get(f"{BASE_URL}/api/social/messages/inbox/{test_user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "inbox" in data
        assert "total_unread" in data
        print(f"✅ Get Inbox: PASS - Total unread: {data['total_unread']}")


class TestGameInvites:
    """دعوات الألعاب - Game Invites APIs"""
    
    @pytest.fixture(scope="class")
    def friends_for_game(self, api_client):
        """Create friends for game invite testing"""
        user1 = f"TEST_game_user1_{uuid.uuid4().hex[:8]}"
        user2 = f"TEST_game_user2_{uuid.uuid4().hex[:8]}"
        
        # Create and accept friendship
        request_response = api_client.post(f"{BASE_URL}/api/social/friends/request", json={
            "from_user_id": user1,
            "to_user_id": user2,
            "from_user_name": "لاعب الألعاب"
        })
        
        if request_response.status_code != 200:
            return None
        
        request_id = request_response.json()["request_id"]
        
        accept_response = api_client.post(f"{BASE_URL}/api/social/friends/accept", json={
            "request_id": request_id,
            "user_id": user2
        })
        
        if accept_response.status_code != 200:
            return None
        
        return {"user1": user1, "user2": user2}
    
    def test_send_friend_game_invite(self, api_client, friends_for_game):
        """POST /api/social/game/invite - invite friend (free)"""
        if not friends_for_game:
            pytest.skip("Could not create friends for game")
        
        payload = {
            "from_user_id": friends_for_game["user1"],
            "to_user_id": friends_for_game["user2"],
            "from_user_name": "لاعب محترف",
            "game_id": "chess",
            "game_name": "الشطرنج",
            "challenge_amount": 0,
            "invite_type": "friend"
        }
        response = api_client.post(f"{BASE_URL}/api/social/game/invite", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "invite_id" in data
        assert data["cost"] == 0  # Friend invite is free
        print(f"✅ Send Friend Game Invite: PASS - Invite ID: {data['invite_id'][:8]}... (Cost: {data['cost']})")
    
    def test_send_game_invite_non_friends(self, api_client):
        """POST /api/social/game/invite - should fail for non-friends"""
        payload = {
            "from_user_id": f"TEST_stranger_game1_{uuid.uuid4().hex[:8]}",
            "to_user_id": f"TEST_stranger_game2_{uuid.uuid4().hex[:8]}",
            "from_user_name": "غريب",
            "game_id": "chess",
            "game_name": "الشطرنج",
            "challenge_amount": 0,
            "invite_type": "friend"
        }
        response = api_client.post(f"{BASE_URL}/api/social/game/invite", json=payload)
        assert response.status_code == 403
        print("✅ Game Invite (Non-Friends): PASS - Correctly rejected with 403")
    
    def test_send_public_game_invite(self, api_client):
        """POST /api/social/game/invite - public invite (costs diamonds)"""
        # Create a test user with diamonds first would be needed for full test
        # For now, test that the endpoint exists and validates properly
        payload = {
            "from_user_id": f"TEST_public_game_{uuid.uuid4().hex[:8]}",
            "to_user_id": None,
            "from_user_name": "لاعب عام",
            "game_id": "trivia",
            "game_name": "التريفيا",
            "challenge_amount": 0,
            "invite_type": "public"
        }
        response = api_client.post(f"{BASE_URL}/api/social/game/invite", json=payload)
        # Should fail with 404 (user not found) or 400 (insufficient diamonds)
        assert response.status_code in [400, 404]
        print(f"✅ Public Game Invite (No User): PASS - Correctly handled ({response.status_code})")


class TestReportSystem:
    """نظام البلاغات - Report System APIs"""
    
    def test_submit_report(self, api_client):
        """POST /api/social/report"""
        payload = {
            "reporter_id": f"TEST_reporter_{uuid.uuid4().hex[:8]}",
            "reported_user_id": f"TEST_reported_{uuid.uuid4().hex[:8]}",
            "report_type": "spam",
            "content_type": "chat_message",
            "content_id": f"msg_{uuid.uuid4().hex[:8]}",
            "reason": "رسائل مزعجة متكررة"
        }
        response = api_client.post(f"{BASE_URL}/api/social/report", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "report_id" in data
        print(f"✅ Submit Report: PASS - Report ID: {data['report_id'][:8]}...")
    
    def test_submit_harassment_report(self, api_client):
        """POST /api/social/report - harassment type"""
        payload = {
            "reporter_id": f"TEST_harassment_reporter_{uuid.uuid4().hex[:8]}",
            "reported_user_id": f"TEST_harassment_user_{uuid.uuid4().hex[:8]}",
            "report_type": "harassment",
            "content_type": "private_message",
            "content_id": None,
            "reason": "رسائل مسيئة"
        }
        response = api_client.post(f"{BASE_URL}/api/social/report", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print("✅ Submit Harassment Report: PASS")
    
    def test_get_user_reports(self, api_client):
        """GET /api/social/reports/user/{user_id}"""
        test_user_id = f"TEST_reports_user_{uuid.uuid4().hex[:8]}"
        response = api_client.get(f"{BASE_URL}/api/social/reports/user/{test_user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "reports" in data
        assert "count" in data
        print(f"✅ Get User Reports: PASS - Found {data['count']} reports")


class TestNotifications:
    """الإشعارات - Notifications APIs"""
    
    def test_get_notifications(self, api_client):
        """GET /api/social/notifications/{user_id}"""
        test_user_id = f"TEST_notif_{uuid.uuid4().hex[:8]}"
        response = api_client.get(f"{BASE_URL}/api/social/notifications/{test_user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"✅ Get Notifications: PASS - Unread: {data['unread_count']}")
    
    def test_mark_notifications_read(self, api_client):
        """POST /api/social/notifications/read/{user_id}"""
        test_user_id = f"TEST_mark_read_{uuid.uuid4().hex[:8]}"
        response = api_client.post(f"{BASE_URL}/api/social/notifications/read/{test_user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print("✅ Mark Notifications Read: PASS")


class TestEdgeCases:
    """حالات حدية - Edge Cases"""
    
    def test_friend_request_missing_fields(self, api_client):
        """Test friend request with missing required fields"""
        payload = {
            "from_user_id": "test_user"
            # Missing to_user_id and from_user_name
        }
        response = api_client.post(f"{BASE_URL}/api/social/friends/request", json=payload)
        assert response.status_code == 422  # Validation error
        print("✅ Missing Fields Validation: PASS - Correctly rejected with 422")
    
    def test_message_with_empty_content(self, api_client):
        """Test sending empty message"""
        payload = {
            "from_user_id": f"TEST_empty_{uuid.uuid4().hex[:8]}",
            "to_user_id": f"TEST_empty2_{uuid.uuid4().hex[:8]}",
            "from_user_name": "مستخدم",
            "message": ""  # Empty message
        }
        response = api_client.post(f"{BASE_URL}/api/social/messages/send", json=payload)
        # Should either fail validation or friendship check
        assert response.status_code in [403, 422]
        print(f"✅ Empty Message: PASS - Handled gracefully ({response.status_code})")
    
    def test_report_with_invalid_type(self, api_client):
        """Test report with arbitrary report type"""
        payload = {
            "reporter_id": f"TEST_invalid_type_{uuid.uuid4().hex[:8]}",
            "reported_user_id": f"TEST_reported_{uuid.uuid4().hex[:8]}",
            "report_type": "custom_type",  # Not in predefined list but model allows
            "content_type": "user_profile",
            "reason": "سبب مخصص"
        }
        response = api_client.post(f"{BASE_URL}/api/social/report", json=payload)
        # Model allows any string, so should succeed
        assert response.status_code == 200
        print("✅ Custom Report Type: PASS - Accepted custom type")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
