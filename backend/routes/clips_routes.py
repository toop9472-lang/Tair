from datetime import datetime, timezone
import os
import re
from pathlib import Path
from typing import Dict, Optional, Set, Tuple
from urllib.parse import urlparse
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, StreamingResponse, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from services.r2_storage import r2

router = APIRouter(prefix="/clips", tags=["Clips"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

DEFAULT_CLIP_VISUAL = "https://static.prod-images.emergentagent.com/jobs/3943d011-4c0b-4252-9b99-046dc8c507ce/images/e14c91a9e40e8d29b6f8d3bf567a4fcb7020c985b1a9d3e96e2035b06f9921e6.png"
MAX_UPLOAD_MB = 200
MEDIA_CLIPS_DIR = (Path(__file__).resolve().parent.parent / "static" / "media" / "clips")
MEDIA_CLIPS_DIR.mkdir(parents=True, exist_ok=True)

VIDEO_MIME_TYPES = {
    "mp4": "video/mp4",
    "m4v": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
}


def _user_filter(user_id: str):
    return {"$or": [{"id": user_id}, {"user_id": user_id}]}


async def _fetch_user(user_id: str, projection=None):
    user = await db.users.find_one(_user_filter(user_id), projection)
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    return user


class CreateClipRequest(BaseModel):
    user_id: str
    user_name: Optional[str] = "مستخدم"
    user_avatar: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    caption: Optional[str] = ""
    duration_seconds: Optional[int] = 15
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None


class ToggleLikeRequest(BaseModel):
    user_id: str


class LegacyToggleLikeRequest(BaseModel):
    clip_id: str
    user_id: str


class AddCommentRequest(BaseModel):
    user_id: str
    user_name: Optional[str] = "مستخدم"
    comment: Optional[str] = None
    content: Optional[str] = None


class LegacyAddCommentRequest(BaseModel):
    clip_id: str
    user_id: str
    user_name: Optional[str] = "مستخدم"
    comment: Optional[str] = None
    content: Optional[str] = None


class ToggleFollowRequest(BaseModel):
    viewer_user_id: str
    target_user_id: str


def _is_video_filename(filename: str) -> bool:
    lowered = (filename or "").lower()
    return lowered.endswith((".mp4", ".mov", ".m4v", ".webm"))


def _is_valid_media_url(value: str) -> bool:
    normalized = (value or "").strip()
    return (
        normalized.startswith("http")
        or normalized.startswith("/media/")
        or normalized.startswith("/backend/media/")
        or normalized.startswith("/api/clips/media/")
    )


def _normalize_clip_media_url(value: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        return ""

    if normalized.startswith("/media/clips/"):
        filename = normalized.split("/media/clips/", 1)[1].lstrip("/")
        return f"/api/clips/media/{filename}" if filename else normalized

    if normalized.startswith("/backend/media/clips/"):
        filename = normalized.split("/backend/media/clips/", 1)[1].lstrip("/")
        return f"/api/clips/media/{filename}" if filename else normalized

    if normalized.startswith("http"):
        try:
            parsed = urlparse(normalized)
            path = parsed.path or ""
            if path.startswith("/media/clips/"):
                filename = path.split("/media/clips/", 1)[1].lstrip("/")
                if filename and parsed.scheme and parsed.netloc:
                    return f"{parsed.scheme}://{parsed.netloc}/api/clips/media/{filename}"
            if path.startswith("/backend/media/clips/"):
                filename = path.split("/backend/media/clips/", 1)[1].lstrip("/")
                if filename and parsed.scheme and parsed.netloc:
                    return f"{parsed.scheme}://{parsed.netloc}/api/clips/media/{filename}"
        except Exception:
            return normalized

    return normalized


def _normalize_comment(comment: dict) -> dict:
    text = (comment.get("content") or comment.get("comment") or "").strip()
    return {
        "comment_id": comment.get("comment_id") or str(uuid.uuid4()),
        "user_id": comment.get("user_id"),
        "user_name": comment.get("user_name") or "مستخدم",
        "content": text,
        "comment": text,
        "created_at": comment.get("created_at")
        or datetime.now(timezone.utc).isoformat(),
    }


def _looks_test_content(text: str) -> bool:
    normalized = (text or "").strip().lower()
    if not normalized:
        return False
    blocked_tokens = {"test", "demo", "dummy", "sample", "placeholder", "تجريبي", "تجربة", "وهمي"}
    return any(token in normalized for token in blocked_tokens)


async def _build_follow_maps(
    owner_ids: Set[str],
    viewer_id: Optional[str] = None,
) -> Tuple[Dict[str, int], Dict[str, int], Set[str]]:
    if not owner_ids:
        return {}, {}, set()

    followers_count_map: Dict[str, int] = {}
    following_count_map: Dict[str, int] = {}
    viewer_following_set: Set[str] = set()

    for owner_id in owner_ids:
        followers_count_map[owner_id] = await db.clips_follows.count_documents(
            {"target_user_id": owner_id}
        )
        following_count_map[owner_id] = await db.clips_follows.count_documents(
            {"follower_user_id": owner_id}
        )

    if viewer_id:
        followed_docs = await db.clips_follows.find(
            {"follower_user_id": viewer_id, "target_user_id": {"$in": list(owner_ids)}},
            {"_id": 0, "target_user_id": 1},
        ).to_list(len(owner_ids))
        viewer_following_set = {
            str(doc.get("target_user_id")) for doc in followed_docs if doc.get("target_user_id")
        }

    return followers_count_map, following_count_map, viewer_following_set


@router.get("/feed")
async def get_clips_feed(limit: int = 30, viewer_id: Optional[str] = None):
    """
    Premium-tier feed ranking inspired by TikTok / Reels:
      score = engagement_rate * recency_decay * follow_boost
    Where:
      • engagement_rate = (likes + 2*comments + 3*shares) / max(views, 30)
      • recency_decay   = 1 / (1 + hours_old / 24)
      • follow_boost    = 3.5x if viewer follows the clip's author else 1.0

    Hidden test/demo content is filtered out, and clips from users the
    viewer has blocked are removed from the result.
    """
    from datetime import datetime, timezone

    normalized_limit = max(1, min(80, int(limit or 30)))

    # Pull a generous candidate pool so the ranker has room to work
    candidate_pool = max(normalized_limit * 4, 80)
    clips = await db.clips_posts.find(
        {},
        {"_id": 0},
    ).sort("created_at", -1).limit(candidate_pool).to_list(candidate_pool)

    hidden_test_clip_ids = []
    safe_clips = []
    for clip in clips:
        clip_text = (
            f"{(clip or {}).get('title', '')} "
            f"{(clip or {}).get('caption', '')} "
            f"{(clip or {}).get('content', '')} "
            f"{(clip or {}).get('user_name', '')}"
        )
        if _looks_test_content(clip_text):
            if clip and clip.get("clip_id"):
                hidden_test_clip_ids.append(clip["clip_id"])
            continue
        safe_clips.append(clip)
    clips = safe_clips
    if hidden_test_clip_ids:
        await db.clips_posts.delete_many({"clip_id": {"$in": hidden_test_clip_ids}})

    # Filter out clips from blocked users (viewer-side block list)
    blocked_ids = set()
    if viewer_id:
        try:
            blocks = await db.user_blocks.find(
                {"user_id": viewer_id}, {"_id": 0, "target_user_id": 1}
            ).to_list(500)
            blocked_ids = {b.get("target_user_id") for b in blocks if b.get("target_user_id")}
        except Exception:
            blocked_ids = set()
    if blocked_ids:
        clips = [c for c in clips if str(c.get("user_id") or "") not in blocked_ids]

    owner_ids = {str((clip or {}).get("user_id")) for clip in clips if (clip or {}).get("user_id")}
    followers_count_map, following_count_map, viewer_following_set = await _build_follow_maps(
        owner_ids,
        viewer_id,
    )

    # --- Ranking ---
    now = datetime.now(timezone.utc)

    def _hours_old(c):
        try:
            ts = c.get("created_at")
            if isinstance(ts, str):
                ts_clean = ts.replace("Z", "+00:00")
                dt = datetime.fromisoformat(ts_clean)
            else:
                dt = ts
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return max(0.0, (now - dt).total_seconds() / 3600.0)
        except Exception:
            return 24.0  # fallback: assume 1 day old

    def _score(c):
        likes = int(c.get("likes_count") or len(c.get("liked_by", []) or []))
        comments = int(c.get("comments_count") or len(c.get("comments", []) or []))
        shares = int(c.get("shares_count") or 0)
        views = max(30, int(c.get("views_count") or c.get("views") or 30))
        engagement = (likes + 2 * comments + 3 * shares) / views
        hours = _hours_old(c)
        recency = 1.0 / (1.0 + hours / 24.0)
        owner_id = str(c.get("user_id") or "")
        is_followed = bool(
            viewer_id and owner_id and owner_id != viewer_id and owner_id in viewer_following_set
        )
        follow_boost = 3.5 if is_followed else 1.0
        # A small fairness boost for fresh clips (<2 hours) so new creators
        # get discovered — matches Instagram Reels' cold-start policy.
        fresh_boost = 1.4 if hours < 2 else 1.0
        return engagement * recency * follow_boost * fresh_boost

    clips = sorted(clips, key=_score, reverse=True)[:normalized_limit]

    normalized_clips = []
    for clip in clips:
        liked_by = clip.get("liked_by", []) or []
        comments = [_normalize_comment(c) for c in (clip.get("comments") or [])]
        owner_id = str(clip.get("user_id") or "")
        normalized_clip = {
            **clip,
            "title": (clip.get("title") or clip.get("caption") or "مقطع").strip()[:80],
            "content": (clip.get("content") or clip.get("caption") or "").strip()[:220],
            "caption": (clip.get("caption") or clip.get("content") or "").strip()[:180],
            "video_url": _normalize_clip_media_url(clip.get("video_url") or ""),
            "thumbnail_url": _normalize_clip_media_url(clip.get("thumbnail_url") or ""),
            "likes_count": int(clip.get("likes_count", len(liked_by)) or 0),
            "liked_by_me": bool(viewer_id and viewer_id in liked_by),
            "comments": comments,
            "comments_count": int(clip.get("comments_count", len(comments)) or 0),
            "followers_count": followers_count_map.get(owner_id, 0),
            "following_count": following_count_map.get(owner_id, 0),
            "followed_by_me": bool(
                viewer_id and owner_id and viewer_id != owner_id and owner_id in viewer_following_set
            ),
        }
        normalized_clips.append(normalized_clip)

    return {
        "clips": normalized_clips,
        "count": len(normalized_clips),
        "algorithm": "v2_engagement_recency_follow",
    }


@router.post("/create")
async def create_clip_post(request: CreateClipRequest):
    duration = int(request.duration_seconds or 15)
    if duration <= 0 or duration > 15:
        raise HTTPException(status_code=400, detail="مدة المقطع يجب أن تكون بين 1 و 15 ثانية")

    # SECURITY: Block profane captions/titles before saving
    try:
        from routes.moderation_routes import contains_profanity
        for field_name, field_val in (
            ("caption", request.caption),
            ("title", request.title),
            ("content", request.content),
        ):
            hit = contains_profanity(field_val or "")
            if hit:
                raise HTTPException(
                    status_code=400,
                    detail="🚫 لا يُسمح بالألفاظ النابية في وصف المقطع.",
                )
    except HTTPException:
        raise
    except Exception:
        pass

    visual_source = (
        (request.video_url or "").strip()
        or (request.thumbnail_url or "").strip()
        or (request.image_url or "").strip()
        or DEFAULT_CLIP_VISUAL
    )
    visual_source = _normalize_clip_media_url(visual_source)
    if not _is_valid_media_url(visual_source):
        visual_source = DEFAULT_CLIP_VISUAL

    thumb = (request.thumbnail_url or "").strip() or visual_source
    thumb = _normalize_clip_media_url(thumb)
    if not _is_valid_media_url(thumb):
        thumb = DEFAULT_CLIP_VISUAL

    caption_text = (
        (request.caption or "").strip()
        or (request.content or "").strip()
        or (request.title or "").strip()
    )[:180]
    title_text = (
        (request.title or "").strip()
        or (request.caption or "").strip()
        or "مقطع جديد"
    )[:80]
    content_text = (
        (request.content or "").strip()
        or (request.caption or "").strip()
    )[:220]

    created_at = datetime.now(timezone.utc).isoformat()
    clip_id = str(uuid.uuid4())

    clip_doc = {
        "clip_id": clip_id,
        "user_id": request.user_id,
        "user_name": request.user_name or "مستخدم",
        "user_avatar": request.user_avatar,
        "video_url": visual_source,
        "thumbnail_url": thumb,
        "caption": caption_text,
        "title": title_text,
        "content": content_text,
        "duration_seconds": duration,
        "likes_count": 0,
        "liked_by": [],
        "comments_count": 0,
        "comments": [],
        "created_at": created_at,
    }

    # pymongo may mutate the inserted dict by injecting "_id" (ObjectId),
    # which can break JSON serialization when returning the payload.
    await db.clips_posts.insert_one({**clip_doc})
    return {
        "success": True,
        "clip": clip_doc,
    }


@router.post("/upload")
async def upload_clip_video(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    await _fetch_user(user_id, {"_id": 0, "id": 1, "user_id": 1})

    filename = file.filename or "clip.mp4"
    if not _is_video_filename(filename):
        raise HTTPException(status_code=400, detail="صيغة الفيديو غير مدعومة")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="ملف الفيديو فارغ")

    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"حجم الفيديو يتجاوز {MAX_UPLOAD_MB}MB",
        )

    file_id = str(uuid.uuid4())
    ext = filename.split(".")[-1].lower()
    safe_ext = ext if ext in {"mp4", "mov", "m4v", "webm"} else "mp4"
    object_key = f"clips/{file_id}.{safe_ext}"
    media_type = VIDEO_MIME_TYPES.get(safe_ext, "video/mp4")

    # Prefer Cloudflare R2 (persistent across deployments). Fall back to local
    # disk only if R2 is not configured.
    video_url: Optional[str] = None
    if r2.is_configured:
        try:
            video_url = r2.upload_bytes(
                object_key, content, content_type=media_type
            )
        except Exception as exc:  # pragma: no cover - cloud failures
            print(f"[clips_upload] R2 upload failed, falling back to local disk: {exc}")
            video_url = None

    if not video_url:
        absolute_path = MEDIA_CLIPS_DIR / f"{file_id}.{safe_ext}"
        with open(absolute_path, "wb") as output:
            output.write(content)
        video_url = f"/api/clips/media/{file_id}.{safe_ext}"

    return {
        "success": True,
        "video_url": video_url,
        "thumbnail_url": DEFAULT_CLIP_VISUAL,
    }


@router.post("/upload-thumb")
async def upload_clip_thumbnail(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Upload a thumbnail image (first video frame) for a clip.
    The mobile client extracts the first frame locally via expo-video-thumbnails
    and uploads it here so the profile grid shows the real video preview
    instead of a random fallback.
    """
    await _fetch_user(user_id, {"_id": 0, "id": 1, "user_id": 1})

    filename = file.filename or "thumb.jpg"
    ext = filename.split(".")[-1].lower()
    safe_ext = ext if ext in {"jpg", "jpeg", "png", "webp"} else "jpg"

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="ملف الصورة فارغ")
    if len(content) > 8 * 1024 * 1024:  # 8MB cap is plenty for thumbs
        raise HTTPException(status_code=400, detail="حجم الصورة يتجاوز 8MB")

    file_id = str(uuid.uuid4())
    object_key = f"clip-thumbs/{file_id}.{safe_ext}"
    mime = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "webp": "image/webp",
    }.get(safe_ext, "image/jpeg")

    thumbnail_url: Optional[str] = None
    if r2.is_configured:
        try:
            thumbnail_url = r2.upload_bytes(object_key, content, content_type=mime)
        except Exception as exc:  # pragma: no cover
            print(f"[clip_thumb_upload] R2 failed, falling back: {exc}")
            thumbnail_url = None

    if not thumbnail_url:
        absolute_path = MEDIA_CLIPS_DIR / f"thumb-{file_id}.{safe_ext}"
        with open(absolute_path, "wb") as output:
            output.write(content)
        thumbnail_url = f"/api/clips/media/thumb-{file_id}.{safe_ext}"

    return {"success": True, "thumbnail_url": thumbnail_url}


@router.get("/media/{filename}")
async def get_clip_media(filename: str, request: Request):
    """Serve uploaded clip media with byte-range support so iOS / expo-av can stream the video."""
    safe_name = os.path.basename(filename or "")
    if safe_name != filename or not _is_video_filename(safe_name):
        raise HTTPException(status_code=400, detail="اسم ملف الفيديو غير صالح")
    absolute_path = MEDIA_CLIPS_DIR / safe_name
    if not absolute_path.exists():
        raise HTTPException(status_code=404, detail="ملف الفيديو غير موجود")

    ext = safe_name.rsplit(".", 1)[-1].lower()
    media_type = VIDEO_MIME_TYPES.get(ext, "video/mp4")
    file_size = absolute_path.stat().st_size

    range_header = request.headers.get("range") or request.headers.get("Range")
    common_headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": media_type,
        "Cache-Control": "public, max-age=3600",
    }

    if not range_header:
        # No range requested – return the whole file with proper headers.
        return FileResponse(
            path=str(absolute_path),
            media_type=media_type,
            headers=common_headers,
        )

    # Parse `bytes=START-END`
    match = re.match(r"bytes=(\d+)-(\d+)?", range_header.strip())
    if not match:
        raise HTTPException(status_code=416, detail="Invalid Range header")
    start = int(match.group(1))
    end = int(match.group(2)) if match.group(2) else file_size - 1
    end = min(end, file_size - 1)
    if start > end or start >= file_size:
        return Response(
            status_code=416,
            headers={**common_headers, "Content-Range": f"bytes */{file_size}"},
        )

    chunk_size = end - start + 1

    def iter_file():
        with open(absolute_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                read_size = min(64 * 1024, remaining)
                data = f.read(read_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        **common_headers,
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Content-Length": str(chunk_size),
    }
    return StreamingResponse(iter_file(), status_code=206, headers=headers, media_type=media_type)


@router.post("/{clip_id}/toggle-like")
async def toggle_clip_like(clip_id: str, request: ToggleLikeRequest):
    clip = await db.clips_posts.find_one({"clip_id": clip_id}, {"_id": 0, "liked_by": 1, "likes_count": 1})
    if not clip:
        raise HTTPException(status_code=404, detail="المقطع غير موجود")

    liked_by = clip.get("liked_by", []) or []
    user_id = request.user_id
    is_liked = user_id in liked_by

    if is_liked:
        likes_count = max(0, int(clip.get("likes_count", len(liked_by))) - 1)
        await db.clips_posts.update_one(
            {"clip_id": clip_id},
            {
                "$pull": {"liked_by": user_id},
                "$set": {"likes_count": likes_count},
            },
        )
        return {
            "success": True,
            "liked": False,
            "liked_by_me": False,
            "likes_count": likes_count,
        }

    likes_count = int(clip.get("likes_count", len(liked_by))) + 1
    await db.clips_posts.update_one(
        {"clip_id": clip_id},
        {
            "$addToSet": {"liked_by": user_id},
            "$set": {"likes_count": likes_count},
        },
    )
    return {
        "success": True,
        "liked": True,
        "liked_by_me": True,
        "likes_count": likes_count,
    }


@router.post("/like")
async def toggle_clip_like_legacy(request: LegacyToggleLikeRequest):
    return await toggle_clip_like(request.clip_id, ToggleLikeRequest(user_id=request.user_id))


@router.post("/{clip_id}/comment")
async def add_clip_comment(clip_id: str, request: AddCommentRequest):
    text = (request.comment or request.content or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="التعليق مطلوب")
    if len(text) > 220:
        raise HTTPException(status_code=400, detail="التعليق طويل جداً")

    comment_doc = _normalize_comment(
        {
            "comment_id": str(uuid.uuid4()),
            "user_id": request.user_id,
            "user_name": request.user_name or "مستخدم",
            "content": text,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    updated = await db.clips_posts.find_one_and_update(
        {"clip_id": clip_id},
        {
            "$inc": {"comments_count": 1},
            "$push": {
                "comments": {
                    "$each": [comment_doc],
                    "$slice": -40,
                }
            },
        },
        projection={"_id": 0, "comments_count": 1, "comments": 1},
    )

    if not updated:
        raise HTTPException(status_code=404, detail="المقطع غير موجود")

    comments = [_normalize_comment(c) for c in (updated.get("comments") or [])]
    return {
        "success": True,
        "comment": comment_doc,
        "comments": comments,
        "comments_count": int((updated.get("comments_count", 0) or 0) + 1),
    }


@router.post("/comment")
async def add_clip_comment_legacy(request: LegacyAddCommentRequest):
    return await add_clip_comment(
        request.clip_id,
        AddCommentRequest(
            user_id=request.user_id,
            user_name=request.user_name or "مستخدم",
            comment=request.comment,
            content=request.content,
        ),
    )


@router.post("/follow/toggle")
async def toggle_follow(request: ToggleFollowRequest):
    viewer_id = (request.viewer_user_id or "").strip()
    target_id = (request.target_user_id or "").strip()
    if not viewer_id or not target_id:
        raise HTTPException(status_code=400, detail="بيانات المتابعة غير مكتملة")
    if viewer_id == target_id:
        raise HTTPException(status_code=400, detail="لا يمكنك متابعة نفسك")

    existing = await db.clips_follows.find_one(
        {"follower_user_id": viewer_id, "target_user_id": target_id},
        {"_id": 0, "follow_id": 1},
    )

    followed = False
    if existing:
        await db.clips_follows.delete_one(
            {"follower_user_id": viewer_id, "target_user_id": target_id}
        )
        followed = False
    else:
        await db.clips_follows.insert_one(
            {
                "follow_id": str(uuid.uuid4()),
                "follower_user_id": viewer_id,
                "target_user_id": target_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        followed = True

    followers_count = await db.clips_follows.count_documents({"target_user_id": target_id})
    following_count = await db.clips_follows.count_documents({"follower_user_id": target_id})
    viewer_following_count = await db.clips_follows.count_documents({"follower_user_id": viewer_id})

    return {
        "success": True,
        "followed": followed,
        "target_user_id": target_id,
        "followers_count": followers_count,
        "following_count": following_count,
        "viewer_following_count": viewer_following_count,
    }


@router.get("/profile-stats/{user_id}")
async def get_profile_follow_stats(user_id: str, viewer_id: Optional[str] = None):
    followers_count = await db.clips_follows.count_documents({"target_user_id": user_id})
    following_count = await db.clips_follows.count_documents({"follower_user_id": user_id})

    followed_by_me = False
    if viewer_id and viewer_id != user_id:
        existing = await db.clips_follows.find_one(
            {"follower_user_id": viewer_id, "target_user_id": user_id},
            {"_id": 0, "follow_id": 1},
        )
        followed_by_me = bool(existing)

    return {
        "user_id": user_id,
        "followers_count": followers_count,
        "following_count": following_count,
        "followed_by_me": followed_by_me,
    }


# ====================== Delete clip / comment ======================

async def _is_admin(user_id: str) -> bool:
    if not user_id:
        return False
    # First, match by id/user_id/email directly in admins collection
    admin = await db.admins.find_one(
        {"$or": [
            {"id": user_id},
            {"user_id": user_id},
            {"email": user_id},
        ]},
        {"_id": 0, "id": 1},
    )
    if admin:
        return True
    # Fallback: look up the user by id and check their email against admins
    try:
        user = await db.users.find_one(
            {"$or": [{"id": user_id}, {"user_id": user_id}]},
            {"_id": 0, "email": 1, "role": 1, "is_admin": 1},
        )
        if user:
            if user.get("is_admin") or user.get("role") in ("admin", "super_admin"):
                return True
            email = (user.get("email") or "").strip().lower()
            if email:
                admin_by_email = await db.admins.find_one(
                    {"email": {"$regex": f"^{email}$", "$options": "i"}},
                    {"_id": 0, "id": 1},
                )
                if admin_by_email:
                    return True
    except Exception:
        pass
    return False


class DeleteClipRequest(BaseModel):
    user_id: str  # current user requesting deletion


@router.delete("/{clip_id}")
async def delete_clip(clip_id: str, user_id: str):
    """Delete a clip. Allowed for the clip owner or any admin."""
    clip = await db.clips_posts.find_one({"clip_id": clip_id}, {"_id": 0})
    if not clip:
        raise HTTPException(status_code=404, detail="المقطع غير موجود")

    is_owner = clip.get("user_id") == user_id
    is_admin = await _is_admin(user_id)
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="غير مصرح بحذف هذا المقطع")

    # Try to delete the local video file too (best-effort)
    try:
        video_url = (clip.get("video_url") or "").strip()
        if "/clips/media/" in video_url:
            filename = video_url.rsplit("/", 1)[-1]
            local = MEDIA_CLIPS_DIR / filename
            if local.exists():
                local.unlink()
    except Exception:
        pass

    await db.clips_posts.delete_one({"clip_id": clip_id})
    return {"success": True, "deleted": clip_id, "by_admin": is_admin}


@router.delete("/{clip_id}/comment/{comment_id}")
async def delete_clip_comment(clip_id: str, comment_id: str, user_id: str):
    """Delete a comment. Allowed for the comment owner, clip owner, or any admin."""
    clip = await db.clips_posts.find_one({"clip_id": clip_id}, {"_id": 0})
    if not clip:
        raise HTTPException(status_code=404, detail="المقطع غير موجود")

    comments = clip.get("comments") or []
    target = next((c for c in comments if c.get("comment_id") == comment_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="التعليق غير موجود")

    is_admin = await _is_admin(user_id)
    is_clip_owner = clip.get("user_id") == user_id
    is_comment_owner = target.get("user_id") == user_id
    if not (is_admin or is_clip_owner or is_comment_owner):
        raise HTTPException(status_code=403, detail="غير مصرح بحذف هذا التعليق")

    await db.clips_posts.update_one(
        {"clip_id": clip_id},
        {
            "$pull": {"comments": {"comment_id": comment_id}},
            "$inc": {"comments_count": -1},
        },
    )
    return {"success": True, "deleted": comment_id, "by_admin": is_admin}
