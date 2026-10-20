from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import jwt
import os
import secrets

JWT_SECRET = os.getenv('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = 'HS256'
JWT_ACCESS_TOKEN_HOURS = 24  # 24 ساعة للـ access token
JWT_REFRESH_TOKEN_DAYS = 30  # 30 يوم للـ refresh token

def create_access_token(user_id: str, is_admin: bool = False) -> str:
    """
    Create JWT access token for user - صالح 24 ساعة
    """
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_ACCESS_TOKEN_HOURS)
    payload = {
        'user_id': user_id,
        'type': 'access',
        'is_admin': is_admin,
        'exp': expiration,
        'iat': datetime.now(timezone.utc),
        'jti': secrets.token_hex(16)  # معرف فريد للـ token
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    """
    Create JWT refresh token - صالح 30 يوم
    """
    expiration = datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_TOKEN_DAYS)
    payload = {
        'user_id': user_id,
        'type': 'refresh',
        'exp': expiration,
        'iat': datetime.now(timezone.utc),
        'jti': secrets.token_hex(16)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_token_pair(user_id: str, is_admin: bool = False) -> Tuple[str, str]:
    """
    Create both access and refresh tokens
    """
    access_token = create_access_token(user_id, is_admin)
    refresh_token = create_refresh_token(user_id)
    return access_token, refresh_token

def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and verify JWT token
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        # التحقق من نوع التوكن
        if payload.get('type') not in ['access', 'refresh', None]:  # None للتوافق مع التوكنات القديمة
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def decode_refresh_token(token: str) -> Optional[dict]:
    """
    Decode and verify refresh token
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'refresh':
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_user_id_from_token(token: str) -> Optional[str]:
    """
    Extract user_id from token
    """
    payload = decode_access_token(token)
    if payload:
        return payload.get('user_id')
    return None

def is_token_valid(token: str) -> bool:
    """
    Check if token is valid and not expired
    """
    return decode_access_token(token) is not None

def refresh_access_token(refresh_token: str) -> Optional[str]:
    """
    Generate new access token using refresh token
    """
    payload = decode_refresh_token(refresh_token)
    if payload:
        user_id = payload.get('user_id')
        if user_id:
            return create_access_token(user_id)
    return None