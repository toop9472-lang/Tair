from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Body
from motor.motor_asyncio import AsyncIOMotorClient
from auth.dependencies import get_current_user_id
from datetime import datetime
from pathlib import Path
from typing import Optional
import os
import uuid

from services.r2_storage import r2
from services.display_names import assert_unique_name, is_placeholder_name

router = APIRouter(prefix='/users', tags=['Users'])

MEDIA_AVATARS_DIR = (Path(__file__).resolve().parent.parent / "static" / "media" / "avatars")
MEDIA_AVATARS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_AVATAR_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
MAX_AVATAR_MB = 8

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]

@router.get('/profile', response_model=dict)
async def get_profile(user_id: str = Depends(get_current_user_id)):
    """
    Get user profile with full details
    """
    db = get_db()
    # Support both 'id' and 'user_id' fields for backward compatibility
    user = await db.users.find_one({'$or': [{'id': user_id}, {'user_id': user_id}]})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found'
        )
    
    # Get user id - support both 'id' and 'user_id' fields
    uid = user.get('id') or user.get('user_id')
    
    return {
        'user': {
            'id': uid,
            'email': user['email'],
            'name': user['name'],
            'avatar': user.get('avatar') or user.get('picture'),
            'points': user.get('points', 0),
            'total_earned': user.get('total_earned', 0),
            'watched_ads': user.get('watched_ads', []),
            'joined_date': user['created_at'].isoformat() if user.get('created_at') else None
        }
    }


@router.post('/claim-name', response_model=dict)
async def claim_name(data: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    """أول اسم حقيقي بدل «ضيف طير». يُرفض الاسم المكرر والاسم الافتراضي."""
    db = get_db()
    user = await db.users.find_one({'$or': [{'id': user_id}, {'user_id': user_id}, {'email': user_id}]})
    if not user:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    try:
        new_name = await assert_unique_name(
            db, (data or {}).get('name') or '', user.get('id'), user.get('user_id'), user.get('email'),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await db.users.update_one(
        {'_id': user['_id']},
        {'$set': {
            'name': new_name,
            'name_key': new_name.casefold(),
            'needs_name_setup': False,
            'updated_at': datetime.utcnow(),
        }},
    )
    return {'success': True, 'name': new_name, 'needs_name_setup': False}

@router.put('/profile', response_model=dict)
async def update_profile(
    data: dict,
    user_id: str = Depends(get_current_user_id)
):
    """
    Update user profile
    تقييد: تغيير الصورة الشخصية مرة واحدة أسبوعياً فقط
    """
    db = get_db()
    # Support both 'id' and 'user_id' fields for backward compatibility
    user = await db.users.find_one({'$or': [{'id': user_id}, {'user_id': user_id}]})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='المستخدم غير موجود'
        )
    
    update_data = {}
    
    if 'name' in data:
        try:
            new_name = await assert_unique_name(db, data.get('name') or '', user.get('id'), user.get('user_id'), user.get('email'))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        if new_name != (user.get('name') or ''):
            # تقييد تغيير الاسم: مرة واحدة كل 7 أيام
            last_name_change = user.get('last_name_change')
            if is_placeholder_name(user.get('name') or ''):
                last_name_change = None
            if last_name_change:
                from datetime import timedelta
                if isinstance(last_name_change, str):
                    try:
                        last_name_change = datetime.fromisoformat(last_name_change.replace('Z', '+00:00'))
                    except Exception:
                        last_name_change = None
                if last_name_change:
                    if last_name_change.tzinfo is None:
                        last_name_change = last_name_change.replace(tzinfo=None)
                    now_naive = datetime.utcnow()
                    days_since = (now_naive - last_name_change.replace(tzinfo=None)).days if last_name_change else 999
                    if days_since < 7:
                        remaining = 7 - days_since
                        raise HTTPException(
                            status_code=400,
                            detail=f'يمكنك تغيير الاسم مرة واحدة كل أسبوع. تبقى {remaining} يوم.',
                        )
            update_data['name'] = new_name
            update_data['name_key'] = new_name.casefold()
            update_data['needs_name_setup'] = False
            if not is_placeholder_name(user.get('name') or ''):
                update_data['last_name_change'] = datetime.utcnow()
    
    if 'avatar' in data:
        # التحقق من تقييد تغيير الصورة (مرة أسبوعياً)
        last_avatar_change = user.get('last_avatar_change')
        if last_avatar_change:
            from datetime import timedelta
            if isinstance(last_avatar_change, str):
                last_avatar_change = datetime.fromisoformat(last_avatar_change)
            
            days_since_change = (datetime.utcnow() - last_avatar_change).days
            if days_since_change < 7:
                remaining_days = 7 - days_since_change
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f'يمكنك تغيير الصورة الشخصية مرة واحدة أسبوعياً. تبقى {remaining_days} يوم.'
                )
        
        update_data['avatar'] = data['avatar']
        update_data['last_avatar_change'] = datetime.utcnow()
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='No data to update'
        )
    
    update_data['updated_at'] = datetime.utcnow()
    
    # Update using the correct field (id or user_id)
    query = {'id': user_id} if user.get('id') else {'user_id': user_id}
    await db.users.update_one(query, {'$set': update_data})
    
    user = await db.users.find_one({'$or': [{'id': user_id}, {'user_id': user_id}]})
    
    # Get user id - support both 'id' and 'user_id' fields
    uid = user.get('id') or user.get('user_id')
    
    return {
        'success': True,
        'user': {
            'id': uid,
            'email': user['email'],
            'name': user['name'],
            'avatar': user.get('avatar') or user.get('picture'),
            'points': user.get('points', 0),
            'total_earned': user.get('total_earned', 0)
        }
    }


