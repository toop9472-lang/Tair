from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta
import uuid

class AdvertiserPayment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    advertiser_id: str
    ad_id: str
    amount: float  # in SAR
    currency: str = 'SAR'
    status: str = 'pending'  # 'pending', 'paid', 'failed'
    payment_method: Optional[str] = None
    payment_proof: Optional[str] = None  # URL to payment screenshot/receipt
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class AdvertiserAd(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    advertiser_id: str
    advertiser_name: str
    advertiser_email: str
    advertiser_phone: Optional[str] = None
    
    # Ad details
    title: str
    description: str
    video_url: str
    website_url: Optional[str] = None  # Optional landing URL displayed below video in the viewer
    thumbnail_url: Optional[str] = None
    duration: int = 60  # seconds
    ad_type: str = 'local'  # 'local' for personal ads, 'global' for wide reach
    
    # Pricing - Hourly based
    price: float = 79.0  # SAR
    duration_hours: int = 1  # Default 1 hour
    
    # Boost (rocket) — paid one-time uplift, NOT a renewal
    boosted_at: Optional[datetime] = None
    boost_paid: bool = False
    
    # Status
    status: str = 'pending'  # 'pending', 'approved', 'rejected', 'active', 'expired'
    is_active: bool = False
    admin_note: Optional[str] = None
    
    # Dates
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    expires_at: Optional[str] = None  # ISO string for countdown timer
    
    # Payment
    payment_id: Optional[str] = None
    payment_status: str = 'pending'

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class AdvertiserAdCreate(BaseModel):
    advertiser_name: str
    advertiser_email: str
    advertiser_phone: Optional[str] = None
    title: str
    description: str
    video_url: str
    website_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: int = 60
    duration_hours: int = 1
    ad_type: str = 'local'

class AdvertiserAdResponse(BaseModel):
    id: str
    advertiser_name: str
    title: str
    description: str
    video_url: str
    website_url: Optional[str] = None
    thumbnail_url: Optional[str]
    duration: int
    price: float
    duration_hours: int
    status: str
    payment_status: str
    created_at: datetime
    expires_at: Optional[str]
    ad_type: str = 'local'
    boosted_at: Optional[datetime] = None
    boost_paid: bool = False

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }