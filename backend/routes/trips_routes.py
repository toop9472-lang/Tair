"""طير — Trips API routes (carrier delivery network)."""
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends, Request
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
    TripLocationUpdate,
)
from auth.actor import require_actor
from services.moderation import moderator_scopes
from models.places import city_match_values
from services.trip_motion import motion_copy

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


async def _notify_bookers(doc: dict, title: str, body: str, notif_type: str = "trip_motion"):
    if not doc or not title:
        return
    try:
        from routes.tair_notifications_routes import create_tair_notification
    except Exception as exc:
        print(f"[trip bookers] import failed: {exc}")
        return
    carrier = doc.get("carrier_id")
    seen = set()
    for booking in doc.get("bookings") or []:
        uid = (booking or {}).get("user_id")
        if not uid or uid == carrier or uid in seen:
            continue
        seen.add(uid)
        try:
            await create_tair_notification(
                user_id=uid,
                title=title,
                body=body,
                notif_type=notif_type,
                data={"trip_id": doc.get("trip_id"), "type": notif_type},
            )
        except Exception as exc:
            print(f"[trip bookers] {exc}")


async def _viewer_ids(request: Request) -> set:
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return set()
    from auth.jwt_handler import get_user_id_from_token
    from auth.actor import _resolve_aliases
    uid = get_user_id_from_token(auth[7:].strip())
    if not uid:
        return set()
    return {uid} | await _resolve_aliases(uid)


def _hide_live(doc: dict, viewer: set) -> None:
    """Carrier's live point is shown only to the carrier and booked riders."""
    allowed = {doc.get("carrier_id")} | {(b or {}).get("user_id") for b in doc.get("bookings") or []}
    if not (viewer & {a for a in allowed if a}):
        for k in ("live_lat", "live_lng", "live_at"):
            doc.pop(k, None)


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("bookings", None)
    for key in ("depart_at", "eta_at", "created_at", "updated_at", "live_at"):
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
    request: Request,
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
        query["from_city"] = {"$in": city_match_values(from_city)}
    if to_city:
        query["to_city"] = {"$in": city_match_values(to_city)}

    cursor = (
        db.trips.find(query).sort("depart_at", 1).skip(skip).limit(min(limit, 100))
    )
    viewer = await _viewer_ids(request)
    items = []
    async for d in cursor:
        _hide_live(d, viewer)
        items.append(_serialize(d))
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
    try:
        from routes.tair_notifications_routes import create_tair_notification
        route = f"{fresh.get('from_city')} ← {fresh.get('to_city')}"
        carrier_name = fresh.get("accepted_name") or "موصل"
        titles = {
            "accepted": ("قُبل طلب رحلتك", f"قبل {carrier_name} طلبك {route}"),
            "in_progress": ("رحلتك في الطريق", f"انطلقت الرحلة {route}"),
            "completed": ("اكتملت الرحلة", f"أُغلقت رحلة {route}"),
            "cancelled": ("أُلغي طلب الرحلة", f"أُلغي طلب {route}"),
        }
        title, body = titles.get(nxt, (None, None))
        target = fresh.get("accepted_by") if user_id == fresh.get("requester_id") else fresh.get("requester_id")
        if title and target and target != user_id:
            await create_tair_notification(
                user_id=target,
                title=title,
                body=body,
                notif_type="trip_request",
                data={"request_id": request_id, "status": nxt},
            )
    except Exception as exc:  # pragma: no cover
        print(f"[trip request notify] failed: {exc}")
    return _serialize_request(fresh)


@router.get("/{trip_id}")
async def get_trip(trip_id: str, request: Request):
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "Trip not found")
    viewer = await _viewer_ids(request)
    _hide_live(doc, viewer)
    my_bookings = sum(1 for b in doc.get("bookings") or [] if (b or {}).get("user_id") in viewer)
    serialized = _serialize(doc)
    serialized["my_bookings"] = my_bookings
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
    trip_id: str, payload: TripStatusUpdate, user_id: str = Query(...), actor: str = Depends(require_actor)
):
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "Trip not found")
    if doc.get("carrier_id") != user_id:
        raise HTTPException(403, "Not the carrier")

    event = TripStatusEvent(status=payload.status, note=payload.note).model_dump()
    cities = [doc.get("from_city"), *(doc.get("waypoints") or []), doc.get("to_city")]
    cities = [c for c in cities if c]
    last = max(len(cities) - 1, 0)
    motion = payload.motion
    stop_index = payload.stop_index
    if motion is None:
        if payload.status in ("arrived", "completed"):
            motion, stop_index = "arrived", last
        elif payload.status in ("departed", "in_transit"):
            motion = "moving"
            stop_index = doc.get("stop_index") or 0
        else:
            motion, stop_index = "stopped", 0
    stop_index = max(0, min(int(stop_index or 0), last))
    if motion == "arrived":
        stop_index = last
    await db.trips.update_one(
        {"trip_id": trip_id},
        {
            "$set": {
                "status": payload.status,
                "motion": motion,
                "stop_index": stop_index,
                "updated_at": _now(),
            },
            "$push": {"status_updates": event},
        },
    )
    fresh = await db.trips.find_one({"trip_id": trip_id})
    if payload.status != "completed":
        title, body = motion_copy(fresh, motion, stop_index)
        await _notify_bookers(fresh, title, body)
    return _serialize(fresh)


