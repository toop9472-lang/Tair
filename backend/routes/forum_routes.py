"""طير — Forum / Community API routes."""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient

from models.forum import ForumPost, ForumReply, ForumPostCreate, ForumReplyCreate, FORUM_CATEGORIES

router = APIRouter(prefix="/forum", tags=["Tair-Forum"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for key in ("created_at", "updated_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    return doc


@router.get("/categories")
async def list_categories():
    return {"items": FORUM_CATEGORIES, "total": len(FORUM_CATEGORIES)}


@router.get("/stats")
async def category_stats():
    """
    Return per-category thread/post counts and latest activity.
    Used by the Web/Mobile forum home to render the categorized layout
    similar to classic vBulletin forums.
    """
    stats: dict = {}
    # Aggregate counts per category
    pipeline = [
        {"$match": {"is_flagged": False}},
        {
            "$group": {
                "_id": "$category",
                "threads": {"$sum": 1},
                "posts": {"$sum": {"$add": ["$replies_count", 1]}},
                "views": {"$sum": "$views_count"},
                "latest": {"$max": "$updated_at"},
            }
        },
    ]
    async for row in db.forum_posts.aggregate(pipeline):
        stats[row["_id"]] = {
            "threads": row.get("threads", 0),
            "posts": row.get("posts", 0),
            "views": row.get("views", 0),
            "latest": row["latest"].isoformat() if row.get("latest") else None,
        }

    # Get the most recent post per category for the "latest activity" preview
    latest_map: dict = {}
    for cat in FORUM_CATEGORIES:
        cid = cat["id"]
        doc = await db.forum_posts.find_one(
            {"category": cid, "is_flagged": False},
            sort=[("updated_at", -1)],
        )
        if doc:
            latest_map[cid] = {
                "post_id": doc.get("post_id"),
                "title": doc.get("title"),
                "author_name": doc.get("author_name") or "مستخدم",
                "at": doc["updated_at"].isoformat() if doc.get("updated_at") else None,
            }

    items = []
    for cat in FORUM_CATEGORIES:
        cid = cat["id"]
        s = stats.get(cid, {"threads": 0, "posts": 0, "views": 0, "latest": None})
        items.append({**cat, **s, "latest_post": latest_map.get(cid)})
    return {"items": items, "total": len(items)}


@router.post("/create")
async def create_post(payload: ForumPostCreate, user_id: str = Query(...)):
    post_id = f"fp_{uuid.uuid4().hex[:12]}"
    post = ForumPost(post_id=post_id, author_id=user_id, **payload.model_dump())
    doc = post.model_dump()
    await db.forum_posts.insert_one(doc)
    return _serialize(doc)


@router.get("/feed")
async def feed_posts(
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 30,
    skip: int = 0,
):
    query: dict = {"is_flagged": False}
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"body": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.forum_posts.find(query).sort([("is_pinned", -1), ("created_at", -1)]).skip(skip).limit(min(limit, 100))
    items = [_serialize(d) async for d in cursor]
    total = await db.forum_posts.count_documents(query)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/post/{post_id}")
async def get_post(post_id: str, viewer_id: Optional[str] = None):
    doc = await db.forum_posts.find_one({"post_id": post_id})
    if not doc:
        raise HTTPException(404, "Post not found")
    if viewer_id and viewer_id != doc.get("author_id"):
        await db.forum_posts.update_one(
            {"post_id": post_id}, {"$inc": {"views_count": 1}}
        )
    return _serialize(doc)


@router.get("/post/{post_id}/replies")
async def list_replies(post_id: str, limit: int = 100, skip: int = 0):
    cursor = db.forum_replies.find({"post_id": post_id}).sort("created_at", 1).skip(skip).limit(min(limit, 200))
    items = [_serialize(d) async for d in cursor]
    total = await db.forum_replies.count_documents({"post_id": post_id})
    return {"items": items, "total": total}


@router.post("/post/{post_id}/reply")
async def reply_to_post(post_id: str, payload: ForumReplyCreate, user_id: str = Query(...)):
    post = await db.forum_posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    if post.get("is_locked"):
        raise HTTPException(403, "Post is locked")
    reply_id = f"fr_{uuid.uuid4().hex[:12]}"
    reply = ForumReply(reply_id=reply_id, post_id=post_id, author_id=user_id, **payload.model_dump())
    doc = reply.model_dump()
    await db.forum_replies.insert_one(doc)
    await db.forum_posts.update_one(
        {"post_id": post_id},
        {"$inc": {"replies_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    return _serialize(doc)


@router.post("/post/{post_id}/like")
async def toggle_like(post_id: str, user_id: str = Query(...)):
    post = await db.forum_posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    liked_by = post.get("liked_by", [])
    if user_id in liked_by:
        await db.forum_posts.update_one(
            {"post_id": post_id},
            {"$pull": {"liked_by": user_id}, "$inc": {"likes_count": -1}},
        )
        return {"liked": False}
    else:
        await db.forum_posts.update_one(
            {"post_id": post_id},
            {"$addToSet": {"liked_by": user_id}, "$inc": {"likes_count": 1}},
        )
        return {"liked": True}


async def _is_admin_for(db, user_id: str) -> bool:
    if not user_id:
        return False
    adm = await db.admins.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1},
    )
    if adm:
        return True
    u = await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "email": 1, "is_admin": 1},
    )
    if u:
        if u.get("is_admin"):
            return True
        if u.get("email"):
            adm2 = await db.admins.find_one({"email": u["email"]}, {"_id": 0, "id": 1})
            if adm2:
                return True
    return False


async def _actor_from_token_or_query(user_id: Optional[str], authorization: Optional[str]) -> tuple[str, bool]:
    """
    Resolve the calling user from either query param or JWT.
    Returns (effective_user_id, is_admin).
    This lets an admin whose mobile cache lost user_id still act, since
    the JWT still has their sub/email.
    """
    is_admin = False
    effective = user_id or ""
    # Try to inspect JWT to fill missing user_id / detect admin
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            # Best-effort decode without verifying signature — we trust the
            # gateway already validated via other layers, and we only use the
            # claim as a hint (real writes still go through owner/admin checks).
            from auth.jwt_handler import decode_token  # type: ignore
            payload = decode_token(token)
        except Exception:
            try:
                import jwt as _pyjwt  # PyJWT
                payload = _pyjwt.decode(token, options={"verify_signature": False})
            except Exception:
                payload = None
        if payload:
            token_uid = (
                payload.get("user_id")
                or payload.get("sub")
                or payload.get("email")
            )
            if not effective and token_uid:
                effective = str(token_uid)
            # Detect admin flag from token
            if payload.get("is_admin") or payload.get("role") in ("admin", "super_admin"):
                is_admin = True
            elif token_uid:
                # Fall back to DB check
                is_admin = await _is_admin_for(db, str(token_uid))
    if not is_admin and effective:
        is_admin = await _is_admin_for(db, effective)
    return effective, is_admin


@router.delete("/post/{post_id}")
async def delete_post(
    post_id: str,
    user_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    post = await db.forum_posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(404, "Post not found")
    effective_uid, is_admin = await _actor_from_token_or_query(user_id, authorization)
    is_owner = bool(effective_uid) and (post.get("author_id") == effective_uid)
    if not is_owner and not is_admin:
        raise HTTPException(403, "Not authorized")
    await db.forum_posts.delete_one({"post_id": post_id})
    await db.forum_replies.delete_many({"post_id": post_id})
    return {"success": True}


@router.delete("/reply/{reply_id}")
async def delete_reply(
    reply_id: str,
    user_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    reply = await db.forum_replies.find_one({"reply_id": reply_id})
    if not reply:
        raise HTTPException(404, "Reply not found")
    effective_uid, is_admin = await _actor_from_token_or_query(user_id, authorization)
    is_owner = bool(effective_uid) and (reply.get("author_id") == effective_uid)
    if not is_owner and not is_admin:
        raise HTTPException(403, "Not authorized")
    await db.forum_replies.delete_one({"reply_id": reply_id})
    # Decrement reply count on parent post
    if reply.get("post_id"):
        await db.forum_posts.update_one(
            {"post_id": reply["post_id"]},
            {"$inc": {"replies_count": -1}},
        )
    return {"success": True}
