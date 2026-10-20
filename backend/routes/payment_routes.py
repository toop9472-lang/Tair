"""
Payment routes for Stripe integration
Handles advertiser ad payments (500 SAR/month)
"""
from fastapi import APIRouter, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import os
import uuid

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionRequest, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse
)

router = APIRouter(prefix='/payments', tags=['Payments'])

# Fixed pricing packages - HOURLY BASED (NEVER accept prices from frontend)
# باقات الإعلانات بالساعة
PRICING_PACKAGES = {
    "ad_1_hour": {"amount": 79.00, "currency": "sar", "duration_hours": 1, "description": "إعلان لمدة ساعة واحدة"},
    "ad_3_hours": {"amount": 119.00, "currency": "sar", "duration_hours": 3, "description": "إعلان لمدة 3 ساعات"},
    "ad_6_hours": {"amount": 149.00, "currency": "sar", "duration_hours": 6, "description": "إعلان لمدة 6 ساعات"},
    "ad_12_hours": {"amount": 199.00, "currency": "sar", "duration_hours": 12, "description": "إعلان لمدة 12 ساعة"},
    "ad_24_hours": {"amount": 275.00, "currency": "sar", "duration_hours": 24, "description": "إعلان لمدة 24 ساعة (يوم كامل)"},
    "ad_48_hours": {"amount": 399.00, "currency": "sar", "duration_hours": 48, "description": "إعلان لمدة 48 ساعة (يومين)"},
    "ad_7_days": {"amount": 999.00, "currency": "sar", "duration_hours": 168, "description": "إعلان لمدة أسبوع كامل"}
}


def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


class CreateCheckoutRequest(BaseModel):
    """Request model for creating checkout session"""
    package_id: str  # e.g., "ad_1_month"
    ad_id: str  # The advertiser ad ID
    origin_url: str  # Frontend origin URL (window.location.origin)
    advertiser_email: Optional[str] = None


class CheckoutResponse(BaseModel):
    """Response model for checkout session"""
    checkout_url: str
    session_id: str


@router.get('/packages')
async def get_pricing_packages():
    """Get available pricing packages - hourly based"""
    return {
        "packages": [
            {
                "id": pkg_id,
                "amount": pkg["amount"],
                "currency": pkg["currency"],
                "duration_hours": pkg["duration_hours"],
                "description": pkg["description"]
            }
            for pkg_id, pkg in PRICING_PACKAGES.items()
        ]
    }


@router.post('/checkout', response_model=CheckoutResponse)
async def create_checkout_session(request: Request, data: CreateCheckoutRequest):
    """
    Create a Stripe checkout session for advertiser ad payment
    Security: Amount is determined by package_id from server-side ONLY
    """
    # Validate package exists
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
    
    # Initialize Stripe
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Payment service not configured'
        )
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    # Build success and cancel URLs from frontend origin
    success_url = f"{data.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/payment/cancel?ad_id={data.ad_id}"
    
    # Create metadata
    metadata = {
        "ad_id": data.ad_id,
        "package_id": data.package_id,
        "duration_hours": str(package["duration_hours"]),
        "advertiser_email": data.advertiser_email or ad.get('advertiser_email', ''),
        "source": "saqr_advertiser"
    }
    
    try:
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=package["amount"],
            currency=package["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record BEFORE redirect
        transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
        payment_record = {
            "transaction_id": transaction_id,
            "session_id": session.session_id,
            "ad_id": data.ad_id,
            "package_id": data.package_id,
            "amount": package["amount"],
            "currency": package["currency"],
            "duration_hours": package["duration_hours"],
            "advertiser_email": metadata["advertiser_email"],
            "payment_status": "pending",
            "status": "initiated",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.payment_transactions.insert_one(payment_record)
        
        # Update ad with payment session
        await db.advertiser_ads.update_one(
            {'id': data.ad_id},
            {'$set': {
                'payment_session_id': session.session_id,
                'payment_status': 'pending',
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        return CheckoutResponse(
            checkout_url=session.url,
            session_id=session.session_id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to create checkout session: {str(e)}'
        )


@router.get('/status/{session_id}')
async def get_payment_status(request: Request, session_id: str):
    """
    Get payment status for a checkout session
    Called by frontend to poll payment status
    """
    db = get_db()
    
    # Find the transaction
    transaction = await db.payment_transactions.find_one(
        {'session_id': session_id},
        {'_id': 0}
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Payment transaction not found'
        )
    
    # If already processed, return cached status
    if transaction.get('payment_status') in ['paid', 'failed', 'expired']:
        return {
            "session_id": session_id,
            "payment_status": transaction['payment_status'],
            "status": transaction['status'],
            "ad_id": transaction.get('ad_id'),
            "amount": transaction.get('amount'),
            "currency": transaction.get('currency')
        }
    
    # Otherwise, check with Stripe
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Payment service not configured'
        )
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        status_response: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction record
        new_status = status_response.status
        new_payment_status = status_response.payment_status
        
        await db.payment_transactions.update_one(
            {'session_id': session_id},
            {'$set': {
                'payment_status': new_payment_status,
                'status': new_status,
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        # If payment successful, activate the ad
        if new_payment_status == 'paid' and transaction.get('status') != 'completed':
            ad_id = transaction.get('ad_id')
            duration_hours = transaction.get('duration_hours', 1)
            
            # Calculate expiration time based on hours
            from datetime import timedelta
            ad_expiration = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
            
            # Update ad status - Auto activate after payment
            await db.advertiser_ads.update_one(
                {'id': ad_id},
                {'$set': {
                    'payment_status': 'paid',
                    'status': 'active',  # Auto-activate after payment
                    'is_active': True,
                    'payment_verified_at': datetime.now(timezone.utc),
                    'activated_at': datetime.now(timezone.utc),
                    'expires_at': ad_expiration.isoformat(),
                    'duration_hours': duration_hours,
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
            
            # Update advertiser payment record
            await db.advertiser_payments.update_one(
                {'ad_id': ad_id},
                {'$set': {
                    'status': 'paid',
                    'paid_at': datetime.now(timezone.utc),
                    'stripe_session_id': session_id
                }}
            )
            
            # Mark transaction as completed
            await db.payment_transactions.update_one(
                {'session_id': session_id},
                {'$set': {'status': 'completed'}}
            )
        
        return {
            "session_id": session_id,
            "payment_status": new_payment_status,
            "status": new_status,
            "ad_id": transaction.get('ad_id'),
            "amount": status_response.amount_total / 100,  # Convert from cents
            "currency": status_response.currency
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to check payment status: {str(e)}'
        )


@router.post('/webhook/stripe')
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events
    """
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Payment service not configured'
        )
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        db = get_db()
        
        # Update transaction based on webhook event
        if webhook_response.session_id:
            await db.payment_transactions.update_one(
                {'session_id': webhook_response.session_id},
                {'$set': {
                    'payment_status': webhook_response.payment_status,
                    'webhook_event_type': webhook_response.event_type,
                    'webhook_event_id': webhook_response.event_id,
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
        
        return {"status": "ok", "event_type": webhook_response.event_type}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Webhook error: {str(e)}'
        )