@router.get('/analytics', response_model=dict)
async def get_user_analytics(user_id: str = Depends(get_current_user_id)):
    """
    Get user analytics for homepage
    """
    db = get_db()
    user = await db.users.find_one({'$or': [{'id': user_id}, {'user_id': user_id}]})
    
    if not user:
        return {
            'today_watches': 0,
            'total_watches': 0,
            'total_points': 0,
            'streak_days': 0
        }
    
    # Count today's watches
    from datetime import timedelta
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    watched_ads = user.get('watched_ads', [])
    
    today_watches = 0
    for wa in watched_ads:
        watched_at = wa.get('watched_at')
        if watched_at and watched_at >= today_start:
            today_watches += 1
    
    return {
        'today_watches': today_watches,
        'total_watches': len(watched_ads),
        'total_points': user.get('total_earned', 0),
        'current_points': user.get('points', 0),
        'streak_days': user.get('streak_days', 0)
    }


@router.post('/upload-avatar')
async def upload_avatar(user_id: str, file: UploadFile = File(...)):
    """Upload a profile picture from device gallery and persist its public URL on the user document.

    Rate-limited: a user can change their avatar at most once every 7 days.
    """
    if not user_id:
        raise HTTPException(status_code=400, detail='user_id required')

    db = get_db()
    existing = await db.users.find_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'_id': 0, 'last_avatar_change': 1, 'avatar_updated_at': 1},
    ) or {}
    last_change_raw = existing.get('last_avatar_change') or existing.get('avatar_updated_at')
    if last_change_raw:
        from datetime import timedelta
        try:
            if isinstance(last_change_raw, str):
                last_dt = datetime.fromisoformat(last_change_raw.replace('Z', '+00:00'))
            else:
                last_dt = last_change_raw
            last_naive = last_dt.replace(tzinfo=None) if last_dt.tzinfo else last_dt
            days_since = (datetime.utcnow() - last_naive).days
            if days_since < 7:
                remaining = 7 - days_since
                raise HTTPException(
                    status_code=429,
                    detail=f'يمكنك تغيير الصورة مرة واحدة كل أسبوع. تبقى {remaining} يوم.',
                )
        except HTTPException:
            raise
        except Exception:
            pass

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail='Empty file')
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > MAX_AVATAR_MB:
        raise HTTPException(status_code=413, detail=f'Avatar too large (>{MAX_AVATAR_MB}MB)')
    suffix = Path(file.filename or '').suffix.lower() or '.jpg'
    if suffix not in ALLOWED_AVATAR_EXTS:
        suffix = '.jpg'
    filename = f"{uuid.uuid4()}{suffix}"
    content_type_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic'}
    content_type = content_type_map.get(suffix, 'image/jpeg')

    avatar_url = None
    if r2.is_configured:
        try:
            avatar_url = r2.upload_bytes(f"avatars/{filename}", raw, content_type=content_type)
        except Exception as exc:
            print(f"[upload_avatar] R2 failed, fallback to local disk: {exc}")
            avatar_url = None

    if not avatar_url:
        target = MEDIA_AVATARS_DIR / filename
        target.write_bytes(raw)
        avatar_url = f"/media/avatars/{filename}"

    now_iso = datetime.utcnow().isoformat()
    await db.users.update_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'$set': {
            'avatar': avatar_url,
            'avatar_updated_at': now_iso,
            'last_avatar_change': now_iso,
        }},
    )
    return {'success': True, 'avatar_url': avatar_url, 'url': avatar_url}


