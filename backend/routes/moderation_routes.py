"""
Moderation Routes — User reports, blocks, profanity filter, and auto-ban policy.

Required for App Store review readiness: every social app must let users
report and block other users, and the platform must remove objectionable
content within 24 hours.
"""
from datetime import datetime, timezone
from typing import List, Optional
import os
import re
import uuid

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

router = APIRouter(prefix="/moderation", tags=["Moderation"])

# 3 unique reporters trigger automatic content removal
AUTO_REMOVE_REPORT_THRESHOLD = 3
# 5 unique reporters across a user's content triggers a temporary user ban
USER_AUTO_BAN_REPORT_THRESHOLD = 5

# Arabic + English profanity list (kept short and editable; loaded into a
# compiled regex with word boundaries for performance).
PROFANITY_WORDS = [
    # Arabic
    "كلب", "حمار", "خنزير", "غبي", "احمق", "أحمق", "تافه", "وسخ",
    "ابن الكلب", "ابن العاهرة", "ابن الزانية", "زنا", "زاني", "زانية",
    "كافر", "ملحد", "نجس", "قذر", "متخلف",
    "شرموط", "شرموطه", "شرموطة", "عرص", "قحبه", "قحبة", "زبي", "خرا",
    "كس", "طيز", "نيك", "منيوك",
    # English
    "fuck", "fucking", "shit", "bitch", "asshole", "bastard", "cunt", "dick",
    "pussy", "whore", "slut", "nigger", "faggot",
]
_PROFANITY_PATTERN = re.compile(
    r"(?iu)\b(" + "|".join(map(re.escape, PROFANITY_WORDS)) + r")\b"
)


def contains_profanity(text: str) -> Optional[str]:
    if not text:
        return None
    match = _PROFANITY_PATTERN.search(text)
    return match.group(1) if match else None


# ---- Models ----

class ReportRequest(BaseModel):
    reporter_id: str
    target_type: str  # "clip" | "comment" | "chat_message" | "user"
    target_id: str
    target_user_id: Optional[str] = None
    reason: str = "inappropriate"  # spam | abuse | sexual | violence | other
    note: Optional[str] = None


class BlockRequest(BaseModel):
    user_id: str
    target_user_id: str


# ---- Endpoints ----

@router.post("/report")
async def submit_report(req: ReportRequest):
    if not req.reporter_id or not req.target_id:
        raise HTTPException(status_code=400, detail="reporter_id and target_id are required")
    if req.reporter_id == req.target_user_id:
        raise HTTPException(status_code=400, detail="لا يمكن الإبلاغ عن نفسك")

    report = {
        "id": str(uuid.uuid4()),
        "reporter_id": req.reporter_id,
        "target_type": req.target_type,
        "target_id": req.target_id,
        "target_user_id": req.target_user_id,
        "reason": req.reason,
        "note": (req.note or "")[:500],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_reports.insert_one(report)

    # Count unique reporters for this exact target
    unique_reporters = await db.user_reports.distinct(
        "reporter_id",
        {"target_type": req.target_type, "target_id": req.target_id},
    )
    unique_count = len(unique_reporters)

    auto_action = None

    # Auto-remove the offending content once threshold is hit
    if unique_count >= AUTO_REMOVE_REPORT_THRESHOLD:
        try:
            if req.target_type == "clip":
                await db.clips_posts.delete_one({"clip_id": req.target_id})
                auto_action = "clip_removed"
            elif req.target_type == "comment":
                await db.comments.delete_one({"id": req.target_id})
                auto_action = "comment_removed"
            elif req.target_type == "chat_message":
                await db.chat_messages.delete_one({"id": req.target_id})
                auto_action = "message_removed"
        except Exception:
            pass

    # Tally reports against the offending user across all their content;
    # if a user crosses USER_AUTO_BAN_REPORT_THRESHOLD unique reporters,
    # we temporarily disable their account.
    if req.target_user_id:
        all_user_reporters = await db.user_reports.distinct(
            "reporter_id", {"target_user_id": req.target_user_id}
        )
        if len(all_user_reporters) >= USER_AUTO_BAN_REPORT_THRESHOLD:
            await db.users.update_one(
                {"$or": [{"id": req.target_user_id}, {"user_id": req.target_user_id}]},
                {
                    "$set": {
                        "is_banned": True,
                        "banned_at": datetime.now(timezone.utc).isoformat(),
                        "banned_reason": "auto_ban_excessive_reports",
                    }
                },
            )
            auto_action = (auto_action + "+user_banned") if auto_action else "user_banned"

    return {
        "success": True,
        "report_id": report["id"],
        "unique_reporters": unique_count,
        "auto_action": auto_action,
        "message": "شكراً لإبلاغك. سيراجع فريقنا المحتوى خلال 24 ساعة.",
    }


@router.get("/blocks/{user_id}", response_model=dict)
async def list_blocks(user_id: str):
    blocks = await db.user_blocks.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    target_ids = [b["target_user_id"] for b in blocks]
    # Hydrate basic profile info so clients can render names/avatars without
    # extra round-trips per blocked user.
    users = []
    if target_ids:
        cursor = db.users.find(
            {"$or": [{"id": {"$in": target_ids}}, {"user_id": {"$in": target_ids}}]},
            {"_id": 0, "id": 1, "user_id": 1, "name": 1, "avatar": 1, "is_verified": 1},
        )
        docs = await cursor.to_list(length=len(target_ids) + 50)
        by_id = {}
        for d in docs:
            canonical = d.get("id") or d.get("user_id")
            if canonical:
                by_id[canonical] = d
        for tid in target_ids:
            d = by_id.get(tid) or {}
            users.append({
                "user_id": tid,
                "name": d.get("name") or "مستخدم محذوف",
                "avatar": d.get("avatar") or "",
                "is_verified": bool(d.get("is_verified")),
            })
    return {
        "user_id": user_id,
        "blocked": target_ids,
        "users": users,
        "count": len(blocks),
    }


@router.post("/block")
async def block_user(req: BlockRequest):
    if not req.user_id or not req.target_user_id:
        raise HTTPException(status_code=400, detail="user_id and target_user_id required")
    if req.user_id == req.target_user_id:
        raise HTTPException(status_code=400, detail="لا يمكن حظر نفسك")

    existing = await db.user_blocks.find_one(
        {"user_id": req.user_id, "target_user_id": req.target_user_id}
    )
    if existing:
        return {"success": True, "already_blocked": True}

    await db.user_blocks.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": req.user_id,
            "target_user_id": req.target_user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"success": True, "message": "تم حظر المستخدم. لن ترى محتواه بعد الآن."}


@router.post("/unblock")
async def unblock_user(req: BlockRequest):
    await db.user_blocks.delete_one(
        {"user_id": req.user_id, "target_user_id": req.target_user_id}
    )
    return {"success": True, "message": "تم إلغاء الحظر."}


@router.get("/profanity-check")
async def profanity_check(text: str):
    """Diagnostic endpoint to verify the profanity filter from clients."""
    hit = contains_profanity(text)
    return {"clean": hit is None, "matched_word": hit}
