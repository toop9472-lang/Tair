"""
AI Features Tests for Saqr App
Tests for Claude AI integration, AI Floating Button, and Admin AI Assistant
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestClaudeAIPublicEndpoints:
    """Test public Claude AI endpoints (no auth required)"""
    
    def test_public_status_endpoint(self):
        """Test /api/claude-ai/public/status returns correct data"""
        response = requests.get(f"{BASE_URL}/api/claude-ai/public/status")
        assert response.status_code == 200
        
        data = response.json()
        assert 'available' in data
        assert 'available_for_all' in data
        assert isinstance(data['available'], bool)
        assert isinstance(data['available_for_all'], bool)
        print(f"Public status: available={data['available']}, available_for_all={data['available_for_all']}")


class TestClaudeAIAuthenticatedEndpoints:
    """Test authenticated Claude AI endpoints"""
    
    @pytest.fixture
    def user_token(self):
        """Get user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": "test@saqr.com",
            "password": "test123456"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("User authentication failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": "sky-321@hotmail.com",
            "password": "Wsxzaq123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_status_endpoint_with_auth(self, user_token):
        """Test /api/claude-ai/status with authentication"""
        response = requests.get(
            f"{BASE_URL}/api/claude-ai/status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert 'enabled' in data
        assert 'enabled_for_all' in data
        assert 'configured' in data
        assert 'model' in data
        assert 'status' in data
        print(f"AI Status: enabled={data['enabled']}, model={data['model']}, status={data['status']}")
    
    def test_chat_endpoint_with_user_token(self, user_token):
        """Test /api/claude-ai/chat with user token"""
        response = requests.post(
            f"{BASE_URL}/api/claude-ai/chat",
            headers={
                "Authorization": f"Bearer {user_token}",
                "Content-Type": "application/json"
            },
            json={
                "messages": [{"role": "user", "content": "مرحبا"}]
            }
        )
        
        # Should succeed if AI is enabled for all users
        if response.status_code == 200:
            data = response.json()
            assert data.get('success') == True
            assert 'response' in data
            assert 'model' in data
            print(f"Chat response: {data['response'][:100]}...")
        elif response.status_code == 403:
            # AI not enabled for all users
            print("AI chat not available for regular users (403)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_generate_response_endpoint(self, admin_token):
        """Test /api/claude-ai/generate-response with admin token"""
        response = requests.post(
            f"{BASE_URL}/api/claude-ai/generate-response",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "prompt": "ما هي أفضل طريقة لزيادة تفاعل المستخدمين؟",
                "max_tokens": 500,
                "temperature": 0.7
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('success') == True
            assert 'response' in data
            print(f"Generate response: {data['response'][:100]}...")
        elif response.status_code == 403:
            print("AI not enabled (403)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_chat_without_auth(self):
        """Test /api/claude-ai/chat without authentication returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/claude-ai/chat",
            headers={"Content-Type": "application/json"},
            json={
                "messages": [{"role": "user", "content": "test"}]
            }
        )
        assert response.status_code in [401, 403]
        print(f"Chat without auth: {response.status_code}")


class TestAdminDashboardStats:
    """Test admin dashboard stats endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": "sky-321@hotmail.com",
            "password": "Wsxzaq123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_dashboard_stats(self, admin_token):
        """Test /api/settings/dashboard/stats for AI assistant context"""
        response = requests.get(
            f"{BASE_URL}/api/settings/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # This endpoint may or may not exist
        if response.status_code == 200:
            data = response.json()
            print(f"Dashboard stats: {data}")
        else:
            print(f"Dashboard stats endpoint returned: {response.status_code}")


class TestAdsEndpoints:
    """Test ads endpoints for AdViewer"""
    
    def test_get_ads(self):
        """Test /api/ads returns ads list"""
        response = requests.get(f"{BASE_URL}/api/ads")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} ads")
        
        if len(data) > 0:
            ad = data[0]
            # Check ad structure
            assert 'id' in ad or '_id' in ad
            assert 'title' in ad
            print(f"First ad: {ad.get('title')}")


class TestActivityEndpoints:
    """Test activity endpoints for AdViewer"""
    
    @pytest.fixture
    def user_token(self):
        """Get user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/signin", json={
            "email": "test@saqr.com",
            "password": "test123456"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("User authentication failed")
    
    def test_heartbeat_endpoint(self, user_token):
        """Test /api/activity/heartbeat"""
        response = requests.post(
            f"{BASE_URL}/api/activity/heartbeat",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # May return 200 or 403 depending on implementation
        assert response.status_code in [200, 403]
        print(f"Heartbeat response: {response.status_code}")
    
    def test_ad_viewers_endpoint(self):
        """Test /api/activity/ad-viewers/{ad_id}"""
        # First get an ad ID
        ads_response = requests.get(f"{BASE_URL}/api/ads")
        if ads_response.status_code != 200 or len(ads_response.json()) == 0:
            pytest.skip("No ads available")
        
        ad_id = ads_response.json()[0].get('id') or ads_response.json()[0].get('_id')
        
        response = requests.get(f"{BASE_URL}/api/activity/ad-viewers/{ad_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert 'viewers' in data or 'total_views' in data
        print(f"Ad viewers data: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
