"""طير — Ratings API routes."""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient

from models.rating import Rating, RatingCreate

router = APIRouter(prefix="/ratings", tags=["Tair-Ratings"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _now():
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    v = doc.get("created_at")
    if isinstance(v, datetime):
        doc["created_at"] = v.isoformat()
    return doc


async def _recompute_avg(user_id: str, role: str):
    pipeline = [
        {"$match": {"rated_id": user_id, "rated_role": role}},
        {
            "$group": {
                "_id": None,
                "avg": {"$avg": "$stars"},
                "count": {"$sum": 1},
            }
        },
    ]
    result = await db.tair_ratings.aggregate(pipeline).to_list(1)
    avg = round(result[0]["avg"], 2) if result else 0.0
    count = result[0]["count"] if result else 0

    profile_key = "seller_profile" if role == "seller" else "carrier_profile"
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                f"{profile_key}.rating_avg": avg,
                f"{profile_key}.rating_count": count,
            }
        },
    )
    return avg, count


@router.post("/create")
async def create_rating(payload: RatingCreate, user_id: str = Query(...)):
    order = await db.tair_orders.find_one({"order_id": payload.order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if user_id not in {order.get("buyer_id"), order.get("seller_id"), order.get("carrier_id")}:
        raise HTTPException(403, "Not part of this order")
    if order.get("status") != "completed":
        raise HTTPException(400, "Order must be completed before rating")

    # Prevent duplicate ratings by role.
    role_flag = {
        "seller": "seller_rated",
        "carrier": "carrier_rated",
        "buyer": "buyer_rated",
    }[payload.rated_role]
    if order.get(role_flag):
        raise HTTPException(400, "Already rated")

    rating_id = f"rat_{uuid.uuid4().hex[:12]}"
    rating = Rating(
        rating_id=rating_id,
        rater_id=user_id,
        **payload.model_dump(),
    )
    doc = rating.model_dump()
    await db.tair_ratings.insert_one(doc)

    # Mark order side as rated.
    await db.tair_orders.update_one(
        {"order_id": payload.order_id}, {"$set": {role_flag: True}}
    )

    # Recompute average for the rated user.
    avg, count = await _recompute_avg(payload.rated_id, payload.rated_role)

    return {
        "rating": _serialize(doc),
        "user_rating_avg": avg,
        "user_rating_count": count,
    }


@router.get("/user/{user_id}")
async def ratings_for_user(user_id: str, role: Optional[str] = None):
    query: dict = {"rated_id": user_id}
    if role:
        query["rated_role"] = role
    cursor = db.tair_ratings.find(query).sort("created_at", -1)
    docs = await cursor.to_list(200)
    items = [_serialize(d) for d in docs]
    return {"items": items, "total": len(items)}


# ==================== Direct Seller Rating (No Order Required) ====================
from pydantic import BaseModel, Field  # noqa: E402


class DirectRating(BaseModel):
    rated_id: str = Field(min_length=1)
    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default="", max_length=500)


@router.post("/seller/rate")
async def rate_seller_direct(payload: DirectRating, user_id: str = Query(...)):
    """أي مستخدم يقدر يقيّم أي بائع (لا يشترط طلب مكتمل)."""
    if user_id == payload.rated_id:
        raise HTTPException(400, "لا يمكنك تقييم نفسك")
    # Prevent duplicate rating from same rater to same seller — allow update instead
    existing = await db.tair_ratings.find_one({
        "rater_id": user_id,
        "rated_id": payload.rated_id,
        "rated_role": "seller",
        "order_id": {"$in": [None, "", "direct"]},
    })
    now = _now()
    if existing:
        await db.tair_ratings.update_one(
            {"_id": existing["_id"]},
            {"$set": {"stars": payload.stars, "comment": payload.comment or "", "created_at": now}},
        )
        rating_id = existing.get("rating_id")
    else:
        rating_id = f"rat_{uuid.uuid4().hex[:12]}"
        await db.tair_ratings.insert_one({
            "rating_id": rating_id,
            "rater_id": user_id,
            "rated_id": payload.rated_id,
            "rated_role": "seller",
            "order_id": "direct",
            "stars": payload.stars,
            "comment": payload.comment or "",
            "created_at": now,
        })
    avg, count = await _recompute_avg(payload.rated_id, "seller")
    return {"success": True, "rating_id": rating_id, "avg": avg, "count": count}


@router.get("/seller/{seller_id}/summary")
async def seller_rating_summary(seller_id: str):
    pipeline = [
        {"$match": {"rated_id": seller_id, "rated_role": "seller"}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    r = await db.tair_ratings.aggregate(pipeline).to_list(1)
    return {"avg": round(r[0]["avg"], 2) if r else 0.0, "count": r[0]["count"] if r else 0}

