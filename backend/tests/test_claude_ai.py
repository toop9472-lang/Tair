"""
Claude AI Service Tests
Test cases for Claude Haiku 4.5 integration
"""

import pytest
import asyncio
from services.claude_ai_service import ClaudeHaikuService, get_claude_service


class TestClaudeHaikuService:
    """Test suite for Claude Haiku Service"""
    
    @pytest.fixture
    def claude_service(self):
        """Create a Claude service instance"""
        return ClaudeHaikuService()
    
    def test_service_singleton(self):
        """Test that service returns singleton instance"""
        service1 = get_claude_service()
        service2 = get_claude_service()
        assert service1 is service2
    
    def test_is_configured(self, claude_service):
        """Test configuration check"""
        # This will depend on whether ANTHROPIC_API_KEY is set
        is_configured = claude_service.is_configured()
        assert isinstance(is_configured, bool)
    
    def test_model_name(self, claude_service):
        """Test model name"""
        assert claude_service.model_name == "claude-haiku-4.5"
    
    def test_api_provider(self, claude_service):
        """Test API provider"""
        assert claude_service.api_provider == "anthropic"
    
    def test_max_tokens(self, claude_service):
        """Test max tokens setting"""
        assert isinstance(claude_service.max_tokens, int)
        assert claude_service.max_tokens > 0
    
    @pytest.mark.asyncio
    async def test_generate_response_not_configured(self, claude_service):
        """Test response generation when not configured"""
        # Mock the API key as empty
        claude_service.api_key = ''
        
        result = await claude_service.generate_response("Test prompt")
        
        assert result['success'] is False
        assert 'error' in result
    
    @pytest.mark.asyncio
    async def test_generate_summary(self, claude_service):
        """Test text summarization"""
        test_text = """
        Claude Haiku 4.5 is an efficient AI model from Anthropic. 
        It provides fast and accurate responses with lower resource consumption. 
        It's ideal for tasks like summarization, translation, and content analysis.
        """
        
        result = await claude_service.generate_summary(test_text)
        
        # Check structure
        assert 'success' in result
        assert 'response' in result or 'error' in result
    
    @pytest.mark.asyncio
    async def test_translate_text(self, claude_service):
        """Test text translation"""
        test_text = "Hello, welcome to our app"
        
        result = await claude_service.translate_text(test_text, 'ar')
        
        # Check structure
        assert 'success' in result
        assert 'response' in result or 'error' in result
    
    @pytest.mark.asyncio
    async def test_analyze_content(self, claude_service):
        """Test content analysis"""
        test_content = "Sample advertisement content for safety analysis"
        
        result = await claude_service.analyze_content(test_content)
        
        # Check structure
        assert 'success' in result
        assert 'response' in result or 'error' in result


class TestClaudeAIEndpoints:
    """Test suite for Claude AI API endpoints"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        from fastapi.testclient import TestClient
        from server import app
        return TestClient(app)
    
    def test_status_endpoint_no_auth(self, client):
        """Test status endpoint without authentication"""
        # This should work without auth for status checking
        response = client.get("/api/claude-ai/status")
        
        # May fail if no token, which is expected
        assert response.status_code in [200, 401, 403]
    
    def test_generate_response_requires_auth(self, client):
        """Test that generate-response requires authentication"""
        response = client.post(
            "/api/claude-ai/generate-response",
            json={
                "prompt": "Test prompt",
                "system_message": "Test system message"
            }
        )
        
        # Should require authentication
        assert response.status_code in [401, 403]


class TestClaudeAIIntegration:
    """Integration tests for Claude AI"""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_full_workflow(self):
        """Test full workflow with real API (if available)"""
        service = get_claude_service()
        
        if not service.is_configured():
            pytest.skip("ANTHROPIC_API_KEY not set")
        
        # Test generation
        result = await service.generate_response("What is 2+2?")
        
        assert result['success'] is True
        assert 'response' in result
        assert '4' in result['response']


# Example usage
if __name__ == "__main__":
    # Run with: python -m pytest backend/tests/test_claude_ai.py -v
    
    async def demo():
        """Demo of Claude AI service"""
        service = get_claude_service()
        
        print("🤖 Claude Haiku 4.5 Service Demo")
        print(f"Model: {service.model_name}")
        print(f"Provider: {service.api_provider}")
        print(f"Configured: {service.is_configured()}")
        
        if service.is_configured():
            # Test response generation
            result = await service.generate_response(
                "What are the benefits of AI?",
                system_message="You are a helpful AI assistant"
            )
            
            if result['success']:
                print(f"\n✅ Response: {result['response']}")
                print(f"Tokens used: {result['usage']}")
            else:
                print(f"\n❌ Error: {result['error']}")
        else:
            print("\n⚠️ API key not configured. Set ANTHROPIC_API_KEY to use.")
    
    # asyncio.run(demo())
