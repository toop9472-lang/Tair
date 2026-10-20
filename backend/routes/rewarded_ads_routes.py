"""
Rewarded Ads System
Manages rewarded ads from multiple ad networks + personal ads
"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from auth.dependencies import get_current_user_id
import os
import uuid
import random

router = APIRouter(prefix='/rewarded-ads', tags=['Rewarded Ads'])

def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


# ============ MODELS ============

class AdNetworkSettings(BaseModel):
    admob_enabled: bool = False
    admob_app_id: str = ""
    admob_rewarded_unit_id: str = ""
    unity_enabled: bool = False
    unity_game_id: str = ""
    unity_rewarded_placement_id: str = ""
    facebook_enabled: bool = False
    facebook_app_id: str = ""
    facebook_rewarded_placement_id: str = ""
    applovin_enabled: bool = False
    applovin_sdk_key: str = ""
    applovin_rewarded_unit_id: str = ""
    # Personal ads settings
    personal_ads_enabled: bool = True
    personal_ads_priority: int = 1  # 1 = highest priority
    # Reward settings
    points_per_rewarded_ad: int = 5
    daily_rewarded_limit: int = 50
    cooldown_seconds: int = 30


class RewardedAdView(BaseModel):
    ad_type: str  # 'personal', 'admob', 'unity', 'facebook', 'applovin'
    ad_id: Optional[str] = None
    completed: bool = False
    watch_duration: int = 0  # seconds
    points_earned: Optional[int] = None  # backward-compat input


class RewardedAdResponse(BaseModel):
    ad_type: str
    ad_id: Optional[str] = None
    video_url: Optional[str] = None
    title: Optional[str] = None
    advertiser: Optional[str] = None
    website_url: Optional[str] = None
    duration: int = 30  # seconds
    reward_points: int = 5  # backward compatibility field
    network_config: Optional[dict] = None  # For external ad networks


# ============ HELPER FUNCTIONS ============

async def get_ad_settings(db) -> dict:
    """Get ad network settings from database"""
    settings = await db.settings.find_one({'type': 'ad_networks'}, {'_id': 0})
    if not settings:
        return AdNetworkSettings().model_dump()
    return settings


async def check_daily_limit(db, user_id: str, limit: int) -> tuple:
    """Check if user has reached daily rewarded ad limit"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    count = await db.rewarded_ad_views.count_documents({
        'user_id': user_id,
        'completed': True,
        'timestamp': {'$gte': today_start}
    })
    
    return count < limit, limit - count


async def check_cooldown(db, user_id: str, cooldown_seconds: int) -> tuple:
    """Check if user is in cooldown period"""
    cooldown_time = datetime.now(timezone.utc) - timedelta(seconds=cooldown_seconds)
    
    last_view = await db.rewarded_ad_views.find_one(
        {'user_id': user_id, 'completed': True},
        sort=[('timestamp', -1)]
    )
    
    if last_view and last_view.get('timestamp'):
        last_time = last_view['timestamp']
        if isinstance(last_time, str):
            last_time = datetime.fromisoformat(last_time.replace('Z', '+00:00'))
        
        # تأكد من أن التاريخ له timezone
        if last_time.tzinfo is None:
            last_time = last_time.replace(tzinfo=timezone.utc)
        
        if last_time > cooldown_time:
            remaining = (last_time + timedelta(seconds=cooldown_seconds) - datetime.now(timezone.utc)).seconds
            return False, remaining
    
    return True, 0


async def get_next_personal_ad(db, user_id: str) -> Optional[dict]:
    """Get next personal ad that user hasn't watched recently"""
    # Get ads user watched in last 24 hours
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    watched = await db.rewarded_ad_views.distinct('ad_id', {
        'user_id': user_id,
        'ad_type': 'personal',
        'timestamp': {'$gte': yesterday}
    })
    
    # Get active personal ads not watched
    ad = await db.advertiser_ads.find_one({
        'status': 'active',
        'id': {'$nin': watched}
    }, {'_id': 0})
    
    # If all watched, get random one
    if not ad:
        ads = await db.advertiser_ads.find({'status': 'active'}, {'_id': 0}).to_list(100)
        if ads:
            ad = random.choice(ads)
    
    return ad


# ============ ROUTES ============

@router.get('/settings')
async def get_rewarded_settings(user_id: str = Depends(get_current_user_id)):
    """Get rewarded ad settings (admin only)"""
    db = get_db()
    
    # Verify admin
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    settings = await get_ad_settings(db)
    
    # Mask sensitive keys
    for key in ['admob_app_id', 'unity_game_id', 'facebook_app_id', 'applovin_sdk_key']:
        if settings.get(key):
            settings[key] = '****' + settings[key][-4:] if len(settings[key]) > 4 else '****'
    
    return settings


@router.put('/settings')
async def update_rewarded_settings(
    settings: AdNetworkSettings,
    user_id: str = Depends(get_current_user_id)
):
    """Update rewarded ad settings (admin only)"""
    db = get_db()
    
    # Verify admin
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح')
    
    # Get current settings to preserve masked values
    current = await db.settings.find_one({'type': 'ad_networks'}, {'_id': 0})
    
    update_data = settings.model_dump()
    update_data['type'] = 'ad_networks'
    update_data['updated_at'] = datetime.now(timezone.utc)
    
    # Don't overwrite with masked values
    if current:
        for key in ['admob_app_id', 'admob_rewarded_unit_id', 'unity_game_id', 
                    'unity_rewarded_placement_id', 'facebook_app_id', 
                    'facebook_rewarded_placement_id', 'applovin_sdk_key', 
                    'applovin_rewarded_unit_id']:
            if update_data.get(key, '').startswith('****'):
                update_data[key] = current.get(key, '')
    
    await db.settings.update_one(
        {'type': 'ad_networks'},
        {'$set': update_data},
        upsert=True
    )
    
    return {'message': 'تم حفظ إعدادات الإعلانات المكافئة'}


@router.get('/next')
async def get_next_rewarded_ad(user_id: str = Depends(get_current_user_id)):
    """Get next available rewarded ad for user"""
    db = get_db()
    settings = await get_ad_settings(db)
    
    # Check daily limit
    can_watch, remaining = await check_daily_limit(
        db, user_id, settings.get('daily_rewarded_limit', 50)
    )
    if not can_watch:
        raise HTTPException(
            status_code=429, 
            detail={'message': 'وصلت للحد اليومي', 'remaining': 0}
        )
    
    # Check cooldown
    can_watch, cooldown_remaining = await check_cooldown(
        db, user_id, settings.get('cooldown_seconds', 30)
    )
    if not can_watch:
        raise HTTPException(
            status_code=429,
            detail={'message': 'انتظر قليلاً', 'cooldown': cooldown_remaining}
        )
    
    reward_points = settings.get('points_per_rewarded_ad', 5)
    
    # Priority: Personal ads first if enabled
    if settings.get('personal_ads_enabled', True):
        personal_ad = await get_next_personal_ad(db, user_id)
        if personal_ad:
            return RewardedAdResponse(
                ad_type='personal',
                ad_id=personal_ad.get('id'),
                video_url=personal_ad.get('video_url'),
                title=personal_ad.get('title'),
                advertiser=personal_ad.get('advertiser_name'),
                website_url=personal_ad.get('website_url'),
                duration=30,
                reward_points=reward_points
            )
    
    # Return network ad config based on priority
    networks = []
    if settings.get('admob_enabled'):
        networks.append({
            'type': 'admob',
            'app_id': settings.get('admob_app_id'),
            'unit_id': settings.get('admob_rewarded_unit_id')
        })
    if settings.get('unity_enabled'):
        networks.append({
            'type': 'unity',
            'game_id': settings.get('unity_game_id'),
            'placement_id': settings.get('unity_rewarded_placement_id')
        })
    if settings.get('facebook_enabled'):
        networks.append({
            'type': 'facebook',
            'app_id': settings.get('facebook_app_id'),
            'placement_id': settings.get('facebook_rewarded_placement_id')
        })
    if settings.get('applovin_enabled'):
        networks.append({
            'type': 'applovin',
            'sdk_key': settings.get('applovin_sdk_key'),
            'unit_id': settings.get('applovin_rewarded_unit_id')
        })
    
    if networks:
        # Return first available network
        network = networks[0]
        return RewardedAdResponse(
            ad_type=network['type'],
            duration=30,
            reward_points=reward_points,
            network_config=network
        )
    
    raise HTTPException(status_code=404, detail='لا توجد إعلانات متاحة حالياً')


@router.post('/complete')
async def complete_rewarded_ad(
    view: RewardedAdView,
    user_id: str = Depends(get_current_user_id)
):
    """Record completed rewarded ad view and grant reward"""
    db = get_db()
    settings = await get_ad_settings(db)
    
    if not view.completed:
        return {'success': False, 'message': 'لم تكتمل المشاهدة'}
    
    # Validate minimum watch duration (at least 80% of ad = 24 seconds for 30-sec ad)
    min_duration = 24
    if view.watch_duration < min_duration:
        return {'success': False, 'message': 'مدة المشاهدة قصيرة جداً'}
    
    # Check daily limit
    can_watch, remaining = await check_daily_limit(
        db, user_id, settings.get('daily_rewarded_limit', 50)
    )
    if not can_watch:
        return {'success': False, 'message': 'وصلت للحد اليومي', 'remaining': 0}
    
    # 1 minute مشاهدة = 1 جوهرة + 6 ألماسات (توافق خلفي مع نقاط)
    full_minutes = max(0, int(view.watch_duration // 60))
    gems_earned = max(1, full_minutes) if view.watch_duration >= 60 else 0
    diamonds_earned = gems_earned * 6
    
    # Record the view
    view_doc = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'ad_type': view.ad_type,
        'ad_id': view.ad_id,
        'completed': True,
        'watch_duration': view.watch_duration,
        'points_earned': gems_earned,
        'gems_earned': gems_earned,
        'diamonds_earned': diamonds_earned,
        'timestamp': datetime.now(timezone.utc)
    }
    await db.rewarded_ad_views.insert_one(view_doc)
    
    # Grant gems/diamonds to user
    await db.users.update_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {
            '$inc': {
                'saqr_gems': gems_earned,
                'points': gems_earned,  # backward-compat
                'saqr_points': gems_earned,
                'diamonds': diamonds_earned,
                'total_earned': gems_earned,
                'ads_watched': 1
            }
        }
    )
    
    # Update ad statistics if personal ad
    if view.ad_type == 'personal' and view.ad_id:
        await db.advertiser_ads.update_one(
            {'id': view.ad_id},
            {'$inc': {'views': 1, 'completed_views': 1}}
        )
    
    # Get updated user data
    user = await db.users.find_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'_id': 0, 'saqr_gems': 1, 'diamonds': 1, 'ads_watched': 1}
    )
    
    return {
        'success': True,
        'gems_earned': gems_earned,
        'diamonds_earned': diamonds_earned,
        'points_earned': gems_earned,
        'total_gems': user.get('saqr_gems', 0),
        'total_diamonds': user.get('diamonds', 0),
        'total_points': user.get('saqr_gems', 0),
        'ads_watched': user.get('ads_watched', 0),
        'remaining_today': remaining - 1,
        'message': f'حصلت على {gems_earned} جوهرة صقر و {diamonds_earned} ألماسة!'
    }


@router.get('/stats')
async def get_user_rewarded_stats(user_id: str = Depends(get_current_user_id)):
    """Get user's rewarded ad statistics"""
    db = get_db()
    settings = await get_ad_settings(db)
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Today's stats
    today_views = await db.rewarded_ad_views.count_documents({
        'user_id': user_id,
        'completed': True,
        'timestamp': {'$gte': today_start}
    })
    
    today_points = await db.rewarded_ad_views.aggregate([
        {'$match': {'user_id': user_id, 'completed': True, 'timestamp': {'$gte': today_start}}},
        {'$group': {'_id': None, 'total': {'$sum': {'$ifNull': ['$gems_earned', '$points_earned']}}}}
    ]).to_list(1)
    today_diamonds = await db.rewarded_ad_views.aggregate([
        {'$match': {'user_id': user_id, 'completed': True, 'timestamp': {'$gte': today_start}}},
        {'$group': {'_id': None, 'total': {'$sum': {'$ifNull': ['$diamonds_earned', 0]}}}}
    ]).to_list(1)
    
    # All time stats
    total_views = await db.rewarded_ad_views.count_documents({
        'user_id': user_id,
        'completed': True
    })
    
    total_points = await db.rewarded_ad_views.aggregate([
        {'$match': {'user_id': user_id, 'completed': True}},
        {'$group': {'_id': None, 'total': {'$sum': {'$ifNull': ['$gems_earned', '$points_earned']}}}}
    ]).to_list(1)
    total_diamonds = await db.rewarded_ad_views.aggregate([
        {'$match': {'user_id': user_id, 'completed': True}},
        {'$group': {'_id': None, 'total': {'$sum': {'$ifNull': ['$diamonds_earned', 0]}}}}
    ]).to_list(1)
    
    daily_limit = settings.get('daily_rewarded_limit', 50)
    
    return {
        'today': {
            'views': today_views,
            'gems': today_points[0]['total'] if today_points else 0,
            'diamonds': today_diamonds[0]['total'] if today_diamonds else 0,
            'points': today_points[0]['total'] if today_points else 0,
            'remaining': max(0, daily_limit - today_views),
            'limit': daily_limit
        },
        'all_time': {
            'views': total_views,
            'gems': total_points[0]['total'] if total_points else 0,
            'diamonds': total_diamonds[0]['total'] if total_diamonds else 0,
            'points': total_points[0]['total'] if total_points else 0
        },
        'reward_per_ad': "1 gem + 6 diamonds per 60s",
        'cooldown_seconds': settings.get('cooldown_seconds', 30)
    }


