from fastapi import FastAPI, APIRouter, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import PlainTextResponse, HTMLResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone

# Load .env BEFORE importing route modules so they pick up env vars
# (e.g. R2 storage credentials read at import time).
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Import routes
from routes.oauth_routes import router as oauth_router
from routes.auth_routes import router as auth_router
from routes.ad_routes import router as ad_router
from routes.withdrawal_routes import router as withdrawal_router
from routes.user_routes import router as user_router
from routes.advertiser_routes import router as advertiser_router
from routes.admin_auth_routes import router as admin_auth_router
from routes.admin_dashboard_routes import router as admin_dashboard_router
from routes.payment_routes import router as payment_router
from routes.tap_routes import router as tap_router
from routes.tabby_routes import router as tabby_router
from routes.tamara_routes import router as tamara_router
from routes.notification_routes import router as notification_router
from routes.invoice_routes import router as invoice_router
from routes.analytics_routes import router as analytics_router
from routes.activity_routes import router as activity_router
from routes.payment_gateways_routes import router as payment_gateways_router
from routes.settings_routes import router as settings_router
from routes.wallet_routes import router as wallet_router
from routes.admin_users_routes import router as admin_users_router
from routes.admin_extensions_routes import router as admin_extensions_router
from routes.clinic_topics_routes import router as clinic_topics_router
from routes.community_chat_routes import router as community_chat_router
from routes.share_routes import router as tair_share_router
from routes.email_routes import router as email_router
from routes.rewarded_ads_routes import router as rewarded_ads_router
from routes.points_settings_routes import router as points_settings_router
from routes.reports_routes import router as reports_router
from routes.claude_ai_routes import router as claude_ai_router
from routes.dev_requests_routes import router as dev_requests_router
from routes.support_routes import router as support_router
from routes.two_factor_routes import router as two_factor_router
from routes.comments_routes import router as comments_router
from routes.moderation_routes import router as moderation_router
from routes.premium_features_routes import (
    stories_router,
    hashtags_router,
    creator_fund_router,
    push_router,
    share_router,
)
from routes.phone_auth_routes import router as phone_auth_router
from routes.support_form_routes import router as support_form_router
from routes.economy_routes import router as economy_router
from routes.stripe_routes import router as stripe_router
from routes.social_routes import router as social_router
from routes.iap_routes import router as iap_router
from routes.admin_iap_upload_routes import router as admin_iap_upload_router
from routes.cache_routes import router as cache_router
from routes.clips_routes import router as clips_router

# طير — bird marketplace routes
from routes.listings_routes import router as tair_listings_router
from routes.trips_routes import router as tair_trips_router
from routes.orders_routes import router as tair_orders_router
from routes.auctions_routes import router as tair_auctions_router
from routes.community_routes import router as tair_community_router
from routes.ratings_routes import router as tair_ratings_router
from routes.tair_reports_routes import router as tair_reports_router
from routes.species_routes import router as tair_species_router
from routes.forum_routes import router as tair_forum_router
from routes.storefront_routes import router as storefront_router
from routes.chat_routes import router as tair_chat_router
from routes.tair_notifications_routes import router as tair_notifs_router
from routes.kyc_routes import router as tair_kyc_router
from routes.webpush_routes import router as tair_webpush_router
from routes.trust_safety_routes import router as tair_trust_router
from routes.mobile_error_routes import router as tair_mobile_error_router
from routes.mobile_push_routes import router as tair_mobile_push_router
from routes.wholesale_routes import router as tair_wholesale_router
from routes.sellers_routes import router as tair_sellers_router
from routes.ai_bird_routes import router as tair_ai_bird_router


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Sentry — error tracking (must be initialised BEFORE FastAPI() is created)
_sentry_dsn = os.environ.get("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "development"),
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=True,
        # Ignore expected HTTP errors — 404/401/etc. shouldn't spam our inbox
        ignore_errors=[
            "HTTPException",
        ],
    )

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Log the request body when Pydantic validation fails so we can see exactly
# which mobile payload is triggering 422s. Auto-disables in production by
# guarding on the TAIR_LOG_422 env flag (set to "1" for debugging).
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402


