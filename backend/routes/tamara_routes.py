"""
Tamara Integration - Buy Now Pay Later for Saudi Arabia
تقسيط المدفوعات - ادفع لاحقاً
Documentation: https://docs.tamara.co
"""
from fastapi import APIRouter, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import os
import uuid
import httpx

router = APIRouter(prefix='/tamara', tags=['Tamara BNPL'])

# Tamara API Configuration
TAMARA_API_URL = "https://api.tamara.co"
TAMARA_SANDBOX_URL = "https://api-sandbox.tamara.co"

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


def get_tamara_config():
    """Get Tamara API configuration from environment"""
    api_key = os.environ.get('TAMARA_API_KEY', '').strip()
    is_sandbox = os.environ.get('TAMARA_SANDBOX', 'true').lower() == 'true'
    
    if not api_key:
        return None, None
    
    base_url = TAMARA_SANDBOX_URL if is_sandbox else TAMARA_API_URL
    return api_key, base_url


class TamaraCheckoutRequest(BaseModel):
    """Request model for creating Tamara checkout"""
    package_id: str
    ad_id: str
    origin_url: str
    advertiser_email: Optional[str] = None
    advertiser_name: Optional[str] = None
    advertiser_phone: Optional[str] = None


class TamaraCheckoutResponse(BaseModel):
    """Response model for Tamara checkout"""
    order_id: str
    checkout_url: str
    status: str


@router.get('/status')
async def get_tamara_status():
    """Check if Tamara is configured"""
    api_key, _ = get_tamara_config()
    return {
        "configured": api_key is not None,
        "message": "Tamara جاهز للاستخدام - ادفع لاحقاً" if api_key else "يرجى إضافة TAMARA_API_KEY في ملف .env"
    }


