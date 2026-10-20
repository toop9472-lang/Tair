"""طير — Report model (safety & compliance)."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


class TairReport(BaseModel):
    report_id: str
    reporter_id: str

    target_type: Literal["listing", "user", "trip", "order"]
    target_id: str

    reason: Literal[
        "prohibited_species",
        "fake_listing",
        "scam",
        "abuse",
        "spam",
        "wrong_category",
        "other",
    ]
    details: Optional[str] = None
    attachments: List[str] = []

    status: Literal["open", "reviewing", "resolved", "dismissed"] = "open"
    admin_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None

    created_at: datetime = Field(default_factory=_now)


class TairReportCreate(BaseModel):
    target_type: Literal["listing", "user", "trip", "order"]
    target_id: str
    reason: Literal[
        "prohibited_species",
        "fake_listing",
        "scam",
        "abuse",
        "spam",
        "wrong_category",
        "other",
    ]
    details: Optional[str] = None
    attachments: List[str] = []