@app.exception_handler(RequestValidationError)
async def _tair_422_logger(request, exc):
    if os.environ.get("TAIR_LOG_422", "1") == "1":
        try:
            body = await request.body()
            preview = body.decode("utf-8", errors="replace")[:800]
        except Exception:
            preview = "<unreadable>"
        logging.getLogger("tair.422").warning(
            "422 on %s %s user_id=%s errors=%s body=%s",
            request.method,
            request.url.path,
            request.query_params.get("user_id"),
            exc.errors(),
            preview,
        )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


MEDIA_DIR = ROOT_DIR / "static" / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
(MEDIA_DIR / "clips").mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

# App-ads.txt for Google AdMob verification (must be at root, not under /api)
@app.get("/app-ads.txt", response_class=PlainTextResponse)
async def app_ads_txt():
    """Google AdMob app-ads.txt verification file"""
    return "google.com, pub-5132559433385403, DIRECT, f08c47fec0942fa0"

@app.get("/volcano-fizer.svg")
async def volcano_fizer_svg():
    """Static key art for the Volcano Fizer game."""
    return FileResponse(
        ROOT_DIR / "static" / "volcano-fizer.svg",
        media_type="image/svg+xml",
        filename="volcano-fizer.svg",
    )

@app.get("/api/downloads/appstore-screenshots")
async def download_appstore_screenshots():
    """Serve the App Store screenshots bundle for Tair."""
    return FileResponse(
        MEDIA_DIR / "tair_appstore_screenshots_v8.0.7.zip",
        media_type="application/zip",
        filename="tair_appstore_screenshots_v8.0.7.zip",
    )