@router.post('/upload-profile-bg')
async def upload_profile_bg(user_id: str, file: UploadFile = File(...)):
    """Upload a profile background/hero image and persist its public URL."""
    if not user_id:
        raise HTTPException(status_code=400, detail='user_id required')

    db = get_db()
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail='Empty file')
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > 8:
        raise HTTPException(status_code=413, detail='Background too large (>8MB)')
    suffix = Path(file.filename or '').suffix.lower() or '.jpg'
    if suffix not in ALLOWED_AVATAR_EXTS:
        suffix = '.jpg'
    filename = f"bg_{uuid.uuid4()}{suffix}"
    content_type_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic'}
    content_type = content_type_map.get(suffix, 'image/jpeg')

    bg_url = None
    if r2.is_configured:
        try:
            bg_url = r2.upload_bytes(f"profile-bg/{filename}", raw, content_type=content_type)
        except Exception as exc:
            print(f"[upload_profile_bg] R2 failed, fallback to local: {exc}")
            bg_url = None
    if not bg_url:
        target = MEDIA_AVATARS_DIR / filename
        target.write_bytes(raw)
        bg_url = f"/media/avatars/{filename}"

    await db.users.update_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'$set': {'profile_bg_url': bg_url, 'profile_bg_updated_at': datetime.utcnow().isoformat()}},
    )
    return {'success': True, 'profile_bg_url': bg_url, 'url': bg_url}



# ====================== Public profile + privacy ======================

PUBLIC_USER_FIELDS = {
    '_id': 0,
    'id': 1,
    'user_id': 1,
    'name': 1,
    'avatar': 1,
    'bio': 1,
    'is_private': 1,
    'created_at': 1,
    'joined_date': 1,
}


@router.get('/public-profile/{target_user_id}')
async def get_public_profile(target_user_id: str, viewer_id: Optional[str] = None):
    """Return a sanitized public profile + follow stats. Never exposes email/phone/balance."""
    db = get_db()
    target = await db.users.find_one(
        {'$or': [{'id': target_user_id}, {'user_id': target_user_id}]},
        PUBLIC_USER_FIELDS,
    )
    if not target:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')

    canonical_id = target.get('id') or target.get('user_id') or target_user_id
    # Follow stats
    followers_count = await db.clips_follows.count_documents({'target_user_id': canonical_id})
    following_count = await db.clips_follows.count_documents({'follower_user_id': canonical_id})
    followed_by_me = False
    if viewer_id and viewer_id != canonical_id:
        followed_by_me = bool(
            await db.clips_follows.find_one(
                {'follower_user_id': viewer_id, 'target_user_id': canonical_id},
                {'_id': 0, 'follow_id': 1},
            )
        )

    # Clip count (visible regardless of privacy because total is public meta)
    clips_count = await db.clips_posts.count_documents({'user_id': canonical_id})

    is_private = bool(target.get('is_private', False))
    can_view_clips = (not is_private) or followed_by_me or viewer_id == canonical_id

    return {
        'user_id': canonical_id,
        'name': target.get('name') or 'مستخدم',
        'avatar': target.get('avatar') or '',
        'bio': target.get('bio') or '',
        'is_private': is_private,
        'joined_date': target.get('created_at') or target.get('joined_date') or '',
        'followers_count': followers_count,
        'following_count': following_count,
        'clips_count': clips_count,
        'followed_by_me': followed_by_me,
        'can_view_clips': can_view_clips,
        'is_self': viewer_id == canonical_id,
    }


@router.get('/clips/{target_user_id}')
async def get_user_clips(
    target_user_id: str,
    viewer_id: Optional[str] = None,
    limit: int = 30,
):
    """Return user's own posted clips. Respects `is_private`: only owner or followers can list when private."""
    db = get_db()
    target = await db.users.find_one(
        {'$or': [{'id': target_user_id}, {'user_id': target_user_id}]},
        {'_id': 0, 'id': 1, 'user_id': 1, 'is_private': 1},
    )
    if not target:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    canonical_id = target.get('id') or target.get('user_id') or target_user_id
    if target.get('is_private') and viewer_id != canonical_id:
        is_follower = bool(
            await db.clips_follows.find_one(
                {'follower_user_id': viewer_id, 'target_user_id': canonical_id},
                {'_id': 0, 'follow_id': 1},
            )
        ) if viewer_id else False
        if not is_follower:
            return {'clips': [], 'count': 0, 'private': True}

    capped = max(1, min(int(limit or 30), 100))
    clips = await (
        db.clips_posts.find({'user_id': canonical_id}, {'_id': 0})
        .sort('created_at', -1)
        .limit(capped)
        .to_list(capped)
    )
    return {'clips': clips, 'count': len(clips), 'private': False}


