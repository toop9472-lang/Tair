"""طير — Trust & Safety: user reports, blocks, ratings, disputes.

All endpoints are lightweight and idempotent. Auth is passed as `user_id` query param
consistent with the rest of the Tair marketplace routes.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

router = APIRouter(prefix="/trust", tags=["Tair-TrustSafety"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_client = AsyncIOMotorClient(mongo_url)
_db = _client[os.environ.get("DB_NAME", "saqr_db")]


def _now():
    return datetime.now(timezone.utc)


# ============================================================================
#  User Reports
# ============================================================================
REPORT_REASONS = {
    "fraud": "احتيال",
    "fake_listing": "إعلان مزيّف",
    "harassment": "إساءة أو تحرّش",
    "prohibited_animal": "حيوان محظور بيعه",
    "spam": "رسائل مزعجة",
    "other": "أخرى",
}


class ReportUserPayload(BaseModel):
    reason: str = Field(..., description="key from REPORT_REASONS")
    note: Optional[str] = None
    context_id: Optional[str] = None  # listing_id / trip_id / thread_id


@router.post("/report-user/{reported_user_id}")
async def report_user(
    reported_user_id: str,
    payload: ReportUserPayload,
    reporter_id: str = Query(...),
):
    if reporter_id == reported_user_id:
        raise HTTPException(400, "لا يمكن الإبلاغ عن نفسك")
    if payload.reason not in REPORT_REASONS:
        raise HTTPException(400, "سبب الإبلاغ غير معروف")
    doc = {
        "report_id": f"rpt_{uuid.uuid4().hex[:12]}",
        "reporter_id": reporter_id,
        "reported_user_id": reported_user_id,
        "reason": payload.reason,
        "reason_ar": REPORT_REASONS[payload.reason],
        "note": (payload.note or "").strip()[:500],
        "context_id": payload.context_id,
        "status": "open",
        "created_at": _now(),
    }
    await _db.tair_user_reports.insert_one(doc)
    return {"success": True, "report_id": doc["report_id"]}


@router.get("/report-reasons")
async def list_report_reasons():
    return [{"key": k, "label": v} for k, v in REPORT_REASONS.items()]


# ============================================================================
#  User Blocks
# ============================================================================
@router.post("/block/{blocked_user_id}")
async def block_user(blocked_user_id: str, blocker_id: str = Query(...)):
    if blocker_id == blocked_user_id:
        raise HTTPException(400, "لا يمكنك حظر نفسك")
    await _db.tair_user_blocks.update_one(
        {"blocker_id": blocker_id, "blocked_id": blocked_user_id},
        {"$set": {"blocker_id": blocker_id, "blocked_id": blocked_user_id, "created_at": _now()}},
        upsert=True,
    )
    return {"success": True}


@router.post("/unblock/{blocked_user_id}")
async def unblock_user(blocked_user_id: str, blocker_id: str = Query(...)):
    await _db.tair_user_blocks.delete_one({"blocker_id": blocker_id, "blocked_id": blocked_user_id})
    return {"success": True}


@router.get("/blocks")
async def my_blocks(user_id: str = Query(...)):
    cur = _db.tair_user_blocks.find({"blocker_id": user_id})
    items = [doc async for doc in cur]
    for it in items:
        it["_id"] = str(it["_id"])
        if isinstance(it.get("created_at"), datetime):
            it["created_at"] = it["created_at"].isoformat()
    return {"items": items, "total": len(items)}


# ============================================================================
#  Ratings (seller / carrier)
# ============================================================================
class RatingPayload(BaseModel):
    stars: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    role: str = Field(..., description="'seller' | 'carrier'")
    order_id: Optional[str] = None


@router.post("/rate/{target_user_id}")
async def rate_user(
    target_user_id: str,
    payload: RatingPayload,
    rater_id: str = Query(...),
):
    if rater_id == target_user_id:
        raise HTTPException(400, "لا يمكن تقييم نفسك")
    if payload.role not in ("seller", "carrier"):
        raise HTTPException(400, "الدور غير معروف")
    doc = {
        "rating_id": f"rt_{uuid.uuid4().hex[:12]}",
        "rater_id": rater_id,
        "target_id": target_user_id,
        "stars": payload.stars,
        "comment": (payload.comment or "").strip()[:400],
        "role": payload.role,
        "order_id": payload.order_id,
        "created_at": _now(),
    }
    try:
        await _db.tair_ratings.update_one(
            {"rater_id": rater_id, "target_id": target_user_id},
            {"$set": doc},
            upsert=True,
        )
    except Exception as e:
        raise HTTPException(400, f"تعذّر حفظ التقييم: {e}")

    # Recompute aggregate on user
    pipeline = [
        {"$match": {"target_id": target_user_id}},
        {"$group": {"_id": "$target_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    agg = await _db.tair_ratings.aggregate(pipeline).to_list(1)
    if agg:
        await _db.users.update_one(
            {"$or": [{"id": target_user_id}, {"user_id": target_user_id}]},
            {"$set": {
                "rating_avg": round(agg[0]["avg"], 2),
                "rating_count": agg[0]["count"],
            }},
        )
    return {"success": True, "rating_id": doc["rating_id"]}


@router.get("/ratings/{target_user_id}")
async def get_ratings(target_user_id: str, limit: int = 30):
    cur = _db.tair_ratings.find({"target_id": target_user_id}).sort("created_at", -1).limit(limit)
    items = []
    async for it in cur:
        it["_id"] = str(it["_id"])
        if isinstance(it.get("created_at"), datetime):
            it["created_at"] = it["created_at"].isoformat()
        items.append(it)
    pipeline = [
        {"$match": {"target_id": target_user_id}},
        {"$group": {"_id": "$target_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    agg = await _db.tair_ratings.aggregate(pipeline).to_list(1)
    summary = {"avg": round(agg[0]["avg"], 2), "count": agg[0]["count"]} if agg else {"avg": 0.0, "count": 0}
    return {"items": items, "summary": summary}


# ============================================================================
#  Disputes on Orders
# ============================================================================
class DisputePayload(BaseModel):
    reason: str = Field(..., min_length=5)
    role: str = Field(..., description="'buyer' | 'seller' | 'carrier'")


@router.post("/orders/{order_id}/dispute")
async def open_dispute(
    order_id: str,
    payload: DisputePayload,
    user_id: str = Query(...),
):
    order = await _db.tair_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(404, "الطلب غير موجود")
    if user_id not in (order.get("buyer_id"), order.get("seller_id"), order.get("carrier_id")):
        raise HTTPException(403, "لست طرفاً في هذا الطلب")

    dispute = {
        "dispute_id": f"disp_{uuid.uuid4().hex[:10]}",
        "order_id": order_id,
        "opened_by": user_id,
        "role": payload.role,
        "reason": payload.reason.strip()[:1000],
        "status": "open",
        "created_at": _now(),
    }
    await _db.tair_disputes.insert_one(dispute)
    await _db.tair_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "disputed", "dispute_id": dispute["dispute_id"], "updated_at": _now()}},
    )
    # Notify all parties via existing notification helper (fire and forget)
    try:
        from routes.tair_notifications_routes import create_tair_notification
        for uid in filter(None, [order.get("buyer_id"), order.get("seller_id"), order.get("carrier_id")]):
            if uid == user_id:
                continue
            await create_tair_notification(
                user_id=uid,
                title="فُتِح نزاع على طلبك",
                body="راجع تفاصيل الطلب وردّ على النزاع في أسرع وقت.",
                notif_type="order_disputed",
                data={"order_id": order_id, "dispute_id": dispute["dispute_id"]},
            )
    except Exception:
        pass
    return {"success": True, "dispute_id": dispute["dispute_id"]}


@router.get("/orders/{order_id}/dispute")
async def get_dispute(order_id: str):
    d = await _db.tair_disputes.find_one({"order_id": order_id})
    if not d:
        return {"dispute": None}
    d["_id"] = str(d["_id"])
    if isinstance(d.get("created_at"), datetime):
        d["created_at"] = d["created_at"].isoformat()
    return {"dispute": d}