@app.get("/support", response_class=HTMLResponse)
async def support_page():
    """Public support page for App Store metadata."""
    return """
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>دعم صقر | Saqr Support</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, sans-serif; background: #0b1020; color: #e2e8f0; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px 42px; }
    .card { background: #121a31; border: 1px solid #223055; border-radius: 16px; padding: 18px; margin-bottom: 14px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    p { margin: 6px 0; line-height: 1.65; }
    .muted { color: #94a3b8; font-size: 13px; }
    .row { display: grid; gap: 10px; margin-top: 12px; }
    label { font-size: 13px; color: #cbd5e1; }
    input, textarea {
      width: 100%; border-radius: 10px; border: 1px solid #334a7d; background: #0f172a;
      color: #f8fafc; padding: 12px; font-size: 14px; outline: none;
    }
    textarea { min-height: 120px; resize: vertical; }
    button {
      border: 0; border-radius: 10px; padding: 11px 16px; cursor: pointer;
      background: linear-gradient(90deg, #3b82f6, #2563eb); color: #fff; font-weight: 700;
    }
    .ok { color: #22c55e; font-size: 13px; margin-top: 8px; }
    .err { color: #ef4444; font-size: 13px; margin-top: 8px; }
    a { color: #60a5fa; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>الدعم الفني - تطبيق صقر</h1>
      <p>إذا واجهت أي مشكلة في الحساب، الألعاب، أو المدفوعات، يمكنك التواصل معنا مباشرة عبر النموذج التالي.</p>
      <p class="muted">If you need support, please submit the form below and our team will review your request.</p>
      <p>البريد: <a href="mailto:sky-321@hotmail.com">sky-321@hotmail.com</a></p>
    </div>

    <div class="card">
      <form id="support-form">
        <div class="row">
          <label for="name">الاسم</label>
          <input id="name" name="name" required maxlength="80" />
        </div>
        <div class="row">
          <label for="email">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" required maxlength="150" />
        </div>
        <div class="row">
          <label for="subject">الموضوع</label>
          <input id="subject" name="subject" required maxlength="180" />
        </div>
        <div class="row">
          <label for="message">الرسالة</label>
          <textarea id="message" name="message" required maxlength="3000"></textarea>
        </div>
        <div class="row" style="margin-top:14px;">
          <button type="submit">إرسال طلب الدعم</button>
        </div>
        <div id="status"></div>
      </form>
    </div>
  </div>

  <script>
    const form = document.getElementById('support-form');
    const statusEl = document.getElementById('status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.className = 'muted';
      statusEl.textContent = 'جارٍ الإرسال...';

      const payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        subject: form.subject.value.trim(),
        message: form.message.value.trim(),
      };

      try {
        const res = await fetch('/api/support/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          statusEl.className = 'ok';
          statusEl.textContent = data.message || 'تم إرسال طلب الدعم بنجاح.';
          form.reset();
        } else {
          statusEl.className = 'err';
          statusEl.textContent = data.detail || data.message || 'تعذر إرسال الطلب حالياً.';
        }
      } catch (_) {
        statusEl.className = 'err';
        statusEl.textContent = 'خطأ اتصال. حاول مرة أخرى.';
      }
    });
  </script>
</body>
</html>
"""


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page():
    """Public privacy page for in-app links and App Store metadata."""
    return """
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>سياسة الخصوصية | صقر</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, sans-serif; background: #0b1020; color: #e2e8f0; line-height: 1.75; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 24px 16px 40px; }
    .card { background: #121a31; border: 1px solid #223055; border-radius: 16px; padding: 18px; margin-bottom: 14px; }
    h1,h2 { margin: 0 0 8px; }
    .muted { color: #94a3b8; font-size: 13px; }
    a { color: #60a5fa; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>سياسة الخصوصية - تطبيق صقر</h1>
      <p class="muted">آخر تحديث: 2026-03-09</p>
      <p>نحترم خصوصيتك. يوضح هذا المستند ما نجمعه من بيانات وكيف نستخدمها داخل التطبيق.</p>
    </div>
    <div class="card">
      <h2>1) البيانات التي نجمعها</h2>
      <p>بيانات الحساب (الاسم، البريد)، بيانات الاستخدام داخل التطبيق (التقدم، الرصيد، النتائج)، وسجلات الدعم الفني عند إرسال طلب دعم.</p>
    </div>
    <div class="card">
      <h2>2) الغرض من استخدام البيانات</h2>
      <p>تشغيل الحساب، مزامنة الرصيد، تشغيل الألعاب واللوحات، منع الغش، وتحسين جودة الخدمة.</p>
    </div>
    <div class="card">
      <h2>3) الإعلانات وATT</h2>
      <p>في iOS نستخدم إذن App Tracking Transparency قبل أي استخدام قد يتعلق بالتتبع الإعلاني. يمكنك إدارة الإذن من داخل التطبيق عبر: حسابي ← إذن تتبع الإعلانات (ATT).</p>
    </div>
    <div class="card">
      <h2>4) حذف الحساب</h2>
      <p>يمكنك حذف الحساب نهائياً من داخل التطبيق عبر: حسابي ← حذف الحساب نهائياً.</p>
    </div>
    <div class="card">
      <h2>5) التواصل</h2>
      <p>للاستفسارات: <a href="mailto:sky-321@hotmail.com">sky-321@hotmail.com</a></p>
    </div>
    <div class="card">
      <h2>6) مصادر الألعاب الخارجية</h2>
      <p>تم حذف أي مصدر ألعاب خارجي كان يعرض جدار موافقة طرف ثالث (مثل رسالة الموافقة على معالجة البيانات). النسخة الحالية لا تتضمن هذا النوع من مصادر الألعاب.</p>
    </div>
  </div>
</body>
</html>
"""


@app.get("/terms", response_class=HTMLResponse)
async def terms_page():
    """Public terms page for in-app links and App Store metadata."""
    return """
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>شروط الاستخدام | صقر</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, sans-serif; background: #0b1020; color: #e2e8f0; line-height: 1.75; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 24px 16px 40px; }
    .card { background: #121a31; border: 1px solid #223055; border-radius: 16px; padding: 18px; margin-bottom: 14px; }
    h1,h2 { margin: 0 0 8px; }
    .muted { color: #94a3b8; font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>شروط الاستخدام - تطبيق صقر</h1>
      <p class="muted">آخر تحديث: 2026-03-09</p>
      <p>باستخدامك للتطبيق فأنت توافق على هذه الشروط.</p>
    </div>
    <div class="card">
      <h2>1) الاستخدام المقبول</h2>
      <p>يمنع إساءة الاستخدام، الغش، أو أي سلوك يضر بالمجتمع أو الخوادم.</p>
    </div>
    <div class="card">
      <h2>2) الحسابات</h2>
      <p>المستخدم مسؤول عن بيانات تسجيل الدخول الخاصة به. يحق لنا تقييد الحسابات المخالفة.</p>
    </div>
    <div class="card">
      <h2>3) المشتريات الرقمية</h2>
      <p>في iOS تتم المشتريات الرقمية عبر In-App Purchase وفق سياسات App Store.</p>
    </div>
    <div class="card">
      <h2>4) الدعم</h2>
      <p>للدعم الفني استخدم صفحة الدعم داخل التطبيق أو عبر الرابط الرسمي /support.</p>
    </div>
  </div>
</body>
</html>
"""

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# CORS Configuration - Read from environment or allow all for flexibility
_cors_env = os.environ.get("CORS_ORIGINS", "")
if _cors_env == "*" or not _cors_env:
    # Allow all origins when CORS_ORIGINS is "*" or not set
    ALLOWED_ORIGINS = ["*"]
