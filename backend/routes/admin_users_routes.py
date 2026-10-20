"""
Admin Users Management Routes
Manage users - ban, delete, view details
Protected admin accounts cannot be modified
"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from auth.dependencies import get_current_user_id
from datetime import datetime, timedelta
import os

router = APIRouter(prefix='/admin/users', tags=['Admin Users Management'])

# Protected admin emails - cannot be deleted or banned
PROTECTED_ADMINS = ['sky-321@hotmail.com']

def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


async def verify_admin(user_id: str, db):
    # Direct lookup by admin id or email
    admin = await db.admins.find_one({'$or': [{'id': user_id}, {'email': user_id}]}, {'_id': 0})
    if admin:
        return admin
    # Fallback: look up user by id/user_id, then match admin by email
    user = await db.users.find_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}, {'email': user_id}]},
        {'_id': 0}
    )
    if user:
        email = user.get('email')
        if email:
            admin = await db.admins.find_one({'email': email}, {'_id': 0})
            if admin:
                return admin
        # Legacy: user record may itself carry is_admin flag
        if user.get('is_admin'):
            return {'id': user.get('id') or user.get('user_id'), 'email': email, 'role': 'admin', 'name': user.get('name', 'Admin')}
    raise HTTPException(status_code=403, detail='غير مصرح')


async def get_user_by_id(db, target_user_id: str):
    """Get user by user_id or id"""
    user = await db.users.find_one(
        {'$or': [{'user_id': target_user_id}, {'id': target_user_id}]},
        {'_id': 0}
    )
    return user


async def check_protected_user(db, target_user_id: str):
    """Check if user is a protected admin"""
    user = await get_user_by_id(db, target_user_id)
    if user and user.get('email') in PROTECTED_ADMINS:
        raise HTTPException(status_code=403, detail='لا يمكن تعديل حساب المدير الرئيسي')
    
    # Also check admins collection
    admin = await db.admins.find_one({'$or': [{'id': target_user_id}, {'email': target_user_id}]})
    if admin and admin.get('email') in PROTECTED_ADMINS:
        raise HTTPException(status_code=403, detail='لا يمكن تعديل حساب المدير الرئيسي')
    
    return user


@router.get('/list')
async def get_all_users(
    page: int = 1,
    limit: int = 50,
    search: str = "",
    status: str = "all",
    user_id: str = Depends(get_current_user_id)
):
    """Get all users (excluding admins) with pagination and filtering"""
    db = get_db()
    await verify_admin(user_id, db)
    
    # Exclude admin emails from the list
    query = {'email': {'$nin': PROTECTED_ADMINS}}
    
    if search:
        query['$and'] = [
            {'email': {'$nin': PROTECTED_ADMINS}},
            {'$or': [
                {'name': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}}
            ]}
        ]
    
    if status == "banned":
        query['is_banned'] = True
    elif status == "active":
        query['is_banned'] = {'$ne': True}
    
    total = await db.users.count_documents(query)
    
    users = await db.users.find(
        query,
        {'_id': 0, 'password': 0}
    ).sort('created_at', -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        'users': users,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit if total > 0 else 1
    }


@router.get('/{target_user_id}')
async def get_user_details(
    target_user_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Get detailed user information"""
    db = get_db()
    await verify_admin(user_id, db)
    
    user = await get_user_by_id(db, target_user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    
    # Get user's withdrawals
    withdrawals = await db.withdrawals.find(
        {'user_id': target_user_id},
        {'_id': 0}
    ).sort('created_at', -1).limit(10).to_list(10)
    
    # Get user's ad submissions
    ads = await db.advertiser_ads.find(
        {'advertiser_id': target_user_id},
        {'_id': 0}
    ).sort('created_at', -1).limit(10).to_list(10)
    
    return {
        'user': user,
        'withdrawals': withdrawals,
        'ads': ads
    }


@router.put('/{target_user_id}/trust')
async def toggle_trusted_by_admin(
    target_user_id: str,
    trusted: bool = True,
    user_id: str = Depends(get_current_user_id)
):
    """Grant/revoke 'trusted-by-admin' + storefront verification badge to a user."""
    db = get_db()
    admin = await verify_admin(user_id, db)

    result = await db.users.update_one(
        {'$or': [{'user_id': target_user_id}, {'id': target_user_id}, {'email': target_user_id}]},
        {'$set': {
            'trusted_by_admin': bool(trusted),
            'trusted_by_admin_at': datetime.utcnow() if trusted else None,
            'trusted_by_admin_by': admin.get('email') if trusted else None,
            # Also flip the storefront verified badge so it shows on the merchant page
            'is_verified_shop': bool(trusted),
            'is_verified_merchant': bool(trusted),
            'shop_verified_at': datetime.utcnow() if trusted else None,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    return {
        'message': 'تم منح شارة الموثوق' if trusted else 'تم إلغاء شارة الموثوق',
        'trusted_by_admin': trusted,
        'is_verified_shop': trusted,
    }


@router.put('/{target_user_id}/ban')
async def ban_user(
    target_user_id: str,
    reason: str = "",
    user_id: str = Depends(get_current_user_id)
):
    """Ban a user (protected admins cannot be banned)"""
    db = get_db()
    admin = await verify_admin(user_id, db)
    
    # Check if protected
    await check_protected_user(db, target_user_id)
    
    result = await db.users.update_one(
        {'$or': [{'user_id': target_user_id}, {'id': target_user_id}]},
        {'$set': {
            'is_banned': True,
            'ban_reason': reason,
            'banned_at': datetime.utcnow(),
            'banned_by': admin.get('email')
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    
    return {'message': 'تم حظر المستخدم بنجاح'}


@router.put('/{target_user_id}/unban')
async def unban_user(
    target_user_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Unban a user"""
    db = get_db()
    await verify_admin(user_id, db)
    
    result = await db.users.update_one(
        {'$or': [{'user_id': target_user_id}, {'id': target_user_id}]},
        {'$set': {
            'is_banned': False,
            'ban_reason': '',
            'unbanned_at': datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    
    return {'message': 'تم رفع الحظر عن المستخدم'}


@router.delete('/{target_user_id}')
async def delete_user(
    target_user_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Delete a user permanently (protected admins cannot be deleted)"""
    db = get_db()
    await verify_admin(user_id, db)
    
    # Check if protected
    await check_protected_user(db, target_user_id)
    
    # Delete user
    result = await db.users.delete_one(
        {'$or': [{'user_id': target_user_id}, {'id': target_user_id}]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    
    # Delete user's related data
    await db.withdrawals.delete_many({'user_id': target_user_id})
    await db.notifications.delete_many({'user_id': target_user_id})
    await db.devices.delete_many({'user_id': target_user_id})
    
    return {'message': 'تم حذف المستخدم وجميع بياناته'}


@router.put('/{target_user_id}/points')
async def update_user_points(
    target_user_id: str,
    points: int,
    reason: str = "",
    user_id: str = Depends(get_current_user_id)
):
    """Manually adjust user points"""
    db = get_db()
    admin = await verify_admin(user_id, db)
    
    user = await get_user_by_id(db, target_user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    
    old_points = user.get('points', 0)
    new_points = old_points + points
    
    if new_points < 0:
        raise HTTPException(status_code=400, detail='لا يمكن أن يكون الرصيد سالباً')
    
    await db.users.update_one(
        {'$or': [{'user_id': target_user_id}, {'id': target_user_id}]},
        {
            '$set': {'points': new_points},
            '$push': {
                'points_history': {
                    'amount': points,
                    'reason': reason,
                    'admin': admin.get('email'),
                    'date': datetime.utcnow()
                }
            }
        }
    )
    
    return {
        'message': f'تم تعديل النقاط من {old_points} إلى {new_points}',
        'old_points': old_points,
        'new_points': new_points
    }


@router.get('/stats/overview')
async def get_users_overview(user_id: str = Depends(get_current_user_id)):
    """Get users statistics overview"""
    db = get_db()
    await verify_admin(user_id, db)
    
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    this_week = today - timedelta(days=7)
    this_month = today - timedelta(days=30)
    
    # Exclude protected admins from counts
    base_query = {'email': {'$nin': PROTECTED_ADMINS}}
    
    total = await db.users.count_documents(base_query)
    banned = await db.users.count_documents({**base_query, 'is_banned': True})
    new_today = await db.users.count_documents({**base_query, 'created_at': {'$gte': today}})
    new_this_week = await db.users.count_documents({**base_query, 'created_at': {'$gte': this_week}})
    new_this_month = await db.users.count_documents({**base_query, 'created_at': {'$gte': this_month}})
    
    # Top users by points
    top_users = await db.users.find(
        base_query,
        {'_id': 0, 'id': 1, 'user_id': 1, 'name': 1, 'email': 1, 'points': 1, 'total_earned': 1}
    ).sort('total_earned', -1).limit(10).to_list(10)
    
    return {
        'total': total,
        'banned': banned,
        'active': total - banned,
        'new_today': new_today,
        'new_this_week': new_this_week,
        'new_this_month': new_this_month,
        'top_users': top_users
    }



# ==========================================================================
# CLEANUP: Purge orphan/legacy listings & trips (admin only, non-destructive to users)
# ==========================================================================
@router.post('/purge-all-trips')
async def admin_purge_all_trips(
    user_id: str = Depends(get_current_user_id),
):
    """Admin-only: HARD delete EVERY trip in the database.
    Uses loop delete_one to bypass the delete_many guard.
    """
    db = get_db()
    await verify_admin(user_id, db)
    deleted = 0
    async for t in db.trips.find({}, {'_id': 1, 'trip_id': 1}):
        r = await db.trips.delete_one({'_id': t['_id']})
        if r.deleted_count:
            deleted += 1
    return {'ok': True, 'deleted_trips': deleted}


@router.post('/purge-all-listings')
async def admin_purge_all_listings(
    user_id: str = Depends(get_current_user_id),
):
    """Admin-only: HARD delete EVERY listing in the database."""
    db = get_db()
    await verify_admin(user_id, db)
    deleted = 0
    async for l in db.listings.find({}, {'_id': 1, 'listing_id': 1}):
        r = await db.listings.delete_one({'_id': l['_id']})
        if r.deleted_count:
            deleted += 1
    # Side clean: comments + favorites (not protected)
    try:
        await db.listing_comments.delete_many({})
        await db.tair_favorites.delete_many({})
    except Exception:
        pass
    return {'ok': True, 'deleted_listings': deleted}


@router.post('/cleanup/orphans')
async def cleanup_orphan_listings_and_trips(
    dry_run: bool = True,
    user_id: str = Depends(get_current_user_id),
):
    """
    Delete legacy/orphan listings and trips that lack required fields
    (e.g., no `created_at`, or `seller_id`/`carrier_id` pointing to a
    non-existent user). NEVER touches the `users` collection.

    Pass `?dry_run=false` to actually delete. Default is a dry run.
    """
    db = get_db()
    await verify_admin(user_id, db)

    # ---- Collect all known user identity keys (id, user_id, email) ----
    known_keys = set()
    async for u in db.users.find({}, {'_id': 0, 'id': 1, 'user_id': 1, 'email': 1}):
        for k in ('id', 'user_id', 'email'):
            v = u.get(k)
            if v:
                known_keys.add(v)

    # ---- Scan listings ----
    listings_to_delete = []
    async for l in db.listings.find({}, {'_id': 0, 'listing_id': 1, 'seller_id': 1, 'created_at': 1, 'status': 1, 'title': 1}):
        reasons = []
        if not l.get('created_at'):
            reasons.append('missing_created_at')
        sid = l.get('seller_id')
        if not sid:
            reasons.append('missing_seller_id')
        elif sid not in known_keys:
            reasons.append('orphan_seller')
        if reasons:
            listings_to_delete.append({
                'listing_id': l.get('listing_id'),
                'seller_id': sid,
                'title': l.get('title', ''),
                'reasons': reasons,
            })

    # ---- Scan trips ----
    trips_to_delete = []
    async for t in db.trips.find({}, {'_id': 0, 'trip_id': 1, 'carrier_id': 1, 'created_at': 1, 'from_city': 1, 'to_city': 1}):
        reasons = []
        if not t.get('created_at'):
            reasons.append('missing_created_at')
        cid = t.get('carrier_id')
        if not cid:
            reasons.append('missing_carrier_id')
        elif cid not in known_keys:
            reasons.append('orphan_carrier')
        if reasons:
            trips_to_delete.append({
                'trip_id': t.get('trip_id'),
                'carrier_id': cid,
                'route': f"{t.get('from_city','?')} → {t.get('to_city','?')}",
                'reasons': reasons,
            })

    if dry_run:
        return {
            'dry_run': True,
            'listings_to_delete': listings_to_delete,
            'trips_to_delete': trips_to_delete,
            'listings_count': len(listings_to_delete),
            'trips_count': len(trips_to_delete),
            'users_unaffected': True,
        }

    # ---- Execute deletion (bounded, safe: only orphaned/legacy items)
    # NOTE: we intentionally loop delete_one instead of delete_many because the
    # startup DB guard (services/db_guard.py) refuses bulk delete_many on the
    # protected collections ("listings", "trips") without TAIR_ALLOW_BULK_DELETE=1.
    # ----
    listing_ids = [x['listing_id'] for x in listings_to_delete if x.get('listing_id')]
    trip_ids = [x['trip_id'] for x in trips_to_delete if x.get('trip_id')]

    # Extra safety: never allow a delete_many that matches >500 docs
    if len(listing_ids) > 500 or len(trip_ids) > 500:
        raise HTTPException(400, 'safety_cap_exceeded_ask_for_manual_run')

    deleted_listings = 0
    for lid in listing_ids:
        r = await db.listings.delete_one({'listing_id': lid})
        if r.deleted_count:
            deleted_listings += 1
            # side-clean: comments + favorites (these are NOT protected collections)
            try:
                await db.listing_comments.delete_many({'listing_id': lid})
            except Exception:
                pass
            try:
                await db.tair_favorites.delete_many({'listing_id': lid})
            except Exception:
                pass

    deleted_trips = 0
    for tid in trip_ids:
        r = await db.trips.delete_one({'trip_id': tid})
        if r.deleted_count:
            deleted_trips += 1

    return {
        'dry_run': False,
        'deleted_listings': deleted_listings,
        'deleted_trips': deleted_trips,
        'users_unaffected': True,
    }
