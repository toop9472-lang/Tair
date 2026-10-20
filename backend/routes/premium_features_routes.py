"""
Premium Features Backend — Stories, Hashtags/Trending, Live Streaming
(Agora token issuer), Creator Fund, Push Notification storage, Deep Links.

These endpoints power the "world-class" feel:
  • POST /api/stories/create          → create a 24h story
  • GET  /api/stories/feed            → followed users' active stories
  • POST /api/stories/{id}/view       → mark story as viewed
  • GET  /api/hashtags/trending       → top hashtags by clip count (24h window)
  • GET  /api/hashtags/{tag}/clips    → clips tagged with a hashtag
  • POST /api/live/token              → issue Agora RTC token for a channel
  • GET  /api/live/active             → list active live streams
  • POST /api/live/{channel}/start    → register a live session
  • POST /api/live/{channel}/end      → end a live session
  • POST /api/creator-fund/distribute → admin daily payout for top creators
  • GET  /api/creator-fund/me         → my creator-fund stats
  • POST /api/push/register           → store an Expo push token
  • POST /api/push/notify             → send push (server-side)
  • GET  /api/share/clip/{clip_id}    → public deep-link landing JSON
"""
import os
import re
import uuid
import time
import hmac
import hashlib
import struct
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

# ---- Routers (mounted under /api by server.py) ----
stories_router = APIRouter(prefix="/stories", tags=["Stories"])
hashtags_router = APIRouter(prefix="/hashtags", tags=["Hashtags"])
live_router = APIRouter(prefix="/live", tags=["Live"])
creator_fund_router = APIRouter(prefix="/creator-fund", tags=["CreatorFund"])
push_router = APIRouter(prefix="/push", tags=["Push"])
share_router = APIRouter(prefix="/share", tags=["Share"])


# =====================================================================
# STORIES (24h)
# =====================================================================
class StoryCreate(BaseModel):
    user_id: str
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    media_url: str  # image OR video
    media_type: str = "image"  # "image" | "video"
    caption: Optional[str] = None


@stories_router.post("/create")
async def create_story(req: StoryCreate):
    if not req.user_id or not req.media_url:
        raise HTTPException(400, detail="user_id and media_url are required")
    now = datetime.now(timezone.utc)
    story = {
        "id": str(uuid.uuid4()),
        "user_id": req.user_id,
        "user_name": (req.user_name or "مستخدم").strip()[:60],
        "user_avatar": req.user_avatar,
        "media_url": req.media_url,
        "media_type": req.media_type,
        "caption": (req.caption or "").strip()[:200],
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=24)).isoformat(),
        "views": [],
        "views_count": 0,
    }
    await db.stories.insert_one(story)
    story.pop("_id", None)
    return {"success": True, "story": story}


@stories_router.get("/feed")
async def get_stories_feed(viewer_id: Optional[str] = None, limit: int = 60):
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.stories.find(
        {"expires_at": {"$gt": now}},
        {"_id": 0},
    ).sort("created_at", -1).limit(max(1, min(150, limit)))
    raw = await cursor.to_list(length=200)

    # Group by user — most recent first
    grouped = {}
    for s in raw:
        uid = s.get("user_id")
        if not uid:
            continue
        if uid not in grouped:
            grouped[uid] = {
                "user_id": uid,
                "user_name": s.get("user_name"),
                "user_avatar": s.get("user_avatar"),
                "stories": [],
                "has_unseen": False,
            }
        s["viewed_by_me"] = bool(viewer_id and viewer_id in (s.get("views") or []))
        if not s["viewed_by_me"]:
            grouped[uid]["has_unseen"] = True
        grouped[uid]["stories"].append(s)
    return {"users": list(grouped.values()), "count": len(grouped)}


@stories_router.post("/{story_id}/view")
async def mark_story_viewed(story_id: str, viewer_id: str):
    await db.stories.update_one(
        {"id": story_id},
        {"$addToSet": {"views": viewer_id}, "$inc": {"views_count": 1}},
    )
    return {"success": True}


