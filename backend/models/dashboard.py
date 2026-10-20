from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DashboardStats(BaseModel):
    total_users: int = 0
    total_ads: int = 0
    active_ads: int = 0
    pending_ads: int = 0
    total_withdrawals: int = 0
    pending_withdrawals: int = 0
    approved_withdrawals: int = 0
    total_revenue: float = 0.0
    total_payouts: float = 0.0
    net_profit: float = 0.0
    
class FinancialReport(BaseModel):
    period: str  # 'daily', 'weekly', 'monthly'
    start_date: datetime
    end_date: datetime
    revenue_from_ads: float
    payouts_to_users: float
    profit: float
    total_points_awarded: int
    total_ad_views: int