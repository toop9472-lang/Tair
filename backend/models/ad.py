from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class Ad(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    video_url: str
    thumbnail_url: str
    advertiser: str
    website_url: Optional[str] = None  # رابط موقع المعلن
    duration: int  # seconds
    points_per_minute: int = 1
    is_active: bool = True
    ad_type: str = 'global'  # 'local' for personal ads, 'global' for wide reach
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class AdCreate(BaseModel):
    title: str
    description: str
    video_url: str
    thumbnail_url: str
    advertiser: str
    website_url: Optional[str] = None
    duration: int
    points_per_minute: int = 1
    ad_type: str = 'global'

class AdResponse(BaseModel):
    id: str
    title: str
    description: str
    video_url: str
    thumbnail_url: str
    advertiser: str
    website_url: Optional[str] = None
    duration: int
    points: int
    ad_type: str = 'global'

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }