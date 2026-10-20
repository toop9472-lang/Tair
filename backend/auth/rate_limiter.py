"""
Login Rate Limiter - حد محاولات تسجيل الدخول
منع هجمات Brute Force
"""
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional
from motor.motor_asyncio import AsyncIOMotorClient
import os

# إعدادات Rate Limiting
MAX_LOGIN_ATTEMPTS = 5  # الحد الأقصى للمحاولات
LOCKOUT_DURATION_MINUTES = 15  # مدة القفل بالدقائق
ATTEMPT_WINDOW_MINUTES = 30  # نافذة المحاولات

def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


async def check_login_allowed(email: str, ip_address: str = None) -> Tuple[bool, Optional[str], Optional[int]]:
    """
    التحقق من إمكانية تسجيل الدخول
    Returns: (allowed, error_message, remaining_seconds)
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # البحث عن محاولات سابقة
    lockout = await db.login_attempts.find_one({
        'email': email.lower(),
        'locked_until': {'$gt': now}
    })
    
    if lockout:
        remaining = (lockout['locked_until'] - now).total_seconds()
        minutes = int(remaining // 60) + 1
        return False, f'تم قفل الحساب مؤقتاً. حاول بعد {minutes} دقيقة', int(remaining)
    
    # حساب المحاولات الفاشلة في آخر 30 دقيقة
    window_start = now - timedelta(minutes=ATTEMPT_WINDOW_MINUTES)
    
    attempts = await db.login_attempts.count_documents({
        'email': email.lower(),
        'success': False,
        'timestamp': {'$gte': window_start}
    })
    
    if attempts >= MAX_LOGIN_ATTEMPTS:
        # قفل الحساب
        await db.login_attempts.update_one(
            {'email': email.lower()},
            {
                '$set': {
                    'locked_until': now + timedelta(minutes=LOCKOUT_DURATION_MINUTES),
                    'lock_reason': 'too_many_failed_attempts'
                }
            },
            upsert=True
        )
        return False, f'تم قفل الحساب بسبب محاولات فاشلة متعددة. حاول بعد {LOCKOUT_DURATION_MINUTES} دقيقة', LOCKOUT_DURATION_MINUTES * 60
    
    remaining_attempts = MAX_LOGIN_ATTEMPTS - attempts
    return True, None, remaining_attempts


async def record_login_attempt(email: str, success: bool, ip_address: str = None, user_agent: str = None):
    """
    تسجيل محاولة تسجيل الدخول
    """
    db = get_db()
    
    await db.login_attempts.insert_one({
        'email': email.lower(),
        'success': success,
        'ip_address': ip_address,
        'user_agent': user_agent,
        'timestamp': datetime.now(timezone.utc)
    })
    
    # إذا نجح الدخول، إزالة القفل والمحاولات الفاشلة
    if success:
        await db.login_attempts.delete_many({
            'email': email.lower(),
            'success': False
        })
        await db.login_attempts.update_one(
            {'email': email.lower()},
            {'$unset': {'locked_until': '', 'lock_reason': ''}}
        )


async def clear_login_attempts(email: str):
    """
    مسح سجل المحاولات (للمسؤول فقط)
    """
    db = get_db()
    await db.login_attempts.delete_many({'email': email.lower()})


async def get_failed_attempts_count(email: str) -> int:
    """
    عدد المحاولات الفاشلة
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=ATTEMPT_WINDOW_MINUTES)
    
    return await db.login_attempts.count_documents({
        'email': email.lower(),
        'success': False,
        'timestamp': {'$gte': window_start}
    })
