"""
Points System Settings
Manage base points, conversion rates, seasons and promotions
"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from auth.dependencies import get_current_user_id
import os

router = APIRouter(prefix='/points-settings', tags=['Points System'])

def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


# ============ MODELS ============

class PointsSettings(BaseModel):
    # Base conversion rate
    points_per_dollar: int = 500  # 500 points = $1
    points_per_sar: int = 133  # ~133 points = 1 SAR
    
    # Earning rates
    points_per_minute_watching: int = 1  # Points earned per minute
    min_watch_seconds: int = 30  # Minimum seconds to earn points
    max_ads_per_10_minutes: int = 5  # Anti-cheat limit
    
    # Withdrawal settings
    min_withdrawal_points: int = 500  # Minimum points to withdraw
    withdrawal_fee_percent: float = 0  # Fee percentage (0-10%)
    
    # Bonus settings
    daily_login_bonus: int = 5  # Points for daily login
    referral_bonus: int = 50  # Points for referring a user
    first_ad_bonus: int = 10  # Bonus for first ad of the day


class SeasonPromotion(BaseModel):
    id: Optional[str] = None
    name: str
    name_en: str = ""
    description: str = ""
    multiplier: float = 2.0  # Points multiplier (2x, 3x, etc.)
    bonus_points: int = 0  # Extra bonus points
    start_date: datetime
    end_date: datetime
    is_active: bool = True
    applies_to: List[str] = ["watching", "rewarded"]  # What it applies to
    banner_color: str = "#F59E0B"  # Display color
    icon: str = "🎉"


class CreatePromotion(BaseModel):
    name: str
    name_en: str = ""
    description: str = ""
    multiplier: float = 2.0
    bonus_points: int = 0
    start_date: datetime
    end_date: datetime
    applies_to: List[str] = ["watching", "rewarded"]
    banner_color: str = "#F59E0B"
    icon: str = "🎉"


# ============ HELPER FUNCTIONS ============

async def get_points_settings(db) -> dict:
    """Get current points settings"""
    settings = await db.settings.find_one({'type': 'points_system'}, {'_id': 0})
    if not settings:
        return PointsSettings().model_dump()
    return settings


async def get_active_promotions(db) -> List[dict]:
    """Get currently active promotions"""
    now = datetime.now(timezone.utc)
    promotions = await db.promotions.find({
        'is_active': True,
        'start_date': {'$lte': now},
        'end_date': {'$gte': now}
    }, {'_id': 0}).to_list(100)
    return promotions


async def calculate_points_with_promotions(db, base_points: int, activity_type: str = "watching") -> dict:
    """Calculate points with any active promotions applied"""
    promotions = await get_active_promotions(db)
    
    total_multiplier = 1.0
    total_bonus = 0
    active_promos = []
    
    for promo in promotions:
        if activity_type in promo.get('applies_to', []):
            total_multiplier *= promo.get('multiplier', 1.0)
            total_bonus += promo.get('bonus_points', 0)
            active_promos.append({
                'name': promo.get('name'),
                'icon': promo.get('icon', '🎉'),
                'multiplier': promo.get('multiplier')
            })
    
    final_points = int(base_points * total_multiplier) + total_bonus
    
    return {
        'base_points': base_points,
        'multiplier': total_multiplier,
        'bonus': total_bonus,
        'final_points': final_points,
        'active_promotions': active_promos
    }


# ============ ROUTES ============

@router.get('/settings')
async def get_settings(user_id: str = Depends(get_current_user_id)):
    """Get points system settings (admin only)"""
    db = get_db()
    
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    settings = await get_points_settings(db)
    return settings


@router.put('/settings')
async def update_settings(
    settings: PointsSettings,
    user_id: str = Depends(get_current_user_id)
):
    """Update points system settings (admin only)"""
    db = get_db()
    
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    # Validate settings
    if settings.points_per_dollar < 100:
        raise HTTPException(status_code=400, detail='الحد الأدنى للنقاط لكل دولار هو 100')
    if settings.multiplier_max > 10:
        raise HTTPException(status_code=400, detail='الحد الأقصى للمضاعف هو 10x') if hasattr(settings, 'multiplier_max') else None
    
    update_data = settings.model_dump()
    update_data['type'] = 'points_system'
    update_data['updated_at'] = datetime.now(timezone.utc)
    update_data['updated_by'] = user_id
    
    await db.settings.update_one(
        {'type': 'points_system'},
        {'$set': update_data},
        upsert=True
    )
    
    return {'message': 'تم حفظ إعدادات النقاط بنجاح'}


@router.get('/promotions')
async def get_promotions(user_id: str = Depends(get_current_user_id)):
    """Get all promotions (admin only)"""
    db = get_db()
    
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    promotions = await db.promotions.find({}, {'_id': 0}).sort('start_date', -1).to_list(100)
    return {'promotions': promotions}


@router.post('/promotions')
async def create_promotion(
    promo: CreatePromotion,
    user_id: str = Depends(get_current_user_id)
):
    """Create a new promotion/season (admin only)"""
    db = get_db()
    
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    # Validate dates
    if promo.end_date <= promo.start_date:
        raise HTTPException(status_code=400, detail='تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية')
    
    import uuid
    promo_doc = promo.model_dump()
    promo_doc['id'] = str(uuid.uuid4())[:8]
    promo_doc['is_active'] = True
    promo_doc['created_at'] = datetime.now(timezone.utc)
    promo_doc['created_by'] = user_id
    
    await db.promotions.insert_one(promo_doc)

    
    promo_doc.pop("_id", None)
    
    return {'message': 'تم إنشاء العرض الترويجي بنجاح', 'id': promo_doc['id']}


@router.put('/promotions/{promo_id}')
async def update_promotion(
    promo_id: str,
    promo: CreatePromotion,
    user_id: str = Depends(get_current_user_id)
):
    """Update an existing promotion (admin only)"""
    db = get_db()
    
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    existing = await db.promotions.find_one({'id': promo_id})
    if not existing:
        raise HTTPException(status_code=404, detail='العرض غير موجود')
    
    update_data = promo.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc)
    
    await db.promotions.update_one(
        {'id': promo_id},
        {'$set': update_data}
    )
    
    return {'message': 'تم تحديث العرض بنجاح'}


@router.delete('/promotions/{promo_id}')
async def delete_promotion(
    promo_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Delete a promotion (admin only)"""
    db = get_db()
    
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    result = await db.promotions.delete_one({'id': promo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='العرض غير موجود')
    
    return {'message': 'تم حذف العرض بنجاح'}


@router.post('/promotions/{promo_id}/toggle')
async def toggle_promotion(
    promo_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Toggle promotion active status (admin only)"""
    db = get_db()
    
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    promo = await db.promotions.find_one({'id': promo_id})
    if not promo:
        raise HTTPException(status_code=404, detail='العرض غير موجود')
    
    new_status = not promo.get('is_active', True)
    await db.promotions.update_one(
        {'id': promo_id},
        {'$set': {'is_active': new_status}}
    )
    
    return {
        'message': 'تم تفعيل العرض' if new_status else 'تم إيقاف العرض',
        'is_active': new_status
    }


# ============ PUBLIC ROUTES ============

@router.get('/current')
async def get_current_rates():
    """Get current points rates and active promotions (public)"""
    db = get_db()
    
    settings = await get_points_settings(db)
    promotions = await get_active_promotions(db)
    
    return {
        'points_per_dollar': settings.get('points_per_dollar', 500),
        'points_per_sar': settings.get('points_per_sar', 133),
        'points_per_minute': settings.get('points_per_minute_watching', 1),
        'min_withdrawal': settings.get('min_withdrawal_points', 500),
        'daily_login_bonus': settings.get('daily_login_bonus', 5),
        'active_promotions': [
            {
                'name': p.get('name'),
                'icon': p.get('icon', '🎉'),
                'multiplier': p.get('multiplier', 1),
                'bonus': p.get('bonus_points', 0),
                'ends_at': p.get('end_date'),
                'banner_color': p.get('banner_color', '#F59E0B')
            }
            for p in promotions
        ],
        'has_active_promotion': len(promotions) > 0
    }


@router.get('/calculate')
async def calculate_earnings(
    points: int,
    activity: str = "watching"
):
    """Calculate earnings with active promotions"""
    db = get_db()
    result = await calculate_points_with_promotions(db, points, activity)
    
    settings = await get_points_settings(db)
    points_per_dollar = settings.get('points_per_dollar', 500)
    
    result['value_usd'] = round(result['final_points'] / points_per_dollar, 2)
    result['value_sar'] = round(result['value_usd'] * 3.75, 2)
    
    return result


# ============ PRESET SEASONS ============

PRESET_SEASONS = [
    {
        'id': 'ramadan',
        'name': 'موسم رمضان المبارك',
        'name_en': 'Ramadan Season',
        'icon': '🌙',
        'multiplier': 2.0,
        'bonus_points': 10,
        'banner_color': '#059669',
        'description': 'نقاط مضاعفة طوال شهر رمضان'
    },
    {
        'id': 'eid',
        'name': 'عروض العيد',
        'name_en': 'Eid Offers',
        'icon': '🎊',
        'multiplier': 3.0,
        'bonus_points': 20,
        'banner_color': '#7C3AED',
        'description': 'احتفل معنا بنقاط ثلاثية!'
    },
    {
        'id': 'national_day',
        'name': 'اليوم الوطني السعودي',
        'name_en': 'Saudi National Day',
        'icon': '🇸🇦',
        'multiplier': 2.5,
        'bonus_points': 15,
        'banner_color': '#16A34A',
        'description': 'احتفالاً باليوم الوطني'
    },
    {
        'id': 'weekend',
        'name': 'عروض نهاية الأسبوع',
        'name_en': 'Weekend Bonus',
        'icon': '🎉',
        'multiplier': 1.5,
        'bonus_points': 5,
        'banner_color': '#F59E0B',
        'description': 'نقاط إضافية في عطلة نهاية الأسبوع'
    },
    {
        'id': 'new_year',
        'name': 'رأس السنة',
        'name_en': 'New Year',
        'icon': '🎆',
        'multiplier': 2.0,
        'bonus_points': 25,
        'banner_color': '#DC2626',
        'description': 'ابدأ السنة الجديدة بنقاط مضاعفة'
    },
    {
        'id': 'flash_sale',
        'name': 'عرض سريع',
        'name_en': 'Flash Sale',
        'icon': '⚡',
        'multiplier': 5.0,
        'bonus_points': 0,
        'banner_color': '#EA580C',
        'description': 'عرض محدود - نقاط x5!'
    }
]


@router.get('/preset-seasons')
async def get_preset_seasons(user_id: str = Depends(get_current_user_id)):
    """Get preset season templates (admin only)"""
    db = get_db()
    
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    return {'presets': PRESET_SEASONS}
