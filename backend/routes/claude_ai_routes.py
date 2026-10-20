"""
Claude Sonnet 4 AI Routes
Endpoints for Claude AI interactions
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from auth.dependencies import get_current_user_id
import os

router = APIRouter(prefix='/claude-ai', tags=['Claude AI'])


def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


class TextPrompt(BaseModel):
    """Text prompt for Claude AI"""
    prompt: str
    system_message: Optional[str] = None
    max_tokens: Optional[int] = 1024
    temperature: Optional[float] = 0.7


class SummaryRequest(BaseModel):
    """Request to summarize text"""
    text: str
    language: Optional[str] = 'ar'
    max_length: Optional[int] = None


class TranslationRequest(BaseModel):
    """Request to translate text"""
    text: str
    source_language: Optional[str] = 'auto'
    target_language: Optional[str] = 'en'


class ContentAnalysisRequest(BaseModel):
    """Request to analyze content"""
    content: str
    analysis_type: Optional[str] = 'general'


class ChatMessage(BaseModel):
    """Chat message"""
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    """Chat request with message history"""
    messages: List[ChatMessage]
    system_message: Optional[str] = None


async def verify_ai_enabled(db) -> bool:
    """Verify Claude AI is enabled"""
    settings = await db.settings.find_one({'type': 'ai_models'}, {'_id': 0})
    if not settings:
        return False
    return settings.get('claude_haiku_enabled', False)


async def get_ai_settings(db):
    """Get AI settings from database"""
    return await db.settings.find_one({'type': 'ai_models'}, {'_id': 0})


@router.post('/generate-response')
async def generate_ai_response(
    request: TextPrompt,
    user_id: str = Depends(get_current_user_id)
):
    """Generate response using Claude Sonnet 4"""
    from services.claude_ai_service import get_claude_service
    
    db = get_db()
    
    # Check if AI is enabled
    if not await verify_ai_enabled(db):
        raise HTTPException(
            status_code=403,
            detail='Claude AI is not enabled. Please enable it in admin settings.'
        )
    
    # Check if user is authorized to use AI
    settings = await get_ai_settings(db)
    if not settings.get('claude_haiku_enabled_for_all_clients'):
        # Only admins can use if not enabled for all
        admin = await db.admins.find_one({
            '$or': [{'id': user_id}, {'email': user_id}]
        }, {'_id': 0})
        if not admin:
            raise HTTPException(
                status_code=403,
                detail='Access denied: Claude AI is not available for your account'
            )
    
    claude_service = await get_claude_service()
    result = await claude_service.generate_response(
        prompt=request.prompt,
        system_message=request.system_message,
        max_tokens=request.max_tokens,
        temperature=request.temperature
    )
    
    return result


@router.post('/summarize')
async def summarize_text(
    request: SummaryRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Summarize text using Claude Sonnet 4"""
    from services.claude_ai_service import get_claude_service
    
    db = get_db()
    
    # Check if AI is enabled
    if not await verify_ai_enabled(db):
        raise HTTPException(
            status_code=403,
            detail='Claude AI is not enabled'
        )
    
    claude_service = await get_claude_service()
    result = await claude_service.summarize_text(
        text=request.text,
        language=request.language,
        max_length=request.max_length
    )
    
    return result


