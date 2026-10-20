"""طير — Listing Comments model (public replies under each listing)."""
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


class ListingComment(BaseModel):
    comment_id: str
    listing_id: str
    author_id: str
    author_name: Optional[str] = None
    body: str
    likes_count: int = 0
    liked_by: List[str] = []
    created_at: datetime = Field(default_factory=_now)


class ListingCommentCreate(BaseModel):
    body: str
    author_name: Optional[str] = None