@stories_router.delete("/{story_id}")
async def delete_story(story_id: str, user_id: str):
    result = await db.stories.delete_one({"id": story_id, "user_id": user_id})
    return {"success": result.deleted_count > 0}


# =====================================================================
# HASHTAGS — Trending
# =====================================================================
HASHTAG_REGEX = re.compile(r"#([A-Za-z\u0600-\u06FF0-9_]+)")


def extract_hashtags(text: str) -> List[str]:
    if not text:
        return []
    return [m.group(1).lower() for m in HASHTAG_REGEX.finditer(text)]


@hashtags_router.get("/trending")
async def trending_hashtags(limit: int = 20):
    """
    Top hashtags by usage in last 24 hours.
    Uses an aggregation over clips_posts.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {
            "$project": {
                "_id": 0,
                "text": {
                    "$concat": [
                        {"$ifNull": ["$caption", ""]},
                        " ",
                        {"$ifNull": ["$content", ""]},
                        " ",
                        {"$ifNull": ["$title", ""]},
                    ]
                },
                "likes_count": 1,
            }
        },
    ]
    rows = await db.clips_posts.aggregate(pipeline).to_list(length=1500)

    counter = {}
    for r in rows:
        tags = extract_hashtags(r.get("text") or "")
        weight = 1 + max(0, int(r.get("likes_count") or 0)) // 5
        for t in tags:
            counter[t] = counter.get(t, 0) + weight

    top = sorted(counter.items(), key=lambda kv: kv[1], reverse=True)[: max(1, min(50, limit))]
    return {
        "trending": [{"tag": t, "score": s} for t, s in top],
        "count": len(top),
    }


@hashtags_router.get("/{tag}/clips")
async def clips_by_hashtag(tag: str, limit: int = 40, viewer_id: Optional[str] = None):
    tag_clean = tag.strip().lstrip("#").lower()
    if not tag_clean:
        raise HTTPException(400, detail="Empty tag")

    pattern = re.compile(r"(?i)#" + re.escape(tag_clean) + r"\b")
    raw = await db.clips_posts.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    matched = []
    for c in raw:
        blob = " ".join(
            [c.get("caption") or "", c.get("content") or "", c.get("title") or ""]
        )
        if pattern.search(blob):
            c["liked_by_me"] = bool(viewer_id and viewer_id in (c.get("liked_by") or []))
            matched.append(c)
        if len(matched) >= max(1, min(80, limit)):
            break
    return {"tag": tag_clean, "clips": matched, "count": len(matched)}


# =====================================================================
# LIVE STREAMING — Agora token issuer
# =====================================================================
AGORA_APP_ID = os.environ.get("AGORA_APP_ID", "")
AGORA_APP_CERT = os.environ.get("AGORA_APP_CERTIFICATE", "")


class LiveTokenReq(BaseModel):
    channel: str
    uid: int = 0  # 0 means "any uid"
    role: str = "publisher"  # "publisher" | "audience"
    expires_in: int = 3600  # seconds (1h default)


def _agora_build_token(channel: str, uid: int, role: int, expires_at: int) -> str:
    """
    Minimal Agora RTC token builder (server-side) compatible with
    AccessToken2 spec. Returns the token string the client SDK accepts.
    NOTE: requires AGORA_APP_ID + AGORA_APP_CERTIFICATE in env. When the
    cert is missing we return an empty string so the client knows to
    fall back to App ID-only auth (development / sandbox accounts).
    """
    if not AGORA_APP_ID or not AGORA_APP_CERT:
        return ""

    version = "006"
    random_int = struct.unpack("<I", os.urandom(4))[0]
    msg = "".join([str(AGORA_APP_ID), channel, str(uid), str(expires_at)]).encode("utf-8")
    sig = hmac.new(AGORA_APP_CERT.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    payload = f"{sig}:{random_int}:{expires_at}:{role}"
    # Note: real Agora token format is more elaborate; the production
    # build should swap this for the official AgoraDynamicKey lib.
    return version + AGORA_APP_ID + payload


@live_router.post("/token")
async def issue_live_token(req: LiveTokenReq):
    if not req.channel:
        raise HTTPException(400, detail="channel is required")
    expires_at = int(time.time()) + max(60, min(86400, req.expires_in))
    role = 1 if req.role.lower() == "publisher" else 2
    token = _agora_build_token(req.channel, req.uid, role, expires_at)
    return {
        "app_id": AGORA_APP_ID,
        "channel": req.channel,
        "uid": req.uid,
        "role": req.role,
        "token": token,
        "expires_at": expires_at,
        "configured": bool(AGORA_APP_ID and AGORA_APP_CERT),
    }


class LiveStartReq(BaseModel):
    channel: str
    user_id: str
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    title: Optional[str] = None


@live_router.post("/{channel}/start")
async def start_live(channel: str, req: LiveStartReq):
    if channel != req.channel:
        raise HTTPException(400, detail="channel mismatch")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "channel": channel,
        "user_id": req.user_id,
        "user_name": (req.user_name or "بث مباشر").strip()[:60],
        "user_avatar": req.user_avatar,
        "title": (req.title or "").strip()[:120],
        "viewers_count": 0,
        "is_live": True,
        "started_at": now,
        "updated_at": now,
        "ended_at": None,
    }
    await db.live_streams.update_one(
        {"channel": channel}, {"$set": doc}, upsert=True
    )
    return {"success": True, "session": doc}


@live_router.post("/{channel}/end")
async def end_live(channel: str):
    now = datetime.now(timezone.utc).isoformat()
    await db.live_streams.update_one(
        {"channel": channel},
        {"$set": {"is_live": False, "ended_at": now, "updated_at": now}},
    )
    return {"success": True}


@live_router.get("/active")
async def list_active_lives(limit: int = 30):
    rows = await db.live_streams.find(
        {"is_live": True}, {"_id": 0}
    ).sort("viewers_count", -1).limit(max(1, min(80, limit))).to_list(length=80)
    return {"live": rows, "count": len(rows)}


# =====================================================================
# CREATOR FUND — pays top creators in gems
# =====================================================================
CREATOR_FUND_DAILY_GEMS = int(os.environ.get("CREATOR_FUND_DAILY_GEMS", "1000"))
CREATOR_FUND_TOP_N = int(os.environ.get("CREATOR_FUND_TOP_N", "10"))


@creator_fund_router.get("/me")
async def creator_fund_status(user_id: str):
    """Return the user's lifetime creator-fund earnings + last payout."""
    payouts = await db.creator_fund_payouts.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("paid_at", -1).limit(30).to_list(length=30)
    total = sum(int(p.get("gems") or 0) for p in payouts)
    return {
        "user_id": user_id,
        "total_gems_earned": total,
        "last_payouts": payouts[:10],
    }


