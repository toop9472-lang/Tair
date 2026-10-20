"""
Email Service using Resend
Handles all transactional emails for Tair platform
"""
import resend
import asyncio
import logging
import re
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# Common placeholder / disposable / test domains we should NOT try to email.
# Resend rejects these anyway and floods Sentry with false errors.
INVALID_EMAIL_DOMAINS = {
    'example.com', 'example.org', 'example.net',
    'test.com', 'test.org', 'test.net',
    'localhost', 'localhost.com',
    'foo.com', 'bar.com', 'domain.com',
    'mail.com', 'email.com',
    'tempmail.com', 'mailinator.com', 'guerrillamail.com',
    'yopmail.com', 'trashmail.com',
}

# Basic RFC-5322 lite regex (good enough for validation before sending)
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def _is_valid_recipient(email: str) -> bool:
    """Return True only for real-looking email addresses."""
    if not email or not isinstance(email, str):
        return False
    email = email.strip().lower()
    if not _EMAIL_RE.match(email):
        return False
    domain = email.rsplit('@', 1)[-1]
    if domain in INVALID_EMAIL_DOMAINS:
        return False
    return True

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


async def get_email_settings():
    """Get email settings from database"""
    db = get_db()
    settings = await db.settings.find_one({'type': 'email'}, {'_id': 0})
    return settings


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    from_name: str = "طير Tair"
) -> dict:
    """
    Send an email using Resend API
    Returns dict with status and message/error
    """
    # Guard against placeholder/fake recipient emails BEFORE calling Resend.
    # This prevents Sentry from flooding on user-data issues.
    if not _is_valid_recipient(to_email):
        logger.warning(f"Email skipped: recipient '{to_email}' is not a deliverable address")
        return {"success": False, "error": "invalid_recipient", "skipped": True}

    try:
        # Get API key from database settings
        settings = await get_email_settings()
        
        if not settings or not settings.get('resend_api_key'):
            logger.warning("Email not sent: No Resend API key configured")
            return {"success": False, "error": "Email service not configured"}
        
        if not settings.get('email_enabled', False):
            logger.info("Email not sent: Email service is disabled")
            return {"success": False, "error": "Email service is disabled"}
        
        # Set API key
        resend.api_key = settings['resend_api_key']
        
        # Get sender email (default to Resend's test sender)
        sender_email = settings.get('sender_email', 'onboarding@resend.dev')
        
        params = {
            "from": f"{from_name} <{sender_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        
        logger.info(f"Email sent successfully to {to_email}")
        return {
            "success": True,
            "email_id": email_response.get("id"),
            "message": f"Email sent to {to_email}"
        }
        
    except Exception as e:
        # Resend "invalid_to_address" / domain-not-verified errors are user-data
        # issues, NOT server errors — log as warning so Sentry doesn't flood.
        err_str = str(e).lower()
        if any(k in err_str for k in ('invalid', 'not verified', 'testing emails',
                                     'validation_error', 'domain', 'restricted')):
            logger.warning(f"Email delivery rejected for {to_email}: {e}")
        else:
            logger.error(f"Failed to send email to {to_email}: {e}")
        return {"success": False, "error": str(e)}


# ============ EMAIL TEMPLATES ============

def get_welcome_email_template(user_name: str, lang: str = 'ar') -> tuple:
    """Generate welcome email for new user registration"""
    
    # Brand Colors
    gold = '#D4AF37'
    purple = '#6B4C9A'
    dark_bg = '#1a1a2e'
    
    if lang == 'ar':
        subject = "🦅 مرحباً بك في صقر!"
        html = f"""
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, {dark_bg}, {purple}); padding: 40px; text-align: center; }}
                .header h1 {{ color: {gold}; margin: 0; font-size: 32px; font-weight: bold; }}
                .header p {{ color: rgba(255,255,255,0.8); margin-top: 10px; }}
                .content {{ padding: 40px; }}
                .welcome-text {{ font-size: 18px; color: #333; line-height: 1.8; }}
                .feature {{ display: flex; align-items: center; margin: 20px 0; padding: 15px; background: linear-gradient(135deg, {dark_bg}10, {purple}10); border-radius: 12px; border-right: 4px solid {gold}; }}
                .feature-icon {{ font-size: 24px; margin-left: 15px; }}
                .cta-button {{ display: inline-block; background: linear-gradient(135deg, {gold}, #B8960C); color: {dark_bg}; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; margin: 20px 0; }}
                .footer {{ background: {dark_bg}; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px; }}
                .footer a {{ color: {gold}; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🦅 صقر</h1>
                    <p>منصة الإعلانات المكافئة</p>
                </div>
                <div class="content">
                    <p class="welcome-text">مرحباً <strong>{user_name}</strong>! 👋</p>
                    <p class="welcome-text">نحن سعداء بانضمامك إلى عائلة صقر! الآن يمكنك كسب المال من مشاهدة الإعلانات.</p>
                    
                    <div class="feature">
                        <span class="feature-icon">💰</span>
                        <span>اكسب 5 نقاط لكل إعلان تشاهده</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">🏦</span>
                        <span>اسحب أرباحك عند 500 نقطة = $1</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">📱</span>
                        <span>تطبيق سهل الاستخدام على الجوال</span>
                    </div>
                    
                    <center>
                        <a href="#" class="cta-button">ابدأ المشاهدة الآن</a>
                    </center>
                </div>
                <div class="footer">
                    <p>© 2025 صقر - جميع الحقوق محفوظة</p>
                </div>
            </div>
        </body>
        </html>
        """
    else:
        subject = "🦅 Welcome to Saqr!"
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, {dark_bg}, {purple}); padding: 40px; text-align: center; }}
                .header h1 {{ color: {gold}; margin: 0; font-size: 32px; font-weight: bold; }}
                .header p {{ color: rgba(255,255,255,0.8); margin-top: 10px; }}
                .content {{ padding: 40px; }}
                .welcome-text {{ font-size: 18px; color: #333; line-height: 1.8; }}
                .feature {{ display: flex; align-items: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid {gold}; }}
                .feature-icon {{ font-size: 24px; margin-right: 15px; }}
                .cta-button {{ display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🦅 Saqr</h1>
                </div>
                <div class="content">
                    <p class="welcome-text">Hello <strong>{user_name}</strong>! 👋</p>
                    <p class="welcome-text">We're excited to have you join the Saqr family! Now you can earn money by watching ads.</p>
                    
                    <div class="feature">
                        <span class="feature-icon">💰</span>
                        <span>Earn 1 point for every minute watched</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">🏦</span>
                        <span>Withdraw at 500 points</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">📱</span>
                        <span>Easy to use app</span>
                    </div>
                    
                    <center>
                        <a href="#" class="cta-button">Start Watching Now</a>
                    </center>
                </div>
                <div class="footer">
                    <p>© 2025 Saqr - All rights reserved</p>
                </div>
            </div>
        </body>
        </html>
        """
    
    return subject, html


def get_withdrawal_notification_template(
    user_name: str,
    amount: float,
    method: str,
    status: str,
    reason: str = "",
    lang: str = 'ar'
) -> tuple:
    """Generate withdrawal status notification email"""
    
    status_ar = {
        'approved': 'تمت الموافقة',
        'rejected': 'مرفوض',
        'pending': 'قيد المراجعة',
        'completed': 'مكتمل'
    }
    
    status_en = {
        'approved': 'Approved',
        'rejected': 'Rejected', 
        'pending': 'Pending Review',
        'completed': 'Completed'
    }
    
    status_color = {
        'approved': '#10b981',
        'rejected': '#ef4444',
        'pending': '#f59e0b',
        'completed': '#10b981'
    }
    
    status_icon = {
        'approved': '✅',
        'rejected': '❌',
        'pending': '⏳',
        'completed': '✅'
    }
    
    if lang == 'ar':
        subject = f"{status_icon.get(status, '📢')} تحديث طلب السحب - {status_ar.get(status, status)}"
        reason_html = f'<p style="color: #ef4444; background: #fef2f2; padding: 15px; border-radius: 10px;">سبب الرفض: {reason}</p>' if status == 'rejected' and reason else ''
        
        html = f"""
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .status-badge {{ display: inline-block; background: {status_color.get(status, '#666')}; color: white; padding: 10px 25px; border-radius: 20px; font-weight: bold; margin: 20px 0; }}
                .content {{ padding: 30px; }}
                .info-box {{ background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0; }}
                .info-row {{ display: flex; justify-content: space-between; margin: 10px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🦅 صقر - إشعار السحب</h1>
                </div>
                <div class="content">
                    <p>مرحباً <strong>{user_name}</strong>،</p>
                    <p>تم تحديث حالة طلب السحب الخاص بك:</p>
                    
                    <center>
                        <span class="status-badge">{status_icon.get(status, '')} {status_ar.get(status, status)}</span>
                    </center>
                    
                    <div class="info-box">
                        <div class="info-row">
                            <span>المبلغ:</span>
                            <strong>{amount}</strong>
                        </div>
                        <div class="info-row">
                            <span>طريقة السحب:</span>
                            <strong>{method}</strong>
                        </div>
                    </div>
                    
                    {reason_html}
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        {"سيتم تحويل المبلغ خلال 24-48 ساعة عمل." if status == 'approved' else "إذا كان لديك أي استفسار، تواصل معنا."}
                    </p>
                </div>
                <div class="footer">
                    <p>© 2025 صقر - جميع الحقوق محفوظة</p>
                </div>
            </div>
        </body>
        </html>
        """
    else:
        subject = f"{status_icon.get(status, '📢')} Withdrawal Update - {status_en.get(status, status)}"
        reason_html = f'<p style="color: #ef4444; background: #fef2f2; padding: 15px; border-radius: 10px;">Reason: {reason}</p>' if status == 'rejected' and reason else ''
        
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .status-badge {{ display: inline-block; background: {status_color.get(status, '#666')}; color: white; padding: 10px 25px; border-radius: 20px; font-weight: bold; margin: 20px 0; }}
                .content {{ padding: 30px; }}
                .info-box {{ background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0; }}
                .info-row {{ display: flex; justify-content: space-between; margin: 10px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🦅 Saqr - Withdrawal Notice</h1>
                </div>
                <div class="content">
                    <p>Hello <strong>{user_name}</strong>,</p>
                    <p>Your withdrawal request has been updated:</p>
                    
                    <center>
                        <span class="status-badge">{status_icon.get(status, '')} {status_en.get(status, status)}</span>
                    </center>
                    
                    <div class="info-box">
                        <div class="info-row">
                            <span>Amount:</span>
                            <strong>{amount}</strong>
                        </div>
                        <div class="info-row">
                            <span>Method:</span>
                            <strong>{method}</strong>
                        </div>
                    </div>
                    
                    {reason_html}
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        {"The amount will be transferred within 24-48 business hours." if status == 'approved' else "If you have any questions, please contact us."}
                    </p>
                </div>
                <div class="footer">
                    <p>© 2025 Saqr - All rights reserved</p>
                </div>
            </div>
        </body>
        </html>
        """
    
    return subject, html


def get_ad_notification_template(
    advertiser_name: str,
    ad_title: str,
    status: str,
    reason: str = "",
    lang: str = 'ar'
) -> tuple:
    """Generate ad status notification email for advertisers"""
    
    status_ar = {
        'approved': 'تمت الموافقة',
        'rejected': 'مرفوض',
        'pending': 'قيد المراجعة',
        'active': 'نشط',
        'expired': 'منتهي'
    }
    
    status_en = {
        'approved': 'Approved',
        'rejected': 'Rejected',
        'pending': 'Pending Review',
        'active': 'Active',
        'expired': 'Expired'
    }
    
    status_color = {
        'approved': '#10b981',
        'rejected': '#ef4444',
        'pending': '#f59e0b',
        'active': '#10b981',
        'expired': '#6b7280'
    }
    
    status_icon = {
        'approved': '✅',
        'rejected': '❌',
        'pending': '⏳',
        'active': '🟢',
        'expired': '⚫'
    }
    
    if lang == 'ar':
        subject = f"{status_icon.get(status, '📢')} تحديث إعلانك - {status_ar.get(status, status)}"
        reason_html = f'<p style="color: #ef4444; background: #fef2f2; padding: 15px; border-radius: 10px;">سبب الرفض: {reason}</p>' if status == 'rejected' and reason else ''
        
        html = f"""
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .status-badge {{ display: inline-block; background: {status_color.get(status, '#666')}; color: white; padding: 10px 25px; border-radius: 20px; font-weight: bold; margin: 20px 0; }}
                .content {{ padding: 30px; }}
                .ad-title {{ background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0; font-size: 18px; font-weight: bold; text-align: center; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📢 صقر - إشعار الإعلان</h1>
                </div>
                <div class="content">
                    <p>مرحباً <strong>{advertiser_name}</strong>،</p>
                    <p>تم تحديث حالة إعلانك:</p>
                    
                    <div class="ad-title">"{ad_title}"</div>
                    
                    <center>
                        <span class="status-badge">{status_icon.get(status, '')} {status_ar.get(status, status)}</span>
                    </center>
                    
                    {reason_html}
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        {"تهانينا! إعلانك الآن يظهر للمستخدمين." if status in ['approved', 'active'] else "يمكنك تعديل إعلانك وإعادة تقديمه." if status == 'rejected' else "سيتم مراجعة إعلانك قريباً."}
                    </p>
                </div>
                <div class="footer">
                    <p>© 2025 صقر - جميع الحقوق محفوظة</p>
                </div>
            </div>
        </body>
        </html>
        """
    else:
        subject = f"{status_icon.get(status, '📢')} Ad Update - {status_en.get(status, status)}"
        reason_html = f'<p style="color: #ef4444; background: #fef2f2; padding: 15px; border-radius: 10px;">Reason: {reason}</p>' if status == 'rejected' and reason else ''
        
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .status-badge {{ display: inline-block; background: {status_color.get(status, '#666')}; color: white; padding: 10px 25px; border-radius: 20px; font-weight: bold; margin: 20px 0; }}
                .content {{ padding: 30px; }}
                .ad-title {{ background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0; font-size: 18px; font-weight: bold; text-align: center; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📢 Saqr - Ad Notification</h1>
                </div>
                <div class="content">
                    <p>Hello <strong>{advertiser_name}</strong>,</p>
                    <p>Your ad status has been updated:</p>
                    
                    <div class="ad-title">"{ad_title}"</div>
                    
                    <center>
                        <span class="status-badge">{status_icon.get(status, '')} {status_en.get(status, status)}</span>
                    </center>
                    
                    {reason_html}
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        {"Congratulations! Your ad is now live." if status in ['approved', 'active'] else "You can edit and resubmit your ad." if status == 'rejected' else "Your ad will be reviewed shortly."}
                    </p>
                </div>
                <div class="footer">
                    <p>© 2025 Saqr - All rights reserved</p>
                </div>
            </div>
        </body>
        </html>
        """
    
    return subject, html


# ============ CONVENIENCE FUNCTIONS ============

async def send_welcome_email(user_email: str, user_name: str, lang: str = 'ar') -> dict:
    """Send welcome email to new user"""
    subject, html = get_welcome_email_template(user_name, lang)
    return await send_email(user_email, subject, html)


async def send_withdrawal_notification(
    user_email: str,
    user_name: str,
    amount: float,
    method: str,
    status: str,
    reason: str = "",
    lang: str = 'ar'
) -> dict:
    """Send withdrawal status notification"""
    subject, html = get_withdrawal_notification_template(user_name, amount, method, status, reason, lang)
    return await send_email(user_email, subject, html)


async def send_ad_notification(
    advertiser_email: str,
    advertiser_name: str,
    ad_title: str,
    status: str,
    reason: str = "",
    lang: str = 'ar'
) -> dict:
    """Send ad status notification to advertiser"""
    subject, html = get_ad_notification_template(advertiser_name, ad_title, status, reason, lang)
    return await send_email(advertiser_email, subject, html)
