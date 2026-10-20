from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from models.ad import Ad, AdCreate, AdResponse
from models.user import WatchedAd
from auth.dependencies import get_current_user_id
from typing import List, Optional
from datetime import datetime, timezone
import os

router = APIRouter(prefix='/ads', tags=['Advertisements'])

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]

@router.get('', response_model=List[AdResponse])
async def get_ads(ad_type: Optional[str] = Query(None, description="Filter by type: 'local' or 'global'")):
    """
    Get all active ads (public - no auth required)
    Combines ads from both 'ads' and 'advertiser_ads' collections
    Supports filtering by ad_type: 'local' (personal ads) or 'global'
    """
    db = get_db()
    current_time = datetime.now(timezone.utc)

    def _is_demo_like_text(value: Optional[str]) -> bool:
        normalized = (value or "").strip().lower()
        if not normalized:
            return False
        markers = ("test", "demo", "dummy", "sample", "placeholder", "تجريبي", "اختبار", "وهمي")
        return any(marker in normalized for marker in markers)

    def _is_demo_ad(ad_doc: dict) -> bool:
        if not isinstance(ad_doc, dict):
            return False
        for field in ("title", "description", "advertiser", "advertiser_name"):
            if _is_demo_like_text(ad_doc.get(field)):
                return True
        return False
    
    # Build query for advertiser ads
    advertiser_query = {'status': 'active', 'is_active': True}
    
    # Add type filter if provided
    if ad_type:
        advertiser_query['ad_type'] = ad_type
    
    # Get ads from main ads collection (these are global/system ads)
    main_ads_query = {'is_active': True}
    if ad_type == 'local':
        main_ads_query = {'is_active': True, 'ad_type': 'local'}
    elif ad_type == 'global':
        main_ads_query = {'is_active': True}  # Main ads are global by default
    
    main_ads = await db.ads.find(main_ads_query, {'_id': 0}).to_list(100)
    
    # Get active ads from advertiser_ads collection (filter expired ones)
    # Sort by boosted_at desc (most recently boosted first), then created_at desc
    advertiser_ads = await db.advertiser_ads.find(advertiser_query, {'_id': 0}).sort([
        ('boosted_at', -1),
        ('created_at', -1),
    ]).to_list(100)
    
    all_ads = []
    boosted_advertiser_ads = []
    normal_advertiser_ads = []
    
    removed_main_ad_ids = []
    removed_advertiser_ad_ids = []

    # Process main ads (added later — boosted advertiser ads come first)
    main_responses = []
    for ad in main_ads:
        if _is_demo_ad(ad):
            if ad.get("id"):
                removed_main_ad_ids.append(ad["id"])
            continue
        main_responses.append(AdResponse(
            id=ad['id'],
            title=ad['title'],
            description=ad['description'],
            video_url=ad['video_url'],
            thumbnail_url=ad['thumbnail_url'],
            advertiser=ad['advertiser'],
            website_url=ad.get('website_url'),
            duration=ad['duration'],
            points=ad['points_per_minute'],
            ad_type=ad.get('ad_type', 'global')
        ))
    
    # Process advertiser ads - check expiration
    for ad in advertiser_ads:
        if _is_demo_ad(ad):
            if ad.get("id"):
                removed_advertiser_ad_ids.append(ad["id"])
            continue
        expires_at = ad.get('expires_at')
        if expires_at:
            # Parse expiration time
            expires_dt = None
            if isinstance(expires_at, str):
                try:
                    expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    # Ensure timezone aware
                    if expires_dt.tzinfo is None:
                        expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    expires_dt = None
            elif isinstance(expires_at, datetime):
                expires_dt = expires_at
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)
            
            # Skip expired ads
            if expires_dt and expires_dt < current_time:
                # Mark as expired in DB
                await db.advertiser_ads.update_one(
                    {'id': ad.get('id')},
                    {'$set': {'status': 'expired', 'is_active': False}}
                )
                continue
        
        all_ads_item = AdResponse(
            id=ad.get('id', ''),
            title=ad.get('title', ''),
            description=ad.get('description', ''),
            video_url=ad.get('video_url', ''),
            thumbnail_url=ad.get('thumbnail_url', ''),
            advertiser=ad.get('advertiser', ad.get('advertiser_name', '')),
            website_url=ad.get('website_url'),
            duration=ad.get('duration', 30),
            points=ad.get('points', 1),
            ad_type=ad.get('ad_type', 'local')
        )
        if ad.get('boosted_at'):
            boosted_advertiser_ads.append(all_ads_item)
        else:
            normal_advertiser_ads.append(all_ads_item)

    # Final order: boosted advertiser ads → normal advertiser ads → main/system ads
    all_ads = boosted_advertiser_ads + normal_advertiser_ads + main_responses

    # Cleanup test/demo records so they stop reappearing.
    if removed_main_ad_ids:
        await db.ads.delete_many({"id": {"$in": removed_main_ad_ids}})
    if removed_advertiser_ad_ids:
        await db.advertiser_ads.delete_many({"id": {"$in": removed_advertiser_ad_ids}})
    
    return all_ads


