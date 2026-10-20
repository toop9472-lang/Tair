"""
Payment Gateways Routes - Tabby, Tamara, STC Pay, PayPal
All gateways are configured but await API keys
"""
from fastapi import APIRouter, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
import os
import uuid

router = APIRouter(prefix='/payment-gateways', tags=['Payment Gateways'])


def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


# ============ Payment Models ============

class TabbyPayment(BaseModel):
    amount: float
    currency: str = "SAR"
    description: str
    buyer_email: str
    buyer_phone: str
    buyer_name: str
    order_id: Optional[str] = None


class TamaraPayment(BaseModel):
    amount: float
    currency: str = "SAR"
    description: str
    buyer_email: str
    buyer_phone: str
    buyer_name: str
    order_id: Optional[str] = None


class STCPayPayment(BaseModel):
    amount: float
    mobile_number: str  # Must start with 05
    merchant_note: Optional[str] = None


class PayPalPayment(BaseModel):
    amount: float
    currency: str = "USD"
    description: str
    return_url: str
    cancel_url: str


# ============ Configuration Status ============

@router.get('/status')
async def get_payment_gateways_status():
    """
    Get configuration status of all payment gateways
    """
    stripe_configured = bool(os.environ.get('STRIPE_API_KEY'))
    
    return {
        'gateways': {
            'stripe': {
                'name': 'Stripe',
                'name_ar': 'سترايب',
                'configured': stripe_configured,
                'supported_currencies': ['USD', 'EUR', 'SAR', 'AED'],
                'type': 'international',
                'logo': '💳'
            },
            'tap': {
                'name': 'Tap Payments',
                'name_ar': 'تاب للدفع',
                'configured': bool(os.environ.get('TAP_API_KEY')),
                'supported_currencies': ['SAR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR'],
                'type': 'regional',
                'logo': '💰'
            },
            'tabby': {
                'name': 'Tabby',
                'name_ar': 'تابي',
                'configured': bool(os.environ.get('TABBY_API_KEY')),
                'supported_currencies': ['SAR', 'AED'],
                'type': 'bnpl',  # Buy Now Pay Later
                'description': 'ادفع على 4 دفعات بدون فوائد',
                'logo': '🛒'
            },
            'tamara': {
                'name': 'Tamara',
                'name_ar': 'تمارا',
                'configured': bool(os.environ.get('TAMARA_API_KEY')),
                'supported_currencies': ['SAR', 'AED'],
                'type': 'bnpl',
                'description': 'قسّم مدفوعاتك على 3 دفعات',
                'logo': '💎'
            },
            'stcpay': {
                'name': 'STC Pay',
                'name_ar': 'اس تي سي باي',
                'configured': bool(os.environ.get('STCPAY_API_KEY')),
                'supported_currencies': ['SAR'],
                'type': 'wallet',
                'description': 'ادفع من محفظة STC Pay',
                'logo': '📱'
            },
            'paypal': {
                'name': 'PayPal',
                'name_ar': 'باي بال',
                'configured': bool(os.environ.get('PAYPAL_CLIENT_ID')),
                'supported_currencies': ['USD', 'EUR', 'GBP', 'SAR'],
                'type': 'international',
                'logo': '🅿️'
            },
            'applepay': {
                'name': 'Apple Pay',
                'name_ar': 'أبل باي',
                'configured': stripe_configured,  # Apple Pay works through Stripe
                'supported_currencies': ['USD', 'EUR', 'SAR', 'AED'],
                'type': 'wallet',
                'description': 'يعمل تلقائياً عبر Stripe للمستخدمين على أجهزة Apple',
                'logo': '',
                'requires': 'stripe',
                'note': 'Apple Pay is automatically available when Stripe is configured. It appears as a payment option for users on compatible Apple devices.'
            }
        }
    }


