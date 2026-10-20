"""
User Activity Routes - Track online users and activity
"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from auth.dependencies import get_current_user_id
from datetime import datetime, timedelta
import os

router = APIRouter(prefix='/activity', tags=['User Activity'])


def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


@router.post('/heartbeat')
async def user_heartbeat(user_id: str = Depends(get_current_user_id)):
    """
    Update user's last active timestamp (call every 30 seconds from frontend)
    """
    db = get_db()
    
    await db.users.update_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'$set': {'last_active': datetime.utcnow()}}
    )
    
    return {'success': True}


@router.post('/ad-view/{ad_id}')
async def start_ad_view(ad_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Record that user started viewing an ad
    """
    db = get_db()
    
    # Add to active viewers
    await db.ad_viewers.update_one(
        {'ad_id': ad_id, 'user_id': user_id},
        {
            '$set': {
                'ad_id': ad_id,
                'user_id': user_id,
                'started_at': datetime.utcnow(),
                'last_ping': datetime.utcnow()
            }
        },
        upsert=True
    )
    
    return {'success': True}


@router.delete('/ad-view/{ad_id}')
async def end_ad_view(ad_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Record that user stopped viewing an ad
    """
    db = get_db()
    
    await db.ad_viewers.delete_one({'ad_id': ad_id, 'user_id': user_id})
    
    return {'success': True}


@router.get('/ad-viewers/{ad_id}')
async def get_ad_viewers_count(ad_id: str):
    """
    Get number of users currently viewing an ad (real count)
    """
    db = get_db()
    
    # Count viewers active in last 60 seconds
    one_minute_ago = datetime.utcnow() - timedelta(seconds=60)
    
    active_viewers = await db.ad_viewers.count_documents({
        'ad_id': ad_id,
        'last_ping': {'$gte': one_minute_ago}
    })
    
    # Also get total views for this ad (from watched_ads)
    total_views = await db.users.count_documents({
        'watched_ads.ad_id': ad_id
    })
    
    return {
        'viewers': active_viewers,
        'total_views': total_views
    }


@router.get('/online-users')
async def get_online_users():
    """
    Get count of currently online users (active in last 5 minutes)
    """
    db = get_db()
    
    five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
    
    online_count = await db.users.count_documents({
        'last_active': {'$gte': five_minutes_ago}
    })
    
    total_users = await db.users.count_documents({})
    
    return {
        'online': online_count,
        'offline': total_users - online_count,
        'total': total_users
    }


@router.get('/user-stats')
async def get_user_activity_stats():
    """
    Get detailed user activity statistics for admin dashboard
    """
    db = get_db()
    
    now = datetime.utcnow()
    five_minutes_ago = now - timedelta(minutes=5)
    one_hour_ago = now - timedelta(hours=1)
    one_day_ago = now - timedelta(days=1)
    one_week_ago = now - timedelta(weeks=1)
    
    # Online users (active in last 5 minutes)
    online = await db.users.count_documents({'last_active': {'$gte': five_minutes_ago}})
    
    # Active in last hour
    active_1h = await db.users.count_documents({'last_active': {'$gte': one_hour_ago}})
    
    # Active in last 24 hours
    active_24h = await db.users.count_documents({'last_active': {'$gte': one_day_ago}})
    
    # Active in last week
    active_7d = await db.users.count_documents({'last_active': {'$gte': one_week_ago}})
    
    # Total users
    total = await db.users.count_documents({})
    
    # Get recent active users list
    recent_users = await db.users.find(
        {'last_active': {'$gte': one_hour_ago}},
        {'_id': 0, 'id': 1, 'user_id': 1, 'name': 1, 'email': 1, 'avatar': 1, 'last_active': 1, 'points': 1}
    ).sort('last_active', -1).limit(20).to_list(20)
    
    # Calculate ad stats
    all_users = await db.users.find({}, {'_id': 0, 'watched_ads': 1}).to_list(10000)
    
    total_views = 0
    completed_views = 0
    
    for user in all_users:
        for wa in user.get('watched_ads', []):
            total_views += 1
            if wa.get('watch_time', 0) >= 60:
                completed_views += 1
    
    completion_rate = (completed_views / total_views * 100) if total_views > 0 else 0
    
    # Get active ads count
    active_ads = await db.ads.count_documents({'is_active': True})
    avg_views_per_ad = total_views / active_ads if active_ads > 0 else 0
    
    return {
        'users': {
            'total': total,
            'online': online,
            'offline': total - online,
            'active_1h': active_1h,
            'active_24h': active_24h,
            'active_7d': active_7d
        },
        'ads': {
            'total_views': total_views,
            'completed_views': completed_views,
            'completion_rate': round(completion_rate, 1),
            'avg_views_per_ad': round(avg_views_per_ad, 1)
        },
        'recent_active_users': [
            {
                'id': u.get('id') or u.get('user_id'),
                'name': u.get('name', 'مستخدم'),
                'email': u.get('email'),
                'avatar': u.get('avatar'),
                'points': u.get('points', 0),
                'last_active': u.get('last_active').isoformat() if u.get('last_active') else None,
                'status': 'online' if u.get('last_active') and u['last_active'] >= five_minutes_ago else 'away'
            }
            for u in recent_users
        ]
    }
