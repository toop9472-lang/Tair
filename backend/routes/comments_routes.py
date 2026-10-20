# Comments Routes - نظام التعليقات على الإعلانات
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
from auth.dependencies import get_current_user_id

router = APIRouter(prefix="/comments", tags=["Comments"])

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]

class CommentCreate(BaseModel):
    ad_id: str
    content: str
    parent_id: Optional[str] = None  # For replies

class CommentLike(BaseModel):
    comment_id: str

@router.post('/', response_model=dict)
async def create_comment(data: CommentCreate, user_id: str = Depends(get_current_user_id)):
    """إضافة تعليق على إعلان"""
    db = get_db()
    
    # Get user info
    user = await db.users.find_one(
        {'$or': [{'id': user_id}, {'user_id': user_id}]},
        {'name': 1, 'email': 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail='المستخدم غير موجود')
    
    # Check if ad exists
    ad = await db.ads.find_one({'id': data.ad_id})
    if not ad:
        raise HTTPException(status_code=404, detail='الإعلان غير موجود')
    
    comment = {
        'comment_id': f"CMT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{user_id[-4:]}",
        'ad_id': data.ad_id,
        'user_id': user_id,
        'user_name': user.get('name', 'مستخدم'),
        'content': data.content,
        'parent_id': data.parent_id,
        'likes': [],
        'likes_count': 0,
        'is_hidden': False,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    await db.comments.insert_one(comment)

    
    comment.pop("_id", None)
    
    # Update ad comments count
    await db.ads.update_one(
        {'id': data.ad_id},
        {'$inc': {'comments_count': 1}}
    )
    
    return {
        'success': True,
        'comment_id': comment['comment_id'],
        'message': 'تم إضافة التعليق بنجاح'
    }

@router.get('/ad/{ad_id}', response_model=List[dict])
async def get_ad_comments(ad_id: str, limit: int = 50, skip: int = 0):
    """جلب تعليقات إعلان معين"""
    db = get_db()
    
    comments = await db.comments.find(
        {'ad_id': ad_id, 'is_hidden': False, 'parent_id': None},
        {'_id': 0}
    ).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    # Get replies for each comment
    for comment in comments:
        replies = await db.comments.find(
            {'parent_id': comment['comment_id'], 'is_hidden': False},
            {'_id': 0}
        ).sort('created_at', 1).to_list(10)
        comment['replies'] = replies
        comment['created_at'] = comment['created_at'].isoformat()
        comment['updated_at'] = comment['updated_at'].isoformat()
    
    return comments

@router.post('/like', response_model=dict)
async def toggle_like(data: CommentLike, user_id: str = Depends(get_current_user_id)):
    """إعجاب/إلغاء إعجاب بتعليق"""
    db = get_db()
    
    comment = await db.comments.find_one({'comment_id': data.comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail='التعليق غير موجود')
    
    likes = comment.get('likes', [])
    
    if user_id in likes:
        # Remove like
        likes.remove(user_id)
        action = 'unliked'
    else:
        # Add like
        likes.append(user_id)
        action = 'liked'
    
    await db.comments.update_one(
        {'comment_id': data.comment_id},
        {
            '$set': {
                'likes': likes,
                'likes_count': len(likes)
            }
        }
    )
    
    return {
        'success': True,
        'action': action,
        'likes_count': len(likes)
    }

@router.delete('/{comment_id}', response_model=dict)
async def delete_comment(comment_id: str, user_id: str = Depends(get_current_user_id)):
    """حذف تعليق"""
    db = get_db()
    
    comment = await db.comments.find_one({'comment_id': comment_id, 'user_id': user_id})
    if not comment:
        raise HTTPException(status_code=404, detail='التعليق غير موجود أو لا تملك صلاحية حذفه')
    
    # Soft delete
    await db.comments.update_one(
        {'comment_id': comment_id},
        {'$set': {'is_hidden': True, 'deleted_at': datetime.utcnow()}}
    )
    
    # Update ad comments count
    await db.ads.update_one(
        {'id': comment['ad_id']},
        {'$inc': {'comments_count': -1}}
    )
    
    return {'success': True, 'message': 'تم حذف التعليق'}

@router.get('/user', response_model=List[dict])
async def get_user_comments(user_id: str = Depends(get_current_user_id)):
    """جلب تعليقات المستخدم"""
    db = get_db()
    
    comments = await db.comments.find(
        {'user_id': user_id, 'is_hidden': False},
        {'_id': 0}
    ).sort('created_at', -1).to_list(100)
    
    for comment in comments:
        comment['created_at'] = comment['created_at'].isoformat()
        comment['updated_at'] = comment['updated_at'].isoformat()
    
    return comments
