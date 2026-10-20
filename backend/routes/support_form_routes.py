# Support Form Routes - Handle support requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/support", tags=["Support"])

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'saqr_db')]

class SupportRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str

class SupportResponse(BaseModel):
    success: bool
    message: str
    ticket_id: str = None

@router.post("/submit", response_model=SupportResponse)
async def submit_support_request(request: SupportRequest):
    """Submit a support request"""
    try:
        # Create support ticket
        ticket = {
            "name": request.name,
            "email": request.email,
            "subject": request.subject,
            "message": request.message,
            "status": "open",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        result = await db.support_tickets.insert_one(ticket)
        ticket_id = str(result.inserted_id)
        
        return SupportResponse(
            success=True,
            message="تم إرسال طلب الدعم بنجاح. سنتواصل معك قريباً.",
            ticket_id=ticket_id
        )
        
    except Exception as e:
        print(f"Support submit error: {e}")
        raise HTTPException(status_code=500, detail="حدث خطأ أثناء إرسال الطلب")

@router.get("/tickets")
async def get_support_tickets(email: str = None, status: str = None):
    """Get support tickets (admin only)"""
    try:
        query = {}
        if email:
            query["email"] = email
        if status:
            query["status"] = status
            
        tickets = await db.support_tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        return {"tickets": tickets}
        
    except Exception as e:
        print(f"Get tickets error: {e}")
        return {"tickets": []}

@router.put("/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, status: str):
    """Update ticket status (admin only)"""
    try:
        from bson import ObjectId
        result = await db.support_tickets.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$set": {
                    "status": status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.modified_count:
            return {"success": True, "message": "تم تحديث حالة التذكرة"}
        return {"success": False, "message": "لم يتم العثور على التذكرة"}
        
    except Exception as e:
        print(f"Update ticket error: {e}")
        raise HTTPException(status_code=500, detail="حدث خطأ")
