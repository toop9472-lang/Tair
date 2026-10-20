from fastapi import APIRouter, HTTPException, status, Depends, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, field_validator
from models.user import User, UserCreate, UserResponse
from auth.jwt_handler import create_access_token, create_token_pair, refresh_access_token
from auth.dependencies import get_current_user_id
from auth.password_utils import validate_password_strength, get_password_strength_score
from auth.rate_limiter import check_login_allowed, record_login_attempt
from passlib.hash import bcrypt
from datetime import datetime, timedelta
import os
import uuid
import asyncio
import logging
from typing import Optional
from services.display_names import assert_unique_name

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/auth', tags=['Authentication'])

DEFAULT_PUBLIC_BASE_URL = "https://saqr-ui-sync.emergent.host"
OAUTH_TEMP_TTL_MINUTES = 20


async def _check_is_admin(user_id_or_email: str) -> dict:
    """Single source of truth for admin detection.
    Returns {'is_admin': bool, 'role': str|None, 'admin_id': str|None}
    """
    from server import db as _db
    if not user_id_or_email:
        return {"is_admin": False, "role": None, "admin_id": None}
    admin = await _db.admins.find_one(
        {"$or": [
            {"id": user_id_or_email},
            {"user_id": user_id_or_email},
            {"email": user_id_or_email},
        ]},
        {"_id": 0, "id": 1, "email": 1, "role": 1, "name": 1},
    )
    if not admin:
        return {"is_admin": False, "role": None, "admin_id": None}
    return {
        "is_admin": True,
        "role": admin.get("role") or "admin",
        "admin_id": admin.get("id") or admin.get("email"),
        "email": admin.get("email"),
        "name": admin.get("name"),
    }

def _resolve_public_base_url(request: Request) -> str:
    """Resolve the externally reachable base URL behind proxies."""
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    if not host:
        return DEFAULT_PUBLIC_BASE_URL
    return f"{proto}://{host}".rstrip("/")

def _resolve_google_redirect_uri(request: Request) -> str:
    return os.environ.get('GOOGLE_REDIRECT_URI') or f"{_resolve_public_base_url(request)}/api/auth/google/callback"

def _resolve_apple_redirect_uri(request: Request) -> str:
    return os.environ.get('APPLE_REDIRECT_URI') or f"{_resolve_public_base_url(request)}/api/auth/apple/callback"

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


async def _get_oauth_settings_doc():
    db = get_db()
    return await db.settings.find_one({'type': 'oauth'}, {'_id': 0}) or {}


async def _resolve_google_credentials():
    settings = await _get_oauth_settings_doc()
    client_id = (os.environ.get('GOOGLE_CLIENT_ID') or settings.get('google_client_id') or '').strip()
    client_secret = (os.environ.get('GOOGLE_CLIENT_SECRET') or settings.get('google_client_secret') or '').strip()
    enabled = settings.get('google_enabled', True)
    return client_id, client_secret, bool(enabled)


async def _resolve_apple_client_id(default_value: str = 'com.saqr.rewards'):
    settings = await _get_oauth_settings_doc()
    client_id = (os.environ.get('APPLE_CLIENT_ID') or settings.get('apple_client_id') or default_value or '').strip()
    enabled = settings.get('apple_enabled', True)
    return client_id, bool(enabled)


async def _save_oauth_temp(key: str, payload: dict):
    db = get_db()
    now = datetime.utcnow()
    await db.oauth_temp_sessions.update_one(
        {'key': key},
        {'$set': {
            'key': key,
            'payload': payload,
            'created_at': now,
            'expires_at': now + __import__('datetime').timedelta(minutes=OAUTH_TEMP_TTL_MINUTES),
        }},
        upsert=True
    )


async def _pop_oauth_temp(key: str):
    db = get_db()
    doc = await db.oauth_temp_sessions.find_one({'key': key})
    if not doc:
        return None
    expires_at = doc.get('expires_at')
    if isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
        await db.oauth_temp_sessions.delete_one({'key': key})
        return None
    await db.oauth_temp_sessions.delete_one({'key': key})
    return doc.get('payload')

class EmailLogin(BaseModel):
    email: EmailStr
    password: str

class EmailRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    # Honeypot — real browsers leave this empty. Bots that auto-fill every field will fail.
    website: Optional[str] = None
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        is_valid, errors = validate_password_strength(v)
        if not is_valid:
            raise ValueError(errors[0])
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('الاسم يجب أن يكون حرفين على الأقل')
        if len(v) > 50:
            raise ValueError('الاسم طويل جداً')
        return v.strip()

