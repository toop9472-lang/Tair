"""Community General Chat — دردشة عامة
Simple text-only chat under Community page.
Rules enforced server-side: no URLs, no phone numbers, no attachments.
Messages auto-expire after 24h (TTL index on created_at).
"""
import os
import re
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from services.moderation import moderator_scopes, notify_staff
from services.tair_stickers import sticker_preview
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/community", tags=["Community Chat"])

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]

# Patterns for forbidden content
_URL_RE = re.compile(r"(https?://|www\.|[a-z0-9]+\.[a-z]{2,}/)", re.IGNORECASE)
# Phone numbers: 7+ digits in a row OR international style
_PHONE_RE = re.compile(r"(\+?\d[\d\s\-\.]{6,}\d)")


def _now():
    return datetime.now(timezone.utc)


def _clean(d):
    if not d:
        return {}
    d.pop("_id", None)
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


async def _is_mod(user_id: str) -> bool:
    if not user_id:
        return False
    # Admins collection — most authoritative
    adm = await db.admins.find_one({"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]})
    if adm:
        return True
    u = await db.users.find_one(
        {"$or": [{"user_id": user_id}, {"email": user_id}, {"id": user_id}]},
        {"_id": 0, "is_admin": 1, "role": 1},
    )
    if u and (u.get("is_admin") or u.get("role") in ("admin", "super_admin")):
        return True
    scopes = await moderator_scopes(db, user_id)
    return (
        "community" in scopes
        or "general" in scopes
        or "clinic_admin" in scopes
    )


# =============================================================
# Ensure TTL index
async def _ensure_ttl():
    try:
        await db.tair_community_chat.create_index(
            "created_at", expireAfterSeconds=86400
        )
    except Exception as e:
        logger.warning("TTL index: %s", e)


class ChatMessage(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@router.get("/chat")
async def list_chat(limit: int = Query(80, le=200)):
    cursor = db.tair_community_chat.find({}).sort("created_at", -1).limit(limit)
    items = []
    async for d in cursor:
        items.append(_clean(d))
    items.reverse()  # oldest first for chat UX
    # Re-evaluate name/avatar + is_moderator dynamically — عشان تظهر الشارة والمعلومات حتى على الرسائل القديمة
    uids = list({m.get("user_id") for m in items if m.get("user_id")})
    user_map = {}
    mod_map = {}
    for uid in uids:
        u = await db.users.find_one(
            {"$or": [{"user_id": uid}, {"email": uid}, {"id": uid}]},
            {"_id": 0, "name": 1, "avatar": 1, "profile_image": 1},
        )
        user_map[uid] = u or {}
        mod_map[uid] = await _is_mod(uid)
    for m in items:
        uid = m.get("user_id")
        u = user_map.get(uid) or {}
        # إذا الاسم المخزن افتراضي، استخرج اسم المستخدم الحالي من قاعدة البيانات
        if not m.get("user_name") or m.get("user_name") == "مستخدم":
            m["user_name"] = u.get("name") or m.get("user_name") or "مستخدم"
        if not m.get("user_avatar"):
            m["user_avatar"] = u.get("avatar") or u.get("profile_image")
        m["is_moderator"] = bool(mod_map.get(uid, m.get("is_moderator", False)))
    return {"items": items, "count": len(items)}


@router.post("/chat")
async def send_chat(payload: ChatMessage, user_id: str = Query(...)):
    # Scope ban?
    ban = await db.tair_scope_bans.find_one({"user_id": user_id, "scope": "community"})
    if ban:
        raise HTTPException(403, "أنت محظور من الدردشة العامة")

    text = payload.text.strip()
    if _URL_RE.search(text):
        raise HTTPException(400, "لا يسمح بإرسال الروابط في الدردشة العامة")
    if _PHONE_RE.search(text):
        raise HTTPException(400, "لا يسمح بإرسال أرقام الهواتف في الدردشة العامة")

    user = await db.users.find_one(
        {"$or": [{"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "name": 1, "avatar": 1, "profile_image": 1},
    )
    is_mod = await _is_mod(user_id)
    msg_id = f"cmsg_{uuid.uuid4().hex[:12]}"
    doc = {
        "msg_id": msg_id,
        "user_id": user_id,
        "user_name": (user or {}).get("name") or "مستخدم",
        "user_avatar": (user or {}).get("avatar") or (user or {}).get("profile_image"),
        "is_moderator": is_mod,
        "text": text,
        "created_at": _now(),
    }
    await db.tair_community_chat.insert_one(doc)
    try:
        since = _now() - timedelta(minutes=15)
        recent = await db.tair_notifications.find_one({
            "type": "community_chat",
            "data.sender_id": user_id,
            "created_at": {"$gte": since},
        })
        if not recent:
            preview = sticker_preview(text)
            preview = preview if len(preview) <= 80 else preview[:77] + "…"
            sender = doc["user_name"]
            await notify_staff(
                db,
                ["community"],
                [user_id],
                "رسالة في الدردشة العامة",
                f"{sender}: {preview}",
                "community_chat",
                {"sender_id": user_id},
            )
    except Exception as exc:
        logger.warning("community chat notify: %s", exc)
    return {"success": True, "msg_id": msg_id, "is_moderator": is_mod}


@router.delete("/chat/{msg_id}")
async def delete_chat(msg_id: str, user_id: str = Query(...)):
    m = await db.tair_community_chat.find_one({"msg_id": msg_id})
    if not m:
        raise HTTPException(404, "الرسالة غير موجودة")
    if m.get("user_id") != user_id and not await _is_mod(user_id):
        raise HTTPException(403, "غير مصرح")
    await db.tair_community_chat.delete_one({"msg_id": msg_id})
    return {"success": True}


@router.on_event("startup")
async def _startup():
    await _ensure_ttl()