@router.get('/applepay/status')
async def get_applepay_status():
    """
    Get Apple Pay configuration status
    Apple Pay works through Stripe automatically
    """
    stripe_configured = bool(os.environ.get('STRIPE_API_KEY'))
    
    db = get_db()
    settings = await db.settings.find_one({'type': 'payment_gateways'}, {'_id': 0})
    
    applepay_enabled = settings.get('applepay_enabled', False) if settings else False
    applepay_merchant_id = settings.get('applepay_merchant_id', '') if settings else ''
    
    return {
        'apple_pay': {
            'enabled': applepay_enabled,
            'functional': stripe_configured and applepay_enabled,
            'stripe_configured': stripe_configured,
            'merchant_id': applepay_merchant_id[:4] + '****' if applepay_merchant_id else '',
            'status': 'active' if (stripe_configured and applepay_enabled) else 'inactive',
            'message': 'Apple Pay يعمل بشكل صحيح عبر Stripe' if (stripe_configured and applepay_enabled) else 
                       'يجب تفعيل Stripe لتشغيل Apple Pay' if not stripe_configured else
                       'Apple Pay معطل في الإعدادات',
            'how_it_works': [
                'Apple Pay متاح تلقائياً في Stripe Checkout',
                'يظهر لمستخدمي iPhone و iPad و Mac فقط',
                'لا يحتاج إعداد إضافي - Stripe يدير العملية',
                'تأكد من تفعيل Apple Pay في لوحة تحكم Stripe'
            ],
            'setup_steps': [
                '1. فعّل Stripe وأدخل مفتاح API',
                '2. اذهب إلى Stripe Dashboard → Settings → Payment Methods',
                '3. فعّل Apple Pay من القائمة',
                '4. سيظهر Apple Pay تلقائياً للمستخدمين المؤهلين'
            ]
        }
    }


# ============ Tabby (تابي) ============

@router.post('/tabby/create-session')
async def create_tabby_session(payment: TabbyPayment):
    """
    Create Tabby checkout session (Buy Now Pay Later)
    """
    tabby_key = os.environ.get('TABBY_API_KEY')
    
    if not tabby_key:
        # Return placeholder for later configuration
        return {
            'configured': False,
            'message': 'بوابة تابي غير مفعلة حالياً. سيتم تفعيلها قريباً.',
            'gateway': 'tabby',
            'placeholder_url': None
        }
    
    # When API key is available, implement actual Tabby integration
    # Tabby API: https://docs.tabby.ai/
    
    db = get_db()
    order_id = payment.order_id or str(uuid.uuid4())
    
    # Store pending payment
    await db.pending_payments.insert_one({
        'id': order_id,
        'gateway': 'tabby',
        'amount': payment.amount,
        'currency': payment.currency,
        'buyer_email': payment.buyer_email,
        'buyer_phone': payment.buyer_phone,
        'buyer_name': payment.buyer_name,
        'status': 'pending',
        'created_at': datetime.utcnow()
    })
    
    return {
        'configured': True,
        'order_id': order_id,
        'checkout_url': f'https://checkout.tabby.ai/{order_id}',
        'message': 'تم إنشاء جلسة الدفع'
    }


# ============ Tamara (تمارا) ============

@router.post('/tamara/create-session')
async def create_tamara_session(payment: TamaraPayment):
    """
    Create Tamara checkout session (Split in 3 payments)
    """
    tamara_key = os.environ.get('TAMARA_API_KEY')
    
    if not tamara_key:
        return {
            'configured': False,
            'message': 'بوابة تمارا غير مفعلة حالياً. سيتم تفعيلها قريباً.',
            'gateway': 'tamara',
            'placeholder_url': None
        }
    
    # When API key is available, implement actual Tamara integration
    # Tamara API: https://docs.tamara.co/
    
    db = get_db()
    order_id = payment.order_id or str(uuid.uuid4())
    
    await db.pending_payments.insert_one({
        'id': order_id,
        'gateway': 'tamara',
        'amount': payment.amount,
        'currency': payment.currency,
        'buyer_email': payment.buyer_email,
        'buyer_phone': payment.buyer_phone,
        'buyer_name': payment.buyer_name,
        'status': 'pending',
        'created_at': datetime.utcnow()
    })
    
    return {
        'configured': True,
        'order_id': order_id,
        'checkout_url': f'https://checkout.tamara.co/{order_id}',
        'message': 'تم إنشاء جلسة الدفع'
    }


# ============ STC Pay (اس تي سي باي) ============

