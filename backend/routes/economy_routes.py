from datetime import datetime, timedelta, timezone
import os
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from pymongo import ReturnDocument

router = APIRouter(prefix="/economy", tags=["Economy"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

EXCHANGE_GEMS = 500
EXCHANGE_SAR = 3
AD_REWARD_GEMS = 5
AD_COOLDOWN_SECONDS = 15  # تخفيض من 45 إلى 15 ثانية بين الإعلانات
AD_DAILY_GEMS_LIMIT = 30
AD_DAILY_ADS_LIMIT = max(1, AD_DAILY_GEMS_LIMIT // AD_REWARD_GEMS)
MIN_AD_WATCH_SECONDS = 10  # تخفيض من 40 إلى 10 ثوانٍ (إعلانات AdMob المكافأة 15-30 ثانية فقط)
CHAT_MESSAGE_COST = 0
EMPTY_DIAMONDS = 0

# AdMob-attested watches (rewarded ads) are trusted by Google. We allow them
# to bypass the local watch_duration check because Google guarantees completion.
ADMOB_TRUSTED_AD_TYPES = {"admob_rewarded", "admob"}


def _user_filter(user_id: str):
    return {"$or": [{"id": user_id}, {"user_id": user_id}]}


def _gems_to_sar(gems: int) -> float:
    return round((float(gems) / float(EXCHANGE_GEMS)) * float(EXCHANGE_SAR), 3)


async def _fetch_user(user_id: str, projection=None):
    user = await db.users.find_one(_user_filter(user_id), projection)
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    return user


def _disabled_message():
    raise HTTPException(
        status_code=410,
        detail="تم إلغاء نظام الألماس والميزات المدفوعة. التطبيق يعمل بجواهر صقر فقط من الإعلانات.",
    )


def _is_allowed_ad_source(source: str) -> bool:
    normalized = (source or "").strip().lower()
    allowed_prefixes = (
        "ad_",
        "watch_ad",
        "rewarded_ad",
        "adwatch",
        "admob",
    )
    return normalized.startswith(allowed_prefixes)


async def _get_today_ad_progress(user_id: str):
    today_prefix = datetime.now(timezone.utc).date().isoformat()
    today_stats = await db.ad_watch_history.aggregate(
        [
            {"$match": {"user_id": user_id, "timestamp": {"$regex": f"^{today_prefix}"}}},
            {"$group": {"_id": None, "count": {"$sum": 1}, "gems": {"$sum": "$gems_earned"}}},
        ]
    ).to_list(1)
    today_count = int(today_stats[0]["count"]) if today_stats else 0
    today_gems = int(today_stats[0]["gems"]) if today_stats else 0
    return today_count, today_gems


def _build_daily_challenge_payload(today_count: int, today_gems: int):
    return {
        "daily_goal_ads": AD_DAILY_ADS_LIMIT,
        "daily_goal_gems": AD_DAILY_GEMS_LIMIT,
        "remaining_ads_today": max(0, AD_DAILY_ADS_LIMIT - today_count),
        "remaining_gems_today": max(0, AD_DAILY_GEMS_LIMIT - today_gems),
        "challenge_completed": today_gems >= AD_DAILY_GEMS_LIMIT,
    }


class PurchasePackageRequest(BaseModel):
    user_id: str
    package_id: str


class PurchaseFeatureBundleRequest(BaseModel):
    user_id: str
    bundle_id: str


class EquipFeatureBundleRequest(BaseModel):
    user_id: str
    bundle_id: str


class SpendDiamondsRequest(BaseModel):
    user_id: str
    game_id: str
    is_online: bool


class GameResultRequest(BaseModel):
    user_id: str
    game_id: str
    is_online: bool
    won: bool
    opponent_diamonds: int = 0


class ClaimDailyRewardRequest(BaseModel):
    user_id: str


class AddDiamondsRequest(BaseModel):
    user_id: str
    amount: int
    source: str = "ad_reward"


class SpendDiamondsDirectRequest(BaseModel):
    user_id: str
    amount: int
    source: str = "game_round"
    game_id: Optional[str] = None


class AdWatchRewardRequest(BaseModel):
    user_id: str
    watch_duration_seconds: int
    ad_type: str = "video"


class AddSaqrGemsRequest(BaseModel):
    user_id: str
    amount: int
    source: str = "ad_reward"


class SendChatMessageRequest(BaseModel):
    user_id: str
    server_id: str
    message: str
    user_name: str
    user_avatar: Optional[str] = None


@router.get("/balance/{user_id}")
async def get_user_balance(user_id: str):
    user = await _fetch_user(
        user_id,
        {"_id": 0, "saqr_points": 1, "saqr_gems": 1, "points": 1},
    )
    today_count, today_gems = await _get_today_ad_progress(user_id)
    saqr_gems = int(
        user.get("saqr_gems", user.get("saqr_points", user.get("points", 0))) or 0
    )
    return {
        "saqr_points": saqr_gems,
        "diamonds": EMPTY_DIAMONDS,
        "saqr_gems": saqr_gems,
        "saqr_gems_value_sar": _gems_to_sar(saqr_gems),
        "daily_points_earned": today_gems,
        "daily_points_remaining": max(0, AD_DAILY_GEMS_LIMIT - today_gems),
        "daily_limit": AD_DAILY_GEMS_LIMIT,
        "today_ads_watched": today_count,
        "daily_goal_ads": AD_DAILY_ADS_LIMIT,
        "chat_message_cost": CHAT_MESSAGE_COST,
        "exchange_rate": f"{EXCHANGE_GEMS} جوهرة صقر = {EXCHANGE_SAR} ريال سعودي",
    }


@router.get("/packages")
async def get_diamond_packages():
    return {"packages": [], "currency": "SAR", "currency_symbol": "ر.س"}


@router.get("/feature-bundles")
async def get_feature_bundles():
    return {"bundles": [], "currency": "saqr_gems"}


@router.get("/my-feature-bundles/{user_id}")
async def get_my_feature_bundles(user_id: str):
    await _fetch_user(user_id, {"_id": 0, "id": 1})
    return {"owned_bundle_ids": [], "owned_bundles": [], "active_feature_slots": {}}


@router.post("/purchase-feature-bundle")
async def purchase_feature_bundle(request: PurchaseFeatureBundleRequest):
    _disabled_message()


@router.post("/equip-feature-bundle")
async def equip_feature_bundle(request: EquipFeatureBundleRequest):
    _disabled_message()


@router.post("/purchase-diamonds")
async def purchase_diamonds(request: PurchasePackageRequest):
    _disabled_message()


@router.post("/enter-game")
async def enter_online_game(request: SpendDiamondsRequest):
    return {"success": True, "cost": 0, "remaining": EMPTY_DIAMONDS, "message": "مجاني"}


@router.post("/game-result")
async def record_game_result(request: GameResultRequest):
    return {
        "success": True,
        "gems_awarded": 0,
        "points_awarded": 0,
        "diamonds_awarded": 0,
        "daily_points_earned": 0,
        "daily_limit": 0,
        "can_earn_more": False,
        "message": "تم إلغاء مكافآت الألعاب. المكافآت الآن من الإعلانات فقط.",
    }


@router.get("/daily-login-status/{user_id}")
async def get_daily_login_status(user_id: str):
    await _fetch_user(user_id, {"_id": 0, "id": 1})
    return {
        "should_show_reward": False,
        "current_streak": 0,
        "today_claimed": True,
        "rewards": [],
        "next_reward": None,
        "message": "تم إيقاف مكافآت الدخول اليومي. المكافآت من الإعلانات فقط.",
    }


@router.post("/claim-daily-reward")
async def claim_daily_reward(request: ClaimDailyRewardRequest):
    raise HTTPException(
        status_code=410,
        detail="تم إيقاف مكافآت الدخول اليومي. جواهر صقر تُكتسب من مشاهدة الإعلانات فقط.",
    )


@router.get("/leaderboard")
async def get_leaderboard():
    pipeline = [
        {
            "$project": {
                "_id": 0,
                "user_id": {"$ifNull": ["$id", "$user_id"]},
                "name": 1,
                "saqr_gems": {
                    "$ifNull": ["$saqr_gems", {"$ifNull": ["$saqr_points", "$points"]}]
                },
                "saqr_points": {
                    "$ifNull": ["$saqr_gems", {"$ifNull": ["$saqr_points", "$points"]}]
                },
                "avatar": 1,
            }
        },
        {"$sort": {"saqr_gems": -1}},
        {"$limit": 20},
    ]
    leaders = await db.users.aggregate(pipeline).to_list(20)
    for idx, leader in enumerate(leaders):
        leader["rank"] = idx + 1
        leader["reward"] = 0
    return {
        "leaderboard": leaders,
        "rewards": {},
        "description": "الترتيب يعتمد على جواهر صقر المكتسبة من الإعلانات.",
    }


@router.get("/game-costs")
async def get_game_costs():
    return {"online_costs": {}, "winner_bonuses": {}, "solo_round_cost": 0, "note": "مجاني"}


@router.post("/initialize-user/{user_id}")
async def initialize_user_economy(user_id: str):
    user = await _fetch_user(user_id, None)
    saqr_gems = int(
        user.get("saqr_gems", user.get("saqr_points", user.get("points", 0))) or 0
    )
    await db.users.update_one(
        _user_filter(user_id),
        {
            "$set": {
                "diamonds": EMPTY_DIAMONDS,
                "saqr_points": saqr_gems,
                "saqr_gems": saqr_gems,
                "economy_initialized": True,
            }
        },
    )
    return {
        "success": True,
        "initial_diamonds": EMPTY_DIAMONDS,
        "initial_saqr_gems": saqr_gems,
        "message": "تم تهيئة الاقتصاد: جواهر صقر فقط.",
    }


@router.post("/add-diamonds")
async def add_diamonds_reward(request: AddDiamondsRequest):
    _disabled_message()


@router.post("/spend-diamonds")
async def spend_diamonds(request: SpendDiamondsDirectRequest):
    _disabled_message()


@router.post("/ad-watch-reward")
async def claim_ad_watch_reward(request: AdWatchRewardRequest):
    # AdMob rewarded ads are attested by Google — bypass the local watch
    # duration minimum (AdMob ads are 15-30s typically). Personal ads still
    # require the minimum watch threshold.
    ad_type_norm = str(request.ad_type or "").strip().lower()
    is_admob_trusted = ad_type_norm in ADMOB_TRUSTED_AD_TYPES

    if not is_admob_trusted and int(request.watch_duration_seconds or 0) < MIN_AD_WATCH_SECONDS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "watch_duration_too_short",
                "message": "مدة مشاهدة الإعلان غير كافية لاحتساب المكافأة.",
                "required_seconds": MIN_AD_WATCH_SECONDS,
            },
        )

    user = await _fetch_user(
        request.user_id,
        {"_id": 0, "saqr_gems": 1, "ad_last_claim_at": 1, "total_ads_watched": 1},
    )
    now_dt = datetime.now(timezone.utc)
    last_claim_raw = user.get("ad_last_claim_at")
    if last_claim_raw:
        try:
            last_claim_dt = datetime.fromisoformat(str(last_claim_raw).replace("Z", "+00:00"))
            if last_claim_dt.tzinfo is None:
                last_claim_dt = last_claim_dt.replace(tzinfo=timezone.utc)
            if (now_dt - last_claim_dt).total_seconds() < AD_COOLDOWN_SECONDS:
                raise HTTPException(
                    status_code=429,
                    detail={"error": "ad_cooldown", "message": "يرجى الانتظار قليلاً قبل إعلان جديد."},
                )
        except HTTPException:
            raise
        except Exception:
            pass

    today_count, today_gems = await _get_today_ad_progress(request.user_id)
    new_gems = int(user.get("saqr_gems", 0) or 0) + AD_REWARD_GEMS
    updated_total_ads = int(user.get("total_ads_watched", 0) or 0) + 1
    updated_today_count = today_count + 1
    updated_today_gems = today_gems + AD_REWARD_GEMS
    await db.users.update_one(
        _user_filter(request.user_id),
        {
            "$set": {"saqr_gems": new_gems, "ad_last_claim_at": now_dt.isoformat(), "diamonds": EMPTY_DIAMONDS},
            "$inc": {
                "saqr_points": AD_REWARD_GEMS,
                "points": AD_REWARD_GEMS,
                "total_ads_watched": 1,
                "total_ad_gems": AD_REWARD_GEMS,
            },
            "$push": {
                "saqr_gems_transactions": {
                    "type": "ad_watch",
                    "amount": AD_REWARD_GEMS,
                    "duration_seconds": request.watch_duration_seconds,
                    "ad_type": request.ad_type,
                    "timestamp": now_dt.isoformat(),
                    "balance_after": new_gems,
                }
            },
        },
    )
    await db.ad_watch_history.insert_one(
        {
            "user_id": request.user_id,
            "gems_earned": AD_REWARD_GEMS,
            "diamonds_earned": 0,
            "duration_seconds": request.watch_duration_seconds,
            "ad_type": request.ad_type,
            "timestamp": now_dt.isoformat(),
        }
    )
    return {
        "success": True,
        "saqr_gems_earned": AD_REWARD_GEMS,
        "diamonds_earned": 0,
        "new_gems_balance": new_gems,
        "new_diamonds_balance": EMPTY_DIAMONDS,
        "total_ads_watched": updated_total_ads,
        "today_ads_watched": updated_today_count,
        "today_gems_earned": updated_today_gems,
        **_build_daily_challenge_payload(updated_today_count, updated_today_gems),
        "carry_seconds": 0,
        "saqr_gems_value_sar": _gems_to_sar(new_gems),
        "exchange_rate": f"{EXCHANGE_GEMS} جوهرة صقر = {EXCHANGE_SAR} ريال سعودي",
        "message": f"حصلت على {AD_REWARD_GEMS} جوهرة صقر.",
    }


@router.get("/ad-stats/{user_id}")
async def get_ad_stats(user_id: str):
    user = await _fetch_user(
        user_id,
        {"_id": 0, "total_ads_watched": 1, "total_ad_gems": 1, "saqr_gems": 1},
    )
    today_count, today_gems = await _get_today_ad_progress(user_id)
    return {
        "total_ads_watched": int(user.get("total_ads_watched", 0) or 0),
        "total_ad_gems": int(user.get("total_ad_gems", 0) or 0),
        "today_ads_watched": today_count,
        "today_gems_earned": today_gems,
        **_build_daily_challenge_payload(today_count, today_gems),
        "current_saqr_gems": int(user.get("saqr_gems", 0) or 0),
        "current_diamonds": EMPTY_DIAMONDS,
        "exchange_rate": f"{EXCHANGE_GEMS} جوهرة صقر = {EXCHANGE_SAR} ريال سعودي",
    }


@router.post("/claim-chest-reward")
async def claim_chest_reward():
    raise HTTPException(
        status_code=410,
        detail="تم إيقاف صناديق الجوائز المالية. كل إعلان يمنح 5 جواهر صقر فقط.",
    )


@router.post("/add-saqr-gems")
async def add_saqr_gems(request: AddSaqrGemsRequest):
    if request.amount != AD_REWARD_GEMS:
        raise HTTPException(status_code=400, detail=f"قيمة المكافأة يجب أن تكون {AD_REWARD_GEMS} جواهر.")
    if not _is_allowed_ad_source(request.source):
        raise HTTPException(status_code=400, detail="مصدر الجواهر يجب أن يكون إعلاناً.")
    user = await _fetch_user(
        request.user_id,
        {"_id": 0, "id": 1, "saqr_gems": 1, "total_ads_watched": 1},
    )
    today_count, today_gems = await _get_today_ad_progress(request.user_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    result = await db.users.find_one_and_update(
        _user_filter(request.user_id),
        {
            "$inc": {
                "saqr_gems": AD_REWARD_GEMS,
                "saqr_points": AD_REWARD_GEMS,
                "points": AD_REWARD_GEMS,
                "total_ad_gems": AD_REWARD_GEMS,
                "total_ads_watched": 1,
            },
            "$set": {"diamonds": EMPTY_DIAMONDS},
            "$push": {
                "saqr_gems_transactions": {
                    "type": request.source,
                    "amount": AD_REWARD_GEMS,
                    "timestamp": now_iso,
                }
            },
        },
        projection={"_id": 0, "saqr_gems": 1},
        return_document=ReturnDocument.AFTER,
    )
    await db.ad_watch_history.insert_one(
        {
            "user_id": request.user_id,
            "gems_earned": AD_REWARD_GEMS,
            "diamonds_earned": 0,
            "duration_seconds": 60,
            "ad_type": request.source,
            "timestamp": now_iso,
        }
    )
    new_balance = int((result or {}).get("saqr_gems", 0) or 0)
    updated_today_count = today_count + 1
    updated_total_ads = int(user.get("total_ads_watched", 0) or 0) + 1
    updated_today_gems = today_gems + AD_REWARD_GEMS
    return {
        "success": True,
        "gems_earned": AD_REWARD_GEMS,
        "saqr_gems_earned": AD_REWARD_GEMS,
        "total_ads_watched": updated_total_ads,
        "today_ads_watched": updated_today_count,
        "today_gems_earned": updated_today_gems,
        **_build_daily_challenge_payload(updated_today_count, updated_today_gems),
        "new_balance": new_balance,
        "saqr_gems_value_sar": _gems_to_sar(new_balance),
        "message": f"حصلت على {AD_REWARD_GEMS} جوهرة صقر.",
    }

@router.get("/ad-challenge/{user_id}")
async def get_ad_challenge_status(user_id: str):
    user = await _fetch_user(
        user_id,
        {"_id": 0, "total_ads_watched": 1, "total_ad_gems": 1, "saqr_gems": 1},
    )
    today_count, today_gems = await _get_today_ad_progress(user_id)
    return {
        "challenge_type": "admob_daily",
        "reward_per_ad_gems": AD_REWARD_GEMS,
        "today_ads_watched": today_count,
        "today_gems_earned": today_gems,
        **_build_daily_challenge_payload(today_count, today_gems),
        "total_ads_watched": int(user.get("total_ads_watched", 0) or 0),
        "total_ad_gems": int(user.get("total_ad_gems", 0) or 0),
        "current_saqr_gems": int(user.get("saqr_gems", 0) or 0),
        "exchange_rate": f"{EXCHANGE_GEMS} جوهرة صقر = {EXCHANGE_SAR} ريال سعودي",
    }


@router.get("/saqr-gems/{user_id}")
async def get_saqr_gems(user_id: str):
    user = await _fetch_user(user_id, {"_id": 0, "saqr_gems": 1})
    gems = int(user.get("saqr_gems", 0) or 0)
    return {
        "saqr_gems": gems,
        "saqr_gems_value_sar": _gems_to_sar(gems),
        "exchange_rate": f"{EXCHANGE_GEMS} جوهرة صقر = {EXCHANGE_SAR} ريال سعودي",
    }


@router.post("/chat/send")
async def send_chat_message(request: SendChatMessageRequest):
    # Chat is intentionally free and should also work for guest/transient IDs.
    # We therefore do not block sending when the user record does not exist yet.
    text = (request.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="الرسالة فارغة")

    # SECURITY: Block URLs/links in chat messages.
    # This protects users from phishing/spam and matches the platform policy.
    import re
    url_pattern = re.compile(
        r"(?ix)"
        r"("
        r"https?://[^\s]+"
        r"|www\.[^\s]+"
        r"|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:/[^\s]*)?"
        r"|t\.me/[^\s]+|wa\.me/[^\s]+|bit\.ly/[^\s]+"
        r")"
    )
    if url_pattern.search(text):
        raise HTTPException(
            status_code=400,
            detail="🚫 لا يُسمح بإرسال الروابط في الدردشة. يرجى إعادة كتابة رسالتك بدون روابط.",
        )

    # SECURITY: Block profane language (Arabic + English).
    try:
        from routes.moderation_routes import contains_profanity
        hit = contains_profanity(text)
        if hit:
            raise HTTPException(
                status_code=400,
                detail="🚫 لا يُسمح بالألفاظ النابية في الدردشة. يرجى احترام المستخدمين الآخرين.",
            )
    except HTTPException:
        raise
    except Exception:
        pass

    message_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    safe_user_name = (request.user_name or "مستخدم").strip()[:60] or "مستخدم"
    safe_avatar = request.user_avatar if isinstance(request.user_avatar, str) else None
    chat_message = {
        "id": message_id,
        "user_id": request.user_id,
        "user_name": safe_user_name,
        "user_avatar": safe_avatar,
        "message": text,
        "server_id": request.server_id,
        "timestamp": timestamp,
    }
    await db.chat_messages.insert_one(chat_message)
    chat_message.pop("_id", None)
    return {
        "success": True,
        "message_id": message_id,
        "diamonds_spent": 0,
        "saqr_gems_spent": 0,
        "new_balance": None,
        "chat_message": chat_message,
    }


@router.get("/chat/messages/{server_id}")
async def get_chat_messages(server_id: str, limit: int = 50, before: Optional[str] = None):
    query = {"server_id": server_id}
    if before:
        query["timestamp"] = {"$lt": before}
    normalized_limit = max(1, min(int(limit or 50), 200))
    messages = await db.chat_messages.find(query, {"_id": 0}).sort("timestamp", -1).limit(normalized_limit).to_list(normalized_limit)
    messages.reverse()

    # AUTO-PURGE: silently remove any legacy messages that contain links
    # so users never see URLs in the chat after the new policy.
    import re as _re
    _url_re = _re.compile(
        r"(?ix)(https?://[^\s]+|www\.[^\s]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:/[^\s]*)?|t\.me/[^\s]+|wa\.me/[^\s]+|bit\.ly/[^\s]+)"
    )
    leaked_ids = [
        (m or {}).get("id")
        for m in messages
        if (m or {}).get("message") and _url_re.search((m or {}).get("message") or "")
    ]
    if leaked_ids:
        try:
            await db.chat_messages.delete_many({"id": {"$in": [x for x in leaked_ids if x]}})
        except Exception:
            pass
        messages = [m for m in messages if (m or {}).get("id") not in leaked_ids]

    active_users = len({(msg or {}).get("user_id") for msg in messages if (msg or {}).get("user_id")})
    return {
        "server_id": server_id,
        "messages": messages,
        "count": len(messages),
        "online_users_count": max(1, active_users),
    }


@router.delete("/chat/messages/{message_id}")
async def delete_chat_message(message_id: str, user_id: str):
    """Delete a chat message. Allowed for the message author or any admin."""
    message = await db.chat_messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="الرسالة غير موجودة")
    is_owner = message.get("user_id") == user_id
    admin = await db.admins.find_one(
        {"$or": [
            {"id": user_id},
            {"user_id": user_id},
            {"email": user_id},
        ]},
        {"_id": 0, "id": 1},
    )
    is_admin = bool(admin)
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="غير مصرح بحذف هذه الرسالة")
    await db.chat_messages.delete_one({"id": message_id})
    return {"success": True, "deleted": message_id, "by_admin": is_admin}


@router.get("/chat/servers")
async def get_chat_servers():
    servers = [
        {
            "id": "arabic",
            "name": "السيرفر العربي",
            "icon": "flag",
            "language": "ar",
            "description": "دردشة باللغة العربية",
        },
        {
            "id": "english",
            "name": "English Server",
            "icon": "globe",
            "language": "en",
            "description": "Chat in English",
        },
        {
            "id": "global",
            "name": "السيرفر العالمي",
            "icon": "earth",
            "language": "multi",
            "description": "دردشة متعددة اللغات",
        },
    ]
    since = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    for server in servers:
        server["recent_messages"] = await db.chat_messages.count_documents(
            {"server_id": server["id"], "timestamp": {"$gte": since}}
        )
    return {"servers": servers, "message_cost": 0, "is_free": True}


@router.get("/chat/check-balance/{user_id}")
async def check_chat_balance(user_id: str):
    # Keep endpoint permissive for guests because chat is free.
    return {
        "diamonds": 0,
        "saqr_gems": 0,
        "can_send": True,
        "messages_available": 999999,
        "message_cost": 0,
        "message": "الدردشة مجانية بالكامل",
    }
