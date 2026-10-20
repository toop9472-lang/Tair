"""طير — Auction models"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class AuctionCreate(BaseModel):
    """Direct create (admin-only path)."""
    title: str
    description: Optional[str] = ""
    images: List[str] = []
    starting_price_sar: float = Field(default=1, ge=1)
    min_increment_sar: float = Field(default=10, gt=0)
    end_at: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = "birds"
    # Bird-specific fields
    gender: Optional[str] = None   # ذكر | أنثى | زوج | غير محدد
    age_months: Optional[int] = None
    species: Optional[str] = None  # النوع (كناري، بادجي، زيبرا...)
    breed: Optional[str] = None    # السلالة


class AuctionSubmit(BaseModel):
    """Seller submission — subject to admin approval."""
    title: str
    description: str = Field(min_length=10, description="وصف واضح")
    images: List[str] = Field(default_factory=list)
    starting_price_sar: float = Field(default=1, ge=1)
    gender: str = Field(min_length=1, description="الجنس مطلوب")
    age_months: int = Field(ge=0)
    species: str = Field(min_length=1, description="النوع مطلوب")
    breed: Optional[str] = ""
    city: Optional[str] = None
    category: Optional[str] = "birds"


class BidCreate(BaseModel):
    amount_sar: float = Field(gt=0)


class AuctionSettingsUpdate(BaseModel):
    daily_limit: Optional[int] = Field(default=None, ge=1, le=100)
    min_increment_sar: Optional[float] = Field(default=None, gt=0)
    starting_price_floor: Optional[float] = Field(default=None, ge=1)
    open_hour: Optional[int] = Field(default=None, ge=0, le=23)
    close_hour: Optional[int] = Field(default=None, ge=1, le=24)


class AuctionResponse(BaseModel):
    auction_id: str
    sequence_number: Optional[int] = None
    seller_id: str
    seller_name: Optional[str] = None
    title: str
    description: Optional[str] = ""
    images: List[str] = []
    starting_price_sar: float
    current_bid_sar: float
    highest_bidder_id: Optional[str] = None
    highest_bidder_name: Optional[str] = None
    min_increment_sar: float
    start_at: str
    end_at: str
    status: str  # pending_review | approved | scheduled | live | closed | cancelled | rejected
    created_at: str
    city: Optional[str] = None
    category: Optional[str] = None
    gender: Optional[str] = None
    age_months: Optional[int] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    bids_count: int = 0
