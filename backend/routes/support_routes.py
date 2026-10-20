# Support Tickets Routes - نظام تذاكر الدعم
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
from auth.dependencies import get_current_user_id

router = APIRouter(prefix="/api/support", tags=["Support"])

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]

class TicketCreate(BaseModel):
    subject: str
    message: str
    category: str = "general"  # general, technical, payment, account

class TicketReply(BaseModel):
    message: str

class TicketResponse(BaseModel):
    id: str
    subject: str
    category: str
    status: str
    created_at: str
    updated_at: str
    messages: List[dict]

@router.post('/tickets', response_model=dict)
async def create_ticket(data: TicketCreate, user_id: str = Depends(get_current_user_id)):
    """إنشاء تذكرة دعم جديدة"""
    db = get_db()
    
    ticket = {
        'ticket_id': f"TKT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{user_id[-4:]}",
        'user_id': user_id,
        'subject': data.subject,
        'category': data.category,
        'status': 'open',  # open, in_progress, resolved, closed
        'priority': 'normal',
        'messages': [{
            'sender': 'user',
            'message': data.message,
            'timestamp': datetime.utcnow().isoformat()
        }],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    result = await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)
    
    return {
        'success': True,
        'ticket_id': ticket['ticket_id'],
        'message': 'تم إنشاء التذكرة بنجاح. سنرد عليك قريباً.'
    }

@router.get('/tickets', response_model=List[dict])
async def get_user_tickets(user_id: str = Depends(get_current_user_id)):
    """جلب تذاكر المستخدم"""
    db = get_db()
    
    tickets = await db.support_tickets.find(
        {'user_id': user_id},
        {'_id': 0}
    ).sort('created_at', -1).to_list(50)
    
    return tickets

@router.get('/tickets/{ticket_id}', response_model=dict)
async def get_ticket(ticket_id: str, user_id: str = Depends(get_current_user_id)):
    """جلب تفاصيل تذكرة معينة"""
    db = get_db()
    
    ticket = await db.support_tickets.find_one(
        {'ticket_id': ticket_id, 'user_id': user_id},
        {'_id': 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail='التذكرة غير موجودة')
    
    return ticket

@router.post('/tickets/{ticket_id}/reply', response_model=dict)
async def reply_to_ticket(ticket_id: str, data: TicketReply, user_id: str = Depends(get_current_user_id)):
    """الرد على تذكرة"""
    db = get_db()
    
    ticket = await db.support_tickets.find_one({'ticket_id': ticket_id, 'user_id': user_id})
    
    if not ticket:
        raise HTTPException(status_code=404, detail='التذكرة غير موجودة')
    
    if ticket['status'] == 'closed':
        raise HTTPException(status_code=400, detail='لا يمكن الرد على تذكرة مغلقة')
    
    new_message = {
        'sender': 'user',
        'message': data.message,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    await db.support_tickets.update_one(
        {'ticket_id': ticket_id},
        {
            '$push': {'messages': new_message},
            '$set': {'updated_at': datetime.utcnow(), 'status': 'open'}
        }
    )
    
    return {'success': True, 'message': 'تم إرسال ردك بنجاح'}

@router.post('/tickets/{ticket_id}/close', response_model=dict)
async def close_ticket(ticket_id: str, user_id: str = Depends(get_current_user_id)):
    """إغلاق تذكرة"""
    db = get_db()
    
    result = await db.support_tickets.update_one(
        {'ticket_id': ticket_id, 'user_id': user_id},
        {'$set': {'status': 'closed', 'updated_at': datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail='التذكرة غير موجودة')
    
    return {'success': True, 'message': 'تم إغلاق التذكرة'}
