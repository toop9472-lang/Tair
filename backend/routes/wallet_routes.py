"""
App Wallet Routes
Manage app balance for paying withdrawals
"""
from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from auth.dependencies import get_current_user_id
from datetime import datetime
import os
import uuid
import stripe

router = APIRouter(prefix='/wallet', tags=['App Wallet'])

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_API_KEY')

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


class DepositRequest(BaseModel):
    amount: float
    payment_method: str  # stripe, bank_transfer, paypal
    currency: str = "SAR"


class BankAccountSettings(BaseModel):
    bank_name: str
    account_holder: str
    account_number: str
    iban: str
    swift_code: Optional[str] = None


class PayPalSettings(BaseModel):
    email: str


class WalletSettings(BaseModel):
    bank_account: Optional[BankAccountSettings] = None
    paypal: Optional[PayPalSettings] = None
    low_balance_alert: float = 1000
    auto_notify_on_low: bool = True


async def verify_admin(user_id: str, db):
    """Verify user is admin"""
    admin = await db.admins.find_one({'id': user_id}, {'_id': 0})
    if not admin:
        admin = await db.admins.find_one({'email': user_id}, {'_id': 0})
    if not admin:
        raise HTTPException(status_code=403, detail='غير مصرح - يجب أن تكون مدير')
    return admin


