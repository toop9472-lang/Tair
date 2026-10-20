"""
Analytics Routes - Detailed analytics for ads and advertisers
"""
from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from auth.dependencies import get_current_user_id
from datetime import datetime, timedelta
from typing import Optional
import os

router = APIRouter(prefix='/analytics', tags=['Analytics'])


def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


@router.get('/ad/{ad_id}', response_model=dict)
async def get_ad_analytics(ad_id: str):
    """
    Get detailed analytics for a specific ad
    """
    db = get_db()
    
    # Get ad info
    ad = await db.ads.find_one({'id': ad_id}, {'_id': 0})
    if not ad:
        ad = await db.advertiser_ads.find_one({'id': ad_id}, {'_id': 0})
    
    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='الإعلان غير موجود'
        )
    
    # Get all users who watched this ad
    users = await db.users.find(
        {'watched_ads.ad_id': ad_id},
        {'_id': 0, 'watched_ads': 1, 'id': 1}
    ).to_list(10000)
    
    # Calculate analytics
    total_views = 0
    total_watch_time = 0
    unique_viewers = len(users)
    daily_views = {}
    hourly_distribution = {str(h): 0 for h in range(24)}
    
    for user in users:
        for watched_ad in user.get('watched_ads', []):
            if watched_ad.get('ad_id') == ad_id:
                total_views += 1
                total_watch_time += watched_ad.get('watch_time', 0)
                
                watched_at = watched_ad.get('watched_at')
                if watched_at:
                    # Daily views
                    day_key = watched_at.strftime('%Y-%m-%d')
                    daily_views[day_key] = daily_views.get(day_key, 0) + 1
                    
                    # Hourly distribution
                    hour_key = str(watched_at.hour)
                    hourly_distribution[hour_key] += 1
    
    # Average watch time
    avg_watch_time = total_watch_time / total_views if total_views > 0 else 0
    
    # Completion rate (watched > 60 seconds)
    completed_views = sum(
        1 for user in users 
        for wa in user.get('watched_ads', [])
        if wa.get('ad_id') == ad_id and wa.get('watch_time', 0) >= 60
    )
    completion_rate = (completed_views / total_views * 100) if total_views > 0 else 0
    
    # Sort daily views by date
    daily_views_list = [
        {'date': k, 'views': v} 
        for k, v in sorted(daily_views.items())
    ][-30:]  # Last 30 days
    
    return {
        'ad_id': ad_id,
        'ad_title': ad.get('title', ''),
        'metrics': {
            'total_views': total_views,
            'unique_viewers': unique_viewers,
            'total_watch_time': total_watch_time,
            'avg_watch_time': round(avg_watch_time, 1),
            'completion_rate': round(completion_rate, 1),
            'points_distributed': total_views  # 1 point per completed view
        },
        'daily_views': daily_views_list,
        'hourly_distribution': hourly_distribution,
        'ad_details': {
            'title': ad.get('title'),
            'description': ad.get('description'),
            'advertiser': ad.get('advertiser') or ad.get('advertiser_name'),
            'duration': ad.get('duration'),
            'website_url': ad.get('website_url'),
            'created_at': ad.get('created_at').isoformat() if ad.get('created_at') else None,
            'is_active': ad.get('is_active', False)
        }
    }