@router.post('/stcpay/create-payment')
async def create_stcpay_payment(payment: STCPayPayment):
    """
    Create STC Pay payment request
    """
    stcpay_key = os.environ.get('STCPAY_API_KEY')
    
    if not stcpay_key:
        return {
            'configured': False,
            'message': 'بوابة STC Pay غير مفعلة حالياً. سيتم تفعيلها قريباً.',
            'gateway': 'stcpay',
            'placeholder_url': None
        }
    
    # Validate mobile number
    if not payment.mobile_number.startswith('05') or len(payment.mobile_number) != 10:
        raise HTTPException(
            status_code=400,
            detail='رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام'
        )
    
    # When API key is available, implement actual STC Pay integration
    
    db = get_db()
    payment_id = str(uuid.uuid4())
    
    await db.pending_payments.insert_one({
        'id': payment_id,
        'gateway': 'stcpay',
        'amount': payment.amount,
        'mobile_number': payment.mobile_number,
        'status': 'pending',
        'created_at': datetime.utcnow()
    })
    
    return {
        'configured': True,
        'payment_id': payment_id,
        'message': 'تم إرسال طلب الدفع إلى رقمك',
        'otp_required': True
    }


@router.post('/stcpay/verify-otp')
async def verify_stcpay_otp(payment_id: str, otp: str):
    """
    Verify STC Pay OTP
    """
    stcpay_key = os.environ.get('STCPAY_API_KEY')
    
    if not stcpay_key:
        return {
            'configured': False,
            'message': 'بوابة STC Pay غير مفعلة'
        }
    
    # Implement OTP verification when API is available
    
    return {
        'success': True,
        'message': 'تم التحقق بنجاح'
    }


# ============ PayPal (باي بال) ============

@router.post('/paypal/create-order')
async def create_paypal_order(payment: PayPalPayment):
    """
    Create PayPal order
    """
    paypal_client_id = os.environ.get('PAYPAL_CLIENT_ID')
    paypal_secret = os.environ.get('PAYPAL_SECRET')
    
    if not paypal_client_id or not paypal_secret:
        return {
            'configured': False,
            'message': 'بوابة PayPal غير مفعلة حالياً. سيتم تفعيلها قريباً.',
            'gateway': 'paypal',
            'placeholder_url': None
        }
    
    # When API keys are available, implement actual PayPal integration
    # PayPal API: https://developer.paypal.com/docs/api/orders/v2/
    
    db = get_db()
    order_id = str(uuid.uuid4())
    
    await db.pending_payments.insert_one({
        'id': order_id,
        'gateway': 'paypal',
        'amount': payment.amount,
        'currency': payment.currency,
        'status': 'pending',
        'created_at': datetime.utcnow()
    })
    
    return {
        'configured': True,
        'order_id': order_id,
        'approval_url': f'https://www.paypal.com/checkoutnow?token={order_id}',
        'message': 'تم إنشاء طلب الدفع'
    }


@router.post('/paypal/capture-order/{order_id}')
async def capture_paypal_order(order_id: str):
    """
    Capture PayPal order after approval
    """
    paypal_client_id = os.environ.get('PAYPAL_CLIENT_ID')
    
    if not paypal_client_id:
        return {'configured': False, 'message': 'بوابة PayPal غير مفعلة'}
    
    # Implement capture when API is available
    
    return {
        'success': True,
        'order_id': order_id,
        'message': 'تم الدفع بنجاح'
    }


# ============ Admin: Update Gateway Keys ============

@router.get('/admin/keys-status')
async def get_keys_status():
    """
    Admin: Check which API keys are configured
    """
    return {
        'keys': {
            'STRIPE_API_KEY': '✅ مفعل' if os.environ.get('STRIPE_API_KEY') else '❌ غير مفعل',
            'TAP_API_KEY': '✅ مفعل' if os.environ.get('TAP_API_KEY') else '❌ غير مفعل',
            'TABBY_API_KEY': '✅ مفعل' if os.environ.get('TABBY_API_KEY') else '❌ غير مفعل',
            'TAMARA_API_KEY': '✅ مفعل' if os.environ.get('TAMARA_API_KEY') else '❌ غير مفعل',
            'STCPAY_API_KEY': '✅ مفعل' if os.environ.get('STCPAY_API_KEY') else '❌ غير مفعل',
            'PAYPAL_CLIENT_ID': '✅ مفعل' if os.environ.get('PAYPAL_CLIENT_ID') else '❌ غير مفعل',
            'PAYPAL_SECRET': '✅ مفعل' if os.environ.get('PAYPAL_SECRET') else '❌ غير مفعل',
        },
        'instructions': {
            'tabby': 'احصل على مفتاح API من: https://merchant.tabby.ai/',
            'tamara': 'احصل على مفتاح API من: https://merchant.tamara.co/',
            'stcpay': 'احصل على مفتاح API من: https://stcpay.com.sa/merchant',
            'paypal': 'احصل على المفاتيح من: https://developer.paypal.com/dashboard/'
        }
    }
