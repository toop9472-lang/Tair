"""طير — Trips API routes (carrier delivery network)."""
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from motor.motor_asyncio import AsyncIOMotorClient

from models.trip import (
    Trip,
    TripCreate,
    TripRequest,
    TripRequestCreate,
    TripRequestStatusUpdate,
    RequestStatusEvent,
    TripStatusEvent,
    TripStatusUpdate,
)
from auth.actor import require_actor

router = APIRouter(prefix="/trips", tags=["Tair-Trips"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _now():
    return datetime.now(timezone.utc)


def _norm_digits(s):
    """Convert Arabic/Persian digits to Latin so mobile's /[^0-9]/ regex works."""
    if not s or not isinstance(s, str):
        return s
    ar = "٠١٢٣٤٥٦٧٨٩"
    fa = "۰۱۲۳۴۵۶۷۸۹"
    out = []
    for ch in s:
        if ch in ar:
            out.append(str(ar.index(ch)))
        elif ch in fa:
            out.append(str(fa.index(ch)))
        else:
            out.append(ch)
    return "".join(out)


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for key in ("depart_at", "eta_at", "created_at", "updated_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    for evt in doc.get("status_updates", []) or []:
        if isinstance(evt.get("at"), datetime):
            evt["at"] = evt["at"].isoformat()
    return doc


@router.post("/create")
async def create_trip(payload: TripCreate, user_id: str = Query(...), actor: str = Depends(require_actor)):
    trip_id = f"trip_{uuid.uuid4().hex[:12]}"
    trip = Trip(
        trip_id=trip_id,
        carrier_id=user_id,
        available_cages=payload.total_cages,
        **payload.model_dump(),
    )
    doc = trip.model_dump()
    await db.trips.insert_one(doc)

    # ==== Auto-match: notify sellers whose active listings share the route ====
    try:
        from routes.tair_notifications_routes import create_tair_notification
        matching_cities = list({payload.from_city, payload.to_city, *(payload.waypoints or [])})
        cursor = db.listings.find(
            {"status": "active", "city": {"$in": matching_cities}},
            {"seller_id": 1, "title": 1, "listing_id": 1, "_id": 0},
        ).limit(50)
        notified = set()
        route_label = f"{payload.from_city} → {payload.to_city}"
        async for listing in cursor:
            sid = listing.get("seller_id")
            if not sid or sid == user_id or sid in notified:
                continue
            notified.add(sid)
            await create_tair_notification(
                user_id=sid,
                title="رحلة جديدة تناسب إعلانك",
                body=f'ناقل سجّل رحلة {route_label} — قد تكون مناسبة لإعلانك "{listing.get("title", "")}"',
                notif_type="trip_match",
                data={"trip_id": trip_id, "listing_id": listing.get("listing_id"), "route": route_label},
            )
    except Exception as exc:  # pragma: no cover
        print(f"[trip auto-match] failed: {exc}")

    return _serialize(doc)


@router.get("/list")
async def list_trips(
    from_city: Optional[str] = None,
    to_city: Optional[str] = None,
    status: Optional[str] = "scheduled",
    limit: int = 20,
    skip: int = 0,
):
    query: dict = {}
    if status == "active":
        query["status"] = {"$in": ["scheduled", "departed", "in_transit"]}
    elif status == "upcoming":
        query["status"] = "scheduled"
    elif status == "live":
        query["status"] = {"$in": ["departed", "in_transit", "arrived"]}
    elif status and status != "all":
        query["status"] = status
    if from_city:
        query["from_city"] = from_city
    if to_city:
        query["to_city"] = to_city

    cursor = (
        db.trips.find(query).sort("depart_at", 1).skip(skip).limit(min(limit, 100))
    )
    items = [_serialize(d) async for d in cursor]
    # Enrich with carrier public info (name, avatar, phone, whatsapp, rating)
    carrier_ids = list({i.get("carrier_id") for i in items if i.get("carrier_id")})
    if carrier_ids:
        users = await db.users.find(
            {"$or": [
                {"id": {"$in": carrier_ids}},
                {"user_id": {"$in": carrier_ids}},
                {"email": {"$in": carrier_ids}},  # mobile may pass email as user_id
            ]},
            {"_id": 0, "id": 1, "user_id": 1, "email": 1, "name": 1, "avatar": 1,
             "phone": 1, "whatsapp": 1, "is_verified_carrier": 1, "storefront_settings": 1},
        ).to_list(200)
        u_map = {}
        for u in users:
            # Index by every identifier the caller might have used
            for key in (u.get("id"), u.get("user_id"), u.get("email")):
                if key:
                    u_map[key] = u
        # Aggregate rating avg + completed count for each carrier
        for i in items:
            cid = i.get("carrier_id")
            u = u_map.get(cid) if cid else None
            stored_phone = i.get("carrier_phone")
            if u:
                # Always overwrite with latest data, then fall back to the trip snapshot
                i["carrier_name"] = u.get("name") or i.get("carrier_name")
                i["carrier_avatar"] = u.get("avatar")
                i["carrier_phone"] = _norm_digits(u.get("phone") or stored_phone)
                i["carrier_whatsapp"] = _norm_digits(
                    u.get("whatsapp") or u.get("phone") or stored_phone
                )
                i["carrier_verified"] = bool(u.get("is_verified_carrier"))
                sf = u.get("storefront_settings") or {}
                i["carrier_identity_color"] = sf.get("identity_color") or "#0f766e"
                i["carrier_logo_url"] = sf.get("logo_url")
            elif stored_phone:
                i["carrier_whatsapp"] = _norm_digits(stored_phone)
            if cid:
                agg = await db.user_ratings.aggregate([
                    {"$match": {"target_id": cid, "role": "carrier"}},
                    {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
                ]).to_list(1)
                i["carrier_rating_avg"] = round(agg[0]["avg"], 2) if agg else None
                i["carrier_trips_completed"] = await db.trips.count_documents(
                    {"carrier_id": cid, "status": "completed"}
                )
    total = await db.trips.count_documents(query)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


def _serialize_request(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for key in ("created_at", "updated_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    for evt in doc.get("status_updates", []) or []:
        if isinstance(evt.get("at"), datetime):
            evt["at"] = evt["at"].isoformat()
    return doc


async def _user_brief(user_id: str):
    if not user_id:
        return None
    return await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "name": 1, "phone": 1, "whatsapp": 1},
    )


@router.post("/requests")
async def create_trip_request(
    payload: TripRequestCreate, user_id: str = Query(...), actor: str = Depends(require_actor)
):
    origin = (payload.from_city or "").strip()
    dest = (payload.to_city or "").strip()
    if not origin or not dest:
        raise HTTPException(400, "حدد مدينة الانطلاق والوصول")
    if origin == dest:
        raise HTTPException(400, "المدينتان يجب أن تكونا مختلفتين")
    day = (payload.depart_on or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise HTTPException(400, "اكتب التاريخ بصيغة السنة-الشهر-اليوم")
    user = await _user_brief(user_id)
    raw_phone = payload.contact_phone or (user or {}).get("whatsapp") or (user or {}).get("phone")
    phone = re.sub(r"\D", "", _norm_digits(raw_phone) or "")
    if len(phone) < 9:
        raise HTTPException(400, "أضف رقم واتساب للتواصل")
    name = (payload.requester_name or "").strip() or (user or {}).get("name") or "عضو طير"
    request_id = f"treq_{uuid.uuid4().hex[:12]}"
    event = RequestStatusEvent(status="pending", note="أُنشئ الطلب").model_dump()
    doc = TripRequest(
        request_id=request_id,
        requester_id=user_id,
        requester_name=name,
        from_city=origin,
        to_city=dest,
        depart_on=day,
        details=(payload.details or "").strip() or None,
        contact_phone=phone,
        status_updates=[event],
    ).model_dump()
    await db.trip_requests.insert_one(doc)
    return _serialize_request(doc)


@router.get("/requests")
async def list_trip_requests(
    user_id: Optional[str] = None,
    scope: str = "board",
    limit: int = 40,
):
    if scope == "mine":
        if not user_id:
            raise HTTPException(400, "يلزم معرف المستخدم")
        query = {"$or": [{"requester_id": user_id}, {"accepted_by": user_id}]}
    else:
        query = {"status": "pending"}
    cursor = db.trip_requests.find(query).sort("created_at", -1).limit(min(limit, 80))
    items = [_serialize_request(d) async for d in cursor]
    return {"items": items, "total": len(items)}


_REQUEST_MOVES = {
    ("pending", "accepted"),
    ("pending", "cancelled"),
    ("accepted", "in_progress"),
    ("accepted", "cancelled"),
    ("in_progress", "completed"),
    ("in_progress", "cancelled"),
}


@router.patch("/requests/{request_id}/status")
async def update_trip_request_status(
    request_id: str,
    payload: TripRequestStatusUpdate,
    user_id: str = Query(...),
    actor: str = Depends(require_actor),
):
    doc = await db.trip_requests.find_one({"request_id": request_id})
    if not doc:
        raise HTTPException(404, "الطلب غير موجود")
    current = doc.get("status") or "pending"
    nxt = payload.status
    if (current, nxt) not in _REQUEST_MOVES:
        raise HTTPException(400, "لا يمكن نقل الطلب إلى هذه الحالة")
    is_owner = doc.get("requester_id") == user_id
    is_carrier = doc.get("accepted_by") == user_id
    if nxt == "accepted":
        if is_owner:
            raise HTTPException(400, "لا يمكنك قبول طلبك")
    elif nxt == "cancelled":
        if not is_owner and not is_carrier:
            raise HTTPException(403, "غير مصرح")
    elif not is_carrier:
        raise HTTPException(403, "هذه الخطوة للموصل الذي قبل الطلب")

    event = RequestStatusEvent(status=nxt, note=payload.note).model_dump()
    updates = {"status": nxt, "updated_at": _now()}
    if nxt == "accepted":
        carrier = await _user_brief(user_id)
        updates["accepted_by"] = user_id
        updates["accepted_name"] = (carrier or {}).get("name") or "موصل طير"
    await db.trip_requests.update_one(
        {"request_id": request_id},
        {"$set": updates, "$push": {"status_updates": event}},
    )
    fresh = await db.trip_requests.find_one({"request_id": request_id})
    return _serialize_request(fresh)


@router.get("/{trip_id}")
async def get_trip(trip_id: str):
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "Trip not found")
    serialized = _serialize(doc)
    # Enrich with carrier public info so mobile shows avatar / WhatsApp / rating
    cid = serialized.get("carrier_id")
    if cid:
        u = await db.users.find_one(
            {"$or": [{"id": cid}, {"user_id": cid}, {"email": cid}]},
            {"_id": 0, "name": 1, "avatar": 1, "phone": 1, "whatsapp": 1,
             "is_verified_carrier": 1, "storefront_settings": 1},
        )
        stored_phone = serialized.get("carrier_phone")
        if u:
            serialized["carrier_name"] = u.get("name") or serialized.get("carrier_name")
            serialized["carrier_avatar"] = u.get("avatar")
            serialized["carrier_phone"] = _norm_digits(u.get("phone") or stored_phone)
            serialized["carrier_whatsapp"] = _norm_digits(
                u.get("whatsapp") or u.get("phone") or stored_phone
            )
            serialized["carrier_verified"] = bool(u.get("is_verified_carrier"))
            sf = u.get("storefront_settings") or {}
            serialized["carrier_identity_color"] = sf.get("identity_color") or "#0f766e"
            serialized["carrier_logo_url"] = sf.get("logo_url")
        elif stored_phone:
            serialized["carrier_whatsapp"] = _norm_digits(stored_phone)
        agg = await db.user_ratings.aggregate([
            {"$match": {"target_id": cid, "role": "carrier"}},
            {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
        ]).to_list(1)
        serialized["carrier_rating_avg"] = round(agg[0]["avg"], 2) if agg else None
        serialized["carrier_trips_completed"] = await db.trips.count_documents(
            {"carrier_id": cid, "status": "completed"}
        )
    return serialized


@router.get("/carrier/{carrier_id}")
async def trips_by_carrier(carrier_id: str, include_completed: bool = False):
    """List a carrier's trips.

    We NEVER return cancelled trips here — a cancelled trip is a delete and
    must stay hidden so it does not reappear in "رحلاتي" on refresh.
    """
    query: dict = {"carrier_id": carrier_id, "status": {"$ne": "cancelled"}}
    if not include_completed:
        query["status"] = {
            "$in": ["scheduled", "departed", "in_transit", "arrived"]
        }
    cursor = db.trips.find(query).sort("depart_at", -1)
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "total": len(items)}


@router.patch("/{trip_id}/status")
async def update_trip_status(
    trip_id: str, payload: TripStatusUpdate, user_id: str = Query(...)
):
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "Trip not found")
    if doc.get("carrier_id") != user_id:
        raise HTTPException(403, "Not the carrier")

    event = TripStatusEvent(status=payload.status, note=payload.note).model_dump()
    await db.trips.update_one(
        {"trip_id": trip_id},
        {
            "$set": {"status": payload.status, "updated_at": _now()},
            "$push": {"status_updates": event},
        },
    )
    fresh = await db.trips.find_one({"trip_id": trip_id})
    return _serialize(fresh)


@router.patch("/{trip_id}")
async def update_trip(
    trip_id: str, payload: TripCreate, user_id: str = Query(...), actor: str = Depends(require_actor)
):
    """Update trip details (carrier or admin only)."""
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "Trip not found")
    is_owner = doc.get("carrier_id") == user_id
    admin = await db.admins.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1},
    )
    if not is_owner and not admin:
        raise HTTPException(403, "Not authorized")

    updates = payload.model_dump()
    # Preserve available_cages logic: reset to new total if changed and higher
    if updates.get("total_cages") and updates["total_cages"] != doc.get("total_cages"):
        updates["available_cages"] = updates["total_cages"]
    updates["updated_at"] = _now()
    await db.trips.update_one({"trip_id": trip_id}, {"$set": updates})
    fresh = await db.trips.find_one({"trip_id": trip_id})
    return _serialize(fresh)


