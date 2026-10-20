"""Clinic Topics + Library — طير العيادة
Full forum-style clinic page replacing the live chat.
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends

from services.moderation import moderator_scopes
from auth.actor import require_actor
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/clinic", tags=["Clinic Topics"])

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]


def _now():
    return datetime.now(timezone.utc)


def _clean(d: dict) -> dict:
    if not d:
        return {}
    d.pop("_id", None)
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


async def _is_admin_or_mod(user_id: str, scope: str = "clinic") -> bool:
    if not user_id:
        return False
    # Primary source — admins collection (contains all registered admins)
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
    return scope in scopes or "general" in scopes or "clinic_admin" in scopes


async def _identity_keys(user_id: str) -> set:
    keys = {user_id} if user_id else set()
    if not user_id:
        return keys
    user = await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1, "user_id": 1, "email": 1},
    )
    if user:
        for key in ("id", "user_id", "email"):
            if user.get(key):
                keys.add(user[key])
    return keys


async def _clinic_staff_ids() -> list:
    """مشرفو العيادة ومديرها والمشرف العام والمدير. التنبيه يصلهم داخل التطبيق وعلى الجوال."""
    ids = []
    async for mod in db.tair_moderators.find({}, {"_id": 0, "user_id": 1, "scopes": 1}):
        scopes = mod.get("scopes") or []
        if isinstance(scopes, str):
            scopes = [scopes]
        if any(s in scopes for s in ("clinic", "clinic_admin", "general")) and mod.get("user_id"):
            ids.append(mod["user_id"])
    async for admin in db.admins.find({}, {"_id": 0, "id": 1, "user_id": 1, "email": 1}):
        uid = admin.get("user_id") or admin.get("id") or admin.get("email")
        if uid:
            ids.append(uid)
    async for user in db.users.find(
        {"$or": [{"is_admin": True}, {"role": {"$in": ["admin", "super_admin"]}}]},
        {"_id": 0, "id": 1, "user_id": 1, "email": 1},
    ):
        uid = user.get("user_id") or user.get("id") or user.get("email")
        if uid:
            ids.append(uid)
    return ids


async def _notify_people(raw_ids, exclude_ids, title, body, notif_type, data):
    blocked = set()
    for eid in exclude_ids or []:
        blocked |= await _identity_keys(eid)
    sent = set()
    try:
        from routes.tair_notifications_routes import create_tair_notification
    except Exception as exc:
        logger.warning("clinic notify import failed: %s", exc)
        return
    for uid in raw_ids or []:
        if not uid or uid == "clinic_bot":
            continue
        keys = await _identity_keys(uid)
        if keys & blocked or keys & sent:
            continue
        sent |= keys
        try:
            await create_tair_notification(
                user_id=uid,
                title=title,
                body=body,
                notif_type=notif_type,
                data=data,
            )
        except Exception as exc:
            logger.warning("clinic notify failed for %s: %s", uid, exc)


# ============== CLINIC BOT TOGGLE ==============
async def _bot_enabled() -> bool:
    s = await db.tair_app_settings.find_one({"key": "clinic_bot"}, {"_id": 0, "enabled": 1})
    return True if not s else bool(s.get("enabled", True))


@router.get("/bot/status")
async def bot_status():
    return {"enabled": await _bot_enabled()}


@router.post("/bot/toggle")
async def bot_toggle(enabled: bool = Query(...), user_id: str = Query(...), actor: str = Depends(require_actor)):
    if not await _is_admin_or_mod(user_id):
        raise HTTPException(403, "غير مصرح")
    await db.tair_app_settings.update_one(
        {"key": "clinic_bot"},
        {"$set": {"key": "clinic_bot", "enabled": enabled, "updated_by": user_id, "updated_at": _now()}},
        upsert=True,
    )
    return {"success": True, "enabled": enabled}


# ============== TOPICS ==============
class Topic(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=4000)
    images: List[str] = Field(default_factory=list, max_items=10)
    videos: List[str] = Field(default_factory=list, max_items=3)
    # Questionnaire (all optional, stored verbatim)
    q_lethargy: Optional[str] = ""        # هل يوجد خمول؟
    q_appetite: Optional[str] = ""         # قلة الشهية
    q_onset: Optional[str] = ""            # متى بدأت الأعراض
    q_diet: Optional[str] = ""             # تغذية الطير
    q_gender: Optional[str] = ""           # ذكر/أنثى
    q_breeding: Optional[str] = ""         # حضن/تزاوج
    q_medications: Optional[str] = ""      # أدوية
    q_seen_vet: Optional[str] = ""         # عرض على دكتور
    q_age: Optional[str] = ""              # العمر
    q_time_with_owner: Optional[str] = ""  # كم له عايش عندك
    q_tame: Optional[str] = ""             # أليف
    q_vomits: Optional[str] = ""           # يستفرغ
    q_mouth_droppings: Optional[str] = ""  # نقاط فم/براز
    # Chick-specific
    is_chick: Optional[bool] = False
    chick_serelac_brand: Optional[str] = ""
    chick_exact_age: Optional[str] = ""
    chick_serelac_temp: Optional[str] = ""
    chick_feeding_count: Optional[str] = ""
    chick_feeding_method: Optional[str] = ""
    chick_serelac_leftover: Optional[str] = ""


async def _enrich_topic(t: dict):
    """Re-fill user_name/user_avatar from users table (so profile changes propagate)."""
    uid = t.get("user_id")
    if uid:
        u = await db.users.find_one(
            {"$or": [{"user_id": uid}, {"email": uid}, {"id": uid}]},
            {"_id": 0, "name": 1, "avatar": 1, "profile_image": 1},
        ) or {}
        if not t.get("user_name") or t.get("user_name") == "مستخدم":
            t["user_name"] = u.get("name") or t.get("user_name") or "مستخدم"
        if not t.get("user_avatar"):
            t["user_avatar"] = u.get("avatar") or u.get("profile_image")
    return t


@router.get("/topics")
async def list_topics(limit: int = Query(30, le=100), skip: int = 0):
    cursor = db.tair_clinic_topics.find({"status": {"$ne": "deleted"}}).sort("created_at", -1).skip(skip).limit(limit)
    items = [_clean(d) async for d in cursor]
    for t in items:
        await _enrich_topic(t)
    return {"items": items, "count": len(items)}


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str):
    t = await db.tair_clinic_topics.find_one({"topic_id": topic_id})
    if not t:
        raise HTTPException(404, "الموضوع غير موجود")
    # Increment views
    await db.tair_clinic_topics.update_one({"topic_id": topic_id}, {"$inc": {"views_count": 1}})
    cleaned = _clean(t)
    await _enrich_topic(cleaned)
    return cleaned


@router.post("/topics")
async def create_topic(payload: Topic, user_id: str = Query(...)):
    # Check scope ban
    ban = await db.tair_scope_bans.find_one({"user_id": user_id, "scope": "clinic"})
    if ban:
        raise HTTPException(403, "أنت محظور من التفاعل مع صفحة العيادة")
    user = await db.users.find_one(
        {"$or": [{"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "name": 1, "avatar": 1, "profile_image": 1},
    )
    tid = f"ctop_{uuid.uuid4().hex[:12]}"
    data = payload.model_dump()
    data.update({
        "topic_id": tid,
        "user_id": user_id,
        "user_name": (user or {}).get("name") or "مستخدم",
        "user_avatar": (user or {}).get("avatar") or (user or {}).get("profile_image"),
        "created_at": _now(),
        "replies_count": 0,
        "views_count": 0,
        "status": "open",
    })
    await db.tair_clinic_topics.insert_one(data)
    try:
        await _notify_people(
            await _clinic_staff_ids(),
            [user_id],
            "موضوع جديد في العيادة",
            f"{data['user_name']}: {payload.title}",
            "clinic_topic",
            {"topic_id": tid},
        )
    except Exception as exc:
        logger.warning("clinic topic notify failed: %s", exc)

    # 🤖 Auto-reply from Clinic Bot (if enabled by admins)
    try:
        if not await _bot_enabled():
            return {"success": True, "topic_id": tid}
        from services.clinic_bot import build_reply_async
        q_lines = []
        for label, val in (
            ("خمول", payload.q_lethargy),
            ("الشهية", payload.q_appetite),
            ("بداية الأعراض", payload.q_onset),
            ("التغذية", payload.q_diet),
            ("الجنس", payload.q_gender),
            ("التكاثر", payload.q_breeding),
            ("العمر", payload.q_age),
            ("استفراغ", payload.q_vomits),
            ("الفم والفضلات", payload.q_mouth_droppings),
        ):
            if val:
                q_lines.append(f"{label}: {val}")
        if payload.is_chick:
            q_lines.append("فرخ صغير")
            if payload.chick_exact_age:
                q_lines.append(f"عمر الفرخ: {payload.chick_exact_age}")
        bot_context_text = "\n".join(
            [payload.title or "", payload.description or "", *q_lines]
        )
        bot_result = await build_reply_async(bot_context_text, species_hint=None)
        bot_reply_doc = {
            "reply_id": f"crep_{uuid.uuid4().hex[:12]}",
            "topic_id": tid,
            "user_id": "clinic_bot",
            "user_name": "🤖 بوت العيادة",
            "user_avatar": None,
            "is_moderator": False,
            "is_bot": True,
            "bot_confidence": bot_result.get("confidence", 0),
            "bot_matched": bot_result.get("matched", False),
            "text": bot_result.get("reply", ""),
            "images": [],
            "created_at": _now(),
        }
        await db.tair_clinic_replies.insert_one(bot_reply_doc)
        await db.tair_clinic_topics.update_one(
            {"topic_id": tid},
            {"$inc": {"replies_count": 1}},
        )
        preview = (bot_result.get("reply") or "").strip().replace("\n", " ")
        if len(preview) > 90:
            preview = preview[:87] + "..."
        await _notify_people(
            [user_id],
            [],
            "رد أولي من بوت العيادة",
            preview or "وصل رد أولي على موضوعك. انتظر تأكيد المشرف.",
            "clinic_reply",
            {"topic_id": tid},
        )
    except Exception as e:
        logger.warning("Clinic bot failed to post initial reply: %s", e)

    return {"success": True, "topic_id": tid}


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    t = await db.tair_clinic_topics.find_one({"topic_id": topic_id})
    if not t:
        raise HTTPException(404, "الموضوع غير موجود")
    if t.get("user_id") != user_id and not await _is_admin_or_mod(user_id):
        raise HTTPException(403, "غير مصرح")
    await db.tair_clinic_topics.delete_one({"topic_id": topic_id})
    await db.tair_clinic_replies.delete_many({"topic_id": topic_id})
    return {"success": True}


# ============== REPLIES ==============
class Reply(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    images: List[str] = Field(default_factory=list, max_items=5)


@router.get("/topics/{topic_id}/replies")
async def list_replies(topic_id: str, limit: int = Query(100, le=200)):
    cursor = db.tair_clinic_replies.find({"topic_id": topic_id}).sort("created_at", 1).limit(limit)
    items = [_clean(d) async for d in cursor]
    # Re-evaluate name/avatar + is_moderator so badges & profile info are current
    uids = list({m.get("user_id") for m in items if m.get("user_id")})
    user_map = {}
    mod_map = {}
    for uid in uids:
        u = await db.users.find_one(
            {"$or": [{"user_id": uid}, {"email": uid}, {"id": uid}]},
            {"_id": 0, "name": 1, "avatar": 1, "profile_image": 1},
        )
        user_map[uid] = u or {}
        mod_map[uid] = await _is_admin_or_mod(uid)
    for m in items:
        uid = m.get("user_id")
        u = user_map.get(uid) or {}
        if not m.get("user_name") or m.get("user_name") == "مستخدم":
            m["user_name"] = u.get("name") or m.get("user_name") or "مستخدم"
        if not m.get("user_avatar"):
            m["user_avatar"] = u.get("avatar") or u.get("profile_image")
        m["is_moderator"] = bool(mod_map.get(uid, m.get("is_moderator", False)))
    return {"items": items, "count": len(items)}


@router.post("/topics/{topic_id}/replies")
async def create_reply(topic_id: str, payload: Reply, user_id: str = Query(...), actor: str = Depends(require_actor)):
    ban = await db.tair_scope_bans.find_one({"user_id": user_id, "scope": "clinic"})
    if ban:
        raise HTTPException(403, "أنت محظور من التفاعل مع صفحة العيادة")
    t = await db.tair_clinic_topics.find_one({"topic_id": topic_id})
    if not t:
        raise HTTPException(404, "الموضوع غير موجود")
    is_mod = await _is_admin_or_mod(user_id)
    # 🔒 Only moderators/admins can post replies in the clinic
    if not is_mod:
        raise HTTPException(403, "الردود مخصصة لمشرفي العيادة فقط")
    user = await db.users.find_one(
        {"$or": [{"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "name": 1, "avatar": 1, "profile_image": 1},
    )
    rid = f"crep_{uuid.uuid4().hex[:12]}"
    await db.tair_clinic_replies.insert_one({
        "reply_id": rid,
        "topic_id": topic_id,
        "user_id": user_id,
        "user_name": (user or {}).get("name") or "مستخدم",
        "user_avatar": (user or {}).get("avatar") or (user or {}).get("profile_image"),
        "is_moderator": is_mod,
        "text": payload.text.strip(),
        "images": payload.images or [],
        "created_at": _now(),
    })
    await db.tair_clinic_topics.update_one({"topic_id": topic_id}, {"$inc": {"replies_count": 1}})
    try:
        preview = payload.text.strip().replace("\n", " ")
        if len(preview) > 90:
            preview = preview[:87] + "..."
        name = (user or {}).get("name") or "مشرف"
        title = (t.get("title") or "موضوع").strip()
        recipients = await _clinic_staff_ids()
        owner = t.get("user_id")
        if owner:
            recipients.append(owner)
        await _notify_people(
            recipients,
            [user_id],
            "رد جديد في العيادة",
            f"{name} على {title}: {preview}",
            "clinic_reply",
            {"topic_id": topic_id},
        )
    except Exception as exc:
        logger.warning("clinic reply notify failed: %s", exc)
    return {"success": True, "reply_id": rid, "is_moderator": is_mod}


@router.delete("/replies/{reply_id}")
async def delete_reply(reply_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    r = await db.tair_clinic_replies.find_one({"reply_id": reply_id})
    if not r:
        raise HTTPException(404, "الرد غير موجود")
    if r.get("user_id") != user_id and not await _is_admin_or_mod(user_id):
        raise HTTPException(403, "غير مصرح")
    await db.tair_clinic_replies.delete_one({"reply_id": reply_id})
    await db.tair_clinic_topics.update_one({"topic_id": r["topic_id"], "replies_count": {"$gt": 0}}, {"$inc": {"replies_count": -1}})
    return {"success": True}


# ============== LIBRARY ==============
class LibraryItem(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = Field(default="", max_length=1000)
    file_url: str
    file_type: Optional[str] = "image"  # image / pdf / video / link / jpg
    cover_url: Optional[str] = ""        # thumbnail (first PDF page or custom)
    category: Optional[str] = ""         # e.g. "أدلة تربية / درة"
    pages: Optional[int] = 0
    source: Optional[str] = ""           # e.g. "قروب طيور وببغاوات"
    tags: List[str] = Field(default_factory=list, max_items=10)


@router.get("/library")
async def list_library(limit: int = Query(100, le=200), q: Optional[str] = None):
    query: dict = {}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$in": [q]}},
        ]
    cursor = db.tair_clinic_library.find(query).sort("created_at", -1).limit(limit)
    items = [_clean(d) async for d in cursor]
    return {"items": items, "count": len(items)}


@router.post("/library")
async def add_library(payload: LibraryItem, user_id: str = Query(...)):
    if not await _is_admin_or_mod(user_id):
        raise HTTPException(403, "فقط المشرفون يستطيعون رفع ملفات المكتبة")
    lid = f"clib_{uuid.uuid4().hex[:12]}"
    await db.tair_clinic_library.insert_one({
        "library_id": lid,
        "uploaded_by": user_id,
        "created_at": _now(),
        **payload.model_dump(),
    })
    return {"success": True, "library_id": lid}


@router.delete("/library/{library_id}")
async def delete_library(library_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    if not await _is_admin_or_mod(user_id):
        raise HTTPException(403, "غير مصرح")
    await db.tair_clinic_library.delete_one({"library_id": library_id})
    return {"success": True}


# ============== AI ASSIST (Gemini via Emergent LLM Key) ==============
@router.post("/ai/assist/{topic_id}")
async def ai_assist(topic_id: str, user_id: str = Query(...)):
    """
    Returns:
      - library_matches: top 3 library items relevant to the topic
      - similar_topics: top 3 previous topics (closed/resolved) similar to this one
      - suggested_reply: AI-drafted reply the moderator can edit before sending
    Only moderators can call this.
    """
    if not await _is_admin_or_mod(user_id):
        raise HTTPException(403, "فقط المشرفون")
    topic = await db.tair_clinic_topics.find_one({"topic_id": topic_id})
    if not topic:
        raise HTTPException(404, "الموضوع غير موجود")

    # 1) Simple keyword-based matching for library/similar topics (fast, no LLM)
    text = " ".join(filter(None, [
        topic.get("title"), topic.get("description"),
        topic.get("q_lethargy"), topic.get("q_appetite"), topic.get("q_mouth_droppings"),
    ])).strip()
    # Extract key Arabic words (simple)
    words = [w for w in text.split() if len(w) > 2]
    seen = set()
    keywords = []
    for w in words[:30]:
        if w not in seen:
            seen.add(w); keywords.append(w)
    # Library matches by title/desc/tags regex
    lib_matches = []
    if keywords:
        regex = "|".join(keywords[:8])
        async for d in db.tair_clinic_library.find({
            "$or": [
                {"title": {"$regex": regex, "$options": "i"}},
                {"description": {"$regex": regex, "$options": "i"}},
                {"tags": {"$in": keywords}},
            ]
        }).limit(3):
            lib_matches.append(_clean(d))
    # Similar past topics
    similar = []
    if keywords:
        regex = "|".join(keywords[:8])
        async for d in db.tair_clinic_topics.find({
            "topic_id": {"$ne": topic_id},
            "$or": [
                {"title": {"$regex": regex, "$options": "i"}},
                {"description": {"$regex": regex, "$options": "i"}},
            ],
        }).sort("replies_count", -1).limit(3):
            d2 = _clean(d)
            # Attach top reply if any
            top_reply = await db.tair_clinic_replies.find_one(
                {"topic_id": d2.get("topic_id"), "is_moderator": True},
                sort=[("created_at", 1)],
            )
            if top_reply:
                d2["mod_reply_preview"] = (top_reply.get("text") or "")[:220]
            similar.append(d2)

    # 2) AI drafted reply using Gemini
    suggested_reply = ""
    ai_error = None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            ai_error = "EMERGENT_LLM_KEY غير مُعرّف في السيرفر"
        else:
            lib_ctx = "\n".join(
                f"- {x.get('title')}: {(x.get('description') or '')[:160]}"
                for x in lib_matches
            ) or "لا توجد ملفات مكتبة مطابقة"
            sim_ctx = "\n".join(
                f"- حالة سابقة: {x.get('title')} → رد المشرف: {x.get('mod_reply_preview', '—')[:200]}"
                for x in similar
            ) or "لا توجد حالات مشابهة"
            from services.clinic_bot import match_entries
            kb_hits = match_entries(
                f"{topic.get('title') or ''}\n{topic.get('description') or ''}",
                top_n=3,
            )
            kb_ctx = "\n".join(
                f"- {e.get('name_ar')} ({e.get('name_en')}): {(e.get('definition') or '')[:220]} | افعل: {(e.get('action') or '')}"
                for _, e in kb_hits
            ) or "لا توجد بطاقة مطابقة"
            prompt = f"""أنت مساعد لمشرف عيادة طير. اكتب رداً مقترحاً بالعربية الواضحة.