@router.patch("/{trip_id}/location")
async def update_trip_location(
    trip_id: str,
    payload: TripLocationUpdate,
    user_id: str = Query(...),
    actor: str = Depends(require_actor),
):
    """Carrier shares the vehicle's current point. The map prefers it while it is fresh."""
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "الرحلة غير موجودة")
    if doc.get("carrier_id") != user_id:
        raise HTTPException(403, "هذه الخطوة للموصل")
    if doc.get("status") in ("completed", "cancelled"):
        raise HTTPException(400, "هذه الرحلة مغلقة")
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$set": {
            "live_lat": payload.lat,
            "live_lng": payload.lng,
            "live_at": _now(),
            "updated_at": _now(),
        }},
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


@router.post("/{trip_id}/book")
async def book_cage(trip_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    """Reserve one cage on a published trip and tell the carrier."""
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "الرحلة غير موجودة")
    if doc.get("carrier_id") == user_id:
        raise HTTPException(400, "لا تحجز قفصاً على رحلتك")
    if doc.get("status") in ("completed", "cancelled", "arrived"):
        raise HTTPException(400, "هذه الرحلة لا تقبل الحجز")
    booking_id = f"book_{uuid.uuid4().hex[:12]}"
    user = await _user_brief(user_id)
    name = (user or {}).get("name") or "مربي"
    booking = {
        "booking_id": booking_id,
        "user_id": user_id,
        "name": name,
        "created_at": _now(),
    }
    res = await db.trips.update_one(
        {"trip_id": trip_id, "available_cages": {"$gte": 1}},
        {
            "$inc": {"available_cages": -1, "bookings_count": 1},
            "$push": {"bookings_ids": booking_id, "bookings": booking},
            "$set": {"updated_at": _now()},
        },
    )
    if res.modified_count != 1:
        raise HTTPException(400, "لا توجد أقفاص متاحة")
    carrier_id = doc.get("carrier_id")
    try:
        from routes.tair_notifications_routes import create_tair_notification
        if carrier_id:
            await create_tair_notification(
                user_id=carrier_id,
                title="حجز قفص جديد",
                body=f"{name} حجز قفصاً على رحلتك من {doc.get('from_city')} إلى {doc.get('to_city')}",
                notif_type="trip_booking",
                data={"trip_id": trip_id, "booking_id": booking_id},
            )
    except Exception as exc:  # pragma: no cover
        print(f"[trip book notify] failed: {exc}")
    fresh = await db.trips.find_one({"trip_id": trip_id})
    out = _serialize(fresh)
    out["booking_id"] = booking_id
    return out


@router.post("/{trip_id}/book/cancel")
async def cancel_booking(trip_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    """Rider cancels one of their cage bookings; the cage returns to the trip."""
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "الرحلة غير موجودة")
    if doc.get("status") in ("arrived", "completed"):
        raise HTTPException(400, "لا يمكن إلغاء الحجز بعد وصول الرحلة")
    mine = [b for b in doc.get("bookings") or [] if (b or {}).get("user_id") == user_id]
    if not mine:
        raise HTTPException(404, "ليس لديك حجز على هذه الرحلة")
    booking = mine[-1]
    bid = booking.get("booking_id")
    res = await db.trips.update_one(
        {"trip_id": trip_id, "bookings.booking_id": bid},
        {
            "$pull": {"bookings": {"booking_id": bid}, "bookings_ids": bid},
            "$inc": {"available_cages": 1, "bookings_count": -1},
            "$set": {"updated_at": _now()},
        },
    )
    if res.modified_count != 1:
        raise HTTPException(409, "تعذّر إلغاء الحجز")
    carrier_id = doc.get("carrier_id")
    if carrier_id:
        try:
            from routes.tair_notifications_routes import create_tair_notification
            await create_tair_notification(
                user_id=carrier_id,
                title="إلغاء حجز قفص",
                body=f"{booking.get('name') or 'مربي'} ألغى حجز قفص على رحلتك من {doc.get('from_city')} إلى {doc.get('to_city')}",
                notif_type="trip_booking_cancel",
                data={"trip_id": trip_id, "booking_id": bid},
            )
        except Exception as exc:  # pragma: no cover
            print(f"[trip cancel notify] failed: {exc}")
    return {"success": True, "booking_id": bid}


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
        scopes = await moderator_scopes(db, user_id)
        if "market" in scopes or "general" in scopes:
            admin = {"id": user_id, "moderator": True}
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
    route = f"{doc.get('from_city') or ''} → {doc.get('to_city') or ''}".strip()
    await _notify_bookers(doc, "أُلغيت الرحلة", f"ألغى الموصل الرحلة {route}", "trip_cancelled")
    return {"success": True, "trip_id": trip_id, "mode": "soft"}