@router.get('/balance')
async def get_wallet_balance(user_id: str = Depends(get_current_user_id)):
    """Get current app wallet balance"""
    db = get_db()
    await verify_admin(user_id, db)
    
    wallet = await db.app_wallet.find_one({'type': 'main'}, {'_id': 0})
    
    if not wallet:
        # Initialize wallet
        wallet = {
            'type': 'main',
            'balance': 0,
            'currency': 'SAR',
            'total_deposited': 0,
            'total_withdrawn': 0,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        await db.app_wallet.insert_one(wallet)

        wallet.pop("_id", None)
    
    # Get pending withdrawals amount
    pending_pipeline = [
        {'$match': {'status': 'pending'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]
    pending_result = await db.withdrawals.aggregate(pending_pipeline).to_list(1)
    pending_amount = pending_result[0]['total'] if pending_result else 0
    
    # Get settings
    settings = await db.app_wallet.find_one({'type': 'settings'}, {'_id': 0})
    low_balance_alert = settings.get('low_balance_alert', 1000) if settings else 1000
    
    return {
        'balance': wallet.get('balance', 0),
        'currency': wallet.get('currency', 'SAR'),
        'total_deposited': wallet.get('total_deposited', 0),
        'total_withdrawn': wallet.get('total_withdrawn', 0),
        'pending_withdrawals': pending_amount,
        'available_balance': wallet.get('balance', 0) - pending_amount,
        'low_balance_alert': low_balance_alert,
        'is_low_balance': wallet.get('balance', 0) < low_balance_alert
    }


@router.get('/transactions')
async def get_wallet_transactions(
    limit: int = 50,
    user_id: str = Depends(get_current_user_id)
):
    """Get wallet transaction history"""
    db = get_db()
    await verify_admin(user_id, db)
    
    transactions = await db.wallet_transactions.find(
        {},
        {'_id': 0}
    ).sort('created_at', -1).limit(limit).to_list(limit)
    
    return {'transactions': transactions}


@router.post('/deposit/stripe')
async def create_stripe_deposit(
    request: DepositRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Create Stripe checkout session for depositing to app wallet"""
    db = get_db()
    admin = await verify_admin(user_id, db)
    
    if request.amount < 100:
        raise HTTPException(status_code=400, detail='الحد الأدنى للإيداع 100 ريال')
    
    try:
        # Create Stripe checkout session
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'sar',
                    'product_data': {
                        'name': 'إيداع رصيد للتطبيق',
                        'description': f'إيداع {request.amount} ريال في محفظة التطبيق'
                    },
                    'unit_amount': int(request.amount * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/admin/dashboard?deposit=success&session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/admin/dashboard?deposit=cancelled',
            metadata={
                'type': 'app_wallet_deposit',
                'amount': str(request.amount),
                'admin_id': user_id
            }
        )
        
        # Record pending transaction
        transaction_id = str(uuid.uuid4())
        await db.wallet_transactions.insert_one({
            'id': transaction_id,
            'type': 'deposit',
            'method': 'stripe',
            'amount': request.amount,
            'currency': 'SAR',
            'status': 'pending',
            'stripe_session_id': session.id,
            'admin_id': user_id,
            'admin_email': admin.get('email', ''),
            'created_at': datetime.utcnow()
        })
        
        return {
            'checkout_url': session.url,
            'session_id': session.id,
            'transaction_id': transaction_id
        }
    
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f'خطأ في Stripe: {str(e)}')


@router.post('/deposit/stripe/confirm')
async def confirm_stripe_deposit(
    session_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Confirm Stripe deposit after successful payment"""
    db = get_db()
    await verify_admin(user_id, db)
    
    try:
        # Verify session with Stripe
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status != 'paid':
            raise HTTPException(status_code=400, detail='الدفع لم يكتمل')
        
        # Check if already processed
        transaction = await db.wallet_transactions.find_one({
            'stripe_session_id': session_id
        })
        
        if transaction and transaction.get('status') == 'completed':
            return {'message': 'تم تأكيد الإيداع مسبقاً', 'already_processed': True}
        
        amount = float(session.metadata.get('amount', 0))
        
        # Update wallet balance
        await db.app_wallet.update_one(
            {'type': 'main'},
            {
                '$inc': {
                    'balance': amount,
                    'total_deposited': amount
                },
                '$set': {'updated_at': datetime.utcnow()}
            },
            upsert=True
        )
        
        # Update transaction status
        await db.wallet_transactions.update_one(
            {'stripe_session_id': session_id},
            {'$set': {
                'status': 'completed',
                'completed_at': datetime.utcnow()
            }}
        )
        
        return {
            'message': f'تم إيداع {amount} ريال بنجاح',
            'amount': amount,
            'success': True
        }
    
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f'خطأ في التحقق: {str(e)}')


@router.post('/deposit/manual')
async def record_manual_deposit(
    amount: float,
    method: str,
    reference: str = "",
    notes: str = "",
    user_id: str = Depends(get_current_user_id)
):
    """Record manual deposit (bank transfer, cash, etc.)"""
    db = get_db()
    admin = await verify_admin(user_id, db)
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail='المبلغ يجب أن يكون أكبر من صفر')
    
    transaction_id = str(uuid.uuid4())
    
    # Record transaction
    await db.wallet_transactions.insert_one({
        'id': transaction_id,
        'type': 'deposit',
        'method': method,
        'amount': amount,
        'currency': 'SAR',
        'status': 'completed',
        'reference': reference,
        'notes': notes,
        'admin_id': user_id,
        'admin_email': admin.get('email', ''),
        'created_at': datetime.utcnow(),
        'completed_at': datetime.utcnow()
    })
    
    # Update wallet balance
    await db.app_wallet.update_one(
        {'type': 'main'},
        {
            '$inc': {
                'balance': amount,
                'total_deposited': amount
            },
            '$set': {'updated_at': datetime.utcnow()}
        },
        upsert=True
    )
    
    return {
        'message': f'تم إيداع {amount} ريال بنجاح',
        'transaction_id': transaction_id,
        'amount': amount
    }


@router.post('/withdraw')
async def process_user_withdrawal(
    withdrawal_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Process a user withdrawal request (deduct from app wallet)"""
    db = get_db()
    await verify_admin(user_id, db)
    
    # Get withdrawal request
    withdrawal = await db.withdrawals.find_one({'id': withdrawal_id}, {'_id': 0})
    if not withdrawal:
        raise HTTPException(status_code=404, detail='طلب السحب غير موجود')
    
    if withdrawal.get('status') != 'pending':
        raise HTTPException(status_code=400, detail='طلب السحب تم معالجته مسبقاً')
    
    # Check wallet balance
    wallet = await db.app_wallet.find_one({'type': 'main'}, {'_id': 0})
    balance = wallet.get('balance', 0) if wallet else 0
    
    if balance < withdrawal.get('amount', 0):
        raise HTTPException(
            status_code=400, 
            detail=f'رصيد المحفظة غير كافٍ. الرصيد الحالي: {balance} ريال'
        )
    
    amount = withdrawal.get('amount', 0)
    
    # Deduct from wallet
    await db.app_wallet.update_one(
        {'type': 'main'},
        {
            '$inc': {
                'balance': -amount,
                'total_withdrawn': amount
            },
            '$set': {'updated_at': datetime.utcnow()}
        }
    )
    
    # Update withdrawal status
    await db.withdrawals.update_one(
        {'id': withdrawal_id},
        {'$set': {
            'status': 'approved',
            'processed_at': datetime.utcnow(),
            'processed_by': user_id
        }}
    )
    
    # Record transaction
    await db.wallet_transactions.insert_one({
        'id': str(uuid.uuid4()),
        'type': 'withdrawal',
        'method': withdrawal.get('method', 'unknown'),
        'amount': -amount,
        'currency': 'SAR',
        'status': 'completed',
        'withdrawal_id': withdrawal_id,
        'user_id': withdrawal.get('user_id'),
        'admin_id': user_id,
        'created_at': datetime.utcnow(),
        'completed_at': datetime.utcnow()
    })
    
    return {
        'message': f'تم الموافقة على السحب وخصم {amount} ريال من المحفظة',
        'amount': amount,
        'new_balance': balance - amount
    }


@router.get('/settings')
async def get_wallet_settings(user_id: str = Depends(get_current_user_id)):
    """Get wallet settings including bank account info"""
    db = get_db()
    await verify_admin(user_id, db)
    
    settings = await db.app_wallet.find_one({'type': 'settings'}, {'_id': 0})
    
    if not settings:
        return {
            'bank_account': None,
            'paypal': None,
            'low_balance_alert': 1000,
            'auto_notify_on_low': True
        }
    
    return {
        'bank_account': settings.get('bank_account'),
        'paypal': settings.get('paypal'),
        'low_balance_alert': settings.get('low_balance_alert', 1000),
        'auto_notify_on_low': settings.get('auto_notify_on_low', True)
    }


@router.put('/settings')
async def update_wallet_settings(
    settings: WalletSettings,
    user_id: str = Depends(get_current_user_id)
):
    """Update wallet settings"""
    db = get_db()
    await verify_admin(user_id, db)
    
    update_data = {
        'type': 'settings',
        'low_balance_alert': settings.low_balance_alert,
        'auto_notify_on_low': settings.auto_notify_on_low,
        'updated_at': datetime.utcnow()
    }
    
    if settings.bank_account:
        update_data['bank_account'] = settings.bank_account.dict()
    
    if settings.paypal:
        update_data['paypal'] = settings.paypal.dict()
    
    await db.app_wallet.update_one(
        {'type': 'settings'},
        {'$set': update_data},
        upsert=True
    )
    
    return {'message': 'تم حفظ الإعدادات بنجاح'}


@router.get('/stats')
async def get_wallet_stats(user_id: str = Depends(get_current_user_id)):
    """Get wallet statistics"""
    db = get_db()
    await verify_admin(user_id, db)
    
    # Get wallet
    wallet = await db.app_wallet.find_one({'type': 'main'}, {'_id': 0})
    
    # Get today's transactions
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    deposits_today = await db.wallet_transactions.aggregate([
        {'$match': {'type': 'deposit', 'status': 'completed', 'created_at': {'$gte': today}}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]).to_list(1)
    
    withdrawals_today = await db.wallet_transactions.aggregate([
        {'$match': {'type': 'withdrawal', 'status': 'completed', 'created_at': {'$gte': today}}},
        {'$group': {'_id': None, 'total': {'$sum': {'$abs': '$amount'}}}}
    ]).to_list(1)
    
    # Get pending withdrawals count
    pending_count = await db.withdrawals.count_documents({'status': 'pending'})
    
    return {
        'balance': wallet.get('balance', 0) if wallet else 0,
        'total_deposited': wallet.get('total_deposited', 0) if wallet else 0,
        'total_withdrawn': wallet.get('total_withdrawn', 0) if wallet else 0,
        'deposits_today': deposits_today[0]['total'] if deposits_today else 0,
        'withdrawals_today': withdrawals_today[0]['total'] if withdrawals_today else 0,
        'pending_withdrawals_count': pending_count
    }


@router.delete('/reset')
async def reset_wallet(user_id: str = Depends(get_current_user_id)):
    """Reset wallet - delete all transactions and reset balance"""
    db = get_db()
    await verify_admin(user_id, db)
    
    # Delete all transactions
    await db.wallet_transactions.delete_many({})
    
    # Reset wallet balance
    await db.app_wallet.update_one(
        {'type': 'main'},
        {'$set': {
            'balance': 0,
            'total_deposited': 0,
            'total_withdrawn': 0,
            'updated_at': datetime.utcnow()
        }},
        upsert=True
    )
    
    return {'message': 'تم إعادة تعيين المحفظة بنجاح'}


@router.delete('/transactions/{transaction_id}')
async def delete_transaction(
    transaction_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Delete a specific transaction"""
    db = get_db()
    await verify_admin(user_id, db)
    
    # Get transaction first
    tx = await db.wallet_transactions.find_one({'id': transaction_id})
    if not tx:
        raise HTTPException(status_code=404, detail='المعاملة غير موجودة')
    
    # Reverse the balance change if transaction was completed
    if tx.get('status') == 'completed':
        amount = tx.get('amount', 0)
        if tx.get('type') == 'deposit':
            # Reverse deposit
            await db.app_wallet.update_one(
                {'type': 'main'},
                {'$inc': {'balance': -amount, 'total_deposited': -amount}}
            )
        else:
            # Reverse withdrawal
            await db.app_wallet.update_one(
                {'type': 'main'},
                {'$inc': {'balance': abs(amount), 'total_withdrawn': -abs(amount)}}
            )
    
    # Delete transaction
    await db.wallet_transactions.delete_one({'id': transaction_id})
    
    return {'message': 'تم حذف المعاملة بنجاح'}
