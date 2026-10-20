"""طير — Chat / Direct Messages models."""
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


class ChatThread(BaseModel):
    thread_id: str
    participants: List[str]                # 2 user_ids
    listing_id: Optional[str] = None       # optional context
    listing_title: Optional[str] = None
    listing_image: Optional[str] = None
    last_message: Optional[str] = None
    last_sender_id: Optional[str] = None
    unread_by: List[str] = []              # user_ids with unread messages
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class ChatMessage(BaseModel):
    msg_id: str
    thread_id: str
    sender_id: str
    sender_name: Optional[str] = None
    body: str
    created_at: datetime = Field(default_factory=_now)


class ChatStartRequest(BaseModel):
    peer_id: str
    listing_id: Optional[str] = None
    listing_title: Optional[str] = None
    listing_image: Optional[str] = None
    initial_message: Optional[str] = None


class ChatSendRequest(BaseModel):
    body: str
    sender_name: Optional[str] = None
