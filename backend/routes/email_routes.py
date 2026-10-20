"""
Email Settings and Testing Routes
Admin can configure email service and test it
"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional
from auth.dependencies import get_current_user_id
from datetime import datetime
from services.email_service import send_email, send_welcome_email
import os

router = APIRouter(prefix='/email', tags=['Email Service'])

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


async def verify_admin(user_id: str, db):
    """Verify user is admin"""
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]}, {'_id': 0})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح - يجب أن تكون مدير')
    return admin


class EmailSettings(BaseModel):
    email_enabled: bool = False
    resend_api_key: Optional[str] = None
    sender_email: str = "onboarding@resend.dev"
    sender_name: str = "صقر Saqr"
    send_welcome_email: bool = True
    send_withdrawal_notifications: bool = True
    send_ad_notifications: bool = True


class TestEmailRequest(BaseModel):
    to_email: EmailStr
    email_type: str = "welcome"  # welcome, withdrawal, ad


def mask_key(key: str) -> str:
    """Mask API key for display"""
    if not key:
        return ''
    if len(key) <= 8:
        return '****' + key[-2:] if len(key) > 2 else '****'
    return '****' + key[-4:]


@router.get('/settings')
async def get_email_settings(user_id: str = Depends(get_current_user_id)):
    """Get email settings (admin only)"""
    db = get_db()
    await verify_admin(user_id, db)
    
    settings = await db.settings.find_one({'type': 'email'}, {'_id': 0})
    
    if not settings:
        return {
            'email_enabled': False,
            'resend_api_key': '',
            'sender_email': 'onboarding@resend.dev',
            'sender_name': 'صقر Saqr',
            'send_welcome_email': True,
            'send_withdrawal_notifications': True,
            'send_ad_notifications': True
        }
    
    return {
        'email_enabled': settings.get('email_enabled', False),
        'resend_api_key': mask_key(settings.get('resend_api_key', '')),
        'sender_email': settings.get('sender_email', 'onboarding@resend.dev'),
        'sender_name': settings.get('sender_name', 'صقر Saqr'),
        'send_welcome_email': settings.get('send_welcome_email', True),
        'send_withdrawal_notifications': settings.get('send_withdrawal_notifications', True),
        'send_ad_notifications': settings.get('send_ad_notifications', True)
    }


@router.put('/settings')
async def update_email_settings(
    settings: EmailSettings,
    user_id: str = Depends(get_current_user_id)
):
    """Update email settings (admin only)"""
    db = get_db()
    await verify_admin(user_id, db)
    
    current = await db.settings.find_one({'type': 'email'}, {'_id': 0})
    
    update_data = {
        'type': 'email',
        'email_enabled': settings.email_enabled,
        'sender_email': settings.sender_email,
        'sender_name': settings.sender_name,
        'send_welcome_email': settings.send_welcome_email,
        'send_withdrawal_notifications': settings.send_withdrawal_notifications,
        'send_ad_notifications': settings.send_ad_notifications,
        'updated_at': datetime.utcnow()
    }
    
    # Handle API key - don't overwrite with masked value
    if settings.resend_api_key and not settings.resend_api_key.startswith('****'):
        update_data['resend_api_key'] = settings.resend_api_key
    elif current:
        update_data['resend_api_key'] = current.get('resend_api_key', '')
    
    await db.settings.update_one(
        {'type': 'email'},
        {'$set': update_data},
        upsert=True
    )
    
    return {'message': 'تم حفظ إعدادات البريد الإلكتروني بنجاح'}


@router.post('/test')
async def test_email(
    request: TestEmailRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Send a test email (admin only)"""
    db = get_db()
    admin = await verify_admin(user_id, db)
    
    # Get settings to check if email is configured
    settings = await db.settings.find_one({'type': 'email'}, {'_id': 0})
    
    if not settings or not settings.get('resend_api_key'):
        raise HTTPException(
            status_code=400,
            detail='لم يتم تكوين خدمة البريد الإلكتروني. الرجاء إضافة مفتاح Resend API أولاً.'
        )
    
    # Send test email based on type
    if request.email_type == "welcome":
        result = await send_welcome_email(
            request.to_email,
            admin.get('name', 'مستخدم اختبار'),
            'ar'
        )
    else:
        # Generic test email
        result = await send_email(
            request.to_email,
            "🧪 اختبار البريد الإلكتروني - صقر",
            """
            <html dir="rtl">
            <body style="font-family: Arial, sans-serif; direction: rtl; padding: 20px;">
                <div style="max-width: 500px; margin: 0 auto; background: #f8f9fa; padding: 30px; border-radius: 10px;">
                    <h2 style="color: #6366f1;">🦅 صقر - اختبار البريد</h2>
                    <p>هذا بريد إلكتروني تجريبي للتأكد من أن إعدادات البريد تعمل بشكل صحيح.</p>
                    <p style="color: #10b981; font-weight: bold;">✅ تم الإرسال بنجاح!</p>
                </div>
            </body>
            </html>
            """
        )
    
    if result['success']:
        return {
            'success': True,
            'message': f'تم إرسال البريد التجريبي إلى {request.to_email}',
            'email_id': result.get('email_id')
        }
    else:
        raise HTTPException(
            status_code=500,
            detail=f'فشل إرسال البريد: {result.get("error", "خطأ غير معروف")}'
        )


@router.get('/stats')
async def get_email_stats(user_id: str = Depends(get_current_user_id)):
    """Get email sending statistics (admin only)"""
    db = get_db()
    await verify_admin(user_id, db)
    
    # Get settings
    settings = await db.settings.find_one({'type': 'email'}, {'_id': 0})
    
    # Count emails sent (if we track them)
    # For now, return basic stats
    return {
        'configured': bool(settings and settings.get('resend_api_key')),
        'enabled': settings.get('email_enabled', False) if settings else False,
        'provider': 'Resend',
        'sender_email': settings.get('sender_email', 'Not configured') if settings else 'Not configured'
    }
