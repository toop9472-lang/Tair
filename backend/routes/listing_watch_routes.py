"""طلبات التنبيه في الحساب: طائر، وسعر أقصى اختياري."""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from auth.actor import require_actor
from services.listing_watch import norm, parse_price

router = APIRouter(prefix="/listing-watches", tags=["Tair-Listing-Watches"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

MAX_WATCHES = 8


def _now():
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("notified_ids", None)
    for key in ("created_at", "updated_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    return doc


class WatchIn(BaseModel):
    bird: str
    max_price: Optional[str] = None
    active: bool = True


class WatchPatch(BaseModel):
    bird: Optional[str] = None
    max_price: Optional[str] = None
    active: Optional[bool] = None
    clear_price: bool = False


def _clean_bird(raw: str) -> str:
    bird = " ".join(str(raw or "").split())
    if len(bird) < 2:
        raise HTTPException(400, "اكتب اسم الطائر، حرفين على الأقل")
    if len(bird) > 40:
        raise HTTPException(400, "اسم الطائر طويل")
    return bird


@router.get("")
async def list_watches(user_id: str = Query(...), actor: str = Depends(require_actor)):
    cursor = db.tair_listing_watches.find({"user_id": actor}).sort("created_at", -1)
    items = [_serialize(doc) async for doc in cursor]
    return {"items": items}


@router.post("")
async def create_watch(payload: WatchIn, user_id: str = Query(...), actor: str = Depends(require_actor)):
    count = await db.tair_listing_watches.count_documents({"user_id": actor})
    if count >= MAX_WATCHES:
        raise HTTPException(400, "يمكنك حفظ ثمانية طلبات. أوقف طلباً قديماً أو احذفه")
    bird = _clean_bird(payload.bird)
    price = parse_price(payload.max_price)
    if payload.max_price not in (None, "") and price is None:
        raise HTTPException(400, "السعر غير واضح")
    now = _now()
    doc = {
        "watch_id": f"w_{uuid.uuid4().hex[:12]}",
        "user_id": actor,
        "bird": bird,
        "bird_norm": norm(bird),
        "max_price": price,
        "active": bool(payload.active),
        "notified_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.tair_listing_watches.insert_one(doc.copy())
    return _serialize(doc)


@router.patch("/{watch_id}")
async def update_watch(
    watch_id: str,
    payload: WatchPatch,
    user_id: str = Query(...),
    actor: str = Depends(require_actor),
):
    doc = await db.tair_listing_watches.find_one({"watch_id": watch_id, "user_id": actor})
    if not doc:
        raise HTTPException(404, "الطلب غير موجود")
    updates = {"updated_at": _now()}
    reset_sent = False
    if payload.bird is not None:
        bird = _clean_bird(payload.bird)
        updates["bird"] = bird
        updates["bird_norm"] = norm(bird)
        reset_sent = True
    if payload.clear_price:
        updates["max_price"] = None
        reset_sent = True
    elif payload.max_price is not None:
        price = parse_price(payload.max_price)
        if payload.max_price != "" and price is None:
            raise HTTPException(400, "السعر غير واضح")
        updates["max_price"] = price
        reset_sent = True
    if payload.active is not None:
        updates["active"] = bool(payload.active)
    if reset_sent:
        updates["notified_ids"] = []
    await db.tair_listing_watches.update_one({"watch_id": watch_id}, {"$set": updates})
    fresh = await db.tair_listing_watches.find_one({"watch_id": watch_id})
    return _serialize(fresh)


@router.delete("/{watch_id}")
async def delete_watch(watch_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    result = await db.tair_listing_watches.delete_one({"watch_id": watch_id, "user_id": actor})
    if not result.deleted_count:
        raise HTTPException(404, "الطلب غير موجود")
    return {"success": True}
