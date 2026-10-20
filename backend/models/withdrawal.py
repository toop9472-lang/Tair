from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

class WithdrawalDetails(BaseModel):
    email: Optional[str] = None  # PayPal
    phone: Optional[str] = None  # STC Pay
    bank_name: Optional[str] = None  # Bank transfer
    account_name: Optional[str] = None
    iban: Optional[str] = None

class Withdrawal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float  # in dollars
    points: int  # points deducted (amount * 500)
    method: str  # 'paypal', 'stcpay', 'bank'
    method_name: str
    details: Dict[str, Any]
    status: str = 'pending'  # 'pending', 'approved', 'rejected'
    admin_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class WithdrawalCreate(BaseModel):
    amount: float
    method: str
    method_name: str
    details: Dict[str, Any]

class WithdrawalResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    points: int
    method: str
    method_name: str
    details: Dict[str, Any]
    status: str
    created_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }