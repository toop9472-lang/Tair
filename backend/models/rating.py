"""طير — Rating model."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


class Rating(BaseModel):
    rating_id: str
    order_id: str

    rater_id: str
    rated_id: str
    rated_role: Literal["seller", "carrier", "buyer"]

    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    tags: List[str] = []  # e.g. ["punctual", "careful", "friendly"]

    created_at: datetime = Field(default_factory=_now)


class RatingCreate(BaseModel):
    order_id: str
    rated_id: str
    rated_role: Literal["seller", "carrier", "buyer"]
    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    tags: List[str] = []
