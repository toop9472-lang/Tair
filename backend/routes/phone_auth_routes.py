# Phone Verification Routes - مسارات التحقق عبر الجوال
from fastapi import APIRouter, HTTPException, status, Request, Depends
from auth.actor import require_actor
from pydantic import BaseModel, field_validator
from motor.motor_asyncio import AsyncIOMotorClient
from services.sms_service import send_otp, verify_otp, format_phone_number, is_phone_verified
from auth.jwt_handler import create_token_pair
from auth.password_utils import validate_password_strength
from passlib.hash import bcrypt
from datetime import datetime, timedelta
from services.display_names import assert_unique_name
import os
import uuid
import re

router = APIRouter(prefix='/phone', tags=['Phone Authentication'])

def get_db():
    """Get database connection"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ.get('DB_NAME', 'saqr_db')]

def validate_saudi_phone(phone: str) -> bool:
    """Validate Saudi phone number"""
    # Remove formatting
    phone = phone.replace(' ', '').replace('-', '')
    
    # Check various formats
    patterns = [
        r'^05\d{8}$',           # 05xxxxxxxx
        r'^\+9665\d{8}$',       # +9665xxxxxxxx
        r'^9665\d{8}$',         # 9665xxxxxxxx
        r'^5\d{8}$',            # 5xxxxxxxx
    ]
    
    return any(re.match(p, phone) for p in patterns)

class SendOTPRequest(BaseModel):
    phone: str
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not validate_saudi_phone(v):
            raise ValueError('رقم الجوال غير صالح. يجب أن يكون رقم سعودي')
        return v

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    
    @field_validator('otp')
    @classmethod
    def validate_otp(cls, v):
        if not v.isdigit() or len(v) != 6:
            raise ValueError('رمز التحقق يجب أن يكون 6 أرقام')
        return v

class RegisterWithPhoneRequest(BaseModel):
    phone: str
    otp: str
    name: str
    password: str
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not validate_saudi_phone(v):
            raise ValueError('رقم الجوال غير صالح')
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('الاسم يجب أن يكون حرفين على الأقل')
        return v.strip()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        is_valid, errors = validate_password_strength(v)
        if not is_valid:
            raise ValueError(errors[0])
        return v

class LoginWithPhoneRequest(BaseModel):
    phone: str
    password: str

class VerifyLoginOTPRequest(BaseModel):
    phone: str
    otp: str
    session_token: str

class ResetPasswordRequest(BaseModel):
    phone: str
    otp: str
    new_password: str
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        is_valid, errors = validate_password_strength(v)
        if not is_valid:
            raise ValueError(errors[0])
        return v


# ==================== REGISTRATION ====================

@router.post('/send-otp')
async def send_verification_otp(data: SendOTPRequest):
    """
    Passwordless OTP send — works for both new and existing users.
    """
    success, message, otp_debug = await send_otp(data.phone, 'verification')

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message
        )

    response = {'success': True, 'message': message}

    # Include OTP in response for development mode
    if otp_debug:
        response['otp_debug'] = otp_debug
        response['note'] = 'وضع التطوير - الرمز مرفق للاختبار'

    return response

@router.post('/verify-otp')
async def verify_registration_otp(data: VerifyOTPRequest):
    """
    التحقق من رمز التسجيل
    """
    success, message = await verify_otp(data.phone, data.otp, 'verification')
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    return {'success': True, 'message': message, 'verified': True}

@router.post('/register')
async def register_with_phone(data: RegisterWithPhoneRequest, request: Request):
    """
    التسجيل برقم الجوال بعد التحقق
    """
    db = get_db()
    formatted_phone = format_phone_number(data.phone)
    
    # Verify OTP was validated
    success, message = await verify_otp(data.phone, data.otp, 'verification')
    if not success:
        # Check if already verified recently
        if not await is_phone_verified(data.phone):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='يرجى التحقق من رمز الجوال أولاً'
            )
    
    # Check if phone already exists
    existing = await db.users.find_one({'phone': formatted_phone})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='رقم الجوال مسجل بالفعل'
        )
    
    # Validate password
    is_valid, errors = validate_password_strength(data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0]
        )
    
    # Create user
    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hash(data.password)
    client_ip = request.client.host if request.client else None
    
    user_doc = {
        'id': user_id,
        'phone': formatted_phone,
        'name': data.name,
        'password_hash': password_hash,
        'provider': 'phone',
        'provider_id': formatted_phone,
        'avatar': f"https://ui-avatars.com/api/?name={data.name}&background=6366f1&color=fff",
        'points': 0,
        'saqr_points': 0,
        'saqr_gems': 0,
        'diamonds': 300,
        'total_earned': 0,
        'watched_ads': [],
        'status': 'active',
        'phone_verified': True,
        'registration_ip': client_ip,
        'diamond_transactions': [{
            'type': 'welcome_bonus',
            'amount': 300,
            'timestamp': datetime.utcnow().isoformat(),
        }],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)

    
    user_doc.pop("_id", None)
    
    # Create tokens
    access_token, refresh_token = create_token_pair(user_id)
    
    return {
        'success': True,
        'token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user_id,
            'phone': formatted_phone,
            'name': data.name,
            'avatar': user_doc['avatar'],
            'points': 0,
            'saqr_gems': 0,
            'diamonds': 300,
        }
    }


# ==================== LOGIN WITH 2FA ====================

@router.post('/login')
async def login_with_phone(data: LoginWithPhoneRequest):
    """
    تسجيل الدخول برقم الجوال - الخطوة الأولى
    """
    db = get_db()
    formatted_phone = format_phone_number(data.phone)
    
    # Find user by phone
    user = await db.users.find_one({'phone': formatted_phone}, {'_id': 0})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='رقم الجوال أو كلمة المرور غير صحيحة'
        )
    
    # Verify password
    if not bcrypt.verify(data.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='رقم الجوال أو كلمة المرور غير صحيحة'
        )
    
    # Check if account is active
    if user.get('status') == 'suspended':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='الحساب معطل'
        )
    
    # Generate session token for 2FA
    session_token = str(uuid.uuid4())
    
    # Store pending login session
    await db.pending_logins.insert_one({
        'session_token': session_token,
        'user_id': user['id'],
        'phone': formatted_phone,
        'created_at': datetime.utcnow(),
        'expires_at': datetime.utcnow() + timedelta(minutes=10)
    })
    
    # Send OTP for login
    success, message, otp_debug = await send_otp(data.phone, 'login')
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message
        )
    
    response = {
        'success': True,
        'requires_otp': True,
        'session_token': session_token,
        'message': 'تم إرسال رمز التحقق'
    }
    
    if otp_debug:
        response['otp_debug'] = otp_debug
    
    return response

@router.post('/verify-login')
async def verify_login_otp(data: VerifyLoginOTPRequest):
    """
    التحقق من رمز تسجيل الدخول - الخطوة الثانية
    """
    db = get_db()
    
    # Find pending login session
    session = await db.pending_logins.find_one({
        'session_token': data.session_token,
        'expires_at': {'$gte': datetime.utcnow()}
    })
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='جلسة تسجيل الدخول منتهية. أعد المحاولة'
        )
    
    # Verify OTP
    success, message = await verify_otp(data.phone, data.otp, 'login')
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    # Delete pending session
    await db.pending_logins.delete_one({'session_token': data.session_token})
    
    # Get user
    user = await db.users.find_one({'id': session['user_id']}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='المستخدم غير موجود'
        )
    
    # Update last login
    await db.users.update_one(
        {'id': session['user_id']},
        {'$set': {'last_login': datetime.utcnow()}}
    )
    
    # Create tokens
    access_token, refresh_token = create_token_pair(session['user_id'])
    
    return {
        'success': True,
        'token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user['id'],
            'phone': user.get('phone'),
            'email': user.get('email'),
            'name': user.get('name'),
            'avatar': user.get('avatar'),
            'points': user.get('saqr_points', user.get('points', 0)),
            'saqr_gems': user.get('saqr_gems', user.get('saqr_points', user.get('points', 0))),
            'diamonds': user.get('diamonds', 300),
        }
    }


# ==================== PASSWORD RESET ====================

@router.post('/forgot-password')
async def forgot_password(data: SendOTPRequest):
    """
    طلب استعادة كلمة المرور
    """
    db = get_db()
    formatted_phone = format_phone_number(data.phone)
    
    # Check if user exists
    user = await db.users.find_one({'phone': formatted_phone})
    
    if not user:
        # Don't reveal if phone exists or not
        return {'success': True, 'message': 'إذا كان الرقم مسجلاً، سيتم إرسال رمز التحقق'}
    
    # Send OTP
    success, message, otp_debug = await send_otp(data.phone, 'password_reset')
    
    response = {'success': True, 'message': 'تم إرسال رمز استعادة كلمة المرور'}
    
    if otp_debug:
        response['otp_debug'] = otp_debug
    
    return response

@router.post('/reset-password')
async def reset_password(data: ResetPasswordRequest):
    """
    إعادة تعيين كلمة المرور
    """
    db = get_db()
    formatted_phone = format_phone_number(data.phone)
    
    # Verify OTP
    success, message = await verify_otp(data.phone, data.otp, 'password_reset')
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    # Validate new password
    is_valid, errors = validate_password_strength(data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0]
        )
    
    # Find user
    user = await db.users.find_one({'phone': formatted_phone})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='المستخدم غير موجود'
        )
    
    # Update password
    password_hash = bcrypt.hash(data.new_password)
    
    await db.users.update_one(
        {'phone': formatted_phone},
        {'$set': {
            'password_hash': password_hash,
            'updated_at': datetime.utcnow()
        }}
    )
    
    return {'success': True, 'message': 'تم تغيير كلمة المرور بنجاح'}


# ==================== UTILITY ====================

@router.get('/check/{phone}')
async def check_phone(phone: str):
    """
    التحقق من وجود رقم الجوال
    """
    db = get_db()
    formatted_phone = format_phone_number(phone)
    
    user = await db.users.find_one({'phone': formatted_phone})
    
    return {
        'exists': user is not None,
        'can_register': user is None
    }


# ==================== PASSWORDLESS OTP LOGIN (Tair) ====================

class OtpLoginRequest(BaseModel):
    phone: str
    otp: str
    name: str | None = None  # required only if new user

    @field_validator('phone')
    @classmethod
    def _v_phone(cls, v):
        if not validate_saudi_phone(v):
            raise ValueError('رقم الجوال غير صالح')
        return v

    @field_validator('otp')
    @classmethod
    def _v_otp(cls, v):
        if not v.isdigit() or len(v) != 6:
            raise ValueError('رمز التحقق يجب أن يكون 6 أرقام')
        return v


@router.post('/otp-login')
async def otp_login_or_register(data: OtpLoginRequest, request: Request):
    """
    Passwordless: verify OTP → if user exists → login; else register with name.
    Returns { token, user, is_new_user }
    """
    db = get_db()
    formatted_phone = format_phone_number(data.phone)

    # 1) Verify OTP (accept both verification & login purposes)
    ok_v, _ = await verify_otp(data.phone, data.otp, 'verification')
    ok_l, _ = await verify_otp(data.phone, data.otp, 'login')
    if not (ok_v or ok_l or await is_phone_verified(data.phone)):
        raise HTTPException(400, 'رمز التحقق غير صحيح أو منتهي')

    # 2) Find or create user
    user = await db.users.find_one({'phone': formatted_phone})
    is_new = user is None

    if is_new:
        try:
            name = await assert_unique_name(db, data.name or '')
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        user_id = str(uuid.uuid4())
        client_ip = request.client.host if request.client else None
        user_doc = {
            'id': user_id,
            'user_id': user_id,
            'phone': formatted_phone,
            'name': name,
            'email': None,
            'provider': 'phone',
            'avatar': f"https://ui-avatars.com/api/?name={name}&background=0d9488&color=fff",
            'points': 0,
            'saqr_gems': 0,
            'diamonds': 300,
            'total_earned': 0,
            'watched_ads': [],
            'status': 'active',
            'phone_verified': True,
            'registration_ip': client_ip,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        }
        await db.users.insert_one(user_doc)
        user = user_doc

    user.pop('_id', None)
    uid = user.get('id') or user.get('user_id')
    access_token, refresh_token = create_token_pair(uid)

    return {
        'success': True,
        'is_new_user': is_new,
        'token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': uid,
            'user_id': uid,
            'phone': user.get('phone'),
            'name': user.get('name'),
            'avatar': user.get('avatar'),
            'email': user.get('email'),
            'profile_bg_url': user.get('profile_bg_url'),
            'bio': user.get('bio'),
            'is_verified_carrier': user.get('is_verified_carrier', False),
            'is_verified_shop': user.get('is_verified_shop', False),
        }
    }


# ==================== PROFILE UPDATES (bg / bio) ====================

class UpdateProfileRequest(BaseModel):
    profile_bg_url: str | None = None
    avatar: str | None = None
    bio: str | None = None
    name: str | None = None
    phone: str | None = None
    whatsapp: str | None = None


def _normalize_digits(s: str | None) -> str | None:
    """Convert Arabic-Indic and Persian digits to Latin digits so mobile
    regex `/[^0-9]/g` still finds the phone number. Any non-digit character
    is preserved (so leading '+' stays)."""
    if not s:
        return s
    arabic = "٠١٢٣٤٥٦٧٨٩"
    persian = "۰۱۲۳۴۵۶۷۸۹"
    out = []
    for ch in s:
        if ch in arabic:
            out.append(str(arabic.index(ch)))
        elif ch in persian:
            out.append(str(persian.index(ch)))
        else:
            out.append(ch)
    return "".join(out)


@router.post('/update-profile')
async def update_profile(data: UpdateProfileRequest, user_id: str, actor: str = Depends(require_actor)):
    db = get_db()
    updates = {'updated_at': datetime.utcnow()}
    if data.profile_bg_url is not None:
        updates['profile_bg_url'] = data.profile_bg_url
    if data.avatar is not None:
        updates['avatar'] = data.avatar
    if data.bio is not None:
        updates['bio'] = data.bio.strip()[:500]
    if data.name is not None:
        try:
            n = await assert_unique_name(db, data.name, user_id)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        updates['name'] = n
        updates['name_key'] = n.casefold()
        updates['needs_name_setup'] = False
    if data.phone is not None:
        p = _normalize_digits(data.phone.strip())
        updates['phone'] = p or None
    if data.whatsapp is not None:
        w = _normalize_digits(data.whatsapp.strip())
        updates['whatsapp'] = w or None

    r = await db.users.update_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}, {'email': user_id}]},
        {'$set': updates},
    )
    if r.matched_count == 0:
        raise HTTPException(404, 'المستخدم غير موجود')
    return {'success': True}


# ==================== FOLLOW / UNFOLLOW ====================

@router.post('/follow/{seller_id}')
async def toggle_follow(seller_id: str, user_id: str):
    if seller_id == user_id:
        raise HTTPException(400, 'لا يمكنك متابعة نفسك')
    db = get_db()
    existing = await db.tair_follows.find_one({'follower_id': user_id, 'followee_id': seller_id})
    if existing:
        await db.tair_follows.delete_one({'_id': existing['_id']})
        return {'following': False}
    await db.tair_follows.insert_one({
        'follower_id': user_id,
        'followee_id': seller_id,
        'created_at': datetime.utcnow(),
    })
    # Notify the seller
    try:
        from routes.tair_notifications_routes import create_tair_notification
        follower = await db.users.find_one(
            {'$or': [{'id': user_id}, {'user_id': user_id}]},
            {'name': 1},
        )
        follower_name = (follower or {}).get('name') or 'متابع جديد'
        await create_tair_notification(
            user_id=seller_id,
            title='متابع جديد',
            body=f'{follower_name} بدأ بمتابعتك',
            notif_type='follow',
            data={'follower_id': user_id},
        )
    except Exception:
        pass
    return {'following': True}


@router.get('/follow-status/{seller_id}')
async def follow_status(seller_id: str, user_id: str):
    db = get_db()
    existing = await db.tair_follows.find_one({'follower_id': user_id, 'followee_id': seller_id})
    followers = await db.tair_follows.count_documents({'followee_id': seller_id})
    return {'following': existing is not None, 'followers_count': followers}


@router.get('/profile/{user_id}')
async def get_public_profile(user_id: str):
    db = get_db()
    user = await db.users.find_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'_id': 0, 'password_hash': 0, 'registration_ip': 0, 'diamond_transactions': 0},
    )
    if not user:
        raise HTTPException(404, 'المستخدم غير موجود')
    # Derive verified flags from latest approved KYC submission
    kyc = await db.kyc_submissions.find_one(
        {'user_id': user.get('id') or user.get('user_id'), 'status': 'approved'},
        sort=[('reviewed_at', -1)],
    )
    if kyc:
        if kyc.get('role') == 'carrier':
            user['is_verified_carrier'] = True
        elif kyc.get('role') == 'shop':
            user['is_verified_shop'] = True
    # Follower count
    user['followers_count'] = await db.tair_follows.count_documents({'followee_id': user_id})
    # Strip sensitive
    user.pop('phone', None)
    return user