else:
    ALLOWED_ORIGINS = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
    expose_headers=["Authorization"],
    max_age=600,
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Saqr API - Welcome to the Advertising Platform"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint for deployment verification"""
    try:
        # Test database connection
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "database": db_status,
        "version": "1.0.0",
        "service": "saqr-api"
    }

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include feature routers
# NOTE: auth_router MUST come before oauth_router because both mount at /auth
# and we want the token-returning `/auth/register` (auth_router) to win.
api_router.include_router(auth_router)
api_router.include_router(admin_extensions_router)
api_router.include_router(clinic_topics_router)
api_router.include_router(community_chat_router)
api_router.include_router(oauth_router)
api_router.include_router(ad_router)
api_router.include_router(withdrawal_router)
api_router.include_router(user_router)
api_router.include_router(advertiser_router)
api_router.include_router(admin_auth_router)
api_router.include_router(admin_dashboard_router)
# ⛔️ Payments/Escrow disabled — Tair is now chat-only. Deals happen outside the app.
# api_router.include_router(payment_router)
# api_router.include_router(tap_router)
# api_router.include_router(tabby_router)
# api_router.include_router(tamara_router)
api_router.include_router(notification_router)
api_router.include_router(invoice_router)
api_router.include_router(analytics_router)
api_router.include_router(activity_router)
# api_router.include_router(payment_gateways_router)
api_router.include_router(settings_router)
# api_router.include_router(wallet_router)
api_router.include_router(admin_users_router)
api_router.include_router(email_router)
api_router.include_router(rewarded_ads_router)
api_router.include_router(points_settings_router)
api_router.include_router(reports_router)
api_router.include_router(claude_ai_router)
api_router.include_router(dev_requests_router)
api_router.include_router(support_router)
api_router.include_router(two_factor_router)
api_router.include_router(comments_router)
api_router.include_router(moderation_router)
api_router.include_router(stories_router)
api_router.include_router(hashtags_router)
api_router.include_router(creator_fund_router)
api_router.include_router(push_router)
api_router.include_router(share_router)
api_router.include_router(phone_auth_router)
api_router.include_router(support_form_router)
api_router.include_router(economy_router)
api_router.include_router(admin_iap_upload_router)
# api_router.include_router(stripe_router)  # Payments disabled
api_router.include_router(social_router)
# api_router.include_router(iap_router)  # Payments disabled
api_router.include_router(cache_router)
api_router.include_router(clips_router)

# طير — bird marketplace routers
api_router.include_router(tair_listings_router)
api_router.include_router(tair_trips_router)
api_router.include_router(tair_auctions_router)
api_router.include_router(tair_community_router)
# api_router.include_router(tair_orders_router)  # Orders/Escrow removed — deals via chat only
api_router.include_router(tair_ratings_router)
api_router.include_router(tair_reports_router)
api_router.include_router(tair_species_router)
api_router.include_router(tair_forum_router)
api_router.include_router(storefront_router)
api_router.include_router(tair_chat_router)
api_router.include_router(tair_notifs_router)
api_router.include_router(tair_kyc_router)
api_router.include_router(tair_webpush_router)
api_router.include_router(tair_trust_router)
api_router.include_router(tair_mobile_error_router)
api_router.include_router(tair_mobile_push_router)
api_router.include_router(tair_wholesale_router)
api_router.include_router(tair_sellers_router)
api_router.include_router(tair_ai_bird_router)

