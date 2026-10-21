"""طير — Simple in-app notifications for chat, listings, trips."""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Any, Dict

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

router = APIRouter(prefix="/tair-notifications", tags=["Tair-Notifications"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for key in ("created_at",):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    from services.notification_face import apply_face
    return apply_face(doc)


def _now():
    return datetime.now(timezone.utc)


def notification_url(notif_type: str, data: Optional[Dict[str, Any]] = None) -> str:
    """Where a closed-app tap should land. The web app reads these query keys."""
    data = data or {}
    if data.get("trip_id"):
        return f"/?trip={data['trip_id']}"
    if data.get("listing_id"):
        return f"/?listing={data['listing_id']}"
    if data.get("topic_id"):
        return f"/?topic={data['topic_id']}"
    if notif_type == "community_chat":
        return "/?tab=forum"
    if notif_type and str(notif_type).startswith("chat"):
        return "/?tab=messages"
    return "/"


async def create_tair_notification(
    user_id: str,
    title: str,
    body: str,
    notif_type: str,
    data: Optional[Dict[str, Any]] = None,
) -> dict:
    """Utility called from other routes (chat, listings) to create a notif.
    Also fires a Web Push (works even when app/browser is closed) — silent on failure."""
    from services.notification_face import notification_face
    face = notification_face(notif_type)
    push_data = {
        "type": notif_type,
        **(data or {}),
        "label": face["label"],
        "channel": face["channel"],
    }
    notif = {
        "notif_id": f"n_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "title": title,
        "body": body,
        "type": notif_type,
        "label": face["label"],
        "channel": face["channel"],
        "data": data or {},
        "is_read": False,
        "created_at": _now(),
    }
    await db.tair_notifications.insert_one(notif.copy())

    # Fire-and-forget Web Push — never break the caller
    try:
        from routes.webpush_routes import send_web_push_to_user
        await send_web_push_to_user(
            user_id=user_id,
            title=title,
            body=body,
            data=push_data,
            url=notification_url(notif_type, data),
        )
    except Exception as exc:
        print(f"[tair_notification] web push failed: {exc}")

    # Fire-and-forget Native (Expo) Push for mobile devices
    try:
        from routes.mobile_push_routes import send_push_to_user
        await send_push_to_user(
            user_id=user_id,
            title=title,
            body=body,
            data=push_data,
        )
    except Exception as exc:
        print(f"[tair_notification] native push failed: {exc}")

    return notif


async def _aliases(user_id: str) -> list:
    ids = {user_id}
    q = {"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]}
    for coll in (db.users, db.admins):
        async for d in coll.find(q, {"_id": 0, "user_id": 1, "id": 1, "email": 1}):
            ids.update(v for v in (d.get("user_id"), d.get("id"), d.get("email")) if v)
    return list(ids)


@router.get("/list")
async def list_notifications(user_id: str = Query(...), limit: int = 50):
    ids = await _aliases(user_id)
    cursor = (
        db.tair_notifications.find({"user_id": {"$in": ids}})
        .sort("created_at", -1)
        .limit(min(limit, 200))
    )
    items = [_serialize(d) async for d in cursor]
    unread_count = await db.tair_notifications.count_documents({"user_id": {"$in": ids}, "is_read": False})
    return {"items": items, "unread_count": unread_count}


@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, user_id: str = Query(...)):
    await db.tair_notifications.update_one(
        {"notif_id": notif_id, "user_id": {"$in": await _aliases(user_id)}},
        {"$set": {"is_read": True}},
    )
    return {"success": True}


@router.post("/read-all")
async def mark_all_read(user_id: str = Query(...)):
    r = await db.tair_notifications.update_many(
        {"user_id": {"$in": await _aliases(user_id)}, "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"success": True, "updated": r.modified_count}