@router.get('/advertiser/{email}', response_model=dict)
async def get_advertiser_analytics(email: str):
    """
    Get analytics for all ads by an advertiser
    """
    db = get_db()
    
    # Get all ads by this advertiser
    ads = await db.advertiser_ads.find(
        {'advertiser_email': email},
        {'_id': 0}
    ).to_list(100)
    
    if not ads:
        return {
            'advertiser_email': email,
            'total_ads': 0,
            'ads_analytics': [],
            'summary': {
                'total_views': 0,
                'total_unique_viewers': 0,
                'avg_completion_rate': 0,
                'total_spent': 0
            }
        }
    
    # Get analytics for each ad
    ads_analytics = []
    total_views = 0
    total_unique_viewers = set()
    total_completion = 0
    
    for ad in ads:
        ad_id = ad['id']
        
        # Get viewers
        users = await db.users.find(
            {'watched_ads.ad_id': ad_id},
            {'_id': 0, 'watched_ads': 1, 'id': 1}
        ).to_list(10000)
        
        ad_views = 0
        ad_watch_time = 0
        completed = 0
        
        for user in users:
            total_unique_viewers.add(user['id'])
            for wa in user.get('watched_ads', []):
                if wa.get('ad_id') == ad_id:
                    ad_views += 1
                    ad_watch_time += wa.get('watch_time', 0)
                    if wa.get('watch_time', 0) >= 60:
                        completed += 1
        
        completion_rate = (completed / ad_views * 100) if ad_views > 0 else 0
        total_views += ad_views
        total_completion += completion_rate
        
        ads_analytics.append({
            'ad_id': ad_id,
            'title': ad['title'],
            'status': ad.get('status', 'pending'),
            'views': ad_views,
            'unique_viewers': len(users),
            'avg_watch_time': round(ad_watch_time / ad_views, 1) if ad_views > 0 else 0,
            'completion_rate': round(completion_rate, 1),
            'created_at': ad.get('created_at').isoformat() if ad.get('created_at') else None
        })
    
    # Get total spent from invoices
    invoices = await db.invoices.find(
        {'advertiser_email': email, 'status': 'paid'},
        {'_id': 0, 'total': 1}
    ).to_list(100)
    
    total_spent = sum(inv.get('total', 0) for inv in invoices)
    
    return {
        'advertiser_email': email,
        'total_ads': len(ads),
        'ads_analytics': ads_analytics,
        'summary': {
            'total_views': total_views,
            'total_unique_viewers': len(total_unique_viewers),
            'avg_completion_rate': round(total_completion / len(ads), 1) if ads else 0,
            'total_spent': total_spent
        }
    }


@router.get('/platform/overview', response_model=dict)
async def get_platform_analytics():
    """
    Admin: Get platform-wide analytics
    """
    db = get_db()
    
    # Total users
    total_users = await db.users.count_documents({})
    
    # Active users (watched ad in last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    active_users = await db.users.count_documents({
        'watched_ads.watched_at': {'$gte': week_ago}
    })
    
    # Total ads
    total_ads = await db.ads.count_documents({})
    active_ads = await db.ads.count_documents({'is_active': True})
    
    # Total views
    users = await db.users.find({}, {'_id': 0, 'watched_ads': 1}).to_list(10000)
    total_views = sum(len(u.get('watched_ads', [])) for u in users)
    
    # Points distributed
    points_data = await db.users.aggregate([
        {'$group': {'_id': None, 'total_points': {'$sum': '$total_earned'}}}
    ]).to_list(1)
    total_points = points_data[0]['total_points'] if points_data else 0
    
    # Revenue
    invoices = await db.invoices.find(
        {'status': 'paid'},
        {'_id': 0, 'total': 1}
    ).to_list(1000)
    total_revenue = sum(inv.get('total', 0) for inv in invoices)
    
    # Withdrawals
    withdrawals = await db.withdrawals.aggregate([
        {'$match': {'status': 'approved'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]).to_list(1)
    total_payouts = withdrawals[0]['total'] if withdrawals else 0
    
    # Daily active users (last 30 days)
    daily_stats = []
    for i in range(30):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        dau = await db.users.count_documents({
            'watched_ads.watched_at': {'$gte': day_start, '$lt': day_end}
        })
        
        daily_stats.append({
            'date': day_start.strftime('%Y-%m-%d'),
            'active_users': dau
        })
    
    daily_stats.reverse()
    
    return {
        'users': {
            'total': total_users,
            'active_last_7_days': active_users,
            'activity_rate': round(active_users / total_users * 100, 1) if total_users > 0 else 0
        },
        'ads': {
            'total': total_ads,
            'active': active_ads
        },
        'engagement': {
            'total_views': total_views,
            'avg_views_per_user': round(total_views / total_users, 1) if total_users > 0 else 0
        },
        'financials': {
            'total_revenue': total_revenue,
            'total_payouts': total_payouts,
            'net_profit': total_revenue - total_payouts,
            'total_points_distributed': total_points
        },
        'daily_active_users': daily_stats
    }


@router.get('/top-ads', response_model=dict)
async def get_top_ads(limit: int = 10):
    """
    Get top performing ads by views
    """
    db = get_db()
    
    # Get all ads
    ads = await db.ads.find({'is_active': True}, {'_id': 0}).to_list(100)
    
    # Calculate views for each
    ads_with_views = []
    
    for ad in ads:
        users = await db.users.count_documents({'watched_ads.ad_id': ad['id']})
        ads_with_views.append({
            'ad_id': ad['id'],
            'title': ad['title'],
            'advertiser': ad.get('advertiser'),
            'views': users,
            'website_url': ad.get('website_url')
        })
    
    # Sort by views
    ads_with_views.sort(key=lambda x: x['views'], reverse=True)
    
    return {'top_ads': ads_with_views[:limit]}