@router.get('/advertiser/status/{ad_id}')
async def get_advertiser_ad_status(ad_id: str):
    """
    Get advertiser ad status including countdown timer info
    Returns remaining time for active ads
    """
    db = get_db()
    ad = await db.advertiser_ads.find_one({'id': ad_id}, {'_id': 0})
    
    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Ad not found'
        )
    
    current_time = datetime.now(timezone.utc)
    expires_at = ad.get('expires_at')
    remaining_seconds = 0
    is_active = ad.get('is_active', False)
    
    if expires_at and is_active:
        expires_dt = None
        if isinstance(expires_at, str):
            try:
                expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                expires_dt = None
        elif isinstance(expires_at, datetime):
            expires_dt = expires_at
            if expires_dt.tzinfo is None:
                expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        
        if expires_dt:
            remaining = expires_dt - current_time
            remaining_seconds = max(0, int(remaining.total_seconds()))
            
            # If expired, update status
            if remaining_seconds <= 0:
                await db.advertiser_ads.update_one(
                    {'id': ad_id},
                    {'$set': {'status': 'expired', 'is_active': False}}
                )
                is_active = False
    
    return {
        'ad_id': ad_id,
        'status': ad.get('status'),
        'is_active': is_active,
        'payment_status': ad.get('payment_status'),
        'expires_at': expires_at,
        'remaining_seconds': remaining_seconds,
        'duration_hours': ad.get('duration_hours'),
        'activated_at': ad.get('activated_at'),
        'advertiser_name': ad.get('advertiser_name'),
        'title': ad.get('title')
    }


@router.get('/advertiser/my-ads')
async def get_my_advertiser_ads(email: str = Query(..., description="Advertiser email")):
    """
    Get all ads for an advertiser by email
    """
    db = get_db()
    ads = await db.advertiser_ads.find(
        {'advertiser_email': email},
        {'_id': 0}
    ).sort('created_at', -1).to_list(50)
    
    current_time = datetime.now(timezone.utc)
    result = []
    
    for ad in ads:
        expires_at = ad.get('expires_at')
        remaining_seconds = 0
        
        if expires_at and ad.get('is_active'):
            expires_dt = None
            if isinstance(expires_at, str):
                try:
                    expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    if expires_dt.tzinfo is None:
                        expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    pass
            elif isinstance(expires_at, datetime):
                expires_dt = expires_at
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)
            
            if expires_dt:
                remaining = expires_dt - current_time
                remaining_seconds = max(0, int(remaining.total_seconds()))
        
        result.append({
            'id': ad.get('id'),
            'title': ad.get('title'),
            'status': ad.get('status'),
            'is_active': ad.get('is_active', False),
            'payment_status': ad.get('payment_status'),
            'expires_at': expires_at,
            'remaining_seconds': remaining_seconds,
            'duration_hours': ad.get('duration_hours'),
            'created_at': ad.get('created_at'),
            'ad_type': ad.get('ad_type', 'local')
        })
    
    return {'ads': result}

