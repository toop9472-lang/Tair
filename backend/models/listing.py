"""طير — Listing (bird/pet ad) model."""
from datetime import datetime, timezone, timedelta
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


def _expires():
    return datetime.now(timezone.utc) + timedelta(days=60)


class ListingHealth(BaseModel):
    status: Literal["excellent", "good", "needs_care", "special_needs"] = "good"
    vaccinated: bool = False
    ring_number: Optional[str] = None
    documents: List[str] = []
    notes: Optional[str] = None


class Listing(BaseModel):
    listing_id: str
    seller_id: str

    title: str
    category: str = "birds"          # broad category (birds, mammals, livestock, supplies, services, ...)
    family: Optional[str] = None     # taxonomic/product family (parrots, cats, feed, ...)
    species: Optional[str] = None    # optional canonical species id from species catalog
    breed: Optional[str] = None
    gender: Literal["male", "female", "pair", "unknown"] = "unknown"
    age_months: Optional[int] = None
    color: Optional[str] = None
    description: str

    health: ListingHealth = Field(default_factory=ListingHealth)

    images: List[str] = []
    videos: List[str] = []
    cover_image: Optional[str] = None

    price_sar: float
    price_negotiable: bool = True
    city: str
    district: Optional[str] = None

    status: Literal["active", "paused", "sold", "removed", "reported"] = "active"
    view_count: int = 0
    favorite_count: int = 0
    comments_count: int = 0
    report_count: int = 0
    is_flagged: bool = False
    moderation_notes: Optional[str] = None

    # Contact (optional — for WhatsApp deep-link)
    seller_name: Optional[str] = None
    seller_phone: Optional[str] = None

    # Timestamps
    posted_at: datetime = Field(default_factory=_now)
    expires_at: datetime = Field(default_factory=_expires)
    sold_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=_now)


class ListingUpdate(BaseModel):
    """Partial update — all fields optional."""
    title: Optional[str] = None
    description: Optional[str] = None
    price_sar: Optional[float] = None
    price_negotiable: Optional[bool] = None
    images: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    cover_image: Optional[str] = None
    status: Optional[Literal["active", "paused", "sold", "removed"]] = None
    health: Optional[ListingHealth] = None


class ListingCreate(BaseModel):
    title: str
    category: str = "birds"
    family: Optional[str] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    gender: Literal["male", "female", "pair", "unknown"] = "unknown"
    age_months: Optional[int] = None
    color: Optional[str] = None
    description: str
    health: ListingHealth = Field(default_factory=ListingHealth)
    images: List[str] = []
    videos: List[str] = []
    cover_image: Optional[str] = None
    # Accept None from mobile (empty price field) and validate below with a
    # clear Arabic error instead of a bare 422.
    price_sar: Optional[float] = None
    price_negotiable: bool = True
    city: str
    district: Optional[str] = None
    seller_name: Optional[str] = None
    seller_phone: Optional[str] = None
