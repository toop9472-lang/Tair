"""طير — Reports API (safety & compliance)."""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient

from auth.jwt_handler import get_user_id_from_token
from models.tair_report import TairReport, TairReportCreate
from services.moderation import moderator_scopes

router = APIRouter(prefix="/tair-reports", tags=["Tair-Reports"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _now():
    return datetime.now(timezone.utc)


_bearer = HTTPBearer(auto_error=False)


async def _actor(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    user_id: Optional[str] = Query(None),
) -> str:
    if credentials and credentials.credentials:
        token_uid = get_user_id_from_token(credentials.credentials)
        if token_uid:
            return token_uid
    if user_id:
        return user_id
    raise HTTPException(401, "غير مصرح")


async def _can_review(user_id: str) -> bool:
    admin = await db.admins.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1},
    )
    if admin:
        return True
    user = await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "is_admin": 1, "role": 1},
    )
    if user and (user.get("is_admin") or user.get("role") in ("admin", "super_admin")):
        return True
    return bool(await moderator_scopes(db, user_id))


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for k in ("created_at", "resolved_at"):
        v = doc.get(k)
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


@router.post("/create")
async def create_report(payload: TairReportCreate, user_id: str = Query(...)):
    report_id = f"rep_{uuid.uuid4().hex[:12]}"
    rep = TairReport(
        report_id=report_id,
        reporter_id=user_id,
        **payload.model_dump(),
    )
    doc = rep.model_dump()
    await db.tair_reports.insert_one(doc)

    # Auto-increment target counts atomically.
    if payload.target_type == "listing":
        updated = await db.listings.find_one_and_update(
            {"listing_id": payload.target_id},
            {"$inc": {"report_count": 1}},
            return_document=True,  # return post-update doc
            projection={"_id": 0, "report_count": 1, "is_flagged": 1},
        )
        if (
            updated
            and (updated.get("report_count") or 0) >= 3
            and not updated.get("is_flagged")
        ):
            await db.listings.update_one(
                {"listing_id": payload.target_id, "is_flagged": {"$ne": True}},
                {
                    "$set": {
                        "is_flagged": True,
                        "moderation_notes": "Auto-flag: 3+ reports",
                    }
                },
            )

    return _serialize(doc)


@router.get("/list")
async def list_reports(status: Optional[str] = "open", user_id: str = Depends(_actor)):
    if not await _can_review(user_id):
        raise HTTPException(403, "غير مصرح")

    query: dict = {}
    if status and status != "all":
        query["status"] = status
    cursor = db.tair_reports.find(query).sort("created_at", -1)
    docs = await cursor.to_list(500)
    items = [_serialize(d) for d in docs]
    return {"items": items, "total": len(items)}


@router.patch("/{report_id}/resolve")
async def resolve_report(
    report_id: str,
    resolution: str = Query("resolved"),
    user_id: str = Depends(_actor),
    notes: Optional[str] = None,
):
    if not await _can_review(user_id):
        raise HTTPException(403, "غير مصرح")

    if resolution not in {"resolved", "dismissed"}:
        raise HTTPException(400, "Invalid resolution")

    await db.tair_reports.update_one(
        {"report_id": report_id},
        {
            "$set": {
                "status": resolution,
                "admin_notes": notes,
                "resolved_at": _now(),
                "resolved_by": user_id,
            }
        },
    )
    return {"success": True, "report_id": report_id, "status": resolution}
