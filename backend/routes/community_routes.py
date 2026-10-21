"""طير — Community API (Stories 24h + Pride/Top Listings + admin deletes)"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from services.r2_storage import r2
from services.moderation import moderator_scopes

router = APIRouter(prefix="/community", tags=["Tair-Community"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

MEDIA_STORIES_DIR = Path(__file__).resolve().parent.parent / "static" / "media" / "stories"
MEDIA_STORIES_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_STORY_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
STORY_CONTENT_TYPE = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic",
}
MAX_STORY_IMAGE_MB = 8


def _now_utc():
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = v.replace(tzinfo=timezone.utc).isoformat() if v.tzinfo is None else v.isoformat()
    return doc


async def _is_admin(user_id: str) -> bool:
    if not user_id:
        return False
    a = await db.admins.find_one({"email": user_id}) or await db.admins.find_one({"user_id": user_id})
    if a:
        return True
    u = await db.users.find_one({"user_id": user_id}) or await db.users.find_one({"email": user_id})
    return bool(u and (u.get("is_admin") or u.get("role") == "admin"))


# ==================== Story Media Upload ====================
@router.post("/upload-image")
async def upload_story_image(
    file: UploadFile = File(...),
    user_id: str = Form(default=""),
):
    filename = file.filename or "story.jpg"
    ext = ("." + filename.split(".")[-1].lower()) if "." in filename else ".jpg"
    if ext not in ALLOWED_STORY_EXTS:
        raise HTTPException(400, "صيغة الصورة غير مدعومة")
    content = await file.read()
    if not content:
        raise HTTPException(400, "الملف فارغ")
    if len(content) > MAX_STORY_IMAGE_MB * 1024 * 1024:
        raise HTTPException(413, f"الصورة تتجاوز {MAX_STORY_IMAGE_MB}MB")

    file_id = uuid.uuid4().hex
    key_user = (user_id or "guest").replace("/", "_")
    object_key = f"tair-stories/{key_user}/{file_id}{ext}"
    content_type = STORY_CONTENT_TYPE.get(ext, "image/jpeg")

    image_url = None
    if r2.is_configured:
        try:
            image_url = r2.upload_bytes(object_key, content, content_type=content_type)
        except Exception as exc:
            print(f"[community_upload_image] R2 failed, fallback: {exc}")
            image_url = None
    if not image_url:
        local_path = MEDIA_STORIES_DIR / f"{file_id}{ext}"
        local_path.write_bytes(content)
        image_url = f"/media/stories/{file_id}{ext}"
    return {"success": True, "url": image_url, "image_url": image_url}


# ==================== Stories (24h) ====================
class StoryCreate(BaseModel):
    image_url: str = ""
    caption: str = ""


@router.post("/stories/create")
async def create_story(payload: StoryCreate, user_id: str = Query(...)):
    if not payload.image_url and not (payload.caption or "").strip():
        raise HTTPException(status_code=400, detail="أضف صورة أو نصاً للقصة")
    now = _now_utc()
    user = await db.users.find_one({"user_id": user_id}) or await db.users.find_one({"email": user_id})
    user_name = (user or {}).get("name") or "مربّي"
    avatar = (user or {}).get("avatar_url") or (user or {}).get("photo_url")
    story_id = f"sty_{uuid.uuid4().hex[:12]}"
    doc = {
        "story_id": story_id,
        "user_id": user_id,
        "user_name": user_name,
        "user_avatar": avatar,
        "image_url": payload.image_url,
        "caption": payload.caption or "",
        "created_at": now,
        "expires_at": now + timedelta(hours=24),
        "views_count": 0,
    }
    await db.tair_stories.insert_one(doc)
    try:
        from services.moderation import notify_staff
        caption = (payload.caption or "").strip()
        await notify_staff(
            db,
            {"community"},
            [user_id],
            "قصة جديدة في المجتمع",
            f"{user_name}: {caption or 'صورة جديدة'}"[:140],
            "story_new",
            {"story_id": story_id},
        )
    except Exception as exc:
        print(f"[story notify] {exc}")
    return _serialize({**doc})


@router.get("/stories/list")
async def list_stories(limit: int = Query(50, le=100)):
    now = _now_utc()
    # Purge expired (background housekeeping)
    await db.tair_stories.delete_many({"expires_at": {"$lte": now}})
    cursor = db.tair_stories.find({"expires_at": {"$gt": now}}).sort("created_at", -1).limit(limit)
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "count": len(items)}


@router.get("/stories/top-today")
async def top_story_today():
    """أعلى قصة تفاعلاً في آخر 24 ساعة (تُستخدم للشارة الذهبية)."""
    now = _now_utc()
    top = await db.tair_stories.find({"expires_at": {"$gt": now}}).sort([
        ("likes_count", -1), ("comments_count", -1), ("views_count", -1), ("created_at", -1),
    ]).limit(1).to_list(1)
    if not top:
        return {"story_id": None}
    d = top[0]
    d.pop("_id", None)
    return {"story_id": d.get("story_id"), "likes": d.get("likes_count", 0), "comments": d.get("comments_count", 0)}


@router.get("/stories/{story_id}")
async def get_story(story_id: str):
    doc = await db.tair_stories.find_one({"story_id": story_id})
    if not doc:
        raise HTTPException(status_code=404, detail="القصة غير موجودة أو انتهت")
    await db.tair_stories.update_one({"story_id": story_id}, {"$inc": {"views_count": 1}})
    return _serialize(doc)


@router.delete("/stories/{story_id}")
async def delete_story(story_id: str, user_id: str = Query(...)):
    story = await db.tair_stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="القصة غير موجودة")
    is_admin = await _is_admin(user_id)
    scopes = [] if is_admin else await moderator_scopes(db, user_id)
    is_mod = "community" in scopes or "general" in scopes
    if story.get("user_id") != user_id and not is_admin and not is_mod:
        raise HTTPException(status_code=403, detail="غير مصرّح")
    await db.tair_stories.delete_one({"story_id": story_id})
    return {"success": True}


# ==================== Pride (Top Listings) ====================
@router.get("/pride/list")
async def list_pride(limit: int = Query(12, le=48)):
    """أفضل الإعلانات: يفضّل الإعلانات ذات المشاهدات/الإعجابات الأعلى، ثم الأحدث."""
    # Prefer 'featured' flag if any; else fallback to most recent active listings
    cursor = db.tair_listings.find({"status": {"$ne": "deleted"}}).sort([
        ("likes_count", -1),
        ("views_count", -1),
        ("created_at", -1),
    ]).limit(limit)
    items = []
    async for d in cursor:
        d.pop("_id", None)
        images = d.get("images") or []
        items.append({
            "listing_id": d.get("listing_id") or d.get("id"),
            "title": d.get("title", ""),
            "image_url": images[0] if images else None,
            "city": d.get("city"),
            "price_sar": d.get("price_sar") or d.get("price"),
            "likes": d.get("likes_count") or 0,
            "views": d.get("views_count") or 0,
            "is_new": _is_new(d.get("created_at")),
        })
    return {"items": items, "count": len(items)}


def _is_new(created_at) -> bool:
    if not created_at:
        return False
    try:
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return (_now_utc() - created_at).total_seconds() < 3 * 86400  # 3 days
    except Exception:
        return False


# ==================== Story Likes & Comments ====================
class StoryComment(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@router.post("/stories/{story_id}/like")
async def like_story(story_id: str, user_id: str = Query(...)):
    story = await db.tair_stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(404, "القصة غير موجودة")
    existing = await db.tair_story_likes.find_one({"story_id": story_id, "user_id": user_id})
    if existing:
        await db.tair_story_likes.delete_one({"_id": existing["_id"]})
        await db.tair_stories.update_one({"story_id": story_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False}
    await db.tair_story_likes.insert_one({
        "story_id": story_id, "user_id": user_id, "created_at": _now_utc(),
    })
    await db.tair_stories.update_one({"story_id": story_id}, {"$inc": {"likes_count": 1}})
    return {"liked": True}


@router.get("/stories/{story_id}/comments")
async def list_story_comments(story_id: str, limit: int = Query(100, le=200)):
    items = []
    async for c in db.tair_story_comments.find({"story_id": story_id}).sort("created_at", -1).limit(limit):
        c.pop("_id", None)
        for k, v in list(c.items()):
            if isinstance(v, datetime):
                c[k] = v.isoformat()
        items.append(c)
    return {"items": items, "count": len(items)}


@router.post("/stories/{story_id}/comments")
async def add_story_comment(story_id: str, payload: StoryComment, user_id: str = Query(...)):
    story = await db.tair_stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(404, "القصة غير موجودة")
    # Check if user is scope-banned from community
    ban = await db.tair_scope_bans.find_one({"user_id": user_id, "scope": "community"})
    if ban:
        raise HTTPException(403, "أنت محظور من التفاعل مع صفحة المجتمع")
    user = await db.users.find_one({"$or": [{"user_id": user_id}, {"email": user_id}]}, {"_id": 0, "name": 1, "avatar": 1})
    now = _now_utc()
    cid = f"scm_{uuid.uuid4().hex[:12]}"
    await db.tair_story_comments.insert_one({
        "comment_id": cid,
        "story_id": story_id,
        "user_id": user_id,
        "user_name": (user or {}).get("name") or "مستخدم",
        "user_avatar": (user or {}).get("avatar"),
        "text": payload.text.strip(),
        "created_at": now,
    })
    await db.tair_stories.update_one({"story_id": story_id}, {"$inc": {"comments_count": 1}})
    return {"success": True, "comment_id": cid}


@router.delete("/stories/comments/{comment_id}")
async def delete_story_comment(comment_id: str, user_id: str = Query(...)):
    c = await db.tair_story_comments.find_one({"comment_id": comment_id})
    if not c:
        raise HTTPException(404, "التعليق غير موجود")
    is_admin = await _is_admin(user_id)
    scopes = [] if is_admin else await moderator_scopes(db, user_id)
    is_mod = "community" in scopes or "general" in scopes
    if c.get("user_id") != user_id and not is_admin and not is_mod:
        raise HTTPException(403, "غير مصرّح")
    await db.tair_story_comments.delete_one({"comment_id": comment_id})
    await db.tair_stories.update_one({"story_id": c["story_id"]}, {"$inc": {"comments_count": -1}})
    return {"success": True}