@router.get('/{ad_id}', response_model=AdResponse)
async def get_ad(ad_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Get specific ad by ID
    """
    db = get_db()
    ad = await db.ads.find_one({'id': ad_id})
    
    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Ad not found'
        )
    
    return AdResponse(
        id=ad['id'],
        title=ad['title'],
        description=ad['description'],
        video_url=ad['video_url'],
        thumbnail_url=ad['thumbnail_url'],
        advertiser=ad['advertiser'],
        duration=ad['duration'],
        points=ad['points_per_minute']
    )

@router.post('/watch', response_model=dict)
async def watch_ad(data: dict, user_id: str = Depends(get_current_user_id)):
    """
    Record ad watch and award points
    Anti-cheat: Validates watch time and ensures each ad is watched only once
    """
    db = get_db()
    ad_id = data.get('ad_id')
    watch_time = data.get('watch_time', 0)
    
    if not ad_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='ad_id is required'
        )
    
    # Anti-cheat: Minimum watch time validation (at least 30 seconds)
    MIN_WATCH_TIME = 30
    if watch_time < MIN_WATCH_TIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Minimum watch time is {MIN_WATCH_TIME} seconds'
        )
    
    # Get ad
    ad = await db.ads.find_one({'id': ad_id})
    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Ad not found'
        )
    
    # Get user - handle both 'id' and 'user_id' fields
    user = await db.users.find_one({
        '$or': [
            {'id': user_id},
            {'user_id': user_id}
        ]
    })
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found'
        )
    
    # Get the actual user_id field from the user document
    actual_user_id = user.get('id') or user.get('user_id')
    
    # Anti-cheat: Check if ad was already watched
    watched_ads = user.get('watched_ads', [])
    for watched_ad in watched_ads:
        if watched_ad.get('ad_id') == ad_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='لقد شاهدت هذا الإعلان من قبل. كل إعلان يمكن مشاهدته مرة واحدة فقط.'
            )
    
    # Anti-cheat: Check for rapid watching (max 5 ads per 10 minutes)
    from datetime import timedelta
    ten_minutes_ago = datetime.utcnow() - timedelta(minutes=10)
    recent_watches = [
        w for w in watched_ads 
        if w.get('watched_at') and w['watched_at'] > ten_minutes_ago
    ]
    if len(recent_watches) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail='أنت تشاهد الإعلانات بسرعة كبيرة. يرجى الانتظار قليلاً.'
        )
    
    # Validate watch time - cannot exceed ad duration
    max_watch_time = ad['duration']
    if watch_time > max_watch_time:
        watch_time = max_watch_time
    
    # Calculate points (1 point per minute)
    points_earned = (watch_time // 60) * ad.get('points_per_minute', 1)
    
    if points_earned <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='وقت المشاهدة قصير جداً لكسب النقاط. شاهد لمدة دقيقة على الأقل.'
        )
    
    # Get current points before update
    old_points = user.get('points', 0)
    
    # Create watched ad record
    watched_ad_record = {
        'ad_id': ad_id,
        'watched_at': datetime.utcnow(),
        'watch_time': watch_time,
        'points_earned': points_earned
    }
    
    # Update user points and watched ads
    await db.users.update_one(
        {'$or': [{'id': actual_user_id}, {'user_id': actual_user_id}]},
        {
            '$inc': {
                'points': points_earned,
                'total_earned': points_earned
            },
            '$push': {'watched_ads': watched_ad_record},
            '$set': {'updated_at': datetime.utcnow()}
        }
    )
    
    # Get updated user
    updated_user = await db.users.find_one({
        '$or': [{'id': actual_user_id}, {'user_id': actual_user_id}]
    })
    
    new_points = updated_user.get('points', 0)
    
    # Check for milestones and send notification
    milestones = [100, 250, 500, 1000, 2500, 5000, 10000]
    for milestone in milestones:
        if old_points < milestone <= new_points:
            # User crossed a milestone!
            try:
                from routes.notification_routes import send_notification_to_user
                if milestone == 500:
                    await send_notification_to_user(
                        db=db,
                        user_id=actual_user_id,
                        title='🎉 مبروك! يمكنك السحب الآن!',
                        body=f'وصلت إلى {milestone} نقطة! يمكنك الآن سحب $1',
                        notification_type='points_milestone',
                        data={'milestone': milestone, 'can_withdraw': True}
                    )
                else:
                    await send_notification_to_user(
                        db=db,
                        user_id=actual_user_id,
                        title=f'🎯 إنجاز جديد: {milestone} نقطة!',
                        body=f'أحسنت! وصلت إلى {milestone} نقطة. استمر في المشاهدة!',
                        notification_type='points_milestone',
                        data={'milestone': milestone}
                    )
            except Exception as e:
                print(f"Notification error: {e}")
            break
    
    return {
        'success': True,
        'points_earned': points_earned,
        'total_points': new_points,
        'message': f'حصلت على {points_earned} نقطة!'
    }