الرد:
- من 4 إلى 8 أسطر
- مبني على بطاقات العيادة إن وُجدت، بلا اختراع مرض
- بلا جرعات وبلا مليغرام وبلا شرح مخبري لزرع الممرض
- تشخيص مبدئي فقط، ويطلب تأكيد المشرف
- إن كانت الحالة تنفسية شديدة أو النفوق جماعياً فابدأ بالعزل والإبلاغ

عنوان الحالة: {topic.get('title')}

وصف المستخدم:
{topic.get('description')}

بطاقات العيادة:
{kb_ctx}

ملفات المكتبة المرشحة:
{lib_ctx}

حالات مشابهة سابقة:
{sim_ctx}
"""
            chat = LlmChat(
                api_key=api_key,
                session_id=f"clinic_ai_{topic_id}",
                system_message="أنت مساعد مشرف عيادة طير. تلخّص المعرفة البيطرية التعليمية بالعربية بلا جرعات وبلا طرق زرع.",
            ).with_model("gemini", "gemini-3-flash-preview")
            resp = await chat.send_message(UserMessage(text=prompt))
            suggested_reply = (resp or "").strip()[:1800]
            if not suggested_reply:
                ai_error = "النموذج أعاد رداً فارغاً"
    except Exception as e:
        logger.warning("AI assist failed for topic %s: %s", topic_id, e)
        ai_error = f"{type(e).__name__}: {str(e)[:200]}"
        suggested_reply = ""

    return {
        "library_matches": lib_matches,
        "similar_topics": similar,
        "suggested_reply": suggested_reply,
        "keywords": keywords[:10],
        "ai_error": ai_error,
    }


# ============== ACTIVE USERS (admin only) ==============
@router.get("/_admin/active-users")
async def active_users(user_id: str = Query(...), minutes: int = Query(15, le=240)):
    if not await _is_admin_or_mod(user_id):
        raise HTTPException(403, "غير مصرح")
    threshold = _now() - timedelta(minutes=minutes)
    items = []
    async for u in db.users.find({
        "last_seen": {"$gte": threshold}
    }, {"_id": 0, "password": 0}).sort("last_seen", -1).limit(200):
        items.append(_clean(u))
    return {"items": items, "count": len(items), "window_min": minutes}