class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post('/signin', response_model=dict)
async def signin(credentials: EmailLogin, request: Request):
    """
    Unified sign in - checks both admins and users
    مع حماية من هجمات Brute Force
    """
    db = get_db()
    
    # الحصول على معلومات الطلب
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get('user-agent', '')
    
    # التحقق من حد المحاولات
    allowed, error_msg, remaining = await check_login_allowed(credentials.email, client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_msg
        )
    
    # First, check if this is an admin
    admin = await db.admins.find_one({'email': credentials.email}, {'_id': 0})
    
    if admin:
        # Verify admin password
        try:
            password_valid = bcrypt.verify(credentials.password, admin['password_hash'])
        except Exception:
            password_valid = False
        
        if password_valid:
            admin_id = admin.get('id', admin['email'])
            
            # تسجيل محاولة ناجحة
            await record_login_attempt(credentials.email, True, client_ip, user_agent)
            
            # Update last login
            await db.admins.update_one(
                {'email': credentials.email},
                {'$set': {'last_login': datetime.utcnow()}}
            )
            
            # Create tokens
            access_token, refresh_token = create_token_pair(admin_id, is_admin=True)
            
            return {
                'token': access_token,
                'refresh_token': refresh_token,
                'role': 'admin',
                'user': {
                    'id': admin_id,
                    'user_id': admin_id,
                    'email': admin['email'],
                    'name': admin.get('name', 'Admin'),
                    'role': admin.get('role', 'admin'),
                    'is_admin': True,
                }
            }
    
    # Not admin, check regular users
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    
    if user:
        # Check password
        try:
            password_valid = user.get('password_hash') and bcrypt.verify(credentials.password, user['password_hash'])
        except Exception:
            password_valid = False
        
        if password_valid:
            # التحقق من حالة الحساب
            user_status = user.get('status', 'active')
            if user_status == 'banned':
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail='تم إيقاف حسابك. تواصل مع الدعم الفني'
                )
            
            # تسجيل محاولة ناجحة
            await record_login_attempt(credentials.email, True, client_ip, user_agent)
            
            # Handle both 'id' and 'user_id' fields for backward compatibility
            user_id = user.get('id') or user.get('user_id')
            access_token, refresh_token = create_token_pair(user_id)
            
            created_at = user.get('created_at')
            if isinstance(created_at, datetime):
                joined_date = created_at.isoformat()
            else:
                joined_date = str(created_at) if created_at else datetime.utcnow().isoformat()
            
            # Get economy data from user document directly
            # Default values for new users: 300 diamonds, 0 gems
            diamonds = user.get('diamonds', 300)  # 300 initial diamonds for new users
            saqr_points = user.get('saqr_points', user.get('points', 0))
            saqr_gems = user.get('saqr_gems', saqr_points)
            
            return {
                'token': access_token,
                'refresh_token': refresh_token,
                'role': 'user',
                'user': {
                    'id': user_id,
                    'email': user['email'],
                    'name': user['name'],
                    'avatar': user.get('avatar'),
                    'points': saqr_points,
                    'diamonds': diamonds,
                    'saqr_gems': saqr_gems,
                    'total_earned': user.get('total_earned', 0),
                    'joined_date': joined_date
                }
            }
    
    # تسجيل محاولة فاشلة
    await record_login_attempt(credentials.email, False, client_ip, user_agent)
    
    # No user found or wrong password
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='البريد الإلكتروني أو كلمة المرور غير صحيحة'
    )


@router.post('/guest', response_model=dict)
async def guest_login(request: Request):
    """
    Continue as a guest — creates an anonymous user + token so the client can
    browse listings, chat with sellers, etc. The user can link an email later
    via Profile to convert to a full account.

    IMPORTANT: if the client sends an existing `guest_id` in the JSON body or
    `X-Guest-Id` header, we REUSE it so uploads/settings don't disappear
    between app reopens.
    """
    db = get_db()
    # Try to reuse an existing guest id from the client
    existing_id = None
    try:
        body = await request.json()
        existing_id = (body or {}).get("guest_id")
    except Exception:
        pass
    if not existing_id:
        existing_id = request.headers.get("x-guest-id")
    if existing_id and str(existing_id).startswith("guest_"):
        existing = await db.users.find_one(
            {"$or": [{"id": existing_id}, {"user_id": existing_id}]}
        )
        if existing:
            uid = existing.get("id") or existing.get("user_id")
            access_token, refresh_tok = create_token_pair(uid)
            return {
                "token": access_token,
                "refresh_token": refresh_tok,
                "role": "guest",
                "user": {
                    "id": uid,
                    "user_id": uid,
                    "email": existing.get("email"),
                    "name": existing.get("name") or "ضيف طير",
                    "needs_name_setup": bool(existing.get("needs_name_setup")) or (existing.get("name") or "ضيف طير") == "ضيف طير",
                    "avatar": existing.get("avatar"),
                    "is_guest": True,
                    "joined_date": (existing.get("created_at") or datetime.utcnow()).isoformat(),
                },
            }

    user_id = f"guest_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow()
    doc = {
        'id': user_id,
        'email': f'{user_id}@guest.tair.app',
        'name': 'ضيف طير',
        'needs_name_setup': True,
        'is_guest': True,
        'provider': 'guest',
        'avatar': f'https://ui-avatars.com/api/?name=Guest&background=0f766e&color=fff',
        'points': 0,
        'saqr_points': 0,
        'saqr_gems': 0,
        'diamonds': 0,
        'total_earned': 0,
        'status': 'active',
        'created_at': now,
        'updated_at': now,
    }
    await db.users.insert_one(doc)
    access_token, refresh_tok = create_token_pair(user_id)
    return {
        'token': access_token,
        'refresh_token': refresh_tok,
        'role': 'guest',
        'user': {
            'id': user_id,
            'user_id': user_id,
            'email': doc['email'],
            'name': doc['name'],
            'needs_name_setup': True,
            'avatar': doc['avatar'],
            'is_guest': True,
            'joined_date': now.isoformat(),
        },
    }



@router.post('/register', response_model=dict)
async def register_email(data: EmailRegister, request: Request):
    """
    Register new user with email/password
    مع التحقق من قوة كلمة المرور + حماية من البوتات (Honeypot + Rate limit per IP)
    """
    db = get_db()

    # Honeypot — bots often auto-fill every field. Silently accept, don't create anything.
    if data.website:
        return {"success": True, "user": {"user_id": "hp", "email": data.email, "name": data.name}}

    # IP rate limit — max 5 registrations per hour per IP
    client_ip = request.client.host if request.client else None
    if client_ip:
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

    # التحقق من قوة كلمة المرور
    is_valid, errors = validate_password_strength(data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0]
        )
    
    # Check if email already exists
    existing = await db.users.find_one({'email': data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='البريد الإلكتروني مسجل بالفعل'
        )
    
    # Check if admin with this email exists
    admin_exists = await db.admins.find_one({'email': data.email})
    if admin_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='البريد الإلكتروني مسجل بالفعل'
        )
    
    try:
        chosen_name = await assert_unique_name(db, data.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Hash password
    password_hash = bcrypt.hash(data.password)
    
    # Create user
    user_id = str(uuid.uuid4())
    
    # الحصول على معلومات الطلب
    client_ip = request.client.host if request.client else None
    
    user_doc = {
        'id': user_id,
        'email': data.email,
        'name': chosen_name,
        'password_hash': password_hash,
        'provider': 'email',
        'provider_id': data.email,
        'avatar': f"https://ui-avatars.com/api/?name={data.name}&background=6366f1&color=fff",
        'points': 0,
        'saqr_points': 0,
        'saqr_gems': 0,
        'diamonds': 300,  # 300 ألماسة ترحيبية
        'total_earned': 0,
        'watched_ads': [],
        'status': 'active',
        'economy_initialized': True,
        'diamond_transactions': [{
            'id': str(uuid.uuid4()),
            'type': 'welcome_bonus',
            'amount': 300,
            'created_at': datetime.utcnow().isoformat()
        }],
        'registration_ip': client_ip,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    
    # Send welcome email (fire and forget - don't block registration)
    async def send_welcome():
        try:
            from services.email_service import send_welcome_email, get_email_settings
            settings = await get_email_settings()
            if settings and settings.get('email_enabled') and settings.get('send_welcome_email'):
                result = await send_welcome_email(data.email, data.name, 'ar')
                logger.info(f"Welcome email result for {data.email}: {result}")
            else:
                logger.info(f"Welcome email skipped (disabled) for {data.email}")
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}", exc_info=True)
    
    asyncio.create_task(send_welcome())
    
    # Create tokens
    access_token, refresh_token = create_token_pair(user_id)
    
    return {
        'token': access_token,
        'refresh_token': refresh_token,
        'role': 'user',
        'user': {
            'id': user_id,
            'email': data.email,
            'name': data.name,
            'avatar': user_doc['avatar'],
            'points': 0,
            'saqr_points': 0,
            'saqr_gems': 0,
            'diamonds': 300,
            'total_earned': 0,
            'joined_date': user_doc['created_at'].isoformat()
        }
    }


@router.post('/refresh-token', response_model=dict)
async def refresh_token_endpoint(data: RefreshTokenRequest):
    """
    تجديد Access Token باستخدام Refresh Token
    """
    new_access_token = refresh_access_token(data.refresh_token)
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Refresh token غير صالح أو منتهي الصلاحية'
        )
    
    return {
        'token': new_access_token,
        'message': 'تم تجديد التوكن بنجاح'
    }


@router.post('/check-password-strength', response_model=dict)
async def check_password_strength(password: str):
    """
    التحقق من قوة كلمة المرور
    """
    is_valid, errors = validate_password_strength(password)
    score = get_password_strength_score(password)
    
    strength = 'ضعيفة'
    if score >= 80:
        strength = 'قوية جداً'
    elif score >= 60:
        strength = 'قوية'
    elif score >= 40:
        strength = 'متوسطة'
    
    return {
        'valid': is_valid,
        'score': score,
        'strength': strength,
        'errors': errors
    }