@router.post('/translate')
async def translate_text(
    request: TranslationRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Translate text using Claude Sonnet 4"""
    from services.claude_ai_service import get_claude_service
    
    db = get_db()
    
    # Check if AI is enabled
    if not await verify_ai_enabled(db):
        raise HTTPException(
            status_code=403,
            detail='Claude AI is not enabled'
        )
    
    claude_service = await get_claude_service()
    result = await claude_service.translate_text(
        text=request.text,
        source_lang=request.source_language,
        target_lang=request.target_language
    )
    
    return result


@router.post('/analyze-content')
async def analyze_content(
    request: ContentAnalysisRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Analyze content using Claude Sonnet 4"""
    from services.claude_ai_service import get_claude_service
    
    db = get_db()
    
    # Check if AI is enabled
    if not await verify_ai_enabled(db):
        raise HTTPException(
            status_code=403,
            detail='Claude AI is not enabled'
        )
    
    # Only admins can analyze content
    admin = await db.admins.find_one({
        '$or': [{'id': user_id}, {'email': user_id}]
    }, {'_id': 0})
    if not admin:
        raise HTTPException(
            status_code=403,
            detail='Only admins can analyze content'
        )
    
    claude_service = await get_claude_service()
    result = await claude_service.analyze_content(
        content=request.content,
        analysis_type=request.analysis_type
    )
    
    return result


@router.post('/chat')
async def chat_with_ai(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Multi-turn chat with Claude Sonnet 4"""
    from services.claude_ai_service import get_claude_service
    
    db = get_db()
    
    # Check if AI is enabled
    if not await verify_ai_enabled(db):
        raise HTTPException(
            status_code=403,
            detail='Claude AI is not enabled'
        )
    
    # Check if user is authorized
    settings = await get_ai_settings(db)
    if not settings.get('claude_haiku_enabled_for_all_clients'):
        admin = await db.admins.find_one({
            '$or': [{'id': user_id}, {'email': user_id}]
        }, {'_id': 0})
        if not admin:
            raise HTTPException(
                status_code=403,
                detail='Access denied: Claude AI is not available for your account'
            )
    
    # Convert messages to dict format
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    
    claude_service = await get_claude_service()
    result = await claude_service.chat(
        messages=messages,
        system_message=request.system_message
    )
    
    return result


@router.get('/status')
async def get_claude_status(user_id: str = Depends(get_current_user_id)):
    """Get Claude AI status and availability"""
    from services.claude_ai_service import get_claude_service
    
    db = get_db()
    settings = await get_ai_settings(db)
    
    if not settings:
        return {
            'enabled': False,
            'enabled_for_all': False,
            'status': 'disabled',
            'message': 'Claude AI is not configured'
        }
    
    claude_service = await get_claude_service()
    is_configured = claude_service.is_configured()
    
    return {
        'enabled': settings.get('claude_haiku_enabled', False),
        'enabled_for_all': settings.get('claude_haiku_enabled_for_all_clients', False),
        'configured': is_configured,
        'model': claude_service.model_name,
        'status': 'active' if (settings.get('claude_haiku_enabled') and is_configured) else 'inactive',
        'message': 'Claude Sonnet 4 is ready' if is_configured else 'API key not configured'
    }


@router.get('/public/status')
async def get_public_claude_status():
    """Get public Claude AI status (no auth required)"""
    db = get_db()
    settings = await get_ai_settings(db)
    
    return {
        'available': settings.get('claude_haiku_enabled', False) if settings else False,
        'available_for_all': settings.get('claude_haiku_enabled_for_all_clients', False) if settings else False
    }


@router.post('/chat/guest')
async def guest_chat_with_ai(request: ChatRequest):
    """
    Public chat endpoint for guests (no authentication required)
    Has rate limiting and restricted capabilities
    """
    from services.claude_ai_service import get_claude_service
    
    db = get_db()
    
    # Check if AI is enabled
    if not await verify_ai_enabled(db):
        return {
            'success': False,
            'error': 'المساعد الذكي غير متاح حالياً'
        }
    
    # Check if AI is enabled for all (including guests)
    settings = await get_ai_settings(db)
    if not settings.get('claude_haiku_enabled_for_all_clients'):
        return {
            'success': False,
            'error': 'المساعد الذكي غير متاح للزوار. يرجى تسجيل الدخول.'
        }
    
    # Limit messages for guests
    messages = [{"role": m.role, "content": m.content} for m in request.messages[-5:]]  # Last 5 messages only
    
    # Add guest context to system message
    system_msg = request.system_message or ""
    system_msg += "\n\nملاحظة: هذا مستخدم زائر. شجعه على إنشاء حساب للاستفادة الكاملة من التطبيق."
    
    try:
        claude_service = await get_claude_service()
        result = await claude_service.chat(
            messages=messages,
            system_message=system_msg
        )
        return result
    except Exception as e:
        return {
            'success': False,
            'error': 'حدث خطأ. يرجى المحاولة مرة أخرى.'
        }

