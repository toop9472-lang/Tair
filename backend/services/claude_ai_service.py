"""
Claude Sonnet 4 AI Service
Integration with Anthropic's Claude Sonnet model
"""

import os
import httpx
from typing import Optional, Dict, Any
from datetime import datetime


class ClaudeSonnetService:
    """Service for Claude Sonnet 4 AI interactions"""
    
    def __init__(self):
        self.model_name = "claude-sonnet-4-20250514"
        self.api_provider = "anthropic"
        self.api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        self.max_tokens = int(os.environ.get('CLAUDE_MAX_TOKENS', '1024'))
        self.api_url = "https://api.anthropic.com/v1/messages"

    @staticmethod
    def _default_assistant_system() -> str:
        return (
            "أنت المساعد الذكي الرسمي لتطبيق صقر. "
            "أسلوبك احترافي، واضح، وودود. "
            "تعامل مع الدردشات البسيطة جداً بشكل طبيعي (مثل: مرحباً، شكراً، كيف حالك) "
            "برد قصير ولطيف ثم اعرض المساعدة. "
            "عند الشرح، استخدم نقاط مختصرة. "
            "إذا سأل المستخدم عن التطبيق، اشرح باختصار ودقة: "
            "جواهر صقر = للسحب المالي (500 جوهرة = 1 ريال)، "
            "والألماس = للاستخدام داخل التطبيق. "
            "يوجد متجر ألماس بحزم من 3 إلى 19 ريال، "
            "ومتجر مميزات لإطارات الملف وإطارات الدردشة والأفاتارات والثيمات. "
            "لا تختلق معلومات غير مؤكدة."
        )
    
    def set_api_key(self, api_key: str):
        """Set API key dynamically"""
        self.api_key = api_key
        os.environ['ANTHROPIC_API_KEY'] = api_key
    
    def is_configured(self) -> bool:
        """Check if Claude Sonnet is properly configured"""
        return bool(self.api_key)
    
    async def _make_request(
        self,
        messages: list,
        system_message: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """Make request to Anthropic API"""
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        payload = {
            "model": self.model_name,
            "max_tokens": max_tokens or self.max_tokens,
            "messages": messages
        }
        
        if system_message:
            payload["system"] = system_message
        
        if temperature != 0.7:
            payload["temperature"] = temperature
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.api_url,
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": response.text, "status_code": response.status_code}
    
    async def generate_response(
        self, 
        prompt: str, 
        system_message: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Generate response using Claude Sonnet 4
        
        Args:
            prompt: User message/prompt
            system_message: System instructions for the model
            max_tokens: Maximum tokens in response
            temperature: Model temperature (0-1)
        
        Returns:
            Dict with response and metadata
        """
        if not self.is_configured():
            return {
                'success': False,
                'error': 'Claude AI is not configured. Please set the API key.',
                'response': None
            }
        
        default_system = self._default_assistant_system()
        
        messages = [{"role": "user", "content": prompt}]
        
        try:
            result = await self._make_request(
                messages=messages,
                system_message=system_message or default_system,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            if "error" in result:
                return {
                    'success': False,
                    'error': result.get('error'),
                    'response': None
                }
            
            response_text = result.get('content', [{}])[0].get('text', '')
            
            return {
                'success': True,
                'response': response_text,
                'model': self.model_name,
                'provider': self.api_provider,
                'usage': result.get('usage', {}),
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'response': None
            }
    
    async def summarize_text(
        self,
        text: str,
        language: str = "ar",
        max_length: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Summarize text using Claude Sonnet
        
        Args:
            text: Text to summarize
            language: Output language (ar/en)
            max_length: Maximum summary length in words
        """
        lang_instruction = "باللغة العربية" if language == "ar" else "in English"
        length_instruction = f"في حدود {max_length} كلمة" if max_length else "بشكل مختصر"
        
        prompt = f"""لخص النص التالي {lang_instruction} {length_instruction}:

{text}"""
        
        system_message = "أنت خبير في تلخيص النصوص. قدم ملخصات واضحة ومفيدة."
        
        return await self.generate_response(
            prompt=prompt,
            system_message=system_message,
            max_tokens=500,
            temperature=0.3
        )
    
    async def translate_text(
        self,
        text: str,
        source_lang: str = "auto",
        target_lang: str = "en"
    ) -> Dict[str, Any]:
        """
        Translate text using Claude Sonnet
        
        Args:
            text: Text to translate
            source_lang: Source language (auto for auto-detect)
            target_lang: Target language code
        """
        lang_names = {
            "ar": "العربية",
            "en": "الإنجليزية",
            "fr": "الفرنسية",
            "es": "الإسبانية",
            "de": "الألمانية",
            "auto": "تلقائي"
        }
        
        target_name = lang_names.get(target_lang, target_lang)
        
        prompt = f"""ترجم النص التالي إلى {target_name}:

{text}

الترجمة:"""
        
        system_message = "أنت مترجم محترف. قدم ترجمات دقيقة وطبيعية."
        
        return await self.generate_response(
            prompt=prompt,
            system_message=system_message,
            max_tokens=1000,
            temperature=0.2
        )
    
    async def analyze_content(
        self,
        content: str,
        analysis_type: str = "general"
    ) -> Dict[str, Any]:
        """
        Analyze content using Claude Sonnet
        
        Args:
            content: Content to analyze
            analysis_type: Type of analysis (general, sentiment, keywords, etc.)
        """
        analysis_prompts = {
            "general": "حلل هذا المحتوى وقدم نظرة عامة شاملة:",
            "sentiment": "حلل المشاعر والعواطف في هذا النص:",
            "keywords": "استخرج الكلمات المفتاحية والمواضيع الرئيسية:",
            "summary": "قدم ملخصاً تنفيذياً لهذا المحتوى:",
            "quality": "قيّم جودة هذا المحتوى من حيث الوضوح والفائدة:"
        }
        
        prompt = f"""{analysis_prompts.get(analysis_type, analysis_prompts['general'])}

{content}"""
        
        system_message = "أنت محلل محتوى خبير. قدم تحليلات دقيقة ومفيدة."
        
        return await self.generate_response(
            prompt=prompt,
            system_message=system_message,
            max_tokens=800,
            temperature=0.4
        )
    
    async def chat(
        self,
        messages: list,
        system_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Multi-turn chat with Claude Sonnet
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            system_message: System instructions
        """
        if not self.is_configured():
            return {
                'success': False,
                'error': 'Claude AI is not configured.',
                'response': None
            }
        
        default_system = self._default_assistant_system()
        
        try:
            result = await self._make_request(
                messages=messages,
                system_message=system_message or default_system,
                max_tokens=1024,
                temperature=0.55
            )
            
            if "error" in result:
                return {
                    'success': False,
                    'error': result.get('error'),
                    'response': None
                }
            
            response_text = result.get('content', [{}])[0].get('text', '')
            
            return {
                'success': True,
                'response': response_text,
                'model': self.model_name,
                'usage': result.get('usage', {})
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'response': None
            }


# Singleton instance
claude_service = ClaudeSonnetService()


# Helper function for routes
async def get_claude_service():
    """Get initialized Claude service with settings from database"""
    from motor.motor_asyncio import AsyncIOMotorClient
    
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if mongo_url and db_name:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        settings = await db.settings.find_one({'type': 'ai_models'}, {'_id': 0})
        
        if settings and settings.get('anthropic_api_key'):
            claude_service.set_api_key(settings['anthropic_api_key'])
    
    return claude_service