@router.post('/login', response_model=dict)
async def login(user_data: UserCreate):
    """
    Login or register user (Google/Apple OAuth)
    """
    try:
        db = get_db()
        
        # Check if user exists
        existing_user = await db.users.find_one({
            'provider': user_data.provider,
            'provider_id': user_data.provider_id
        })
        
        if existing_user:
            # Update user data
            await db.users.update_one(
                {'_id': existing_user['_id']},
                {'$set': {
                    'name': user_data.name,
                    'avatar': user_data.avatar,
                    'updated_at': datetime.utcnow()
                }}
            )
            user_id = existing_user.get('id') or existing_user.get('user_id')
        else:
            # Create new user
            new_user = User(**user_data.dict())
            user_dict = new_user.dict()
            user_dict.update({
                'points': 0,
                'saqr_points': 0,
                'saqr_gems': 0,
                'diamonds': 300,
            })
            await db.users.insert_one(user_dict)
            user_id = new_user.id
        
        # Create JWT token
        token = create_access_token(user_id)
        
        # Get user data
        user = await db.users.find_one({'$or': [{'id': user_id}, {'user_id': user_id}]})
        
        return {
            'token': token,
            'user': {
                'id': user.get('id', user.get('user_id')),
                'email': user['email'],
                'name': user['name'],
                'avatar': user.get('avatar'),
                'points': user.get('saqr_points', user.get('points', 0)),
                'saqr_gems': user.get('saqr_gems', user.get('saqr_points', user.get('points', 0))),
                'diamonds': user.get('diamonds', 300),
                'total_earned': user['total_earned'],
                'joined_date': user['created_at'].isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Login failed: {str(e)}'
        )


@router.get('/me', response_model=dict)
async def get_current_user(user_id: str = Depends(get_current_user_id)):
    """
    Get current user profile.
    Supports both regular users (`users` collection) AND admins (`admins` collection).
    For admins, if a paired `users` record exists (same email), we merge storefront
    fields from there so the mobile app can render identity correctly.
    """
    db = get_db()

    # Bump last_seen on the user (silent — doesn't affect response)
    try:
        now = datetime.utcnow()
        await db.users.update_one(
            {'$or': [{'id': user_id}, {'user_id': user_id}, {'email': user_id}]},
            {'$set': {'last_seen': now}}
        )
    except Exception:
        pass

    # 1. Try admins collection FIRST (by id, user_id, or email).
    # This ensures the caller's admin flag is authoritative for admin JWTs.
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'user_id': user_id}, {'email': user_id}]})

    if admin:
        # Look for a paired users record by email so we can pull storefront + contact fields
        paired = None
        email = admin.get('email')
        if email:
            paired = await db.users.find_one({'email': email})
        # Admin id: use admin.id → admin.user_id → paired.id → paired.user_id → email as last resort
        # This ensures /me always returns a usable user_id even when admins collection has only email
        canonical_id = (
            admin.get('id')
            or admin.get('user_id')
            or (paired or {}).get('id')
            or (paired or {}).get('user_id')
            or email
        )
        # Merge admin core fields + paired user fields (paired wins for storefront/contact)
        user = {
            'id': canonical_id,
            'user_id': canonical_id,
            'email': email,
            'name': (paired or {}).get('name') or admin.get('name') or 'مدير طير',
            'is_admin': True,
            'role': admin.get('role') or 'super_admin',
            'avatar': (paired or {}).get('avatar'),
            'bio': (paired or {}).get('bio'),
            'phone': (paired or {}).get('phone'),
            'whatsapp': (paired or {}).get('whatsapp'),
            'profile_bg_url': (paired or {}).get('profile_bg_url'),
            'is_verified_shop': bool((paired or {}).get('is_verified_shop')),
            'is_verified_carrier': bool((paired or {}).get('is_verified_carrier')),
            'created_at': admin.get('created_at') or (paired or {}).get('created_at'),
        }
    else:
        # 2. Regular users collection (by id, user_id, or email)
        user = await db.users.find_one({'$or': [{'id': user_id}, {'user_id': user_id}, {'email': user_id}]})
        # Also honour is_admin flag on the user record, plus email-linked admin row
        if user:
            if not user.get('is_admin') and user.get('email'):
                linked = await db.admins.find_one({'email': user['email']}, {'_id': 0, 'id': 1})
                if linked:
                    user['is_admin'] = True

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found'
        )
    
    return {
        'user': {
            'id': user.get('id', user.get('user_id')),
            'user_id': user.get('user_id', user.get('id')),
            'email': user.get('email'),
            'name': user.get('name'),
            'avatar': user.get('avatar'),
            'bio': user.get('bio'),
            'phone': user.get('phone'),
            'whatsapp': user.get('whatsapp'),
            'profile_bg_url': user.get('profile_bg_url'),
            'is_admin': bool(user.get('is_admin')),
            'role': user.get('role'),
            'is_verified_shop': bool(user.get('is_verified_shop')),
            'is_verified_carrier': bool(user.get('is_verified_carrier')),
            'points': user.get('saqr_points', user.get('points', 0)),
            'saqr_gems': user.get('saqr_gems', user.get('saqr_points', user.get('points', 0))),
            'diamonds': user.get('diamonds', 300),
            'total_earned': user.get('total_earned', 0),
            'watched_ads': user.get('watched_ads', []),
            'joined_date': user['created_at'].isoformat() if user.get('created_at') and hasattr(user.get('created_at'), 'isoformat') else user.get('created_at'),
        }
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    confirmation_text: str
    password: Optional[str] = None


@router.post('/change-password', response_model=dict)
async def change_password(data: ChangePasswordRequest, user_id: str = Depends(get_current_user_id)):
    """
    تغيير كلمة المرور للمستخدم المسجل
    """
    db = get_db()
    
    # البحث عن المستخدم - دعم كلا الحقلين id و user_id
    user = await db.users.find_one({
        '$or': [
            {'id': user_id},
            {'user_id': user_id}
        ]
    })
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='المستخدم غير موجود'
        )
    
    # التحقق من كلمة المرور الحالية
    if not user.get('password_hash'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='لا يمكن تغيير كلمة المرور لهذا الحساب'
        )
    
    try:
        password_valid = bcrypt.verify(data.current_password, user['password_hash'])
    except Exception:
        password_valid = False
    
    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='كلمة المرور الحالية غير صحيحة'
        )
    
    # التحقق من قوة كلمة المرور الجديدة
    is_valid, errors = validate_password_strength(data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0]
        )
    
    # التأكد من أن كلمة المرور الجديدة مختلفة عن الحالية
    try:
        same_password = bcrypt.verify(data.new_password, user['password_hash'])
    except Exception:
        same_password = False
    
    if same_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية'
        )
    
    # تحديث كلمة المرور
    new_password_hash = bcrypt.hash(data.new_password)
    # استخدام الحقل المناسب للتحديث
    update_filter = {'user_id': user_id} if user.get('user_id') else {'id': user_id}
    await db.users.update_one(
        update_filter,
        {
            '$set': {
                'password_hash': new_password_hash,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    return {'message': 'تم تغيير كلمة المرور بنجاح'}


@router.post('/delete-account', response_model=dict)
async def delete_account(data: DeleteAccountRequest, user_id: str = Depends(get_current_user_id)):
    """
    حذف الحساب نهائياً (امتثال App Store 5.1.1(v))
    """
    db = get_db()

    user = await db.users.find_one({
        '$or': [
            {'id': user_id},
            {'user_id': user_id}
        ]
    })
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='المستخدم غير موجود'
        )

    confirmation = (data.confirmation_text or '').strip().lower()
    if confirmation not in {'delete', 'حذف'}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='تأكيد الحذف غير صحيح'
        )

    # Email/password accounts must provide password for destructive action
    if user.get('password_hash'):
        if not data.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='يرجى إدخال كلمة المرور لتأكيد حذف الحساب'
            )
        try:
            if not bcrypt.verify(data.password, user['password_hash']):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail='كلمة المرور غير صحيحة'
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='كلمة المرور غير صحيحة'
            )

    canonical_user_id = user.get('id') or user.get('user_id') or user_id
    aliases = list({canonical_user_id, user.get('id'), user.get('user_id')} - {None})
    user_email = user.get('email')

    # Remove core account and session data
    await db.users.delete_many({'$or': [{'id': {'$in': aliases}}, {'user_id': {'$in': aliases}}]})
    await db.user_sessions.delete_many({'user_id': {'$in': aliases}})

    # Best-effort cleanup for user-linked data
    cleanup_targets = [
        ('withdrawals', [{'user_id': {'$in': aliases}}]),
        ('withdrawal_requests', [{'user_id': {'$in': aliases}}]),
        ('purchases', [{'user_id': {'$in': aliases}}]),
        ('subscriptions', [{'user_id': {'$in': aliases}}]),
        ('watched_ads', [{'user_id': {'$in': aliases}}]),
        ('ad_watch_events', [{'user_id': {'$in': aliases}}]),
        ('diamond_transactions', [{'user_id': {'$in': aliases}}]),
        ('economy_logs', [{'user_id': {'$in': aliases}}]),
        ('support_tickets', [{'user_id': {'$in': aliases}}]),
        ('support_messages', [{'user_id': {'$in': aliases}}]),
        ('chat_messages', [{'user_id': {'$in': aliases}}]),
        ('global_chat_messages', [{'user_id': {'$in': aliases}}]),
        ('private_chat_threads', [{'participant_ids': {'$in': aliases}}]),
        ('private_messages', [{'sender_id': {'$in': aliases}}, {'receiver_id': {'$in': aliases}}]),
        ('game_sessions', [{'user_id': {'$in': aliases}}]),
        ('game_results', [{'user_id': {'$in': aliases}}]),
        ('leaderboard_scores', [{'user_id': {'$in': aliases}}]),
        ('invitations', [{'from_user_id': {'$in': aliases}}, {'to_user_id': {'$in': aliases}}]),
        ('comments', [{'user_id': {'$in': aliases}}]),
        ('likes', [{'user_id': {'$in': aliases}}]),
        ('referrals', [{'user_id': {'$in': aliases}}, {'referred_user_id': {'$in': aliases}}]),
        ('oauth_temp_sessions', [{'payload.user_id': {'$in': aliases}}]),
    ]
    if user_email:
        cleanup_targets.extend([
            ('password_resets', [{'email': user_email}]),
            ('support_tickets', [{'email': user_email}]),
            ('users', [{'email': user_email}]),  # legacy duplicates safety
        ])
    for collection_name, queries in cleanup_targets:
        for query in queries:
            try:
                await db[collection_name].delete_many(query)
            except Exception:
                continue

    return {'message': 'تم حذف الحساب نهائياً'}


