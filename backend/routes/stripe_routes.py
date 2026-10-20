# Stripe Payment Routes for Diamond Purchases
# مسارات الدفع لشراء الألماسات
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

router = APIRouter(prefix="/diamond-payments", tags=["Diamond Payments"])

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'saqr_db')]

# Stripe API Key
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# Fixed Diamond Packages (SAR - السعر ثابت من السيرفر لمنع التلاعب)
DIAMOND_PACKAGES = {
    "starter": {"name": "حزمة البداية", "diamonds": 100, "bonus": 0, "price_sar": 3.0},
    "silver": {"name": "الحزمة الفضية", "diamonds": 250, "bonus": 25, "price_sar": 7.0},
    "gold": {"name": "الحزمة الذهبية", "diamonds": 500, "bonus": 75, "price_sar": 12.0},
    "platinum": {"name": "الحزمة البلاتينية", "diamonds": 1000, "bonus": 200, "price_sar": 19.0},
}

# SAR to USD conversion rate (approximate)
SAR_TO_USD = 0.27

# ==================== MODELS ====================

class CreateCheckoutRequest(BaseModel):
    user_id: str
    package_id: str
    origin_url: str

class CheckoutStatusRequest(BaseModel):
    session_id: str

# ==================== ENDPOINTS ====================

@router.post("/checkout/create")
async def create_checkout_session(request: CreateCheckoutRequest, http_request: Request):
    """إنشاء جلسة دفع Stripe لشراء الألماسات"""
    
    # التحقق من وجود الباقة
    if request.package_id not in DIAMOND_PACKAGES:
        raise HTTPException(status_code=400, detail="الباقة غير موجودة")
    
    package = DIAMOND_PACKAGES[request.package_id]
    
    # تحويل السعر من ريال إلى دولار (Stripe يستخدم USD)
    amount_usd = round(package["price_sar"] * SAR_TO_USD, 2)
    
    # إنشاء URLs
    success_url = f"{request.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/payment-cancel"
    
    # Metadata
    metadata = {
        "user_id": request.user_id,
        "package_id": request.package_id,
        "package_name": package["name"],
        "diamonds": str(package["diamonds"] + package["bonus"]),
        "price_sar": str(package["price_sar"])
    }
    
    try:
        # إعداد Stripe Checkout
        host_url = str(http_request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # إنشاء جلسة Checkout
        checkout_request = CheckoutSessionRequest(
            amount=amount_usd,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # حفظ سجل المعاملة في قاعدة البيانات
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "user_id": request.user_id,
            "package_id": request.package_id,
            "package_name": package["name"],
            "diamonds": package["diamonds"] + package["bonus"],
            "amount_sar": package["price_sar"],
            "amount_usd": amount_usd,
            "currency": "usd",
            "status": "pending",
            "payment_status": "initiated",
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.session_id,
            "package": {
                "name": package["name"],
                "diamonds": package["diamonds"] + package["bonus"],
                "price_sar": package["price_sar"]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في إنشاء جلسة الدفع: {str(e)}")

@router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, http_request: Request):
    """التحقق من حالة جلسة الدفع"""
    
    # البحث عن المعاملة
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="المعاملة غير موجودة")
    
    # إذا تم معالجة الدفع مسبقاً، نعيد الحالة المخزنة
    if transaction.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "diamonds_added": transaction.get("diamonds", 0),
            "already_processed": True
        }
    
    try:
        # استعلام Stripe للحصول على الحالة
        host_url = str(http_request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        status_response: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # تحديث حالة المعاملة
        new_status = {
            "status": status_response.status,
            "payment_status": status_response.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": new_status}
        )
        
        # إذا تم الدفع بنجاح، نضيف الألماسات للمستخدم
        if status_response.payment_status == "paid":
            # التحقق من عدم إضافة الألماسات مسبقاً
            tx = await db.payment_transactions.find_one({"session_id": session_id})
            if not tx.get("diamonds_credited"):
                user_id = transaction.get("user_id")
                diamonds = transaction.get("diamonds", 0)
                
                # إضافة الألماسات
                await db.users.update_one(
                    {"$or": [{"id": user_id}, {"user_id": user_id}]},
                    {
                        "$inc": {"diamonds": diamonds},
                        "$push": {
                            "diamond_transactions": {
                                "id": str(uuid.uuid4()),
                                "type": "purchase",
                                "package_id": transaction.get("package_id"),
                                "package_name": transaction.get("package_name"),
                                "amount": diamonds,
                                "price_sar": transaction.get("amount_sar"),
                                "session_id": session_id,
                                "created_at": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    }
                )
                
                # تحديد أن الألماسات تمت إضافتها
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"diamonds_credited": True}}
                )
                
                return {
                    "status": "complete",
                    "payment_status": "paid",
                    "diamonds_added": diamonds,
                    "message": f"تم إضافة {diamonds} ألماسة لحسابك!"
                }
        
        return {
            "status": status_response.status,
            "payment_status": status_response.payment_status,
            "amount_total": status_response.amount_total,
            "currency": status_response.currency
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في التحقق من الحالة: {str(e)}")

@router.get("/transactions/{user_id}")
async def get_user_transactions(user_id: str):
    """الحصول على سجل معاملات المستخدم"""
    
    transactions = await db.payment_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "transactions": transactions,
        "total": len(transactions)
    }

@router.get("/packages")
async def get_payment_packages():
    """الحصول على باقات الألماسات المتاحة"""
    
    packages = []
    for pkg_id, pkg in DIAMOND_PACKAGES.items():
        packages.append({
            "id": pkg_id,
            "name": pkg["name"],
            "diamonds": pkg["diamonds"],
            "bonus": pkg["bonus"],
            "total_diamonds": pkg["diamonds"] + pkg["bonus"],
            "price_sar": pkg["price_sar"],
            "price_usd": round(pkg["price_sar"] * SAR_TO_USD, 2)
        })
    
    return {
        "packages": packages,
        "currency": "SAR",
        "currency_symbol": "ر.س"
    }
