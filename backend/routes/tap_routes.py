"""
Tap Payments integration for Saudi Arabia
Supports mada, Visa, Mastercard, Apple Pay
Documentation: https://developers.tap.company
"""
from fastapi import APIRouter, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import os
import uuid
import httpx

router = APIRouter(prefix='/tap', tags=['Tap Payments'])

# Tap API Configuration
TAP_API_URL = "https://api.tap.company/v2"
TAP_TEST_URL = "https://api.tap.company/v2"  # Same URL, test mode determined by key

# Fixed pricing packages (same as Stripe)
# 1 شهر = 1000 ريال
PRICING_PACKAGES = {
    "ad_1_month": {"amount": 1000.00, "currency": "SAR", "duration_months": 1, "description": "إعلان لمدة شهر واحد"},
    "ad_3_months": {"amount": 2700.00, "currency": "SAR", "duration_months": 3, "description": "إعلان لمدة 3 أشهر (خصم 10%)"},
    "ad_6_months": {"amount": 4800.00, "currency": "SAR", "duration_months": 6, "description": "إعلان لمدة 6 أشهر (خصم 20%)"},
    "ad_12_months": {"amount": 8400.00, "currency": "SAR", "duration_months": 12, "description": "إعلان لمدة سنة كاملة (خصم 30%)"}
}


def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


def get_tap_api_key():
    """Get Tap API key from environment"""
    api_key = os.environ.get('TAP_API_KEY', '').strip()
    if not api_key:
        return None
    return api_key


class TapCheckoutRequest(BaseModel):
    """Request model for creating Tap checkout"""
    package_id: str
    ad_id: str
    origin_url: str
    advertiser_email: Optional[str] = None
    advertiser_name: Optional[str] = None
    advertiser_phone: Optional[str] = None


class TapCheckoutResponse(BaseModel):
    """Response model for Tap checkout"""
    charge_id: str
    checkout_url: str
    status: str


@router.get('/status')
async def get_tap_status():
    """Check if Tap Payments is configured"""
    api_key = get_tap_api_key()
    return {
        "configured": api_key is not None,
        "message": "Tap Payments جاهز للاستخدام" if api_key else "يرجى إضافة TAP_API_KEY في ملف .env"
    }


@router.post('/checkout', response_model=TapCheckoutResponse)
async def create_tap_checkout(request: Request, data: TapCheckoutRequest):
    """
    Create a Tap Payments checkout session
    Supports mada, Visa, Mastercard, Apple Pay
    """
    api_key = get_tap_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Tap Payments غير مُفعّل. يرجى إضافة TAP_API_KEY'
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
    
    # Build success and cancel URLs
    success_url = f"{data.origin_url}/payment/success?provider=tap&charge_id={{tap_id}}"
    cancel_url = f"{data.origin_url}/payment/cancel?ad_id={data.ad_id}"
    
    # Create Tap charge
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Amount in smallest currency unit (halalas for SAR)
    amount_halalas = int(package["amount"] * 100)
    
    payload = {
        "amount": package["amount"],  # Tap accepts decimal amount
        "currency": "SAR",
        "customer": {
            "first_name": data.advertiser_name or ad.get('advertiser_name', 'Customer'),
            "email": data.advertiser_email or ad.get('advertiser_email'),
            "phone": {
                "country_code": "966",
                "number": (data.advertiser_phone or ad.get('advertiser_phone', '')).replace('+966', '').replace('0', '', 1) if data.advertiser_phone or ad.get('advertiser_phone') else ""
            }
        },
        "source": {"id": "src_all"},  # Accept all payment methods
        "redirect": {
            "url": success_url
        },
        "post": {
            "url": f"{str(request.base_url).rstrip('/')}/api/tap/webhook"
        },
        "description": f"إعلان صقر - {package['description']}",
        "metadata": {
            "ad_id": data.ad_id,
            "package_id": data.package_id,
            "duration_months": str(package["duration_months"]),
            "source": "saqr_advertiser"
        },
        "reference": {
            "transaction": f"saqr_{data.ad_id[:8]}",
            "order": f"order_{uuid.uuid4().hex[:8]}"
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TAP_API_URL}/charges",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                error_detail = response.json() if response.text else {"message": "Unknown error"}
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Tap API error: {error_detail}"
                )
            
            tap_response = response.json()
        
        charge_id = tap_response.get('id')
        checkout_url = tap_response.get('transaction', {}).get('url')
        charge_status = tap_response.get('status')
        
        if not checkout_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='Failed to get checkout URL from Tap'
            )
        
        # Create payment transaction record
        transaction_id = f"tap_txn_{uuid.uuid4().hex[:12]}"
        payment_record = {
            "transaction_id": transaction_id,
            "charge_id": charge_id,
            "provider": "tap",
            "ad_id": data.ad_id,
            "package_id": data.package_id,
            "amount": package["amount"],
            "currency": package["currency"],
            "duration_months": package["duration_months"],
            "advertiser_email": data.advertiser_email or ad.get('advertiser_email'),
            "payment_status": "pending",
            "status": "initiated",
            "tap_status": charge_status,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.payment_transactions.insert_one(payment_record)
        
        # Update ad with payment info
        await db.advertiser_ads.update_one(
            {'id': data.ad_id},
            {'$set': {
                'tap_charge_id': charge_id,
                'payment_provider': 'tap',
                'payment_status': 'pending',
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        return TapCheckoutResponse(
            charge_id=charge_id,
            checkout_url=checkout_url,
            status=charge_status
        )
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to connect to Tap: {str(e)}'
        )


@router.get('/status/{charge_id}')
async def get_tap_payment_status(request: Request, charge_id: str):
    """
    Get payment status for a Tap charge
    """
    api_key = get_tap_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Tap Payments غير مُفعّل'
        )
    
    db = get_db()
    
    # Find transaction in our DB
    transaction = await db.payment_transactions.find_one(
        {'charge_id': charge_id, 'provider': 'tap'},
        {'_id': 0}
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Transaction not found'
        )
    
    # If already completed, return cached status
    if transaction.get('payment_status') in ['paid', 'captured']:
        return {
            "charge_id": charge_id,
            "payment_status": "paid",
            "ad_id": transaction.get('ad_id'),
            "amount": transaction.get('amount'),
            "currency": transaction.get('currency')
        }
    
    # Check with Tap API
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{TAP_API_URL}/charges/{charge_id}",
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail='Failed to check payment status'
                )
            
            tap_data = response.json()
        
        tap_status = tap_data.get('status', 'UNKNOWN')
        payment_status = 'pending'
        
        # Map Tap status to our status
        if tap_status in ['CAPTURED', 'AUTHORIZED']:
            payment_status = 'paid'
        elif tap_status in ['FAILED', 'DECLINED', 'CANCELLED']:
            payment_status = 'failed'
        elif tap_status == 'INITIATED':
            payment_status = 'pending'
        
        # Update transaction
        await db.payment_transactions.update_one(
            {'charge_id': charge_id},
            {'$set': {
                'payment_status': payment_status,
                'tap_status': tap_status,
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
                {'charge_id': charge_id},
                {'$set': {'status': 'completed'}}
            )
        
        return {
            "charge_id": charge_id,
            "payment_status": payment_status,
            "tap_status": tap_status,
            "ad_id": transaction.get('ad_id'),
            "amount": transaction.get('amount'),
            "currency": transaction.get('currency')
        }
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to connect to Tap: {str(e)}'
        )


@router.post('/webhook')
async def tap_webhook(request: Request):
    """
    Handle Tap webhook events
    """
    try:
        body = await request.json()
        
        charge_id = body.get('id')
        tap_status = body.get('status')
        
        if not charge_id:
            return {"status": "ignored", "reason": "No charge_id"}
        
        db = get_db()
        
        payment_status = 'pending'
        if tap_status in ['CAPTURED', 'AUTHORIZED']:
            payment_status = 'paid'
        elif tap_status in ['FAILED', 'DECLINED', 'CANCELLED']:
            payment_status = 'failed'
        
        # Update transaction
        result = await db.payment_transactions.update_one(
            {'charge_id': charge_id},
            {'$set': {
                'payment_status': payment_status,
                'tap_status': tap_status,
                'webhook_received_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count > 0 and payment_status == 'paid':
            # Get transaction to find ad_id
            transaction = await db.payment_transactions.find_one(
                {'charge_id': charge_id},
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
        
        return {"status": "ok", "charge_id": charge_id, "payment_status": payment_status}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
