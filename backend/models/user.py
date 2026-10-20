from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
import uuid

class WatchedAd(BaseModel):
    ad_id: str
    watched_at: datetime = Field(default_factory=datetime.utcnow)
    watch_time: int  # seconds
    points_earned: int

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    avatar: Optional[str] = None
    provider: str  # 'google' or 'apple'
    provider_id: str
    points: int = 0
    total_earned: int = 0
    watched_ads: List[WatchedAd] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    avatar: Optional[str] = None
    provider: str
    provider_id: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar: Optional[str]
    points: int
    total_earned: int
    watched_ads: List[WatchedAd]
    created_at: datetime
    joined_date: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }