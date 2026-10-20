from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from models.advertiser import AdvertiserAd, AdvertiserAdCreate, AdvertiserAdResponse, AdvertiserPayment
from auth.dependencies import get_current_user_id
from typing import List, Optional
from datetime import datetime, timedelta
import os
import uuid

from services.r2_storage import r2

router = APIRouter(prefix='/advertiser', tags=['Advertiser'])
MAX_VIDEO_UPLOAD_MB = 200

VIDEO_MIME_TYPES = {
    "mp4": "video/mp4",
    "m4v": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
}

# Hourly pricing packages
HOURLY_PACKAGES = {
    1: 79.0,    # 1 hour
    3: 119.0,   # 3 hours
    6: 149.0,   # 6 hours
    12: 199.0,  # 12 hours
    24: 275.0,  # 24 hours (1 day)
    48: 399.0,  # 48 hours (2 days)
    168: 999.0  # 7 days
}

def get_db():
    """Get database connection"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


def _is_video_filename(filename: str) -> bool:
    lowered = (filename or "").lower()
    return lowered.endswith((".mp4", ".mov", ".m4v", ".webm"))


def _is_valid_video_url(value: str) -> bool:
    normalized = (value or "").strip()
    return (
        normalized.startswith("http")
        or normalized.startswith("/media/ads/")
        or normalized.startswith("/api/clips/media/")
    )


def _looks_demo_content(*values: str) -> bool:
    normalized = " ".join((v or "") for v in values).strip().lower()
    if not normalized:
        return False
    markers = ("test", "demo", "dummy", "sample", "placeholder", "تجريبي", "اختبار")
    return any(marker in normalized for marker in markers)


@router.post('/upload-video', response_model=dict)
async def upload_advertiser_video(file: UploadFile = File(...)):
    filename = file.filename or "advertiser-video.mp4"
    if not _is_video_filename(filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='صيغة فيديو غير مدعومة',
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='ملف الفيديو فارغ',
        )

    max_bytes = MAX_VIDEO_UPLOAD_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'حجم الفيديو يتجاوز {MAX_VIDEO_UPLOAD_MB}MB',
        )

    file_id = str(uuid.uuid4())
    ext = filename.split(".")[-1].lower()
    safe_ext = ext if ext in {"mp4", "mov", "m4v", "webm"} else "mp4"
    media_type = VIDEO_MIME_TYPES.get(safe_ext, "video/mp4")

    video_url = None
    if r2.is_configured:
        try:
            video_url = r2.upload_bytes(
                f"ads/{file_id}.{safe_ext}", content, content_type=media_type
            )
        except Exception as exc:
            print(f"[advertiser upload-video] R2 failed, fallback to local: {exc}")
            video_url = None

    if not video_url:
        media_ads_dir = os.path.join(
            os.path.dirname(__file__),
            "..",
            "static",
            "media",
            "ads",
        )
        os.makedirs(media_ads_dir, exist_ok=True)
        output_path = os.path.join(media_ads_dir, f"{file_id}.{safe_ext}")
        with open(output_path, "wb") as output:
            output.write(content)
        video_url = f"/media/ads/{file_id}.{safe_ext}"

    return {
        "success": True,
        "video_url": video_url,
    }

@router.post('/ads', response_model=dict)
async def create_advertiser_ad(ad_data: AdvertiserAdCreate):
    """
    Create a new advertiser ad request
    """
    db = get_db()
    
    try:
        if _looks_demo_content(ad_data.title, ad_data.description, ad_data.advertiser_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='لا يمكن نشر إعلان تجريبي. يرجى إدخال بيانات إعلان حقيقية.',
            )

        video_url = (ad_data.video_url or "").strip()
        if not video_url or not _is_valid_video_url(video_url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='يرجى رفع فيديو الإعلان أو إدخال رابط فيديو صالح',
            )

        # Get price based on duration_hours
        duration_hours = ad_data.duration_hours
        total_price = HOURLY_PACKAGES.get(duration_hours, 79.0)
        
        # Create ad
        ad = AdvertiserAd(
            advertiser_id=f"adv_{datetime.utcnow().timestamp()}",
            advertiser_name=ad_data.advertiser_name,
            advertiser_email=ad_data.advertiser_email,
            advertiser_phone=ad_data.advertiser_phone,
            title=ad_data.title,
            description=ad_data.description,
            video_url=video_url,
            thumbnail_url=ad_data.thumbnail_url,
            duration=ad_data.duration,
            price=total_price,
            duration_hours=duration_hours,
            ad_type=ad_data.ad_type,
            status='pending',
            payment_status='pending'
        )
        
        # Save to database
        ad_dict = ad.dict()
        await db.advertiser_ads.insert_one(ad_dict)
        
        # Create payment record
        payment = AdvertiserPayment(
            advertiser_id=ad.advertiser_id,
            ad_id=ad.id,
            amount=total_price,
            status='pending'
        )
        payment_dict = payment.dict()
        await db.advertiser_payments.insert_one(payment_dict)
        
        # Update ad with payment ID
        await db.advertiser_ads.update_one(
            {'id': ad.id},
            {'$set': {'payment_id': payment.id}}
        )
        
        return {
            'success': True,
            'ad': AdvertiserAdResponse(
                id=ad.id,
                advertiser_name=ad.advertiser_name,
                title=ad.title,
                description=ad.description,
                video_url=ad.video_url,
                thumbnail_url=ad.thumbnail_url,
                duration=ad.duration,
                price=ad.price,
                duration_hours=ad.duration_hours,
                status=ad.status,
                payment_status=ad.payment_status,
                created_at=ad.created_at,
                expires_at=ad.expires_at,
                ad_type=ad.ad_type
            ),
            'payment': {
                'id': payment.id,
                'amount': payment.amount,
                'currency': payment.currency,
                'status': payment.status
            },
            'message': f'تم إنشاء طلب الإعلان بنجاح! المبلغ المطلوب: {total_price} ريال'
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to create ad: {str(e)}'
        )

@router.get('/ads/{ad_id}', response_model=dict)
async def get_advertiser_ad(ad_id: str):
    """
    Get advertiser ad by ID
    """
    db = get_db()
    ad = await db.advertiser_ads.find_one({'id': ad_id})
    
    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Ad not found'
        )
    
    # Get payment info
    payment = await db.advertiser_payments.find_one({'ad_id': ad_id})
    
    # Hide legacy test/demo ads from production API responses.
    advertiser_name = (ad.get('advertiser_name') or '').strip()
    title = (ad.get('title') or '').strip()
    if 'test' in advertiser_name.lower() or 'demo' in advertiser_name.lower() or 'test' in title.lower() or 'demo' in title.lower():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Ad not found'
        )

    return {
        'ad': AdvertiserAdResponse(
            id=ad['id'],
            advertiser_name=ad['advertiser_name'],
            title=ad['title'],
            description=ad['description'],
            video_url=ad['video_url'],
            thumbnail_url=ad.get('thumbnail_url'),
            duration=ad['duration'],
            price=ad['price'],
            duration_hours=ad.get('duration_hours', 1),
            status=ad['status'],
            payment_status=ad['payment_status'],
            created_at=ad['created_at'],
            expires_at=ad.get('expires_at'),
            ad_type=ad.get('ad_type', 'local')
        ),
        'payment': {
            'id': payment['id'],
            'amount': payment['amount'],
            'currency': payment['currency'],
            'status': payment['status']
        } if payment else None
    }

@router.post('/ads/{ad_id}/payment', response_model=dict)
async def submit_payment_proof(ad_id: str, data: dict):
    """
    Submit payment proof for advertiser ad
    """
    db = get_db()
    
    # Check if ad exists
    ad = await db.advertiser_ads.find_one({'id': ad_id})
    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Ad not found'
        )
    
    payment_method = data.get('payment_method')
    payment_proof = data.get('payment_proof')  # URL or reference
    
    # Update payment
    await db.advertiser_payments.update_one(
        {'ad_id': ad_id},
        {'$set': {
            'payment_method': payment_method,
            'payment_proof': payment_proof,
            'status': 'pending'
        }}
    )
    
    # Update ad
    await db.advertiser_ads.update_one(
        {'id': ad_id},
        {'$set': {'payment_status': 'pending'}}
    )
    
    return {
        'success': True,
        'message': 'تم إرسال إثبات الدفع بنجاح! سيتم مراجعته من قبل الإدارة'
    }

@router.post('/ads/{ad_id}/boost', response_model=dict)
async def boost_advertiser_ad(ad_id: str, data: dict = None):
    """
    Boost an existing ad to the top of the feed for 5 SAR.
    This is a one-time uplift — it does NOT extend the ad duration.
    """
    db = get_db()
    ad = await db.advertiser_ads.find_one({'id': ad_id})
    if not ad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ad not found')

    payment_method = (data or {}).get('payment_method')
    payment_proof = (data or {}).get('payment_proof')

    now = datetime.utcnow()
    boost_price = 5.0

    # Mark the ad as boosted (timestamp drives the feed sort order)
    await db.advertiser_ads.update_one(
        {'id': ad_id},
        {'$set': {
            'boosted_at': now,
            'boost_paid': True,
        }}
    )

    # Record a separate boost payment for transparency
    boost_payment = AdvertiserPayment(
        advertiser_id=ad.get('advertiser_id', f'adv_{now.timestamp()}'),
        ad_id=ad_id,
        amount=boost_price,
        status='pending' if not payment_proof else 'paid',
        payment_method=payment_method,
        payment_proof=payment_proof,
    )
    boost_dict = boost_payment.dict()
    boost_dict['type'] = 'boost'
    await db.advertiser_payments.insert_one(boost_dict)

    return {
        'success': True,
        'message': 'تم رفع إعلانك للأعلى!',
        'boost_price': boost_price,
        'boost_payment_id': boost_payment.id,
        'boosted_at': now.isoformat(),
    }


@router.get('/pricing', response_model=dict)
async def get_pricing():
    """
    Get advertiser pricing information - hourly packages
    """
    return {
        'packages': [
            {'hours': 1, 'price': 79, 'description': 'ساعة واحدة'},
            {'hours': 3, 'price': 119, 'description': '3 ساعات'},
            {'hours': 6, 'price': 149, 'description': '6 ساعات'},
            {'hours': 12, 'price': 199, 'description': '12 ساعة'},
            {'hours': 24, 'price': 275, 'description': '24 ساعة (يوم كامل)'},
            {'hours': 48, 'price': 399, 'description': '48 ساعة (يومين)'},
            {'hours': 168, 'price': 999, 'description': 'أسبوع كامل'}
        ],
        'currency': 'SAR',
        'features': [
            'عرض إعلانك لجميع المستخدمين',
            'مؤقت عد تنازلي على صورتك',
            'إحصائيات مشاهدة مفصلة',
            'دعم فني كامل'
        ],
        'payment_methods': [
            {'id': 'stripe', 'name': 'بطاقة ائتمان', 'icon': '💳'},
            {'id': 'bank', 'name': 'تحويل بنكي', 'icon': '🏦'},
            {'id': 'stcpay', 'name': 'STC Pay', 'icon': '📱'}
        ]
    }