"""
Push Notifications Model
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid


class DeviceToken(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    token: str  # FCM or Expo push token
    platform: str  # 'ios', 'android', 'web'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    body: str
    data: Optional[dict] = None
    notification_type: str  # 'withdrawal_approved', 'new_ad', 'points_milestone'
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationCreate(BaseModel):
    title: str
    body: str
    data: Optional[dict] = None
    notification_type: str


class DeviceTokenCreate(BaseModel):
    token: str
    platform: str
