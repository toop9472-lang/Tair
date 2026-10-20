"""
In-App Purchases System - نظام المشتريات داخل التطبيق
- باقات الألماسات
- باقات VIP
- عروض خاصة
- سجل المشتريات
"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from auth.dependencies import get_current_user_id
import os
import uuid

router = APIRouter(prefix='/iap', tags=['In-App Purchases'])

def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


# ============ MODELS ============

class PurchaseRequest(BaseModel):
    product_id: str
    payment_method: str = "apple_pay"  # apple_pay, google_pay, stripe
    receipt_data: Optional[str] = None

class SubscriptionRequest(BaseModel):
    plan_id: str
    payment_method: str = "apple_pay"


# ============ PRODUCT DEFINITIONS ============

# باقات الألماسات
DIAMOND_PACKAGES = [
    {
        "id": "diamonds_100",
        "name": "حزمة البداية",
        "name_en": "Starter Pack",
        "diamonds": 100,
        "bonus": 0,
        "price_sar": 3.00,
        "price_usd": 0.80,
        "icon": "💎",
        "popular": False,
        "best_value": False
    },
    {
        "id": "diamonds_250",
        "name": "الحزمة الفضية",
        "name_en": "Silver Pack",
        "diamonds": 250,
        "bonus": 25,
        "price_sar": 7.00,
        "price_usd": 1.87,
        "icon": "💎💎",
        "popular": True,
        "best_value": False
    },
    {
        "id": "diamonds_500",
        "name": "الحزمة الذهبية",
        "name_en": "Gold Pack",
        "diamonds": 500,
        "bonus": 75,
        "price_sar": 12.00,
        "price_usd": 3.20,
        "icon": "💎💎💎",
        "popular": False,
        "best_value": False
    },
    {
        "id": "diamonds_1000",
        "name": "الحزمة البلاتينية",
        "name_en": "Platinum Pack",
        "diamonds": 1000,
        "bonus": 200,
        "price_sar": 19.00,
        "price_usd": 5.07,
        "icon": "👑",
        "popular": False,
        "best_value": True
    },
    {
        "id": "diamonds_2500",
        "name": "حزمة الملوك",
        "name_en": "Royal Pack",
        "diamonds": 2500,
        "bonus": 750,
        "price_sar": 45.00,
        "price_usd": 12.00,
        "icon": "🏆",
        "popular": False,
        "best_value": False
    },
    {
        "id": "diamonds_5000",
        "name": "حزمة الأساطير",
        "name_en": "Legend Pack",
        "diamonds": 5000,
        "bonus": 2000,
        "price_sar": 85.00,
        "price_usd": 22.67,
        "icon": "⭐",
        "popular": False,
        "best_value": False
    }
]

# اشتراكات VIP
VIP_SUBSCRIPTIONS = [
    {
        "id": "vip_weekly",
        "name": "VIP أسبوعي",
        "name_en": "Weekly VIP",
        "duration_days": 7,
        "price_sar": 9.99,
        "price_usd": 2.67,
        "benefits": {
            "daily_diamonds": 50,
            "ad_free": True,
            "exclusive_games": True,
            "double_rewards": False,
            "priority_support": False,
            "exclusive_avatar": True
        },
        "badge": "🌟",
        "color": "#10b981"
    },
    {
        "id": "vip_monthly",
        "name": "VIP شهري",
        "name_en": "Monthly VIP",
        "duration_days": 30,
        "price_sar": 29.99,
        "price_usd": 8.00,
        "benefits": {
            "daily_diamonds": 100,
            "ad_free": True,
            "exclusive_games": True,
            "double_rewards": True,
            "priority_support": True,
            "exclusive_avatar": True
        },
        "badge": "💫",
        "color": "#f59e0b",
        "popular": True
    },
    {
        "id": "vip_yearly",
        "name": "VIP سنوي",
        "name_en": "Yearly VIP",
        "duration_days": 365,
        "price_sar": 249.99,
        "price_usd": 66.67,
        "benefits": {
            "daily_diamonds": 200,
            "ad_free": True,
            "exclusive_games": True,
            "double_rewards": True,
            "priority_support": True,
            "exclusive_avatar": True,
            "special_title": "أسطورة صقر"
        },
        "badge": "👑",
        "color": "#8b5cf6",
        "best_value": True
    }
]

# عروض خاصة
SPECIAL_OFFERS = [
    {
        "id": "starter_bundle",
        "name": "عرض البداية",
        "name_en": "Starter Bundle",
        "description": "للمستخدمين الجدد فقط",
        "original_price_sar": 25.00,
        "price_sar": 9.99,
        "discount_percent": 60,
        "contents": {
            "diamonds": 500,
            "vip_days": 7,
            "exclusive_avatar": True
        },
        "one_time": True,
        "for_new_users": True,
        "expires_hours": 48
    },
    {
        "id": "weekend_special",
        "name": "عرض نهاية الأسبوع",
        "name_en": "Weekend Special",
        "description": "متاح فقط في عطلة نهاية الأسبوع",
        "original_price_sar": 20.00,
        "price_sar": 12.99,
        "discount_percent": 35,
        "contents": {
            "diamonds": 400,
            "bonus_points": 100
        },
        "one_time": False,
        "weekend_only": True
    }
]


# ============ ENDPOINTS ============

@router.get('/products')
async def get_all_products():
    """الحصول على جميع المنتجات المتاحة"""
    return {
        "diamond_packages": DIAMOND_PACKAGES,
        "vip_subscriptions": VIP_SUBSCRIPTIONS,
        "special_offers": SPECIAL_OFFERS
    }


@router.get('/diamond-packages')
async def get_diamond_packages():
    """الحصول على باقات الألماسات"""
    return {
        "packages": DIAMOND_PACKAGES,
        "currency": "SAR"
    }


@router.get('/vip-plans')
async def get_vip_plans():
    """الحصول على خطط VIP"""
    return {
        "plans": VIP_SUBSCRIPTIONS,
        "currency": "SAR"
    }


@router.get('/special-offers')
async def get_special_offers(user_id: Optional[str] = None):
    """الحصول على العروض الخاصة"""
    db = get_db()
    
    available_offers = []
    
    for offer in SPECIAL_OFFERS:
        # Check if new user only
        if offer.get("for_new_users") and user_id:
            user = await db.users.find_one({"id": user_id})
            if user:
                created = user.get("created_at", datetime.now(timezone.utc))
                if (datetime.now(timezone.utc) - created).days > 7:
                    continue  # Skip offer for old users
        
        # Check if one-time and already purchased
        if offer.get("one_time") and user_id:
            purchased = await db.purchases.find_one({
                "user_id": user_id,
                "product_id": offer["id"]
            })
            if purchased:
                continue  # Already purchased
        
        available_offers.append(offer)
    
    return {
        "offers": available_offers,
        "currency": "SAR"
    }


@router.post('/purchase')
async def purchase_product(
    data: PurchaseRequest,
    user_id: str = Depends(get_current_user_id)
):
    """شراء منتج"""
    db = get_db()
    
    # Find product
    product = None
    product_type = None
    
    # Check diamond packages
    for pkg in DIAMOND_PACKAGES:
        if pkg["id"] == data.product_id:
            product = pkg
            product_type = "diamonds"
            break
    
    # Check special offers
    if not product:
        for offer in SPECIAL_OFFERS:
            if offer["id"] == data.product_id:
                product = offer
                product_type = "offer"
                break
    
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    
    # Create purchase record
    purchase_id = str(uuid.uuid4())[:8]
    
    purchase_record = {
        "purchase_id": purchase_id,
        "user_id": user_id,
        "product_id": data.product_id,
        "product_type": product_type,
        "payment_method": data.payment_method,
        "amount_sar": product.get("price_sar", 0),
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.purchases.insert_one(purchase_record)
    
    # For demo: auto-complete purchase
    # In production, this would be handled by payment callback
    
    # Award diamonds
    diamonds_to_add = 0
    if product_type == "diamonds":
        diamonds_to_add = product["diamonds"] + product.get("bonus", 0)
    elif product_type == "offer":
        diamonds_to_add = product.get("contents", {}).get("diamonds", 0)
    
    if diamonds_to_add > 0:
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"diamonds": diamonds_to_add}}
        )
    
    # Award VIP if included
    if product_type == "offer" and product.get("contents", {}).get("vip_days"):
        vip_days = product["contents"]["vip_days"]
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "vip_until": datetime.now(timezone.utc) + timedelta(days=vip_days),
                    "is_vip": True
                }
            }
        )
    
    # Update purchase status
    await db.purchases.update_one(
        {"purchase_id": purchase_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "success": True,
        "purchase_id": purchase_id,
        "diamonds_added": diamonds_to_add,
        "message": "تم الشراء بنجاح!"
    }


@router.post('/subscribe')
async def subscribe_vip(
    data: SubscriptionRequest,
    user_id: str = Depends(get_current_user_id)
):
    """الاشتراك في VIP"""
    db = get_db()
    
    # Find plan
    plan = None
    for p in VIP_SUBSCRIPTIONS:
        if p["id"] == data.plan_id:
            plan = p
            break
    
    if not plan:
        raise HTTPException(status_code=404, detail="الخطة غير موجودة")
    
    # Create subscription
    subscription_id = str(uuid.uuid4())[:8]
    
    subscription = {
        "subscription_id": subscription_id,
        "user_id": user_id,
        "plan_id": data.plan_id,
        "payment_method": data.payment_method,
        "amount_sar": plan["price_sar"],
        "duration_days": plan["duration_days"],
        "status": "active",
        "starts_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=plan["duration_days"]),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.subscriptions.insert_one(subscription)
    
    # Update user VIP status
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "is_vip": True,
                "vip_plan": data.plan_id,
                "vip_until": subscription["expires_at"],
                "vip_benefits": plan["benefits"]
            }
        }
    )
    
    return {
        "success": True,
        "subscription_id": subscription_id,
        "plan": plan,
        "expires_at": subscription["expires_at"].isoformat(),
        "message": f"مبروك! أنت الآن {plan['name']}"
    }


@router.get('/my-purchases')
async def get_my_purchases(user_id: str = Depends(get_current_user_id)):
    """الحصول على سجل مشترياتي"""
    db = get_db()
    
    purchases = await db.purchases.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    subscriptions = await db.subscriptions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate total spent
    total_spent = sum(p.get("amount_sar", 0) for p in purchases if p.get("status") == "completed")
    total_spent += sum(s.get("amount_sar", 0) for s in subscriptions)
    
    return {
        "purchases": purchases,
        "subscriptions": subscriptions,
        "total_spent_sar": total_spent,
        "total_purchases": len(purchases),
        "active_subscription": next((s for s in subscriptions if s.get("status") == "active"), None)
    }


@router.get('/vip-status')
async def get_vip_status(user_id: str = Depends(get_current_user_id)):
    """الحصول على حالة VIP"""
    db = get_db()
    
    user = await db.users.find_one({"$or": [{"id": user_id}, {"user_id": user_id}]})
    if not user:
        raise HTTPException(status_code=404, detail="مستخدم غير موجود")
    
    is_vip = user.get("is_vip", False)
    vip_until = user.get("vip_until")
    
    # Check if expired
    if vip_until and vip_until < datetime.now(timezone.utc):
        is_vip = False
        await db.users.update_one(
            {"$or": [{"id": user_id}, {"user_id": user_id}]},
            {"$set": {"is_vip": False}}
        )
    
    if not is_vip:
        return {
            "is_vip": False,
            "available_plans": VIP_SUBSCRIPTIONS
        }
    
    # Find plan details
    plan_id = user.get("vip_plan")
    plan = next((p for p in VIP_SUBSCRIPTIONS if p["id"] == plan_id), None)
    
    return {
        "is_vip": True,
        "plan": plan,
        "expires_at": vip_until.isoformat() if vip_until else None,
        "benefits": user.get("vip_benefits", {}),
        "days_remaining": (vip_until - datetime.now(timezone.utc)).days if vip_until else 0
    }


@router.post('/restore-purchases')
async def restore_purchases(
    user_id: str = Depends(get_current_user_id)
):
    """استعادة المشتريات (للأجهزة الجديدة)"""
    db = get_db()
    
    # Get all completed purchases
    purchases = await db.purchases.find({
        "user_id": user_id,
        "status": "completed"
    }).to_list(100)
    
    # Get active subscriptions
    subscriptions = await db.subscriptions.find({
        "user_id": user_id,
        "status": "active",
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    }).to_list(10)
    
    return {
        "restored_purchases": len(purchases),
        "active_subscriptions": len(subscriptions),
        "message": "تم استعادة المشتريات بنجاح" if purchases or subscriptions else "لا توجد مشتريات للاستعادة"
    }