@router.put('/privacy/{user_id}')
async def set_account_privacy(user_id: str, data: dict):
    """Toggle account privacy. Body: { "is_private": true|false }."""
    if not user_id:
        raise HTTPException(status_code=400, detail='user_id required')
    is_private = bool(data.get('is_private'))
    db = get_db()
    result = await db.users.update_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'$set': {'is_private': is_private, 'privacy_updated_at': datetime.utcnow().isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    return {'success': True, 'is_private': is_private}


async def _can_view_social_lists(db, canonical_id: str, viewer_id: Optional[str]) -> bool:
    """Privacy gate: only owner or follower can view lists of a private account."""
    target = await db.users.find_one(
        {'$or': [{'id': canonical_id}, {'user_id': canonical_id}]},
        {'_id': 0, 'is_private': 1, 'id': 1, 'user_id': 1},
    )
    if not target:
        return False
    if not target.get('is_private'):
        return True
    if viewer_id and viewer_id == canonical_id:
        return True
    if not viewer_id:
        return False
    return bool(
        await db.clips_follows.find_one(
            {'follower_user_id': viewer_id, 'target_user_id': canonical_id},
            {'_id': 0, 'follow_id': 1},
        )
    )


async def _hydrate_users_by_ids(db, user_ids: list, viewer_id: Optional[str]) -> list:
    """Return minimal public user info for a list of user ids."""
    if not user_ids:
        return []
    cursor = db.users.find(
        {'$or': [{'id': {'$in': user_ids}}, {'user_id': {'$in': user_ids}}]},
        {'_id': 0, 'id': 1, 'user_id': 1, 'name': 1, 'avatar': 1, 'is_private': 1, 'is_verified': 1},
    )
    docs = await cursor.to_list(length=len(user_ids) + 50)
    # Map back to original order
    by_id = {}
    for d in docs:
        canonical = d.get('id') or d.get('user_id')
        if canonical:
            by_id[canonical] = d
    out = []
    follow_targets = set()
    if viewer_id:
        # Pre-compute which of these the viewer follows for the "متابعة/متابَع" tag
        follows = await db.clips_follows.find(
            {'follower_user_id': viewer_id, 'target_user_id': {'$in': user_ids}},
            {'_id': 0, 'target_user_id': 1},
        ).to_list(length=len(user_ids) + 50)
        follow_targets = {f.get('target_user_id') for f in follows}
    for uid in user_ids:
        d = by_id.get(uid)
        if not d:
            continue
        canonical = d.get('id') or d.get('user_id') or uid
        out.append({
            'user_id': canonical,
            'name': d.get('name') or 'مستخدم',
            'avatar': d.get('avatar') or '',
            'is_private': bool(d.get('is_private')),
            'is_verified': bool(d.get('is_verified')),
            'followed_by_me': canonical in follow_targets if viewer_id else False,
        })
    return out


@router.get('/followers/{target_user_id}')
async def list_followers(
    target_user_id: str,
    viewer_id: Optional[str] = None,
    limit: int = 100,
):
    """Return followers of a user. Respects `is_private`."""
    db = get_db()
    target = await db.users.find_one(
        {'$or': [{'id': target_user_id}, {'user_id': target_user_id}]},
        {'_id': 0, 'id': 1, 'user_id': 1, 'is_private': 1},
    )
    if not target:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    canonical_id = target.get('id') or target.get('user_id') or target_user_id

    can_view = await _can_view_social_lists(db, canonical_id, viewer_id)
    if not can_view:
        return {'users': [], 'count': 0, 'private': True}

    capped = max(1, min(int(limit or 100), 500))
    rows = await db.clips_follows.find(
        {'target_user_id': canonical_id},
        {'_id': 0, 'follower_user_id': 1, 'created_at': 1},
    ).sort('created_at', -1).limit(capped).to_list(capped)
    user_ids = [r.get('follower_user_id') for r in rows if r.get('follower_user_id')]
    users = await _hydrate_users_by_ids(db, user_ids, viewer_id)
    return {'users': users, 'count': len(users), 'private': False}


@router.get('/following/{target_user_id}')
async def list_following(
    target_user_id: str,
    viewer_id: Optional[str] = None,
    limit: int = 100,
):
    """Return users the target follows. Respects `is_private`."""
    db = get_db()
    target = await db.users.find_one(
        {'$or': [{'id': target_user_id}, {'user_id': target_user_id}]},
        {'_id': 0, 'id': 1, 'user_id': 1, 'is_private': 1},
    )
    if not target:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    canonical_id = target.get('id') or target.get('user_id') or target_user_id

    can_view = await _can_view_social_lists(db, canonical_id, viewer_id)
    if not can_view:
        return {'users': [], 'count': 0, 'private': True}

    capped = max(1, min(int(limit or 100), 500))
    rows = await db.clips_follows.find(
        {'follower_user_id': canonical_id},
        {'_id': 0, 'target_user_id': 1, 'created_at': 1},
    ).sort('created_at', -1).limit(capped).to_list(capped)
    user_ids = [r.get('target_user_id') for r in rows if r.get('target_user_id')]
    users = await _hydrate_users_by_ids(db, user_ids, viewer_id)
    return {'users': users, 'count': len(users), 'private': False}
