"""
Tabby Integration - Buy Now Pay Later for Saudi Arabia
تقسيط المدفوعات - 4 دفعات بدون فوائد
Documentation: https://docs.tabby.ai
"""
from fastapi import APIRouter, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import os
import uuid
import httpx

router = APIRouter(prefix='/tabby', tags=['Tabby BNPL'])

# Tabby API Configuration
TABBY_API_URL = "https://api.tabby.ai/api/v2"
TABBY_TEST_URL = "https://api.tabby.ai/api/v2"  # Test mode determined by key

# Fixed pricing packages
PRICING_PACKAGES = {
    "ad_1_month": {"amount": 500.00, "currency": "SAR", "duration_months": 1, "description": "إعلان لمدة شهر واحد"},
    "ad_3_months": {"amount": 1350.00, "currency": "SAR", "duration_months": 3, "description": "إعلان لمدة 3 أشهر (خصم 10%)"},
    "ad_6_months": {"amount": 2400.00, "currency": "SAR", "duration_months": 6, "description": "إعلان لمدة 6 أشهر (خصم 20%)"},
    "ad_12_months": {"amount": 4200.00, "currency": "SAR", "duration_months": 12, "description": "إعلان لمدة سنة كاملة (خصم 30%)"}
}


def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


def get_tabby_api_key():
    """Get Tabby API key from environment"""
    api_key = os.environ.get('TABBY_API_KEY', '').strip()
    if not api_key:
        return None
    return api_key


class TabbyCheckoutRequest(BaseModel):
    """Request model for creating Tabby checkout"""
    package_id: str
    ad_id: str
    origin_url: str
    advertiser_email: Optional[str] = None
    advertiser_name: Optional[str] = None
    advertiser_phone: Optional[str] = None


class TabbyCheckoutResponse(BaseModel):
    """Response model for Tabby checkout"""
    payment_id: str
    checkout_url: str
    status: str
    installments: int = 4


@router.get('/status')
async def get_tabby_status():
    """Check if Tabby is configured"""
    api_key = get_tabby_api_key()
    return {
        "configured": api_key is not None,
        "message": "Tabby جاهز للاستخدام - تقسيط 4 دفعات" if api_key else "يرجى إضافة TABBY_API_KEY في ملف .env"
    }


@router.post('/checkout', response_model=TabbyCheckoutResponse)
async def create_tabby_checkout(request: Request, data: TabbyCheckoutRequest):
    """
    Create a Tabby checkout session
    تقسيط على 4 دفعات بدون فوائد
    """
    api_key = get_tabby_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Tabby غير مُفعّل. يرجى إضافة TABBY_API_KEY'
        )
    
    # Validate package
    if data.package_id not in PRICING_PACKAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid package ID'
        )
    
    package = PRICING_PACKAGES[data.package_id]
    
    # Validate ad exists
    db = get_db()
    ad = await db.advertiser_ads.find_one({'id': data.ad_id}, {'_id': 0})
    
    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Ad not found'
        )
    
    # Build URLs
    success_url = f"{data.origin_url}/payment/success?provider=tabby&payment_id={{payment_id}}"
    cancel_url = f"{data.origin_url}/payment/cancel?ad_id={data.ad_id}"
    failure_url = f"{data.origin_url}/payment/cancel?ad_id={data.ad_id}&reason=failed"
    
    # Create Tabby checkout session
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Generate unique order reference
    order_ref = f"saqr_{data.ad_id[:8]}_{uuid.uuid4().hex[:6]}"
    
    payload = {
        "payment": {
            "amount": str(package["amount"]),
            "currency": "SAR",
            "description": f"إعلان صقر - {package['description']}",
            "buyer": {
                "phone": data.advertiser_phone or ad.get('advertiser_phone', '+966500000000'),
                "email": data.advertiser_email or ad.get('advertiser_email'),
                "name": data.advertiser_name or ad.get('advertiser_name', 'Customer'),
            },
            "order": {
                "reference_id": order_ref,
                "items": [{
                    "title": f"إعلان صقر - {package['duration_months']} شهر",
                    "description": package['description'],
                    "quantity": 1,
                    "unit_price": str(package["amount"]),
                    "category": "advertising"
                }]
            },
            "buyer_history": {
                "registered_since": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "loyalty_level": 0
            }
        },
        "lang": "ar",
        "merchant_code": "saqr_ads",
        "merchant_urls": {
            "success": success_url,
            "cancel": cancel_url,
            "failure": failure_url
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TABBY_API_URL}/checkout",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                error_detail = response.json() if response.text else {"message": "Unknown error"}
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Tabby API error: {error_detail}"
                )
            
            tabby_response = response.json()
        
        payment_id = tabby_response.get('id') or tabby_response.get('payment', {}).get('id')
        checkout_url = tabby_response.get('configuration', {}).get('available_products', {}).get('installments', [{}])[0].get('web_url')
        
        if not checkout_url:
            # Try alternative URL structure
            checkout_url = tabby_response.get('checkout_url') or tabby_response.get('web_url')
        
        if not checkout_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='Failed to get checkout URL from Tabby'
            )
        
        # Create payment transaction record
        transaction_id = f"tabby_txn_{uuid.uuid4().hex[:12]}"
        payment_record = {
            "transaction_id": transaction_id,
            "payment_id": payment_id,
            "order_ref": order_ref,
            "provider": "tabby",
            "ad_id": data.ad_id,
            "package_id": data.package_id,
            "amount": package["amount"],
            "currency": package["currency"],
            "duration_months": package["duration_months"],
            "advertiser_email": data.advertiser_email or ad.get('advertiser_email'),
            "payment_status": "pending",
            "status": "initiated",
            "installments": 4,
            "installment_amount": package["amount"] / 4,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.payment_transactions.insert_one(payment_record)
        
        # Update ad with payment info
        await db.advertiser_ads.update_one(
            {'id': data.ad_id},
            {'$set': {
                'tabby_payment_id': payment_id,
                'payment_provider': 'tabby',
                'payment_status': 'pending',
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        return TabbyCheckoutResponse(
            payment_id=payment_id,
            checkout_url=checkout_url,
            status="created",
            installments=4
        )
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to connect to Tabby: {str(e)}'
        )


@router.get('/status/{payment_id}')
async def get_tabby_payment_status(request: Request, payment_id: str):
    """
    Get payment status for a Tabby payment
    """
    api_key = get_tabby_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Tabby غير مُفعّل'
        )
    
    db = get_db()
    
    # Find transaction in our DB
    transaction = await db.payment_transactions.find_one(
        {'payment_id': payment_id, 'provider': 'tabby'},
        {'_id': 0}
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Transaction not found'
        )
    
    # If already completed, return cached status
    if transaction.get('payment_status') == 'paid':
        return {
            "payment_id": payment_id,
            "payment_status": "paid",
            "ad_id": transaction.get('ad_id'),
            "amount": transaction.get('amount'),
            "installments": 4
        }
    
    # Check with Tabby API
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{TABBY_API_URL}/payments/{payment_id}",
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                # Try alternative endpoint
                response = await client.get(
                    f"{TABBY_API_URL}/checkout/{payment_id}",
                    headers=headers,
                    timeout=30.0
                )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail='Failed to check payment status'
                )
            
            tabby_data = response.json()
        
        tabby_status = tabby_data.get('status', 'UNKNOWN')
        payment_status = 'pending'
        
        # Map Tabby status to our status
        if tabby_status in ['AUTHORIZED', 'CLOSED', 'CAPTURED']:
            payment_status = 'paid'
        elif tabby_status in ['REJECTED', 'EXPIRED', 'FAILED']:
            payment_status = 'failed'
        elif tabby_status == 'CREATED':
            payment_status = 'pending'
        
        # Update transaction
        await db.payment_transactions.update_one(
            {'payment_id': payment_id},
            {'$set': {
                'payment_status': payment_status,
                'tabby_status': tabby_status,
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        # If paid, activate ad
        if payment_status == 'paid' and transaction.get('status') != 'completed':
            ad_id = transaction.get('ad_id')
            
            await db.advertiser_ads.update_one(
                {'id': ad_id},
                {'$set': {
                    'payment_status': 'paid',
                    'status': 'pending',  # Still needs admin approval
                    'payment_verified_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
            
            await db.payment_transactions.update_one(
                {'payment_id': payment_id},
                {'$set': {'status': 'completed'}}
            )
        
        return {
            "payment_id": payment_id,
            "payment_status": payment_status,
            "tabby_status": tabby_status,
            "ad_id": transaction.get('ad_id'),
            "amount": transaction.get('amount'),
            "installments": 4
        }
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to connect to Tabby: {str(e)}'
        )


@router.post('/webhook')
async def tabby_webhook(request: Request):
    """
    Handle Tabby webhook events
    """
    try:
        body = await request.json()
        
        payment_id = body.get('id') or body.get('payment', {}).get('id')
        tabby_status = body.get('status')
        
        if not payment_id:
            return {"status": "ignored", "reason": "No payment_id"}
        
        db = get_db()
        
        payment_status = 'pending'
        if tabby_status in ['AUTHORIZED', 'CLOSED', 'CAPTURED']:
            payment_status = 'paid'
        elif tabby_status in ['REJECTED', 'EXPIRED', 'FAILED']:
            payment_status = 'failed'
        
        # Update transaction
        result = await db.payment_transactions.update_one(
            {'payment_id': payment_id},
            {'$set': {
                'payment_status': payment_status,
                'tabby_status': tabby_status,
                'webhook_received_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count > 0 and payment_status == 'paid':
            transaction = await db.payment_transactions.find_one(
                {'payment_id': payment_id},
                {'_id': 0}
            )
            
            if transaction:
                ad_id = transaction.get('ad_id')
                await db.advertiser_ads.update_one(
                    {'id': ad_id},
                    {'$set': {
                        'payment_status': 'paid',
                        'status': 'pending',
                        'payment_verified_at': datetime.now(timezone.utc),
                        'updated_at': datetime.now(timezone.utc)
                    }}
                )
        
        return {"status": "ok", "payment_id": payment_id, "payment_status": payment_status}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
