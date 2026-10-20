from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from models.withdrawal import Withdrawal, WithdrawalCreate, WithdrawalResponse
from auth.dependencies import get_current_user_id
from typing import List
from datetime import datetime
import os

router = APIRouter(prefix='/withdrawals', tags=['Withdrawals'])

# Threshold for manual approval (in points)
MANUAL_APPROVAL_THRESHOLD = 10

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]

@router.get('', response_model=List[WithdrawalResponse])
async def get_user_withdrawals(user_id: str = Depends(get_current_user_id)):
    """
    Get all withdrawal requests for current user
    """
    db = get_db()
    withdrawals = await db.withdrawals.find({'user_id': user_id}).sort('created_at', -1).to_list(100)
    
    return [
        WithdrawalResponse(
            id=w['id'],
            user_id=w['user_id'],
            amount=w['amount'],
            points=w['points'],
            method=w['method'],
            method_name=w['method_name'],
            details=w['details'],
            status=w['status'],
            created_at=w['created_at']
        )
        for w in withdrawals
    ]

@router.post('', response_model=dict)
async def create_withdrawal(
    withdrawal_data: WithdrawalCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create withdrawal request
    Requests >= 10 points require manual admin approval
    Requests < 10 points are auto-approved
    """
    db = get_db()
    
    # Get user
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found'
        )
    
    # Calculate points needed (500 points = $1)
    points_needed = int(withdrawal_data.amount * 500)
    
    # Check if user has enough points
    if user['points'] < points_needed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Insufficient points. You need {points_needed} points but only have {user["points"]}'
        )
    
    # Check minimum amount
    if withdrawal_data.amount < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Minimum withdrawal amount is $1 (500 points)'
        )
    
    # Determine status based on points threshold
    # If points >= 10, requires manual approval
    # If points < 10, auto-approved
    initial_status = 'pending_approval' if points_needed >= MANUAL_APPROVAL_THRESHOLD else 'approved'
    
    # Create withdrawal
    withdrawal = Withdrawal(
        user_id=user_id,
        amount=withdrawal_data.amount,
        points=points_needed,
        method=withdrawal_data.method,
        method_name=withdrawal_data.method_name,
        details=withdrawal_data.details,
        status=initial_status
    )
    
    # Save to database
    withdrawal_dict = withdrawal.dict()
    withdrawal_dict['requires_approval'] = points_needed >= MANUAL_APPROVAL_THRESHOLD
    await db.withdrawals.insert_one(withdrawal_dict)
    
    # Deduct points from user (reserved for withdrawal)
    await db.users.update_one(
        {'id': user_id},
        {
            '$inc': {'points': -points_needed},
            '$set': {'updated_at': datetime.utcnow()}
        }
    )
    
    # Generate appropriate message
    if initial_status == 'pending_approval':
        message = 'طلب السحب يحتاج موافقة المدير. سيتم مراجعته قريباً.'
    else:
        message = 'تم الموافقة على طلب السحب تلقائياً. سيتم التحويل قريباً.'
    
    return {
        'success': True,
        'withdrawal': WithdrawalResponse(
            id=withdrawal.id,
            user_id=withdrawal.user_id,
            amount=withdrawal.amount,
            points=withdrawal.points,
            method=withdrawal.method,
            method_name=withdrawal.method_name,
            details=withdrawal.details,
            status=withdrawal.status,
            created_at=withdrawal.created_at
        ),
        'requires_approval': points_needed >= MANUAL_APPROVAL_THRESHOLD,
        'message': message
    }

@router.get('/{withdrawal_id}', response_model=WithdrawalResponse)
async def get_withdrawal(
    withdrawal_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get specific withdrawal by ID
    """
    db = get_db()
    withdrawal = await db.withdrawals.find_one({
        'id': withdrawal_id,
        'user_id': user_id
    })
    
    if not withdrawal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Withdrawal not found'
        )
    
    return WithdrawalResponse(
        id=withdrawal['id'],
        user_id=withdrawal['user_id'],
        amount=withdrawal['amount'],
        points=withdrawal['points'],
        method=withdrawal['method'],
        method_name=withdrawal['method_name'],
        details=withdrawal['details'],
        status=withdrawal['status'],
        created_at=withdrawal['created_at']
    )


# Admin endpoints for withdrawal management
@router.get('/admin/pending', response_model=dict)
async def get_pending_withdrawals():
    """
    Admin: Get all pending withdrawal requests that need approval
    """
    db = get_db()
    
    withdrawals = await db.withdrawals.find(
        {'status': 'pending_approval'},
        {'_id': 0}
    ).sort('created_at', 1).to_list(100)
    
    # Get user info for each withdrawal
    result = []
    for w in withdrawals:
        user = await db.users.find_one({'id': w['user_id']}, {'_id': 0, 'password': 0})
        result.append({
            **w,
            'user': {
                'name': user.get('name', 'Unknown') if user else 'Unknown',
                'email': user.get('email', '') if user else ''
            }
        })
    
    return {
        'pending_count': len(result),
        'withdrawals': result
    }


@router.post('/admin/{withdrawal_id}/approve')
async def approve_withdrawal(withdrawal_id: str):
    """
    Admin: Approve a pending withdrawal request
    """
    db = get_db()
    
    withdrawal = await db.withdrawals.find_one({'id': withdrawal_id})
    if not withdrawal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Withdrawal not found'
        )
    
    if withdrawal['status'] != 'pending_approval':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Withdrawal is not pending approval'
        )
    
    await db.withdrawals.update_one(
        {'id': withdrawal_id},
        {'$set': {
            'status': 'approved',
            'approved_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }}
    )
    
    return {
        'success': True,
        'message': 'تم الموافقة على طلب السحب'
    }


@router.post('/admin/{withdrawal_id}/reject')
async def reject_withdrawal(withdrawal_id: str, data: dict = None):
    """
    Admin: Reject a pending withdrawal request and refund points
    """
    db = get_db()
    
    withdrawal = await db.withdrawals.find_one({'id': withdrawal_id})
    if not withdrawal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Withdrawal not found'
        )
    
    if withdrawal['status'] != 'pending_approval':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Withdrawal is not pending approval'
        )
    
    # Refund points to user
    await db.users.update_one(
        {'id': withdrawal['user_id']},
        {'$inc': {'points': withdrawal['points']}}
    )
    
    # Update withdrawal status
    reason = data.get('reason', 'رفض بواسطة المدير') if data else 'رفض بواسطة المدير'
    await db.withdrawals.update_one(
        {'id': withdrawal_id},
        {'$set': {
            'status': 'rejected',
            'admin_note': reason,
            'rejected_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }}
    )
    
    return {
        'success': True,
        'message': 'تم رفض طلب السحب وإعادة النقاط'
    }