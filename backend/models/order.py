"""طير — Order model (links buyer + seller + carrier + trip)."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


OrderStatus = Literal[
    "pending",
    "accepted_by_carrier",
    "in_transit",
    "delivered",
    "completed",
    "disputed",
    "cancelled",
]


class OrderItem(BaseModel):
    listing_id: str
    quantity: int = 1
    agreed_price_sar: float


class OrderStatusEvent(BaseModel):
    status: OrderStatus
    at: datetime = Field(default_factory=_now)
    actor_id: Optional[str] = None
    note: Optional[str] = None


class OrderDispute(BaseModel):
    reason: str
    details: Optional[str] = None
    filed_by: str
    filed_at: datetime = Field(default_factory=_now)
    resolution: Optional[str] = None
    resolved_at: Optional[datetime] = None


class Order(BaseModel):
    order_id: str

    buyer_id: str
    seller_id: str
    carrier_id: Optional[str] = None

    listing_id: str
    trip_id: Optional[str] = None

    items: List[OrderItem] = []
    agreed_price_sar: float
    delivery_fee_hint_sar: Optional[float] = None

    status: OrderStatus = "pending"
    status_history: List[OrderStatusEvent] = []

    pickup_address_hint: Optional[str] = None
    dropoff_address_hint: Optional[str] = None

    dispute: Optional[OrderDispute] = None

    buyer_rated: bool = False
    seller_rated: bool = False
    carrier_rated: bool = False

    created_at: datetime = Field(default_factory=_now)
    completed_at: Optional[datetime] = None


class OrderCreate(BaseModel):
    listing_id: str
    trip_id: Optional[str] = None
    seller_id: str
    carrier_id: Optional[str] = None
    quantity: int = 1
    agreed_price_sar: float
    delivery_fee_hint_sar: Optional[float] = None
    pickup_address_hint: Optional[str] = None
    dropoff_address_hint: Optional[str] = None
