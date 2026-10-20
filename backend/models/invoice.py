"""
Invoice Model - Auto-generated invoices for advertisers
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class InvoiceStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class InvoiceItem(BaseModel):
    description: str
    quantity: int = 1
    unit_price: float
    total: float


class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str  # e.g., "INV-2025-0001"
    
    # Advertiser Info
    advertiser_email: str
    advertiser_name: str
    advertiser_phone: Optional[str] = None
    advertiser_company: Optional[str] = None
    
    # Ad Info
    ad_id: str
    ad_title: str
    
    # Invoice Details
    items: List[InvoiceItem]
    subtotal: float
    tax_rate: float = 0.15  # 15% VAT in Saudi Arabia
    tax_amount: float
    total: float
    currency: str = "SAR"
    
    # Payment Info
    payment_method: Optional[str] = None  # stripe, tap
    payment_id: Optional[str] = None
    status: InvoiceStatus = InvoiceStatus.PENDING
    
    # Dates
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    
    # Notes
    notes: Optional[str] = None


class InvoiceCreate(BaseModel):
    advertiser_email: str
    advertiser_name: str
    advertiser_phone: Optional[str] = None
    advertiser_company: Optional[str] = None
    ad_id: str
    ad_title: str
    package_name: str
    package_price: float
    duration_months: int