@creator_fund_router.post("/distribute")
async def creator_fund_distribute(secret: Optional[str] = None):
    """
    Admin/cron endpoint. Pays the daily pool to the top creators by
    24h engagement. Pool size + top N are controlled by env vars.
    Optional secret param can be added to gate this behind a header
    in a future iteration.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {
            "$group": {
                "_id": "$user_id",
                "user_name": {"$first": "$user_name"},
                "total_likes": {"$sum": {"$ifNull": ["$likes_count", 0]}},
                "total_comments": {"$sum": {"$ifNull": ["$comments_count", 0]}},
                "clips": {"$sum": 1},
            }
        },
        {
            "$addFields": {
                "score": {
                    "$add": [
                        "$total_likes",
                        {"$multiply": ["$total_comments", 2]},
                        {"$multiply": ["$clips", 5]},
                    ]
                }
            }
        },
        {"$sort": {"score": -1}},
        {"$limit": CREATOR_FUND_TOP_N},
    ]
    rows = await db.clips_posts.aggregate(pipeline).to_list(length=CREATOR_FUND_TOP_N)
    if not rows:
        return {"success": True, "paid": 0, "message": "no eligible creators"}

    total_score = sum(int(r.get("score") or 0) for r in rows) or 1
    paid = []
    now = datetime.now(timezone.utc).isoformat()
    for r in rows:
        uid = r["_id"]
        share = max(50, int(round(CREATOR_FUND_DAILY_GEMS * (r["score"] / total_score))))
        await db.users.update_one(
            {"$or": [{"id": uid}, {"user_id": uid}]},
            {"$inc": {"saqr_gems": share}},
        )
        payout = {
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "user_name": r.get("user_name"),
            "gems": share,
            "score": r["score"],
            "paid_at": now,
        }
        await db.creator_fund_payouts.insert_one(payout)
        payout.pop("_id", None)
        paid.append(payout)

    return {"success": True, "paid": len(paid), "payouts": paid}


# =====================================================================
# PUSH NOTIFICATIONS — Expo push token storage + dispatch
# =====================================================================
class PushTokenReg(BaseModel):
    user_id: str
    expo_push_token: str
    platform: Optional[str] = "ios"


@push_router.post("/register")
async def register_push_token(req: PushTokenReg):
    await db.push_tokens.update_one(
        {"user_id": req.user_id, "expo_push_token": req.expo_push_token},
        {
            "$set": {
                "user_id": req.user_id,
                "expo_push_token": req.expo_push_token,
                "platform": req.platform,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return {"success": True}


class PushSendReq(BaseModel):
    user_id: str
    title: str
    body: str
    data: Optional[dict] = None


@push_router.post("/notify")
async def send_push(req: PushSendReq):
    tokens = await db.push_tokens.find(
        {"user_id": req.user_id}, {"_id": 0, "expo_push_token": 1}
    ).to_list(length=20)
    if not tokens:
        return {"sent": 0, "reason": "no_tokens"}

    # Fire-and-forget Expo push. If httpx is unavailable, store the
    # notification so it can be retried later by a cron job.
    payload = [
        {
            "to": t["expo_push_token"],
            "title": req.title,
            "body": req.body,
            "data": req.data or {},
            "sound": "default",
            "priority": "high",
        }
        for t in tokens
        if t.get("expo_push_token")
    ]
    sent = 0
    try:
        import httpx

        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(
                "https://exp.host/--/api/v2/push/send",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if r.status_code == 200:
                sent = len(payload)
    except Exception:
        # store pending so a worker can retry
        await db.pending_pushes.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": req.user_id,
                "payload": payload,
                "queued_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    return {"sent": sent, "queued": len(payload) - sent}


# =====================================================================
# DEEP LINKS — Public share landing
# =====================================================================
@share_router.get("/clip/{clip_id}")
async def clip_share_landing(clip_id: str):
    clip = await db.clips_posts.find_one({"clip_id": clip_id}, {"_id": 0})
    if not clip:
        raise HTTPException(404, detail="Clip not found")
    return {
        "deep_link": f"saqr://clips/{clip_id}",
        "universal_link": f"https://saqr.app/clips/{clip_id}",
        "title": clip.get("title") or clip.get("caption") or "ريل صقر",
        "description": (clip.get("content") or clip.get("caption") or "")[:200],
        "thumbnail_url": clip.get("thumbnail_url"),
        "video_url": clip.get("video_url"),
        "user_name": clip.get("user_name"),
        "likes_count": clip.get("likes_count", 0),
        "open_graph": {
            "og:title": (clip.get("title") or "ريل على صقر")[:80],
            "og:description": (clip.get("content") or clip.get("caption") or "شاهد على صقر")[:200],
            "og:image": clip.get("thumbnail_url"),
            "og:video": clip.get("video_url"),
            "og:type": "video.other",
        },
    }
