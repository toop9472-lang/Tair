"""طير — Admin Extensions API + Clinic Chat
Real stats, broadcast, moderator roles, verification requests, clinic chat with 24h TTL.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from auth.dependencies import get_current_user_id

router = APIRouter(tags=["Admin-Extensions"])

_client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = _client[os.environ.get("DB_NAME", "saqr_db")]


def _now():
    return datetime.now(timezone.utc)


async def _is_admin(user_id: str) -> bool:
    if not user_id:
        return False
    adm = await db.admins.find_one({"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]})
    if adm:
        return True
    u = await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "is_admin": 1, "role": 1},
    )
    return bool(u and (u.get("is_admin") or u.get("role") in ("admin", "super_admin")))


async def _get_moderator_scopes(user_id: str) -> List[str]:
    if not user_id:
        return []
    m = await db.tair_moderators.find_one({"$or": [
        {"user_id": user_id}, {"email": user_id}
    ]})
    if not m:
        return []
    scopes = m.get("scopes") or []
    if isinstance(scopes, str):
        scopes = [scopes]
    return scopes


async def _can_moderate(user_id: str, scope: str) -> bool:
    if await _is_admin(user_id):
        return True
    scopes = await _get_moderator_scopes(user_id)
    return scope in scopes or "general" in scopes


def _clean_doc(d: dict) -> dict:
    d = dict(d)
    d.pop("_id", None)
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


# =============================================================
# REAL COMPREHENSIVE STATS
# =============================================================
@router.get("/admin/stats/full")
async def full_stats(user_id: str = Depends(get_current_user_id)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")

    now = _now()
    day_ago = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    async def cnt(coll, q=None):
        return await db[coll].count_documents(q or {})

    users_total = await cnt("users")
    users_banned = await cnt("users", {"is_banned": True})
    users_verified = await cnt("users", {"is_verified_shop": True})
    users_carriers = await cnt("users", {"role": "carrier"})
    users_sellers = await cnt("users", {"role": "seller"})
    users_active_today = await cnt("users", {"last_login": {"$gte": day_ago}})

    listings_total = await cnt("listings", {"status": {"$ne": "removed"}})
    listings_new_today = await cnt("listings", {"created_at": {"$gte": day_ago}})

    trips_total = await cnt("tair_trips", {"status": {"$ne": "cancelled"}})
    trips_active = await cnt("tair_trips", {"status": {"$in": ["scheduled", "in_transit"]}})

    auctions_pending = await cnt("tair_auctions", {"status": "pending_review"})
    auctions_live = await cnt("tair_auctions", {"status": "live"})
    auctions_scheduled = await cnt("tair_auctions", {"status": "scheduled"})

    stories_active = await cnt("tair_stories", {"expires_at": {"$gt": now}})
    reports_open = await cnt("tair_reports", {"status": {"$ne": "resolved"}})
    verification_pending = await cnt("tair_verification_requests", {"status": "pending"})
    moderators = await cnt("tair_moderators")

    return {
        "users": {
            "total": users_total, "banned": users_banned,
            "verified_shops": users_verified,
            "carriers": users_carriers, "sellers": users_sellers,
            "active_today": users_active_today, "moderators": moderators,
        },
        "listings": {"total": listings_total, "new_today": listings_new_today},
        "trips": {"total": trips_total, "active": trips_active},
        "auctions": {
            "pending_review": auctions_pending,
            "live": auctions_live, "scheduled": auctions_scheduled,
        },
        "community": {"stories_active": stories_active},
        "reports": {"open": reports_open},
        "verification": {"pending": verification_pending},
        "generated_at": now.isoformat(),
    }


# =============================================================
# BROADCAST
# =============================================================
class BroadcastPayload(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=1, max_length=1000)
    audience: str = Field(default="all")


@router.post("/admin/broadcast")
async def send_broadcast(payload: BroadcastPayload, background: BackgroundTasks, user_id: str = Depends(get_current_user_id)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    q = {"is_banned": {"$ne": True}}
    if payload.audience == "sellers":
        q["role"] = "seller"
    elif payload.audience == "carriers":
        q["role"] = "carrier"
    elif payload.audience == "verified":
        q["is_verified_shop"] = True

    now = _now()
    docs = []
    async for u in db.users.find(q, {"_id": 0, "user_id": 1, "id": 1, "email": 1}):
        uid = u.get("user_id") or u.get("id") or u.get("email")
        if not uid:
            continue
        docs.append({
            "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
            "user_id": uid,
            "type": "admin_broadcast",
            "title": payload.title,
            "body": payload.body,
            "data": {"from_admin": True},
            "is_read": False,
            "created_at": now,
        })
    if docs:
        await db.tair_notifications.insert_many(docs)
    uids = [d["user_id"] for d in docs]
    pushed = len(await _collect_tokens(uids, payload.audience == "all"))
    background.add_task(_push_to_users, uids, payload.title, payload.body,
                        {"type": "admin_broadcast"}, payload.audience == "all")
    return {"success": True, "delivered_to": len(docs), "recipients": len(docs), "push_devices": pushed}


async def _push_to_users(user_ids: List[str], title: str, body: str, data: dict, include_guests: bool = False) -> int:
    from routes.mobile_push_routes import send_expo_push
    tokens = await _collect_tokens(user_ids, include_guests)
    for i in range(0, len(tokens), 100):
        await send_expo_push(tokens[i:i + 100], title, body, data)
    return len(tokens)


async def _collect_tokens(user_ids: List[str], include_guests: bool) -> List[str]:
    ids = set(user_ids)
    alias_q = {"$or": [{"user_id": {"$in": user_ids}}, {"id": {"$in": user_ids}}, {"email": {"$in": user_ids}}]}
    for coll in (db.users, db.admins):
        async for d in coll.find(alias_q, {"_id": 0, "user_id": 1, "id": 1, "email": 1}):
            ids.update(v for v in (d.get("user_id"), d.get("id"), d.get("email")) if v)
    q = {"$or": [{"user_id": {"$in": list(ids)}}] + ([{"user_id": "guest"}] if include_guests else [])}
    tokens = set()
    async for t in db.mobile_push_tokens.find(q, {"_id": 0, "token": 1}):
        if t.get("token"):
            tokens.add(t["token"])
    async for t in db.push_tokens.find(q, {"_id": 0, "token": 1}):
        if t.get("token"):
            tokens.add(t["token"])
    return list(tokens)


# =============================================================
# APP UPDATE NOTICE (popup + push for everyone)
# =============================================================
class AppUpdatePayload(BaseModel):
    version: str = Field(min_length=1, max_length=20)
    notes: str = Field(min_length=1, max_length=2000)
    store_url: Optional[str] = ""


@router.post("/admin/app-update")
async def publish_app_update(payload: AppUpdatePayload, background: BackgroundTasks, user_id: str = Depends(get_current_user_id)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    now = _now()
    update_id = f"upd_{uuid.uuid4().hex[:10]}"
    await db.tair_app_settings.update_one(
        {"key": "app_update"},
        {"$set": {"key": "app_update", "update_id": update_id, "version": payload.version,
                  "notes": payload.notes, "store_url": payload.store_url or "", "published_at": now}},
        upsert=True,
    )
    title = f"تحديث جديد لتطبيق طير {payload.version}"
    docs, uids = [], []
    async for u in db.users.find({"is_banned": {"$ne": True}}, {"_id": 0, "user_id": 1, "id": 1, "email": 1}):
        uid = u.get("user_id") or u.get("id") or u.get("email")
        if not uid:
            continue
        uids.append(uid)
        docs.append({
            "notif_id": f"ntf_{uuid.uuid4().hex[:12]}", "user_id": uid, "type": "app_update",
            "title": title, "body": payload.notes, "data": {"update_id": update_id},
            "is_read": False, "created_at": now,
        })
    if docs:
        await db.tair_notifications.insert_many(docs)
    pushed = len(await _collect_tokens(uids, True))
    background.add_task(_push_to_users, uids, title, payload.notes[:180], {"type": "app_update"}, True)
    return {"success": True, "update_id": update_id, "recipients": len(docs), "push_devices": pushed}


@router.get("/admin/source-download")
async def source_download(key: str = Query(...)):
    from fastapi.responses import FileResponse
    path = "/tmp/tair_export/Tair_full_source.zip"
    if key != os.environ.get("SOURCE_DOWNLOAD_KEY") or not os.path.exists(path):
        raise HTTPException(404, "غير موجود")
    return FileResponse(path, filename="Tair_full_source.zip", media_type="application/zip")


@router.get("/app/latest-update")
async def latest_app_update():
    d = await db.tair_app_settings.find_one({"key": "app_update"}, {"_id": 0})
    return _clean_doc(d) if d else {}


# =============================================================
# VERIFICATION REQUESTS
# =============================================================
class VerifyRequestPayload(BaseModel):
    shop_name: Optional[str] = ""
    reason: str = Field(min_length=10, max_length=500)
    supporting_docs: List[str] = Field(default_factory=list)


@router.post("/admin/verification/request")
async def request_verification(payload: VerifyRequestPayload, user_id: str = Depends(get_current_user_id)):
    if not user_id:
        raise HTTPException(401, "يجب تسجيل الدخول")
    existing = await db.tair_verification_requests.find_one({"user_id": user_id, "status": "pending"})
    if existing:
        raise HTTPException(400, "لديك طلب قيد الانتظار")
    now = _now()
    req_id = f"vreq_{uuid.uuid4().hex[:12]}"
    await db.tair_verification_requests.insert_one({
        "request_id": req_id,
        "user_id": user_id,
        "shop_name": payload.shop_name or "",
        "reason": payload.reason,
        "supporting_docs": payload.supporting_docs,
        "status": "pending",
        "created_at": now,
    })
    # Notify admins
    async for adm in db.admins.find({}, {"_id": 0, "user_id": 1, "email": 1}):
        aid = adm.get("user_id") or adm.get("email")
        if aid:
            await db.tair_notifications.insert_one({
                "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
                "user_id": aid,
                "type": "verification_request",
                "title": "طلب توثيق متجر جديد",
                "body": f"{payload.shop_name or user_id}",
                "data": {"request_id": req_id},
                "is_read": False,
                "created_at": now,
            })
    return {"success": True, "request_id": req_id}


@router.get("/admin/verification/list")
async def list_verifications(user_id: str = Depends(get_current_user_id), status: str = Query("pending")):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    q = {} if status == "all" else {"status": status}
    items = [_clean_doc(d) async for d in db.tair_verification_requests.find(q).sort("created_at", -1).limit(100)]
    return {"items": items, "count": len(items)}


@router.post("/admin/verification/{request_id}/approve")
async def approve_verification(request_id: str, user_id: str = Depends(get_current_user_id)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    r = await db.tair_verification_requests.find_one({"request_id": request_id})
    if not r:
        raise HTTPException(404, "الطلب غير موجود")
    now = _now()
    await db.tair_verification_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "approved", "reviewed_at": now, "reviewed_by": user_id}},
    )
    await db.users.update_one(
        {"$or": [{"user_id": r["user_id"]}, {"id": r["user_id"]}, {"email": r["user_id"]}]},
        {"$set": {
            "is_verified_shop": True, "is_verified_merchant": True,
            "trusted_by_admin": True, "shop_verified_at": now,
        }},
    )
    await db.tair_notifications.insert_one({
        "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
        "user_id": r["user_id"], "type": "verification_approved",
        "title": "✅ تم توثيق متجرك",
        "body": "مبروك — أصبح متجرك موثقاً من طير",
        "is_read": False, "created_at": now,
    })
    return {"success": True}


@router.post("/admin/verification/{request_id}/reject")
async def reject_verification(request_id: str, user_id: str = Depends(get_current_user_id), reason: str = Query("")):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    r = await db.tair_verification_requests.find_one({"request_id": request_id})
    if not r:
        raise HTTPException(404, "الطلب غير موجود")
    now = _now()
    await db.tair_verification_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "rejected", "reviewed_at": now, "reviewed_by": user_id, "rejection_reason": reason}},
    )
    await db.tair_notifications.insert_one({
        "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
        "user_id": r["user_id"], "type": "verification_rejected",
        "title": "طلب التوثيق مرفوض",
        "body": reason or "لم يستوف الطلب الشروط",
        "is_read": False, "created_at": now,
    })
    return {"success": True}


# =============================================================
# MODERATORS
# =============================================================
VALID_SCOPES = {"general", "market", "community", "clinic", "clinic_admin"}


class ModeratorAssign(BaseModel):
    user_id: str = Field(min_length=1)
    scopes: List[str] = Field(default_factory=list)


@router.post("/admin/moderators/assign")
async def assign_moderator(payload: ModeratorAssign, user_id: str = Depends(get_current_user_id)):
    # Admin OR clinic_admin can assign (clinic_admin can only assign clinic scopes)
    is_adm = await _is_admin(user_id)
    requested = [s for s in payload.scopes if s in VALID_SCOPES]
    if not requested:
        raise HTTPException(400, "اختر صلاحية واحدة على الأقل")
    if not is_adm:
        my_scopes = await _get_moderator_scopes(user_id)
        if "clinic_admin" not in my_scopes:
            raise HTTPException(403, "غير مصرح")
        # Clinic admin may only grant clinic scope
        if any(s not in ("clinic",) for s in requested):
            raise HTTPException(403, "مدير العيادة يستطيع تعيين مشرف عيادة فقط")
    scopes = requested
    u = await db.users.find_one({"$or": [{"user_id": payload.user_id}, {"id": payload.user_id}, {"email": payload.user_id}]})
    if not u:
        raise HTTPException(404, "المستخدم غير موجود")
    canonical_uid = u.get("user_id") or u.get("id") or u.get("email")
    now = _now()
    await db.tair_moderators.update_one(
        {"user_id": canonical_uid},
        {"$set": {
            "user_id": canonical_uid, "email": u.get("email"),
            "name": u.get("name") or "مشرف", "avatar": u.get("avatar"),
            "scopes": scopes, "assigned_at": now, "assigned_by": user_id,
        }},
        upsert=True,
    )
    await db.tair_notifications.insert_one({
        "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
        "user_id": canonical_uid, "type": "moderator_assigned",
        "title": "🛡️ تم تعيينك مشرفاً",
        "body": f"صلاحياتك: {'، '.join(scopes)}",
        "is_read": False, "created_at": now,
    })
    return {"success": True, "scopes": scopes}


@router.delete("/admin/moderators/{target_user_id}")
async def revoke_moderator(target_user_id: str, user_id: str = Depends(get_current_user_id)):
    is_adm = await _is_admin(user_id)
    if not is_adm:
        my_scopes = await _get_moderator_scopes(user_id)
        if "clinic_admin" not in my_scopes:
            raise HTTPException(403, "غير مصرح")
        # Clinic admin may only revoke clinic-only mods (not general/market/community)
        target = await db.tair_moderators.find_one({"$or": [{"user_id": target_user_id}, {"email": target_user_id}]})
        tgt_scopes = (target or {}).get("scopes") or []
        if any(s not in ("clinic",) for s in tgt_scopes):
            raise HTTPException(403, "لا يمكنك إزالة مشرف خارج نطاق العيادة")
    r = await db.tair_moderators.delete_one({"$or": [{"user_id": target_user_id}, {"email": target_user_id}]})
    if r.deleted_count == 0:
        raise HTTPException(404, "المشرف غير موجود")
    return {"success": True}


@router.get("/admin/moderators/list")
async def list_moderators(user_id: str = Depends(get_current_user_id)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    items = [_clean_doc(d) async for d in db.tair_moderators.find({}).sort("assigned_at", -1)]
    return {"items": items, "count": len(items)}


@router.get("/admin/moderators/my-scopes")
async def my_scopes(user_id: str = Depends(get_current_user_id)):
    is_adm = await _is_admin(user_id)
    scopes = await _get_moderator_scopes(user_id)
    return {
        "is_admin": is_adm,
        "scopes": list(VALID_SCOPES) if is_adm else scopes,
    }


# =============================================================
# CLINIC — Chat with 24h TTL
# =============================================================
class ClinicMsgCreate(BaseModel):
    text: Optional[str] = ""
    image_url: Optional[str] = ""


class ClinicSettingsUpdate(BaseModel):
    enabled: bool


DEFAULT_CLINIC_SETTINGS = {"enabled": False, "topic": "العيادة"}


async def _clinic_settings() -> dict:
    doc = await db.tair_clinic_settings.find_one({"_id": "singleton"})
    if not doc:
        await db.tair_clinic_settings.insert_one({"_id": "singleton", **DEFAULT_CLINIC_SETTINGS})
        return dict(DEFAULT_CLINIC_SETTINGS)
    doc.pop("_id", None)
    return {**DEFAULT_CLINIC_SETTINGS, **doc}


@router.get("/clinic/settings")
async def get_clinic_settings():
    return await _clinic_settings()


@router.put("/clinic/settings")
async def update_clinic_settings(payload: ClinicSettingsUpdate, user_id: str = Depends(get_current_user_id)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    await db.tair_clinic_settings.update_one(
        {"_id": "singleton"},
        {"$set": {"enabled": bool(payload.enabled), "updated_by": user_id, "updated_at": _now()}},
        upsert=True,
    )
    return await _clinic_settings()


async def _prune_old_clinic():
    """Delete messages older than 24h."""
    cutoff = datetime.now(timezone.utc).timestamp() - 24 * 3600
    cutoff_dt = datetime.fromtimestamp(cutoff, tz=timezone.utc)
    await db.tair_clinic_messages.delete_many({"created_at": {"$lt": cutoff_dt}})


@router.get("/clinic/messages")
async def clinic_messages(user_id: str = Depends(get_current_user_id), limit: int = Query(100, le=200)):
    if not user_id:
        raise HTTPException(401, "يجب تسجيل الدخول")
    settings = await _clinic_settings()
    if not settings.get("enabled") and not await _is_admin(user_id):
        raise HTTPException(403, "العيادة قيد الإعداد")
    await _prune_old_clinic()
    is_banned = await db.tair_clinic_bans.find_one({"user_id": user_id})
    can_send = not is_banned
    items = []
    async for m in db.tair_clinic_messages.find({}).sort("created_at", 1).limit(limit):
        items.append(_clean_doc(m))
    return {
        "items": items, "count": len(items),
        "can_send": can_send,
        "is_moderator": await _can_moderate(user_id, "clinic"),
        "banned": bool(is_banned),
    }


@router.post("/clinic/send")
async def clinic_send(payload: ClinicMsgCreate, user_id: str = Depends(get_current_user_id)):
    if not user_id:
        raise HTTPException(401, "يجب تسجيل الدخول")
    settings = await _clinic_settings()
    if not settings.get("enabled") and not await _is_admin(user_id):
        raise HTTPException(403, "العيادة قيد الإعداد")
    if not payload.text and not payload.image_url:
        raise HTTPException(400, "اكتب نصاً أو أرفق صورة")
    if await db.tair_clinic_bans.find_one({"user_id": user_id}):
        raise HTTPException(403, "لا يمكنك المشاركة — تم حظرك من العيادة")
    u = await db.users.find_one({"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]})
    now = _now()
    msg_id = f"clm_{uuid.uuid4().hex[:12]}"
    doc = {
        "msg_id": msg_id,
        "user_id": user_id,
        "user_name": (u or {}).get("name") or "مستخدم",
        "user_avatar": (u or {}).get("avatar"),
        "is_moderator": await _can_moderate(user_id, "clinic"),
        "text": payload.text or "",
        "image_url": payload.image_url or "",
        "created_at": now,
    }
    await db.tair_clinic_messages.insert_one(doc)
    return _clean_doc(doc)


@router.delete("/clinic/messages/{msg_id}")
async def clinic_delete_msg(msg_id: str, user_id: str = Depends(get_current_user_id)):
    if not await _can_moderate(user_id, "clinic"):
        raise HTTPException(403, "غير مصرح — يتطلب صلاحية مشرف العيادة")
    r = await db.tair_clinic_messages.delete_one({"msg_id": msg_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "الرسالة غير موجودة")
    return {"success": True}


class ClinicBanPayload(BaseModel):
    user_id: str


@router.post("/clinic/ban")
async def clinic_ban(payload: ClinicBanPayload, user_id: str = Depends(get_current_user_id)):
    if not await _can_moderate(user_id, "clinic"):
        raise HTTPException(403, "غير مصرح")
    await db.tair_clinic_bans.update_one(
        {"user_id": payload.user_id},
        {"$set": {"user_id": payload.user_id, "banned_by": user_id, "banned_at": _now()}},
        upsert=True,
    )
    return {"success": True}


@router.delete("/clinic/ban/{target_user_id}")
async def clinic_unban(target_user_id: str, user_id: str = Depends(get_current_user_id)):
    if not await _can_moderate(user_id, "clinic"):
        raise HTTPException(403, "غير مصرح")
    await db.tair_clinic_bans.delete_one({"user_id": target_user_id})
    return {"success": True}


# =============================================================
# SCOPE-BASED USER BANS (each moderator can ban users from THEIR scope only)
# =============================================================
class ScopeBanPayload(BaseModel):
    user_id: str
    scope: str  # "clinic" | "market" | "community" | "general"
    reason: Optional[str] = ""


@router.post("/admin/scope-bans/create")
async def moderator_ban_user(payload: ScopeBanPayload, user_id: str = Depends(get_current_user_id)):
    if payload.scope not in VALID_SCOPES:
        raise HTTPException(400, "نطاق غير معروف")
    if not await _can_moderate(user_id, payload.scope):
        raise HTTPException(403, f"غير مصرح — تحتاج صلاحية مشرف {payload.scope}")
    await db.tair_scope_bans.update_one(
        {"user_id": payload.user_id, "scope": payload.scope},
        {"$set": {
            "user_id": payload.user_id, "scope": payload.scope,
            "reason": payload.reason or "", "banned_by": user_id, "banned_at": _now(),
        }},
        upsert=True,
    )
    return {"success": True}


@router.delete("/admin/scope-bans/remove")
async def moderator_unban_user(
    target_user_id: str = Query(...),
    scope: str = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    if scope not in VALID_SCOPES:
        raise HTTPException(400, "نطاق غير معروف")
    if not await _can_moderate(user_id, scope):
        raise HTTPException(403, "غير مصرح")
    await db.tair_scope_bans.delete_one({"user_id": target_user_id, "scope": scope})
    return {"success": True}


@router.get("/admin/scope-bans/list")
async def moderator_list_bans(scope: str = Query(...), user_id: str = Depends(get_current_user_id)):
    if not await _can_moderate(user_id, scope):
        raise HTTPException(403, "غير مصرح")
    items = []
    async for b in db.tair_scope_bans.find({"scope": scope}).sort("banned_at", -1).limit(100):
        items.append(_clean_doc(b))
    return {"items": items, "count": len(items)}


@router.get("/admin/scope-bans/check")
async def moderator_is_banned(target_user_id: str = Query(...), scope: str = Query(...)):
    b = await db.tair_scope_bans.find_one({"user_id": target_user_id, "scope": scope})
    return {"banned": bool(b)}