@router.post('/logout')
async def logout():
    """
    Logout user (client should clear token)
    """
    return {'message': 'تم تسجيل الخروج بنجاح'}



# ==================== Password Reset APIs ====================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyResetOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str

@router.post('/forgot-password', response_model=dict)
async def forgot_password(data: ForgotPasswordRequest):
    """
    Send password reset link to user's email (No OTP)
    """
    import secrets
    
    db = get_db()
    
    # Find user by email
    user = await db.users.find_one({'email': data.email})
    
    if not user:
        # Don't reveal if email exists or not for security
        return {'message': 'إذا كان البريد الإلكتروني مسجلاً، سيتم إرسال رابط إعادة التعيين'}
    
    # Generate secure reset token
    reset_token = secrets.token_urlsafe(32)
    
    # Store token with expiration (1 hour)
    await db.password_resets.update_one(
        {'email': data.email},
        {
            '$set': {
                'email': data.email,
                'reset_token': reset_token,
                'created_at': datetime.utcnow(),
                'expires_at': datetime.utcnow().replace(second=0, microsecond=0) + __import__('datetime').timedelta(hours=1),
                'used': False
            }
        },
        upsert=True
    )
    
    # Build reset URL
    frontend_url = os.environ.get("PUBLIC_APP_URL", DEFAULT_PUBLIC_BASE_URL).rstrip("/")
    reset_url = f"{frontend_url}/forgot-password?token={reset_token}"
    
    # Send email with reset link
    try:
        from services.email_service import send_email
        await send_email(
            to_email=data.email,
            subject='إعادة تعيين كلمة المرور - صقر',
            html_content=f'''
            <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px;">
                <h2 style="color: #3b82f6;">إعادة تعيين كلمة المرور</h2>
                <p>مرحباً،</p>
                <p>لإعادة تعيين كلمة المرور، اضغط على الزر أدناه:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold;">
                        إعادة تعيين كلمة المرور
                    </a>
                </div>
                <p>أو انسخ هذا الرابط:</p>
                <p style="background: #f3f4f6; padding: 10px; border-radius: 5px; word-break: break-all;">{reset_url}</p>
                <p style="color: #ef4444;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
                <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذه الرسالة.</p>
                <p style="color: #6b7280; margin-top: 30px;">فريق صقر</p>
            </div>
            '''
        )
    except Exception as e:
        print(f"Failed to send reset email: {e}")
        # Continue anyway - token is stored
    
    return {'message': 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني'}

@router.post('/verify-reset-otp', response_model=dict)
async def verify_reset_otp(data: VerifyResetOTPRequest):
    """
    Verify the OTP and return a reset token
    """
    db = get_db()
    
    # Find valid OTP
    reset_record = await db.password_resets.find_one({
        'email': data.email,
        'otp': data.otp,
        'used': False
    })
    
    if not reset_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='رمز التحقق غير صحيح'
        )
    
    # Check if expired
    if reset_record.get('expires_at') and reset_record['expires_at'] < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='انتهت صلاحية رمز التحقق'
        )
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    
    # Update record with reset token
    await db.password_resets.update_one(
        {'email': data.email, 'otp': data.otp},
        {
            '$set': {
                'reset_token': reset_token,
                'token_expires_at': datetime.utcnow().replace(second=0, microsecond=0) + __import__('datetime').timedelta(minutes=30)
            }
        }
    )
    
    return {'reset_token': reset_token, 'message': 'تم التحقق بنجاح'}