@router.post('/start-session')
async def start_ad_session(
    data: dict,
    user_id: str = Depends(get_current_user_id)
):
    """Start a new ad viewing session for fraud prevention"""
    db = get_db()
    settings = await get_ad_settings(db)
    
    # Check daily limit
    can_watch, remaining = await check_daily_limit(
        db, user_id, settings.get('daily_rewarded_limit', 50)
    )
    if not can_watch:
        raise HTTPException(status_code=429, detail={'error': 'daily_limit', 'message': 'وصلت للحد اليومي'})
    
    # Check cooldown
    can_watch, cooldown_remaining = await check_cooldown(
        db, user_id, settings.get('cooldown_seconds', 30)
    )
    if not can_watch:
        raise HTTPException(status_code=429, detail={'error': 'cooldown', 'message': f'انتظر {cooldown_remaining} ثانية', 'remaining': cooldown_remaining})
    
    # Create session
    session_id = str(uuid.uuid4())
    session = {
        'session_id': session_id,
        'user_id': user_id,
        'ad_type': data.get('ad_type', 'rewarded'),
        'started_at': datetime.now(timezone.utc),
        'device_info': data.get('device_info', {}),
        'status': 'started'
    }
    await db.ad_sessions.insert_one(session)

    session.pop("_id", None)
    
    return {
        'session_id': session_id,
        'expected_reward': {'gems': 1, 'diamonds': 6, 'duration_seconds': 60},
        'remaining_today': remaining
    }


@router.post('/sync-pending')
async def sync_pending_reward(
    data: dict,
    user_id: str = Depends(get_current_user_id)
):
    """Sync a pending reward that failed to save earlier"""
    db = get_db()
    
    # Validate session
    session = await db.ad_sessions.find_one({
        'session_id': data.get('sessionId'),
        'user_id': user_id
    })
    
    if not session:
        raise HTTPException(status_code=404, detail='جلسة غير موجودة')
    
    # Check if already claimed
    if session.get('status') == 'completed':
        return {'success': False, 'message': 'تم استلام المكافأة مسبقاً'}
    
    # Grant reward
    reward_gems = 1
    reward_diamonds = 6
    
    await db.users.update_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'$inc': {
            'saqr_gems': reward_gems,
            'saqr_points': reward_gems,
            'points': reward_gems,
            'diamonds': reward_diamonds,
            'total_earned': reward_gems,
            'ads_watched': 1
        }}
    )
    
    await db.ad_sessions.update_one(
        {'session_id': data.get('sessionId')},
        {'$set': {'status': 'completed', 'synced_at': datetime.now(timezone.utc)}}
    )
    
    return {'success': True, 'gems_earned': reward_gems, 'diamonds_earned': reward_diamonds}


@router.get('/leaderboard')
async def get_rewarded_leaderboard():
    """Get top earners from rewarded ads"""
    db = get_db()
    
    # Get top 10 users by rewarded gems this week
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    
    pipeline = [
        {'$match': {'completed': True, 'timestamp': {'$gte': week_start}}},
        {'$group': {
            '_id': '$user_id',
            'total_points': {'$sum': {'$ifNull': ['$gems_earned', '$points_earned']}},
            'total_views': {'$sum': 1}
        }},
        {'$sort': {'total_points': -1}},
        {'$limit': 10}
    ]
    
    results = await db.rewarded_ad_views.aggregate(pipeline).to_list(10)
    
    # Get user names
    leaderboard = []
    for i, result in enumerate(results):
        user = await db.users.find_one(
            {'$or': [{'id': result['_id']}, {'user_id': result['_id']}]},
            {'_id': 0, 'name': 1}
        )
        leaderboard.append({
            'rank': i + 1,
            'name': user.get('name', 'مستخدم') if user else 'مستخدم',
            'points': result['total_points'],
            'views': result['total_views']
        })
    
    return {'leaderboard': leaderboard, 'period': 'weekly'}
