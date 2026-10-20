"""
OAuth routes for Google/Apple authentication via Emergent Auth
REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
from fastapi import APIRouter, HTTPException, status, Response, Request, Cookie
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import uuid
import httpx
from auth.jwt_handler import create_token_pair

router = APIRouter(prefix='/auth', tags=['OAuth Authentication'])

# Constants
SESSION_EXPIRY_DAYS = 7
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]

@router.post('/session', response_model=dict)
async def process_session(request: Request, response: Response):
    """
    Process session_id from Emergent Auth and create user session
    """
    try:
        data = await request.json()
        session_id = data.get('session_id')
        
        if not session_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='session_id is required'
            )
        
        # Call Emergent Auth to get user data
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                EMERGENT_AUTH_URL,
                headers={'X-Session-ID': session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail='Invalid session_id'
                )
            
            user_data = auth_response.json()
        
        db = get_db()
        
        # Check if user exists by email
        existing_user = await db.users.find_one(
            {'email': user_data['email']},
            {'_id': 0}
        )
        
        provider_name = (
            user_data.get('provider')
            or user_data.get('auth_provider')
            or 'google'
        )

        if existing_user:
            user_id = existing_user.get('user_id') or existing_user.get('id')
            # Update user data
            await db.users.update_one(
                {"$or": [{"user_id": user_id}, {"id": user_id}]},
                {'$set': {
                    'name': user_data['name'],
                    'picture': user_data.get('picture'),
                    'provider': provider_name,
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                'user_id': user_id,
                'email': user_data['email'],
                'name': user_data['name'],
                'picture': user_data.get('picture'),
                'provider': provider_name,
                'points': 0,
                'saqr_points': 0,
                'saqr_gems': 0,
                'diamonds': 300,  # 300 ألماسة ترحيبية
                'total_earned': 0,
                'watched_ads': [],
                'economy_initialized': True,
                'diamond_transactions': [{
                    'id': str(uuid.uuid4()),
                    'type': 'welcome_bonus',
                    'amount': 300,
                    'created_at': datetime.now(timezone.utc).isoformat()
                }],
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            await db.users.insert_one(new_user)
        
        # Create session
        session_token = user_data.get('session_token', f"session_{uuid.uuid4().hex}")
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
        
        # Store session
        await db.user_sessions.update_one(
            {'user_id': user_id},
            {'$set': {
                'session_token': session_token,
                'expires_at': expires_at,
                'created_at': datetime.now(timezone.utc)
            }},
            upsert=True
        )
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
        )
        
        # Get updated user
        user = await db.users.find_one({"$or": [{"user_id": user_id}, {"id": user_id}]}, {'_id': 0})
        
        access_token, refresh_token = create_token_pair(user_id)

        return {
            'success': True,
            'token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'user_id': user.get('user_id', user.get('id')),
                'id': user.get('id', user.get('user_id')),
                'email': user['email'],
                'name': user['name'],
                'picture': user.get('picture'),
                'points': user.get('saqr_points', user.get('points', 0)),
                'saqr_gems': user.get('saqr_gems', user.get('saqr_points', user.get('points', 0))),
                'diamonds': user.get('diamonds', 300),
                'total_earned': user.get('total_earned', 0)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Session processing failed: {str(e)}'
        )


@router.get('/me', response_model=dict)
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Get current authenticated user
    """
    # Try cookie first, then Authorization header
    token = session_token
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Not authenticated'
        )
    
    db = get_db()
    
    # Find session
    session = await db.user_sessions.find_one(
        {'session_token': token},
        {'_id': 0}
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid session'
        )
    # Check expiry
    expires_at = session['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Session expired'
        )
    
    # Get user
    user = await db.users.find_one(
        {"$or": [{"user_id": session['user_id']}, {"id": session['user_id']}]},
        {'_id': 0}
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found'
        )
    
    return {
        'user_id': user.get('user_id', user.get('id')),
        'id': user.get('id', user.get('user_id')),
        'email': user['email'],
        'name': user['name'],
        'picture': user.get('picture'),
        'points': user.get('saqr_points', user.get('points', 0)),
        'saqr_gems': user.get('saqr_gems', user.get('saqr_points', user.get('points', 0))),
        'diamonds': user.get('diamonds', 300),
        'total_earned': user.get('total_earned', 0),
        'watched_ads': user.get('watched_ads', [])
    }


