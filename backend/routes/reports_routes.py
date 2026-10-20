"""
Reports Routes - Generate and download PDF reports
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from auth.dependencies import get_current_user_id
from datetime import datetime, timedelta
from typing import Optional
import os
import io

router = APIRouter(prefix='/reports', tags=['Reports'])


def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


async def verify_admin(user_id: str = Depends(get_current_user_id)):
    """Verify user is admin"""
    db = get_db()
    admin = await db.admins.find_one({
        '$or': [{'id': user_id}, {'email': user_id}]
    })
    if not admin:
        raise HTTPException(status_code=403, detail='Admin access required')
    return admin


@router.get('/financial')
async def generate_financial_report(
    days: int = Query(default=30, ge=1, le=365),
    admin = Depends(verify_admin)
):
    """
    Generate financial report PDF
    
    Args:
        days: Number of days to include in report (default 30)
    """
    from services.pdf_report_service import pdf_service
    
    db = get_db()
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get statistics
    total_users = await db.users.count_documents({})
    active_ads = await db.advertiser_ads.count_documents({'status': 'active'})
    pending_withdrawals = await db.withdrawals.count_documents({'status': 'pending'})
    
    # Revenue calculation
    revenue_pipeline = [
        {'$match': {'status': {'$in': ['approved', 'active', 'paid']}}},
        {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
    ]
    revenue_result = await db.advertiser_ads.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]['total'] if revenue_result else 0
    
    # Payouts calculation
    payout_pipeline = [
        {'$match': {'status': 'approved'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]
    payout_result = await db.withdrawals.aggregate(payout_pipeline).to_list(1)
    total_payouts = payout_result[0]['total'] if payout_result else 0
    
    stats = {
        'total_users': total_users,
        'active_ads': active_ads,
        'pending_withdrawals': pending_withdrawals,
        'total_revenue': total_revenue,
        'total_payouts': total_payouts,
        'net_profit': total_revenue - (total_payouts * 3.75)  # Convert USD to SAR
    }
    
    # Get withdrawals in period
    withdrawals = await db.withdrawals.find(
        {'created_at': {'$gte': start_date, '$lte': end_date}},
        {'_id': 0}
    ).sort('created_at', -1).to_list(100)
    
    # Get user emails for withdrawals
    for w in withdrawals:
        user = await db.users.find_one(
            {'$or': [{'id': w.get('user_id')}, {'user_id': w.get('user_id')}]},
            {'email': 1, '_id': 0}
        )
        if user:
            w['user_email'] = user.get('email', '')
    
    # Get ads revenue in period
    ads_revenue = await db.advertiser_ads.find(
        {'created_at': {'$gte': start_date, '$lte': end_date}},
        {'_id': 0}
    ).sort('created_at', -1).to_list(100)
    
    # Generate PDF
    pdf_bytes = await pdf_service.generate_financial_report(
        start_date=start_date,
        end_date=end_date,
        stats=stats,
        withdrawals=withdrawals,
        ads_revenue=ads_revenue
    )
    
    filename = f"saqr_financial_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )


@router.get('/ads-performance')
async def generate_ads_performance_report(
    days: int = Query(default=30, ge=1, le=365),
    admin = Depends(verify_admin)
):
    """
    Generate ads performance report PDF
    """
    from services.pdf_report_service import pdf_service
    
    db = get_db()
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get all ads with analytics
    ads = await db.advertiser_ads.find(
        {'status': {'$in': ['active', 'approved']}},
        {'_id': 0}
    ).to_list(200)
    
    # Enrich with view counts
    for ad in ads:
        ad_id = ad.get('id')
        
        # Get view count from ad_views collection
        views = await db.ad_views.count_documents({'ad_id': ad_id})
        ad['views'] = views
        
        # Calculate completion rate (views that completed 60 seconds)
        completions = await db.ad_views.count_documents({
            'ad_id': ad_id,
            'watch_time': {'$gte': 60}
        })
        ad['completion_rate'] = (completions / views * 100) if views > 0 else 0
    
    # Generate PDF
    pdf_bytes = await pdf_service.generate_ads_performance_report(
        ads=ads,
        period_days=days
    )
    
    filename = f"saqr_ads_performance_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )


@router.get('/user/{user_id}')
async def generate_user_report(
    user_id: str,
    admin = Depends(verify_admin)
):
    """
    Generate user activity report PDF
    """
    from services.pdf_report_service import pdf_service
    
    db = get_db()
    
    # Get user
    user = await db.users.find_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'_id': 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    
    actual_user_id = user.get('id') or user.get('user_id')
    
    # Get withdrawals
    withdrawals = await db.withdrawals.find(
        {'user_id': actual_user_id},
        {'_id': 0}
    ).sort('created_at', -1).to_list(50)
    
    # Get watched ads count
    watched_ads = len(user.get('watched_ads', []))
    
    # Generate PDF
    pdf_bytes = await pdf_service.generate_user_report(
        user=user,
        withdrawals=withdrawals,
        watched_ads=watched_ads,
        period_days=30
    )
    
    filename = f"saqr_user_report_{actual_user_id[:8]}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )


@router.get('/my-report')
async def generate_my_report(
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate report for current user (no admin required)
    """
    from services.pdf_report_service import pdf_service
    
    db = get_db()
    
    # Get user
    user = await db.users.find_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'_id': 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    
    actual_user_id = user.get('id') or user.get('user_id')
    
    # Get withdrawals
    withdrawals = await db.withdrawals.find(
        {'user_id': actual_user_id},
        {'_id': 0}
    ).sort('created_at', -1).to_list(20)
    
    # Get watched ads count
    watched_ads = len(user.get('watched_ads', []))
    
    # Generate PDF
    pdf_bytes = await pdf_service.generate_user_report(
        user=user,
        withdrawals=withdrawals,
        watched_ads=watched_ads,
        period_days=30
    )
    
    filename = f"my_saqr_report_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )
