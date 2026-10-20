# SMS Service - خدمة الرسائل النصية
# يدعم Twilio مع إمكانية إضافة مزودين آخرين

import os
import random
import string
from datetime import datetime, timedelta
from typing import Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorClient

# Twilio imports
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

def get_db():
    """Get database connection"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ.get('DB_NAME', 'saqr_db')]

def generate_otp(length: int = 6) -> str:
    """Generate a random OTP code"""
    return ''.join(random.choices(string.digits, k=length))

def format_phone_number(phone: str) -> str:
    """Format phone number to international format"""
    # Remove spaces and dashes
    phone = phone.replace(' ', '').replace('-', '')
    
    # If starts with 0, assume Saudi Arabia
    if phone.startswith('0'):
        phone = '+966' + phone[1:]
    # If doesn't start with +, add +966
    elif not phone.startswith('+'):
        if phone.startswith('966'):
            phone = '+' + phone
        else:
            phone = '+966' + phone
    
    return phone

async def send_sms(phone: str, message: str) -> Tuple[bool, str]:
    """
    Send SMS using Twilio
    Returns: (success, message/error)
    """
    # Check if Twilio is configured
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_PHONE_NUMBER')
    
    if not all([account_sid, auth_token, from_number]):
        # For development/testing - just log the message
        print(f"[SMS DEBUG] To: {phone}, Message: {message}")
        return True, "تم إرسال الرمز (وضع التطوير)"
    
    if not TWILIO_AVAILABLE:
        return False, "خدمة SMS غير متوفرة"
    
    try:
        client = TwilioClient(account_sid, auth_token)
        formatted_phone = format_phone_number(phone)
        
        sms = client.messages.create(
            body=message,
            from_=from_number,
            to=formatted_phone
        )
        
        return True, sms.sid
    except Exception as e:
        print(f"SMS Error: {e}")
        return False, str(e)

async def send_otp(phone: str, purpose: str = 'verification') -> Tuple[bool, str, Optional[str]]:
    """
    Generate and send OTP to phone number
    purpose: 'verification', 'login', 'password_reset'
    Returns: (success, message, otp_for_testing)
    """
    db = get_db()
    otp = generate_otp()
    formatted_phone = format_phone_number(phone)
    
    # Check rate limit (max 5 OTPs per hour)
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_otps = await db.otp_codes.count_documents({
        'phone': formatted_phone,
        'created_at': {'$gte': one_hour_ago}
    })
    
    if recent_otps >= 5:
        return False, "تم تجاوز الحد المسموح. حاول مرة أخرى بعد ساعة", None
    
    # Purpose messages
    messages = {
        'verification': f"رمز التحقق الخاص بك في صقر: {otp}\nصالح لمدة 5 دقائق",
        'login': f"رمز تسجيل الدخول الخاص بك في صقر: {otp}\nصالح لمدة 5 دقائق",
        'password_reset': f"رمز استعادة كلمة المرور في صقر: {otp}\nصالح لمدة 5 دقائق"
    }
    
    message = messages.get(purpose, messages['verification'])
    
    # Store OTP in database
    await db.otp_codes.insert_one({
        'phone': formatted_phone,
        'otp': otp,
        'purpose': purpose,
        'verified': False,
        'attempts': 0,
        'created_at': datetime.utcnow(),
        'expires_at': datetime.utcnow() + timedelta(minutes=5)
    })
    
    # Send SMS
    success, result = await send_sms(formatted_phone, message)

    # SEC-003 fix: NEVER return OTP in the API response, even when Twilio is
    # unconfigured. Log it server-side in dev so we can still validate during
    # local development; production requires configured SMS.
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    if not account_sid:
        # Dev mode: log locally, do NOT return to client.
        try:
            print(f"[dev-otp] phone={formatted_phone} otp={otp} purpose={purpose}")
        except Exception:
            pass

    if success:
        return True, "تم إرسال رمز التحقق", None
    else:
        return False, f"فشل إرسال الرسالة: {result}", None

async def verify_otp(phone: str, otp: str, purpose: str = 'verification') -> Tuple[bool, str]:
    """
    Verify OTP code
    Returns: (success, message)
    """
    db = get_db()
    formatted_phone = format_phone_number(phone)
    
    # Find the OTP
    otp_doc = await db.otp_codes.find_one({
        'phone': formatted_phone,
        'purpose': purpose,
        'verified': False,
        'expires_at': {'$gte': datetime.utcnow()}
    }, sort=[('created_at', -1)])
    
    if not otp_doc:
        return False, "رمز التحقق غير صالح أو منتهي الصلاحية"
    
    # Check attempts (max 3)
    if otp_doc.get('attempts', 0) >= 3:
        return False, "تم تجاوز عدد المحاولات المسموحة"
    
    # Increment attempts
    await db.otp_codes.update_one(
        {'_id': otp_doc['_id']},
        {'$inc': {'attempts': 1}}
    )
    
    # Verify OTP
    if otp_doc['otp'] != otp:
        remaining = 2 - otp_doc.get('attempts', 0)
        return False, f"رمز التحقق غير صحيح. المحاولات المتبقية: {remaining}"
    
    # Mark as verified
    await db.otp_codes.update_one(
        {'_id': otp_doc['_id']},
        {'$set': {'verified': True, 'verified_at': datetime.utcnow()}}
    )
    
    return True, "تم التحقق بنجاح"

async def is_phone_verified(phone: str) -> bool:
    """Check if phone number has been verified recently (within 10 minutes)"""
    db = get_db()
    formatted_phone = format_phone_number(phone)
    
    ten_minutes_ago = datetime.utcnow() - timedelta(minutes=10)
    
    verified_otp = await db.otp_codes.find_one({
        'phone': formatted_phone,
        'verified': True,
        'verified_at': {'$gte': ten_minutes_ago}
    })
    
    return verified_otp is not None

async def cleanup_expired_otps():
    """Clean up expired OTP codes"""
    db = get_db()
    await db.otp_codes.delete_many({
        'expires_at': {'$lt': datetime.utcnow()}
    })