@router.post('/logout', response_model=dict)
async def logout(
    request: Request,
    response: Response,
    session_token: Optional[str] = Cookie(None)
):
    """
    Logout user and clear session
    """
    token = session_token
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    
    if token:
        db = get_db()
        await db.user_sessions.delete_one({'session_token': token})
    
    # Clear cookie
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {'success': True, 'message': 'Logged out successfully'}


# Email/Password Authentication
from pydantic import BaseModel, EmailStr
from passlib.hash import bcrypt

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    website: Optional[str] = None  # honeypot


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post('/register', response_model=dict)
async def register_user(data: RegisterRequest, request: Request, response: Response):
    """
    Register new user with email/password
    + Honeypot + IP-based rate limit against bot signups
    """
    db = get_db()

    # Honeypot — real browsers leave `website` empty; bots that auto-fill every field will fail silently
    if data.website:
        return {"success": True, "user": {"user_id": "hp", "email": data.email, "name": data.name}}

    # IP rate limit — max 5 registrations per hour per IP
    client_ip = request.client.host if request.client else None
    if client_ip:
        from datetime import timedelta
        now = datetime.utcnow()
        window_start = now - timedelta(hours=1)
        recent = await db.users.count_documents({
            "registration_ip": client_ip,
            "created_at": {"$gte": window_start},
        })
        if recent >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail='تجاوزت الحد المسموح من التسجيلات. حاول بعد ساعة',
            )
    
    # Check if email exists
    existing = await db.users.find_one({'email': data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='البريد الإلكتروني مستخدم بالفعل'
        )
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = bcrypt.hash(data.password)
    
    new_user = {
        'user_id': user_id,
        'email': data.email,
        'name': data.name,
        'password_hash': password_hash,
        'provider': 'email',
        'points': 0,
        'saqr_points': 0,
        'saqr_gems': 0,
        'diamonds': 300,  # 300 ألماسة ترحيبية
        'total_earned': 0,
        'watched_ads': [],
        'economy_initialized': True,
        'diamond_transactions': [{
            'id': str(uuid.uuid4()),
            'type': 'welcome_bonus',
            'amount': 300,
            'created_at': datetime.now(timezone.utc).isoformat()
        }],
        'registration_ip': client_ip,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(new_user)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    
    await db.user_sessions.insert_one({
        'user_id': user_id,
        'session_token': session_token,
        'expires_at': expires_at,
        'created_at': datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )
    
    return {
        'success': True,
        'user': {
            'user_id': user_id,
            'email': data.email,
            'name': data.name,
            'points': 0,
            'saqr_gems': 0,
            'diamonds': 300,
            'total_earned': 0
        }
    }


@router.post('/login/email', response_model=dict)
async def login_email(data: LoginRequest, response: Response):
    """
    Login with email/password
    """
    db = get_db()
    
    # Find user
    user = await db.users.find_one({'email': data.email}, {'_id': 0})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='البريد الإلكتروني أو كلمة المرور غير صحيحة'
        )
    # Check password
    if not user.get('password_hash'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='هذا الحساب مسجّل عبر Google. استخدم تسجيل الدخول بـ Google'
        )
    
    if not bcrypt.verify(data.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='البريد الإلكتروني أو كلمة المرور غير صحيحة'
        )
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    
    await db.user_sessions.update_one(
        {'user_id': user.get('user_id') or user.get('id')},
        {'$set': {
            'session_token': session_token,
            'expires_at': expires_at,
            'created_at': datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )
    
    return {
        'success': True,
        'user': {
            'user_id': user.get('user_id', user.get('id')),
            'id': user.get('id', user.get('user_id')),
            'email': user['email'],
            'name': user['name'],
            'picture': user.get('picture'),
            'points': user.get('saqr_points', user.get('points', 0)),
            'saqr_gems': user.get('saqr_gems', user.get('saqr_points', user.get('points', 0))),
            'diamonds': user.get('diamonds', 300),
            'total_earned': user.get('total_earned', 0)
        }
    }