# Include WebSocket router (at app level, not api_router)
app.include_router(tair_share_router)

# Include the router in the main app
app.include_router(api_router)

# ROOT LEVEL health check endpoint for Kubernetes liveness/readiness probes
@app.get("/health")
async def root_health_check():
    """Root-level health check endpoint for Kubernetes deployment"""
    try:
        # Test database connection
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "database": db_status,
        "version": "1.0.0",
        "service": "saqr-api"
    }

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



@app.on_event("startup")
async def ensure_tair_indexes():
    """Ensure MongoDB indexes for hot paths — safe & idempotent."""
    # Install DB guard first so any accidental delete_many during startup is
    # refused unless TAIR_ALLOW_BULK_DELETE=1 is set explicitly.
    try:
        from services.db_guard import install_delete_guard
        install_delete_guard(db)
        logger.info("DB delete_many guard installed on protected collections")
    except Exception as e:
        logger.warning("Failed to install DB guard: %s", e)
    try:
        # Listings (marketplace queries)
        await db.tair_listings.create_index([("status", 1), ("created_at", -1)])
        await db.tair_listings.create_index([("family", 1), ("city", 1)])
        await db.tair_listings.create_index([("seller_id", 1)])
        await db.tair_listings.create_index([("listing_id", 1)], unique=True)
        # Trips
        await db.tair_trips.create_index([("status", 1), ("depart_at", 1)])
        await db.tair_trips.create_index([("from_city", 1), ("to_city", 1)])
        await db.tair_trips.create_index([("carrier_id", 1)])
        await db.tair_trips.create_index([("trip_id", 1)], unique=True)
        # Chat
        await db.tair_chat_messages.create_index([("thread_id", 1), ("created_at", 1)])
        await db.tair_chat_threads.create_index([("participants", 1)])
        # Notifications
        await db.tair_notifications.create_index([("user_id", 1), ("created_at", -1)])
        await db.tair_notifications.create_index([("user_id", 1), ("is_read", 1)])
        # Orders
        await db.tair_orders.create_index([("buyer_id", 1), ("status", 1)])
        await db.tair_orders.create_index([("seller_id", 1), ("status", 1)])
        await db.tair_orders.create_index([("carrier_id", 1), ("status", 1)])
        # Users & auth
        await db.users.create_index([("email", 1)], unique=True, sparse=True)
        await db.users.create_index([("registration_ip", 1), ("created_at", -1)])
        await db.login_attempts.create_index([("email", 1), ("timestamp", -1)])
        # Web push
        await db.web_push_subscriptions.create_index([("user_id", 1)])
        await db.web_push_subscriptions.create_index([("endpoint", 1)], unique=True)
        # Reports & ratings (new)
        await db.tair_user_reports.create_index([("reported_user_id", 1), ("created_at", -1)])
        await db.tair_user_blocks.create_index([("blocker_id", 1), ("blocked_id", 1)], unique=True)
        await db.tair_ratings.create_index([("target_id", 1), ("created_at", -1)])
        await db.tair_ratings.create_index([("rater_id", 1), ("target_id", 1)], unique=True)
        logger.info("Tair MongoDB indexes ensured")
        await db.admins.update_many({"name": "مدير صقر"}, {"$set": {"name": "مدير طير"}})
    except Exception as e:
        logger.warning(f"ensure_tair_indexes failed (non-fatal): {e}")


@app.on_event("startup")
async def cleanup_dummy_ads_on_startup():
    """Remove dummy/sample ads that were previously seeded. Runs once per start."""
    try:
        dummy_advertisers = ["Samsung", "Amazon", "Gourmet Restaurant"]
        result1 = await db.ads.delete_many({"advertiser": {"$in": dummy_advertisers}})
        result2 = await db.ads.delete_many(
            {"video_url": {"$regex": "commondatastorage.googleapis.com"}}
        )
        total = result1.deleted_count + result2.deleted_count
        if total > 0:
            logger.info(f"Cleaned up {total} dummy ads on startup")
    except Exception as e:
        logger.warning(f"cleanup_dummy_ads_on_startup failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()