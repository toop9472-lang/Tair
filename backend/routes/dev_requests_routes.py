"""
Development Requests Routes
Manage feature requests, bug reports, and improvements
"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os
import uuid

router = APIRouter(prefix='/dev-requests', tags=['Development Requests'])

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


class DevRequest(BaseModel):
    title: str
    description: Optional[str] = ''
    type: str = 'feature'  # feature, bug, improvement, other
    priority: str = 'medium'  # high, medium, low


class DevRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str  # pending, in_progress, completed


async def verify_admin(user_id: str, db):
    """Verify user is admin"""
    from auth.dependencies import get_current_user_id
    admin = await db.admins.find_one({'id': user_id}, {'_id': 0})
    if not admin:
        admin = await db.admins.find_one({'email': user_id}, {'_id': 0})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح - يجب أن تكون مدير')
    return admin


@router.get('')
async def get_all_requests(user_id: str = Depends(lambda: None)):
    """Get all development requests"""
    from auth.dependencies import get_current_user_id
    db = get_db()
    
    # Get user_id from token
    from fastapi import Request
    
    requests = await db.dev_requests.find({}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return requests


@router.post('')
async def create_request(request: DevRequest):
    """Create a new development request"""
    db = get_db()
    
    new_request = {
        'id': str(uuid.uuid4()),
        'title': request.title,
        'description': request.description,
        'type': request.type,
        'priority': request.priority,
        'status': 'pending',
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    await db.dev_requests.insert_one(new_request)
    del new_request['_id']
    
    return new_request


@router.put('/{request_id}')
async def update_request(request_id: str, update: DevRequestUpdate):
    """Update a development request"""
    db = get_db()
    
    existing = await db.dev_requests.find_one({'id': request_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail='الطلب غير موجود')
    
    update_data = {'updated_at': datetime.utcnow().isoformat()}
    
    if update.title is not None:
        update_data['title'] = update.title
    if update.description is not None:
        update_data['description'] = update.description
    if update.type is not None:
        update_data['type'] = update.type
    if update.priority is not None:
        update_data['priority'] = update.priority
    
    await db.dev_requests.update_one(
        {'id': request_id},
        {'$set': update_data}
    )
    
    return {'success': True, 'message': 'تم تحديث الطلب'}


@router.patch('/{request_id}/status')
async def update_request_status(request_id: str, status_update: StatusUpdate):
    """Update the status of a development request"""
    db = get_db()
    
    existing = await db.dev_requests.find_one({'id': request_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail='الطلب غير موجود')
    
    await db.dev_requests.update_one(
        {'id': request_id},
        {'$set': {
            'status': status_update.status,
            'updated_at': datetime.utcnow().isoformat()
        }}
    )
    
    return {'success': True, 'message': 'تم تحديث الحالة'}


@router.delete('/{request_id}')
async def delete_request(request_id: str):
    """Delete a development request"""
    db = get_db()
    
    result = await db.dev_requests.delete_one({'id': request_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='الطلب غير موجود')
    
    return {'success': True, 'message': 'تم حذف الطلب'}


@router.get('/summary')
async def get_requests_summary():
    """Get summary of all requests for the developer"""
    db = get_db()
    
    requests = await db.dev_requests.find(
        {'status': {'$ne': 'completed'}},
        {'_id': 0}
    ).sort([('priority', 1), ('created_at', 1)]).to_list(100)
    
    # Group by priority
    high_priority = [r for r in requests if r['priority'] == 'high']
    medium_priority = [r for r in requests if r['priority'] == 'medium']
    low_priority = [r for r in requests if r['priority'] == 'low']
    
    summary = {
        'total_pending': len(requests),
        'high_priority': high_priority,
        'medium_priority': medium_priority,
        'low_priority': low_priority,
        'formatted_summary': generate_summary_text(high_priority, medium_priority, low_priority)
    }
    
    return summary


def generate_summary_text(high, medium, low):
    """Generate a formatted summary text for the developer"""
    lines = ['# 📋 طلبات التطوير المعلقة\n']
    
    if high:
        lines.append('## 🔴 أولوية عالية:')
        for r in high:
            lines.append(f"- [{r['type']}] {r['title']}")
            if r.get('description'):
                lines.append(f"  └─ {r['description'][:100]}")
        lines.append('')
    
    if medium:
        lines.append('## 🟡 أولوية متوسطة:')
        for r in medium:
            lines.append(f"- [{r['type']}] {r['title']}")
        lines.append('')
    
    if low:
        lines.append('## 🟢 أولوية منخفضة:')
        for r in low:
            lines.append(f"- [{r['type']}] {r['title']}")
    
    return '\n'.join(lines)