@router.post('/reset-password', response_model=dict)
async def reset_password(data: ResetPasswordRequest):
    """
    Reset user's password using the reset token (No OTP)
    """
    db = get_db()
    
    # Verify reset token
    reset_record = await db.password_resets.find_one({
        'reset_token': data.reset_token,
        'used': False
    })
    
    if not reset_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='رابط إعادة التعيين غير صالح'
        )
    
    # Check if token expired
    if reset_record.get('expires_at') and reset_record['expires_at'] < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='انتهت صلاحية رابط إعادة التعيين'
        )
    
    email = reset_record['email']
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='كلمة المرور يجب أن تكون 6 أحرف على الأقل'
        )
    
    # Hash new password
    new_password_hash = bcrypt.hash(data.new_password)
    
    # Update user's password
    result = await db.users.update_one(
        {'email': email},
        {
            '$set': {
                'password_hash': new_password_hash,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='المستخدم غير موجود'
        )
    
    # Mark reset record as used
    await db.password_resets.update_one(
        {'reset_token': data.reset_token},
        {'$set': {'used': True}}
    )
    
    return {'message': 'تم تغيير كلمة المرور بنجاح'}



# ==================== Apple Sign In ====================

from fastapi.responses import RedirectResponse
import secrets
import httpx

# Store sessions temporarily
apple_sessions = {}

class AppleTokenRequest(BaseModel):
    code: str
    id_token: str = None

@router.get('/apple')
async def apple_sign_in_redirect(request: Request, redirect_uri: str = 'saqr://auth/callback'):
    """
    Redirect to Apple Sign In page
    """
    # Apple OAuth configuration
    client_id, apple_enabled = await _resolve_apple_client_id('com.saqr.rewards')
    if not apple_enabled:
        return RedirectResponse(url=f"{redirect_uri}?error=apple_not_configured")
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store state with redirect_uri
    apple_sessions[state] = {
        'redirect_uri': redirect_uri,
        'created_at': datetime.utcnow()
    }
    await _save_oauth_temp(state, {
        'redirect_uri': redirect_uri,
        'provider': 'apple',
        'kind': 'state',
    })
    
    # Apple authorization URL
    callback_uri = _resolve_apple_redirect_uri(request)
    apple_auth_url = (
        f"https://appleid.apple.com/auth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={callback_uri}"
        f"&response_type=code%20id_token"
        f"&scope=name%20email"
        f"&response_mode=form_post"
        f"&state={state}"
    )
    
    return RedirectResponse(url=apple_auth_url)


@router.post('/apple/callback')
async def apple_sign_in_callback(request: Request):
    """
    Handle Apple Sign In callback
    """
    try:
        db = get_db()
        
        # Get form data
        form = await request.form()
        code = form.get('code')
        id_token = form.get('id_token')
        state = form.get('state')
        user_data = form.get('user')  # Only provided on first sign in
        
        if not code and not id_token:
            raise HTTPException(status_code=400, detail='Missing authorization code or id_token')
        
        # Get redirect_uri from state
        session_data = await _pop_oauth_temp(state) or apple_sessions.get(state, {})
        redirect_uri = session_data.get('redirect_uri', 'saqr://auth/callback')
        
        # Clean up old sessions
        if state in apple_sessions:
            del apple_sessions[state]
        
        # Decode id_token to get user info
        import jwt
        apple_user = None
        
        if id_token:
            # Decode without verification for now (Apple tokens are self-signed)
            try:
                decoded = jwt.decode(id_token, options={"verify_signature": False})
                apple_user = {
                    'id': decoded.get('sub'),
                    'email': decoded.get('email'),
                }
            except Exception as e:
                print(f"Error decoding Apple token: {e}")
        
        # Parse user data if provided (first sign in only)
        name = ''
        if user_data:
            try:
                import json
                parsed_user = json.loads(user_data)
                first_name = parsed_user.get('name', {}).get('firstName', '')
                last_name = parsed_user.get('name', {}).get('lastName', '')
                name = f"{first_name} {last_name}".strip()
            except Exception:
                pass
        
        if not apple_user or not apple_user.get('id'):
            raise HTTPException(status_code=400, detail='Could not get user info from Apple')
        
        # Check if user exists
        existing_user = await db.users.find_one({
            '$or': [
                {'provider': 'apple', 'provider_id': apple_user['id']},
                {'email': apple_user.get('email')}
            ]
        })
        
        if existing_user:
            # Update existing user
            user_id = existing_user.get('id') or existing_user.get('user_id')
            await db.users.update_one(
                {'$or': [{'id': user_id}, {'user_id': user_id}]},
                {'$set': {
                    'provider': 'apple',
                    'provider_id': apple_user['id'],
                    'updated_at': datetime.utcnow()
                }}
            )
        else:
            # Create new user with friendly default name if Apple didn't share one.
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            display_name = (name or '').strip() or f"صديق صقر {user_id[-4:]}"
            new_user = {
                'id': user_id,
                'email': apple_user.get('email', f"{apple_user['id']}@privaterelay.appleid.com"),
                'name': display_name,
                'needs_name_setup': not bool((name or '').strip()),
                'provider': 'apple',
                'provider_id': apple_user['id'],
                'points': 0,
                'saqr_points': 0,
                'saqr_gems': 0,
                'diamonds': 100,
                'total_earned': 0,
                'is_guest': False,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            await db.users.insert_one(new_user)
        
        # Create session
        session_id = secrets.token_urlsafe(32)
        token, refresh = create_token_pair(user_id)
        
        # Store session temporarily
        apple_sessions[session_id] = {
            'user_id': user_id,
            'token': token,
            'refresh_token': refresh,
            'created_at': datetime.utcnow()
        }
        await _save_oauth_temp(session_id, {
            'user_id': user_id,
            'token': token,
            'refresh_token': refresh,
            'kind': 'session',
        })
        
        # Redirect back to app
        return RedirectResponse(url=f"{redirect_uri}?session_id={session_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Apple Sign In Error: {e}")
        # Redirect with error
        return RedirectResponse(url=f"saqr://auth/callback?error=auth_failed")


@router.get('/session/{session_id}')
async def get_session(session_id: str):
    """
    Get session data after OAuth callback
    """
    db = get_db()
    
    session_data = await _pop_oauth_temp(session_id) or apple_sessions.get(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail='Session not found or expired')
    
    # Clean up session
    if session_id in apple_sessions:
        del apple_sessions[session_id]
    
    # Get user data
    user = await db.users.find_one({'$or': [{'id': session_data['user_id']}, {'user_id': session_data['user_id']}]})
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    
    return {
        'token': session_data['token'],
        'refresh_token': session_data.get('refresh_token'),
        'user': {
            'id': user.get('id', user.get('user_id')),
            'email': user.get('email', ''),
            'name': user.get('name', 'مستخدم'),
            'avatar': user.get('avatar'),
            'points': user.get('saqr_points', user.get('points', 0)),
            'saqr_gems': user.get('saqr_gems', user.get('saqr_points', user.get('points', 0))),
            'diamonds': user.get('diamonds', 0),
            'total_earned': user.get('total_earned', 0),
            'joined_date': user.get('created_at', datetime.utcnow()).isoformat()
        }
    }



class AppleNativeLogin(BaseModel):
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    identity_token: Optional[str] = None

@router.post('/apple/native')
async def apple_native_sign_in(data: AppleNativeLogin):
    """Handle native Apple Sign In from mobile app.

    SEC-002 fix: verify the identity_token signature against Apple's public
    keys, and use ONLY the verified `sub` claim as the Apple user id. The
    client-supplied `user_id` / `email` cannot be trusted alone.
    """
    try:
        db = get_db()

        if not data.identity_token:
            raise HTTPException(status_code=400, detail='Missing identity_token')

        # Verify the Apple identity token
        try:
            import jwt as _jwt
            from jwt import PyJWKClient

            # Decode header to get the kid
            header = _jwt.get_unverified_header(data.identity_token)
            kid = header.get('kid')
            if not kid:
                raise HTTPException(status_code=401, detail='invalid_token_header')

            jwks = PyJWKClient('https://appleid.apple.com/auth/keys')
            signing_key = jwks.get_signing_key_from_jwt(data.identity_token)
            decoded = _jwt.decode(
                data.identity_token,
                signing_key.key,
                algorithms=['RS256'],
                audience=os.environ.get('APPLE_CLIENT_ID') or None,
                options={
                    'verify_signature': True,
                    'verify_exp': True,
                    'verify_iss': True,
                    # audience verification only when APPLE_CLIENT_ID is set
                    'verify_aud': bool(os.environ.get('APPLE_CLIENT_ID')),
                },
                issuer='https://appleid.apple.com',
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=401, detail=f'apple_token_invalid: {e}')

        apple_sub = decoded.get('sub')
        apple_email = decoded.get('email') or data.email
        if not apple_sub:
            raise HTTPException(status_code=401, detail='apple_token_missing_sub')

        # Only match on VERIFIED provider_id, never on client-supplied email
        existing_user = await db.users.find_one({
            'provider': 'apple', 'provider_id': apple_sub,
        })

        if existing_user:
            # Update existing user
            user_id = existing_user.get('id') or existing_user.get('user_id')
            update_data = {
                'provider': 'apple',
                'provider_id': apple_sub,
                'updated_at': datetime.utcnow(),
            }
            if data.name and (not existing_user.get('name') or existing_user.get('name') == 'مستخدم Apple'):
                update_data['name'] = data.name
            elif existing_user.get('name') == 'مستخدم Apple':
                update_data['name'] = 'صديق صقر'

            await db.users.update_one(
                {'$or': [{'id': user_id}, {'user_id': user_id}]},
                {'$set': update_data},
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            default_name = (data.name or '').strip() or f"صديق صقر {user_id[-4:]}"
            new_user = {
                'id': user_id,
                'email': apple_email or f"{apple_sub[:10]}@privaterelay.appleid.com",
                'name': default_name,
                'needs_name_setup': not bool((data.name or '').strip()),
                'provider': 'apple',
                'provider_id': apple_sub,
                'points': 0,
                'saqr_points': 0,
                'saqr_gems': 0,
                'diamonds': 100,
                'total_earned': 0,
                'is_guest': False,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
            }
            await db.users.insert_one(new_user)
        
        # Create tokens
        token, refresh = create_token_pair(user_id)
        
        # Get user data
        user = await db.users.find_one({'$or': [{'id': user_id}, {'user_id': user_id}]})
        
        return {
            'token': token,
            'refresh_token': refresh,
            'user': {
                'id': user.get('id', user.get('user_id')),
                'email': user.get('email', ''),
                'name': user.get('name', 'مستخدم'),
                'avatar': user.get('avatar'),
                'points': user.get('saqr_points', user.get('points', 0)),
                'saqr_gems': user.get('saqr_gems', user.get('saqr_points', user.get('points', 0))),
                'diamonds': user.get('diamonds', 0),
                'total_earned': user.get('total_earned', 0),
                'joined_date': user.get('created_at', datetime.utcnow()).isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Apple Native Sign In Error: {e}")
        raise HTTPException(status_code=500, detail='فشل تسجيل الدخول')



# ==================== Google Sign In ====================

@router.get('/google')
async def google_sign_in_redirect(request: Request, redirect_uri: str = 'saqr://auth/callback'):
    """
    Redirect to Google Sign In page
    """
    import secrets
    
    client_id, _, google_enabled = await _resolve_google_credentials()
    
    if not google_enabled or not client_id:
        # Return error if no client ID configured
        return RedirectResponse(url=f"{redirect_uri}?error=google_not_configured")
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store state with redirect_uri
    apple_sessions[state] = {
        'redirect_uri': redirect_uri,
        'provider': 'google',
        'created_at': datetime.utcnow()
    }
    await _save_oauth_temp(state, {
        'redirect_uri': redirect_uri,
        'provider': 'google',
        'kind': 'state',
    })
    
    # Google authorization URL
    callback_uri = _resolve_google_redirect_uri(request)
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={callback_uri}"
        f"&response_type=code"
        f"&scope=email%20profile"
        f"&access_type=offline"
        f"&state={state}"
    )
    
    return RedirectResponse(url=google_auth_url)


@router.get('/google/callback')
async def google_sign_in_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """
    Handle Google Sign In callback
    """
    try:
        db = get_db()
        
        if error:
            session_data = await _pop_oauth_temp(state) or apple_sessions.get(state, {})
            redirect_uri = session_data.get('redirect_uri', 'saqr://auth/callback')
            return RedirectResponse(url=f"{redirect_uri}?error={error}")
        
        if not code:
            raise HTTPException(status_code=400, detail='Missing authorization code')
        
        # Get redirect_uri from state
        session_data = await _pop_oauth_temp(state) or apple_sessions.get(state, {})
        redirect_uri = session_data.get('redirect_uri', 'saqr://auth/callback')
        
        # Clean up session
        if state in apple_sessions:
            del apple_sessions[state]
        
        # Exchange code for tokens
        client_id, client_secret, google_enabled = await _resolve_google_credentials()
        
        if not google_enabled or not client_id or not client_secret:
            return RedirectResponse(url=f"{redirect_uri}?error=google_not_configured")
        
        callback_uri = _resolve_google_redirect_uri(request)
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'code': code,
                    'grant_type': 'authorization_code',
                    'redirect_uri': callback_uri
                }
            )
            
            if token_response.status_code != 200:
                return RedirectResponse(url=f"{redirect_uri}?error=token_exchange_failed")
            
            tokens = token_response.json()
            access_token = tokens.get('access_token')
            
            # Get user info
            userinfo_response = await client.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                headers={'Authorization': f'Bearer {access_token}'}
            )
            
            if userinfo_response.status_code != 200:
                return RedirectResponse(url=f"{redirect_uri}?error=userinfo_failed")
            
            google_user = userinfo_response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({
            '$or': [
                {'provider': 'google', 'provider_id': google_user.get('id')},
                {'email': google_user.get('email')}
            ]
        })
        
        if existing_user:
            user_id = existing_user.get('id') or existing_user.get('user_id')
            await db.users.update_one(
                {'$or': [{'id': user_id}, {'user_id': user_id}]},
                {'$set': {
                    'provider': 'google',
                    'provider_id': google_user.get('id'),
                    'avatar': google_user.get('picture'),
                    'updated_at': datetime.utcnow()
                }}
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                'id': user_id,
                'email': google_user.get('email', ''),
                'name': google_user.get('name', 'مستخدم Google'),
                'avatar': google_user.get('picture'),
                'provider': 'google',
                'provider_id': google_user.get('id'),
                'points': 0,
                'saqr_points': 0,
                'saqr_gems': 0,
                'diamonds': 100,
                'total_earned': 0,
                'is_guest': False,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            await db.users.insert_one(new_user)
        
        # Create session
        import secrets
        session_id = secrets.token_urlsafe(32)
        token, refresh = create_token_pair(user_id)
        
        apple_sessions[session_id] = {
            'user_id': user_id,
            'token': token,
            'refresh_token': refresh,
            'created_at': datetime.utcnow()
        }
        await _save_oauth_temp(session_id, {
            'user_id': user_id,
            'token': token,
            'refresh_token': refresh,
            'kind': 'session',
        })
        
        return RedirectResponse(url=f"{redirect_uri}?session_id={session_id}")
        
    except Exception as e:
        print(f"Google Sign In Error: {e}")
        return RedirectResponse(url=f"saqr://auth/callback?error=auth_failed")


@router.get('/providers-status', response_model=dict)
async def oauth_providers_status():
    """Expose OAuth provider availability for mobile UI guards."""
    google_client_id, google_client_secret, google_enabled = await _resolve_google_credentials()
    _, apple_enabled = await _resolve_apple_client_id('com.saqr.rewards')
    return {
        "google_enabled": bool(google_enabled and google_client_id and google_client_secret),
        # Native Apple Sign In can work without web OAuth client_id.
        "apple_enabled": bool(apple_enabled),
        "email_enabled": True,
    }


@router.get('/is-admin')
async def is_admin_endpoint(user_id: str = ""):
    """Mobile/web UI calls this to decide whether to show the admin panel."""
    return await _check_is_admin(user_id)
