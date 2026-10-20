"""طير — Trip (delivery route) model."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


TripStatus = Literal[
    "scheduled", "departed", "in_transit", "arrived", "completed", "cancelled"
]


class TripStatusEvent(BaseModel):
    status: TripStatus
    at: datetime = Field(default_factory=_now)
    note: Optional[str] = None


class Trip(BaseModel):
    trip_id: str
    carrier_id: str
    # Carrier display snapshot (denormalized for feed convenience)
    carrier_name: Optional[str] = None
    carrier_phone: Optional[str] = None      # WhatsApp/tel — visible only when carrier consents
    carrier_avatar: Optional[str] = None
    carrier_rating_avg: Optional[float] = None
    carrier_trips_completed: int = 0

    # route
    from_city: str
    from_district: Optional[str] = None
    to_city: str
    to_district: Optional[str] = None
    waypoints: List[str] = []                # ordered list of stopover cities
    is_direct: bool = False                  # true = non-stop

    # timing
    depart_at: datetime
    eta_at: Optional[datetime] = None

    # vehicle
    vehicle_type: str = "سيدان"
    has_ac: bool = True
    total_cages: int = 4
    available_cages: int = 4
    accepts_sensitive: bool = True

    # meta
    notes: Optional[str] = None
    price_hint_sar: Optional[float] = None

    status: TripStatus = "scheduled"
    status_updates: List[TripStatusEvent] = []

    bookings_count: int = 0
    bookings_ids: List[str] = []
    bookings: List[dict] = []

    live_lat: Optional[float] = None
    live_lng: Optional[float] = None
    live_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class TripCreate(BaseModel):
    from_city: str
    from_district: Optional[str] = None
    to_city: str
    to_district: Optional[str] = None
    waypoints: List[str] = []
    is_direct: bool = False
    depart_at: datetime
    eta_at: Optional[datetime] = None
    vehicle_type: str = "سيدان"
    has_ac: bool = True
    total_cages: int = 4
    accepts_sensitive: bool = True
    notes: Optional[str] = None
    price_hint_sar: Optional[float] = None
    # Optional carrier contact + display
    carrier_name: Optional[str] = None
    carrier_phone: Optional[str] = None
    carrier_avatar: Optional[str] = None


class TripStatusUpdate(BaseModel):
    status: TripStatus
    note: Optional[str] = None
    motion: Optional[Literal["stopped", "moving", "arrived"]] = None
    stop_index: Optional[int] = None


class TripLocationUpdate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


RequestStatus = Literal["pending", "accepted", "in_progress", "completed", "cancelled"]


class RequestStatusEvent(BaseModel):
    status: RequestStatus
    at: datetime = Field(default_factory=_now)
    note: Optional[str] = None


class TripRequest(BaseModel):
    request_id: str
    requester_id: str
    requester_name: Optional[str] = None
    from_city: str
    to_city: str
    depart_on: str
    details: Optional[str] = None
    contact_phone: Optional[str] = None
    status: RequestStatus = "pending"
    status_updates: List[RequestStatusEvent] = []
    accepted_by: Optional[str] = None
    accepted_name: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class TripRequestCreate(BaseModel):
    from_city: str
    to_city: str
    depart_on: str
    details: Optional[str] = None
    contact_phone: Optional[str] = None
    requester_name: Optional[str] = None


class TripRequestStatusUpdate(BaseModel):
    status: RequestStatus
    note: Optional[str] = None