@router.post('/checkout', response_model=TamaraCheckoutResponse)
async def create_tamara_checkout(request: Request, data: TamaraCheckoutRequest):
    """
    Create a Tamara checkout session
    ادفع لاحقاً - تقسيط بدون فوائد
    """
    api_key, base_url = get_tamara_config()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Tamara غير مُفعّل. يرجى إضافة TAMARA_API_KEY'
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
    success_url = f"{data.origin_url}/payment/success?provider=tamara&order_id={{order_id}}"
    cancel_url = f"{data.origin_url}/payment/cancel?ad_id={data.ad_id}"
    failure_url = f"{data.origin_url}/payment/cancel?ad_id={data.ad_id}&reason=failed"
    notification_url = f"{str(request.base_url).rstrip('/')}/api/tamara/webhook"
    
    # Create Tamara checkout order
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Generate unique order reference
    order_ref = f"saqr_{data.ad_id[:8]}_{uuid.uuid4().hex[:6]}"
    
    # Split name for Tamara
    full_name = data.advertiser_name or ad.get('advertiser_name', 'Customer')
    name_parts = full_name.split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else first_name
    
    payload = {
        "order_reference_id": order_ref,
        "total_amount": {
            "amount": package["amount"],
            "currency": "SAR"
        },
        "description": f"إعلان صقر - {package['description']}",
        "country_code": "SA",
        "payment_type": "PAY_BY_INSTALMENTS",
        "instalments": 3,  # Tamara standard: 3 installments
        "locale": "ar_SA",
        "items": [{
            "reference_id": data.ad_id,
            "type": "service",
            "name": f"إعلان صقر - {package['duration_months']} شهر",
            "sku": data.package_id,
            "quantity": 1,
            "unit_price": {
                "amount": package["amount"],
                "currency": "SAR"
            },
            "total_amount": {
                "amount": package["amount"],
                "currency": "SAR"
            }
        }],
        "consumer": {
            "first_name": first_name,
            "last_name": last_name,
            "phone_number": data.advertiser_phone or ad.get('advertiser_phone', '+966500000000'),
            "email": data.advertiser_email or ad.get('advertiser_email')
        },
        "shipping_address": {
            "first_name": first_name,
            "last_name": last_name,
            "line1": "Digital Service",
            "city": "Riyadh",
            "country_code": "SA"
        },
        "tax_amount": {
            "amount": 0,
            "currency": "SAR"
        },
        "shipping_amount": {
            "amount": 0,
            "currency": "SAR"
        },
        "merchant_url": {
            "success": success_url,
            "failure": failure_url,
            "cancel": cancel_url,
            "notification": notification_url
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/checkout",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                error_detail = response.json() if response.text else {"message": "Unknown error"}
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Tamara API error: {error_detail}"
                )
            
            tamara_response = response.json()
        
        order_id = tamara_response.get('order_id')
        checkout_url = tamara_response.get('checkout_url')
        
        if not checkout_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='Failed to get checkout URL from Tamara'
            )
        
        # Create payment transaction record
        transaction_id = f"tamara_txn_{uuid.uuid4().hex[:12]}"
        payment_record = {
            "transaction_id": transaction_id,
            "order_id": order_id,
            "order_ref": order_ref,
            "provider": "tamara",
            "ad_id": data.ad_id,
            "package_id": data.package_id,
            "amount": package["amount"],
            "currency": package["currency"],
            "duration_months": package["duration_months"],
            "advertiser_email": data.advertiser_email or ad.get('advertiser_email'),
            "payment_status": "pending",
            "status": "initiated",
            "installments": 3,
            "installment_amount": round(package["amount"] / 3, 2),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.payment_transactions.insert_one(payment_record)
        
        # Update ad with payment info
        await db.advertiser_ads.update_one(
            {'id': data.ad_id},
            {'$set': {
                'tamara_order_id': order_id,
                'payment_provider': 'tamara',
                'payment_status': 'pending',
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        return TamaraCheckoutResponse(
            order_id=order_id,
            checkout_url=checkout_url,
            status="created"
        )
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to connect to Tamara: {str(e)}'
        )


@router.get('/status/{order_id}')
async def get_tamara_payment_status(request: Request, order_id: str):
    """
    Get payment status for a Tamara order
    """
    api_key, base_url = get_tamara_config()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Tamara غير مُفعّل'
        )
    
    db = get_db()
    
    # Find transaction in our DB
    transaction = await db.payment_transactions.find_one(
        {'order_id': order_id, 'provider': 'tamara'},
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
            "order_id": order_id,
            "payment_status": "paid",
            "ad_id": transaction.get('ad_id'),
            "amount": transaction.get('amount'),
            "installments": 3
        }
    
    # Check with Tamara API
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{base_url}/orders/{order_id}",
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail='Failed to check payment status'
                )
            
            tamara_data = response.json()
        
        tamara_status = tamara_data.get('status', 'UNKNOWN')
        payment_status = 'pending'
        
        # Map Tamara status to our status
        if tamara_status in ['approved', 'captured', 'fully_captured']:
            payment_status = 'paid'
        elif tamara_status in ['declined', 'expired', 'canceled']:
            payment_status = 'failed'
        elif tamara_status in ['new', 'pending']:
            payment_status = 'pending'
        
        # Update transaction
        await db.payment_transactions.update_one(
            {'order_id': order_id},
            {'$set': {
                'payment_status': payment_status,
                'tamara_status': tamara_status,
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
                {'order_id': order_id},
                {'$set': {'status': 'completed'}}
            )
        
        return {
            "order_id": order_id,
            "payment_status": payment_status,
            "tamara_status": tamara_status,
            "ad_id": transaction.get('ad_id'),
            "amount": transaction.get('amount'),
            "installments": 3
        }
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to connect to Tamara: {str(e)}'
        )


@router.post('/webhook')
async def tamara_webhook(request: Request):
    """
    Handle Tamara webhook events
    """
    try:
        body = await request.json()
        
        order_id = body.get('order_id')
        event_type = body.get('event_type')
        tamara_status = body.get('data', {}).get('status') or body.get('status')
        
        if not order_id:
            return {"status": "ignored", "reason": "No order_id"}
        
        db = get_db()
        
        payment_status = 'pending'
        if event_type in ['order_approved', 'order_captured'] or tamara_status in ['approved', 'captured']:
            payment_status = 'paid'
        elif event_type in ['order_declined', 'order_expired', 'order_canceled'] or tamara_status in ['declined', 'expired', 'canceled']:
            payment_status = 'failed'
        
        # Update transaction
        result = await db.payment_transactions.update_one(
            {'order_id': order_id},
            {'$set': {
                'payment_status': payment_status,
                'tamara_status': tamara_status or event_type,
                'webhook_received_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count > 0 and payment_status == 'paid':
            transaction = await db.payment_transactions.find_one(
                {'order_id': order_id},
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
        
        return {"status": "ok", "order_id": order_id, "payment_status": payment_status}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post('/capture/{order_id}')
async def capture_tamara_payment(order_id: str):
    """
    Capture an approved Tamara payment
    يجب استدعاء هذا بعد تقديم الخدمة
    """
    api_key, base_url = get_tamara_config()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Tamara غير مُفعّل'
        )
    
    db = get_db()
    
    transaction = await db.payment_transactions.find_one(
        {'order_id': order_id, 'provider': 'tamara'},
        {'_id': 0}
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Transaction not found'
        )
    
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    
    payload = {
        "total_amount": {
            "amount": transaction.get('amount'),
            "currency": "SAR"
        },
        "items": [{
            "reference_id": transaction.get('ad_id'),
            "name": f"إعلان صقر",
            "quantity": 1,
            "unit_price": {
                "amount": transaction.get('amount'),
                "currency": "SAR"
            },
            "total_amount": {
                "amount": transaction.get('amount'),
                "currency": "SAR"
            }
        }],
        "shipping_info": {
            "shipped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "shipping_company": "Digital"
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/orders/{order_id}/capture",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                error_detail = response.json() if response.text else {"message": "Unknown error"}
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Tamara capture error: {error_detail}"
                )
            
            tamara_response = response.json()
        
        # Update transaction
        await db.payment_transactions.update_one(
            {'order_id': order_id},
            {'$set': {
                'payment_status': 'captured',
                'tamara_status': 'captured',
                'captured_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        return {"status": "captured", "order_id": order_id}
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to connect to Tamara: {str(e)}'
        )