@router.delete("/{trip_id}")
async def cancel_trip(trip_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "Trip not found")
    is_owner = doc.get("carrier_id") == user_id
    # Robust admin lookup: admins collection OR user with is_admin flag OR admin linked by email
    admin = await db.admins.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1},
    )
    if not admin:
        u = await db.users.find_one(
            {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
            {"_id": 0, "email": 1, "is_admin": 1},
        )
        if u:
            if u.get("is_admin"):
                admin = {"id": user_id}
            elif u.get("email"):
                admin = await db.admins.find_one({"email": u["email"]}, {"_id": 0, "id": 1})
    if not is_owner and not admin:
        # Also allow moderators with 'market' or 'general' scope (trips are in market realm)
        try:
            m = await db.tair_moderators.find_one(
                {"$or": [{"user_id": user_id}, {"email": user_id}]},
                {"_id": 0, "scopes": 1},
            )
            scopes = (m or {}).get("scopes") or []
            if "market" in scopes or "general" in scopes:
                admin = {"id": user_id, "moderator": True}
        except Exception:
            pass
    if not is_owner and not admin:
        raise HTTPException(403, "Not authorized")
    if admin:
        # Admin: HARD delete for permanent purge
        await db.trips.delete_one({"trip_id": trip_id})
        return {"success": True, "trip_id": trip_id, "mode": "hard"}
    # Owner: SOFT cancel (never re-surfaces because /carrier/{id} excludes 'cancelled')
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$set": {"status": "cancelled", "updated_at": _now()}},
    )
    return {"success": True, "trip_id": trip_id, "mode": "soft"}
