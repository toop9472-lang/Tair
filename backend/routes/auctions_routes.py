"""طير — Auction (المزاد) API.

Rules:
- Bidding window: 16:00 - 21:00 KSA (Asia/Riyadh, UTC+3).
- Users must accept a religious oath (الحلف الشرعي) ONE TIME before viewing/bidding.
- Bids placed in the final 60 seconds extend the auction end by 60 seconds.
- All timestamps stored in UTC ISO strings; frontend formats as 24-hour HH:MM.
- No in-app payments — winner + seller close the deal via chat/WhatsApp.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient

from models.auction import AuctionCreate, AuctionSubmit, BidCreate, AuctionSettingsUpdate

router = APIRouter(prefix="/auctions", tags=["Tair-Auctions"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

KSA_TZ = timezone(timedelta(hours=3))
AUCTION_OPEN_HOUR = 16  # 16:00 KSA
AUCTION_CLOSE_HOUR = 21  # 21:00 KSA
EXTENSION_SECONDS = 60


# ==================== Admin helper ====================
async def _is_admin(user_id: str) -> bool:
    if not user_id:
        return False
    adm = await db.admins.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]}
    )
    if adm:
        return True
    u = await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "is_admin": 1, "role": 1},
    )
    return bool(u and (u.get("is_admin") or u.get("role") == "admin"))


# ==================== Settings ====================
DEFAULT_SETTINGS = {
    "daily_limit": 15,
    "min_increment_sar": 10.0,
    "starting_price_floor": 1.0,
    "open_hour": AUCTION_OPEN_HOUR,
    "close_hour": AUCTION_CLOSE_HOUR,
}


async def _get_settings() -> dict:
    doc = await db.tair_auction_settings.find_one({"_id": "singleton"})
    if not doc:
        await db.tair_auction_settings.insert_one({"_id": "singleton", **DEFAULT_SETTINGS})
        return dict(DEFAULT_SETTINGS)
    doc.pop("_id", None)
    return {**DEFAULT_SETTINGS, **doc}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _now_ksa() -> datetime:
    return _now_utc().astimezone(KSA_TZ)


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _parse_iso(s: str) -> datetime:
    if not s:
        return _now_utc()
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return _now_utc()


def _today_window_ksa():
    """Returns (opens_at_utc, closes_at_utc) for the auction window that is
    currently active OR the next upcoming window."""
    now_ksa = _now_ksa()
    opens = now_ksa.replace(hour=AUCTION_OPEN_HOUR, minute=0, second=0, microsecond=0)
    closes = now_ksa.replace(hour=AUCTION_CLOSE_HOUR, minute=0, second=0, microsecond=0)
    if now_ksa >= closes:
        # move to tomorrow
        opens = opens + timedelta(days=1)
        closes = closes + timedelta(days=1)
    return opens.astimezone(timezone.utc), closes.astimezone(timezone.utc)


def _is_window_open() -> bool:
    now = _now_ksa()
    return AUCTION_OPEN_HOUR <= now.hour < AUCTION_CLOSE_HOUR


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = _iso(v)
    return doc


# ==================== Window Status ====================
@router.get("/window-status")
async def window_status():
    opens_utc, closes_utc = _today_window_ksa()
    now = _now_utc()
    is_open = _is_window_open()
    return {
        "is_open": is_open,
        "opens_at": _iso(opens_utc),
        "closes_at": _iso(closes_utc),
        "now": _iso(now),
        "open_hour_ksa": AUCTION_OPEN_HOUR,
        "close_hour_ksa": AUCTION_CLOSE_HOUR,
        "ksa_offset_hours": 3,
    }


# ==================== Oath (الحلف الشرعي) ====================
OATH_TEXT = (
    "أُقسم بالله العظيم أن أتعامل في هذا المزاد بصدق وأمانة، "
    "وألا أرفع سعر السلعة إلا وأنا جاد في الشراء، "
    "وأتحمّل مسؤولية عرضي وشرائي أمام الله ثم أمام إدارة التطبيق."
)


@router.get("/oath/status")
async def oath_status(user_id: str = Query(...)):
    doc = await db.tair_auction_oaths.find_one({"user_id": user_id})
    return {
        "accepted": bool(doc),
        "accepted_at": _iso(doc["accepted_at"]) if doc else None,
        "text": OATH_TEXT,
    }


@router.post("/oath/accept")
async def oath_accept(user_id: str = Query(...)):
    now = _now_utc()
    await db.tair_auction_oaths.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "accepted_at": now}},
        upsert=True,
    )
    return {"success": True, "accepted_at": _iso(now)}


async def _require_oath(user_id: str):
    doc = await db.tair_auction_oaths.find_one({"user_id": user_id})
    if not doc:
        raise HTTPException(status_code=428, detail="الحلف الشرعي مطلوب قبل المشاركة في المزاد")


# ==================== Auction Settings (Admin) ====================
@router.get("/settings")
async def get_settings():
    return await _get_settings()


@router.put("/settings")
async def update_settings(payload: AuctionSettingsUpdate, user_id: str = Query(...)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح — يتطلب صلاحية المدير")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "لا يوجد تعديل")
    await db.tair_auction_settings.update_one(
        {"_id": "singleton"}, {"$set": update}, upsert=True
    )
    return await _get_settings()


# ==================== Seller Submission ====================
@router.post("/submit")
async def submit_auction(payload: AuctionSubmit, user_id: str = Query(...)):
    """Seller submits an auction for admin review. Not visible publicly until approved."""
    await _require_oath(user_id)
    settings = await _get_settings()
    floor = float(settings.get("starting_price_floor", 1))
    if payload.starting_price_sar < floor:
        raise HTTPException(400, f"سعر الافتتاح يجب أن يكون ≥ {floor:.0f} ر.س")
    if len(payload.images) < 3:
        raise HTTPException(400, "مطلوب ٣ صور على الأقل")
    if len(payload.images) > 5:
        raise HTTPException(400, "الحد الأقصى ٥ صور")

    seller = await db.users.find_one({"$or": [{"user_id": user_id}, {"email": user_id}]})
    seller_name = (seller or {}).get("name") or "بائع"

    now = _now_utc()
    auction_id = f"auc_{uuid.uuid4().hex[:12]}"
    # Compute submission queue position (auto-numbered by submission order)
    submission_count = await db.tair_auctions.count_documents({
        "status": {"$in": ["pending_review", "approved", "scheduled", "live"]}
    })
    queue_position = submission_count + 1

    doc = {
        "auction_id": auction_id,
        "sequence_number": None,        # assigned on approval
        "queue_position": queue_position,
        "seller_id": user_id,
        "seller_name": seller_name,
        "title": payload.title,
        "description": payload.description,
        "images": payload.images,
        "starting_price_sar": float(payload.starting_price_sar),
        "current_bid_sar": float(payload.starting_price_sar),
        "highest_bidder_id": None,
        "highest_bidder_name": None,
        "min_increment_sar": float(settings.get("min_increment_sar", 10)),
        "start_at": None,
        "end_at": None,
        "status": "pending_review",
        "created_at": now,
        "city": payload.city,
        "category": payload.category or "birds",
        "gender": payload.gender,
        "age_months": int(payload.age_months),
        "species": payload.species,
        "breed": payload.breed or "",
        "bids_count": 0,
    }
    await db.tair_auctions.insert_one(doc)
    return _serialize({**doc})


# ==================== Admin: List Pending ====================
@router.get("/pending")
async def list_pending(user_id: str = Query(...), limit: int = Query(50, le=200)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    cursor = db.tair_auctions.find({"status": "pending_review"}).sort("created_at", 1).limit(limit)
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "count": len(items)}


# ==================== Admin: Approve ====================
@router.post("/{auction_id}/approve")
async def approve_auction(auction_id: str, user_id: str = Query(...)):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    auction = await db.tair_auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(404, "المزاد غير موجود")
    if auction.get("status") != "pending_review":
        raise HTTPException(400, f"لا يمكن الموافقة — الحالة الحالية: {auction.get('status')}")

    # Assign next sequence number (across all approved/scheduled/live/closed auctions)
    last = await db.tair_auctions.find_one(
        {"sequence_number": {"$ne": None}}, sort=[("sequence_number", -1)]
    )
    next_seq = (last.get("sequence_number") if last else 0) + 1

    opens_utc, closes_utc = _today_window_ksa()
    now = _now_utc()
    start_at = now if _is_window_open() else opens_utc
    end_at = closes_utc
    status = "live" if _is_window_open() else "scheduled"

    await db.tair_auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "sequence_number": next_seq,
            "start_at": start_at,
            "end_at": end_at,
            "status": status,
            "approved_at": now,
            "approved_by": user_id,
        }},
    )

    # Notify seller
    try:
        await db.tair_notifications.insert_one({
            "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
            "user_id": auction["seller_id"],
            "type": "auction_approved",
            "title": "تمت الموافقة على مزادك ✅",
            "body": f"تم قبول «{auction['title']}» — مزاد رقم #{next_seq}",
            "data": {"auction_id": auction_id, "sequence_number": next_seq},
            "is_read": False,
            "created_at": now,
        })
    except Exception:
        pass

    doc = await db.tair_auctions.find_one({"auction_id": auction_id})
    return {"success": True, "sequence_number": next_seq, "auction": _serialize(doc)}


# ==================== Admin: Reject ====================
@router.post("/{auction_id}/reject")
async def reject_auction(auction_id: str, user_id: str = Query(...), reason: str = Query("")):
    if not await _is_admin(user_id):
        raise HTTPException(403, "غير مصرح")
    auction = await db.tair_auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(404, "المزاد غير موجود")
    now = _now_utc()
    await db.tair_auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": now,
            "rejected_by": user_id,
            "rejection_reason": reason,
        }},
    )
    # Notify seller
    try:
        await db.tair_notifications.insert_one({
            "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
            "user_id": auction["seller_id"],
            "type": "auction_rejected",
            "title": "تم رفض طلب المزاد",
            "body": reason or f"لم يتم قبول «{auction['title']}» — تواصل مع الإدارة",
            "data": {"auction_id": auction_id},
            "is_read": False,
            "created_at": now,
        })
    except Exception:
        pass
    return {"success": True}


# ==================== Create Auction (admin direct — legacy) ====================
@router.post("/create")
async def create_auction(payload: AuctionCreate, user_id: str = Query(...)):
    await _require_oath(user_id)

    # Fetch seller name
    seller = await db.users.find_one({"user_id": user_id}) or await db.users.find_one({"email": user_id})
    seller_name = (seller or {}).get("name") or "بائع"

    opens_utc, closes_utc = _today_window_ksa()
    now = _now_utc()

    # If currently in window → start now; else start at next opens_utc
    start_at = now if _is_window_open() else opens_utc
    end_at = _parse_iso(payload.end_at) if payload.end_at else closes_utc
    if end_at <= start_at:
        end_at = closes_utc

    status = "live" if _is_window_open() else "scheduled"

    # Assign sequence
    last = await db.tair_auctions.find_one(
        {"sequence_number": {"$ne": None}}, sort=[("sequence_number", -1)]
    )
    next_seq = (last.get("sequence_number") if last else 0) + 1

    auction_id = f"auc_{uuid.uuid4().hex[:12]}"
    doc = {
        "auction_id": auction_id,
        "sequence_number": next_seq,
        "seller_id": user_id,
        "seller_name": seller_name,
        "title": payload.title,
        "description": payload.description or "",
        "images": payload.images or [],
        "starting_price_sar": float(payload.starting_price_sar),
        "current_bid_sar": float(payload.starting_price_sar),
        "highest_bidder_id": None,
        "highest_bidder_name": None,
        "min_increment_sar": float(payload.min_increment_sar or 10),
        "start_at": start_at,
        "end_at": end_at,
        "status": status,
        "created_at": now,
        "city": payload.city,
        "category": payload.category or "birds",
        "gender": payload.gender,
        "age_months": payload.age_months,
        "species": payload.species,
        "breed": payload.breed,
        "bids_count": 0,
    }
    await db.tair_auctions.insert_one(doc)
    return _serialize({**doc})


# ==================== List ====================
@router.get("/list")
async def list_auctions(status: str = Query("all"), limit: int = Query(50, le=200)):
    now = _now_utc()
    # Find newly-ended auctions BEFORE bulk-updating so we can send notifications
    ending = await db.tair_auctions.find(
        {"status": {"$in": ["scheduled", "live"]}, "end_at": {"$lte": now}}
    ).to_list(200)
    # Auto-close overdue
    await db.tair_auctions.update_many(
        {"status": {"$in": ["scheduled", "live"]}, "end_at": {"$lte": now}},
        {"$set": {"status": "closed"}},
    )
    # Emit end-notifications
    for a in ending:
        try:
            aid = a["auction_id"]
            seller_id = a.get("seller_id")
            winner_id = a.get("highest_bidder_id")
            title = a.get("title", "")
            winning_price = a.get("current_bid_sar")
            if seller_id:
                await db.tair_notifications.insert_one({
                    "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
                    "user_id": seller_id,
                    "type": "auction_ended",
                    "title": "انتهى مزادك",
                    "body": (f"فاز {a.get('highest_bidder_name','مزايد')} بـ {winning_price:.0f} ر.س على «{title}»"
                             if winner_id else f"انتهى مزاد «{title}» بدون مزايدات"),
                    "data": {"auction_id": aid},
                    "is_read": False,
                    "created_at": now,
                })
            if winner_id:
                await db.tair_notifications.insert_one({
                    "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
                    "user_id": winner_id,
                    "type": "auction_won",
                    "title": "مبروك! فزت بالمزاد",
                    "body": f"فزت بـ«{title}» بمبلغ {winning_price:.0f} ر.س — تواصل مع البائع لإتمام الصفقة",
                    "data": {"auction_id": aid, "seller_id": seller_id},
                    "is_read": False,
                    "created_at": now,
                })
        except Exception:
            continue
    # Auto-live if in window
    if _is_window_open():
        await db.tair_auctions.update_many(
            {"status": "scheduled", "start_at": {"$lte": now}, "end_at": {"$gt": now}},
            {"$set": {"status": "live"}},
        )

    q = {}
    if status == "all":
        # Hide submissions & rejects from public
        q["status"] = {"$in": ["scheduled", "live", "closed"]}
    else:
        q["status"] = status
    # Sort: live first, then scheduled by sequence, then closed
    cursor = db.tair_auctions.find(q).sort([
        ("status", 1),
        ("sequence_number", 1),
        ("start_at", -1),
    ]).limit(limit)
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "count": len(items), "window_is_open": _is_window_open()}


# ==================== Get Auction ====================
@router.get("/{auction_id}")
async def get_auction(auction_id: str):
    doc = await db.tair_auctions.find_one({"auction_id": auction_id})
    if not doc:
        raise HTTPException(status_code=404, detail="المزاد غير موجود")
    now = _now_utc()
    end_at = doc.get("end_at")
    if isinstance(end_at, datetime):
        if end_at.tzinfo is None:
            end_at = end_at.replace(tzinfo=timezone.utc)
        if end_at <= now and doc.get("status") in ("scheduled", "live"):
            await db.tair_auctions.update_one({"auction_id": auction_id}, {"$set": {"status": "closed"}})
            doc["status"] = "closed"

    # Attach recent bids
    bids_cursor = db.tair_auction_bids.find({"auction_id": auction_id}).sort("created_at", -1).limit(30)
    bids = [_serialize(b) async for b in bids_cursor]
    return {**_serialize(doc), "recent_bids": bids}


# ==================== Place Bid ====================
@router.post("/{auction_id}/bid")
async def place_bid(auction_id: str, payload: BidCreate, user_id: str = Query(...)):
    await _require_oath(user_id)

    if not _is_window_open():
        raise HTTPException(status_code=423, detail="المزاد مغلق. أوقات المزايدة من 16:00 حتى 21:00 بتوقيت السعودية")

    auction = await db.tair_auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="المزاد غير موجود")

    if auction["seller_id"] == user_id:
        raise HTTPException(status_code=403, detail="لا يمكنك المزايدة على مزادك")

    now = _now_utc()
    end_raw = auction["end_at"]
    end_at = end_raw if isinstance(end_raw, datetime) else _parse_iso(end_raw)
    if end_at.tzinfo is None:
        end_at = end_at.replace(tzinfo=timezone.utc)
    if end_at <= now:
        await db.tair_auctions.update_one({"auction_id": auction_id}, {"$set": {"status": "closed"}})
        raise HTTPException(status_code=410, detail="المزاد أُغلق")

    current = float(auction.get("current_bid_sar", 0))
    min_inc = float(auction.get("min_increment_sar", 50))
    amount = float(payload.amount_sar)
    if amount < current + min_inc:
        raise HTTPException(
            status_code=400,
            detail=f"يجب أن تكون المزايدة {current + min_inc:.0f} ر.س على الأقل",
        )

    # Fetch bidder name
    bidder = await db.users.find_one({"user_id": user_id}) or await db.users.find_one({"email": user_id})
    bidder_name = (bidder or {}).get("name") or "مزايد"

    bid_id = f"bid_{uuid.uuid4().hex[:12]}"
    await db.tair_auction_bids.insert_one({
        "bid_id": bid_id,
        "auction_id": auction_id,
        "bidder_id": user_id,
        "bidder_name": bidder_name,
        "amount_sar": amount,
        "created_at": now,
    })

    # Update auction; auto-extend end if within last 60s
    update = {
        "current_bid_sar": amount,
        "highest_bidder_id": user_id,
        "highest_bidder_name": bidder_name,
        "status": "live",
    }
    extended = False
    seconds_left = (end_at - now).total_seconds()
    if seconds_left <= EXTENSION_SECONDS:
        # extend to now + 60s, but don't push past today's close (21:00 KSA)
        opens_utc, closes_utc = _today_window_ksa()
        # if we're in "today window", cap at closes_utc
        new_end = now + timedelta(seconds=EXTENSION_SECONDS)
        # closes_utc from _today_window_ksa may return next-day window when past-close; here we're
        # in window so closes_utc is today's close
        if new_end > closes_utc and _is_window_open():
            new_end = closes_utc
        update["end_at"] = new_end
        extended = True

    await db.tair_auctions.update_one(
        {"auction_id": auction_id},
        {"$set": update, "$inc": {"bids_count": 1}},
    )

    # Notifications
    try:
        # Outbid: notify previous highest bidder (if any and different)
        prev_bidder = auction.get("highest_bidder_id")
        if prev_bidder and prev_bidder != user_id:
            await db.tair_notifications.insert_one({
                "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
                "user_id": prev_bidder,
                "type": "auction_outbid",
                "title": "تم تجاوز مزايدتك",
                "body": f"{bidder_name} زايد بمبلغ {amount:.0f} ر.س على «{auction.get('title','')}»",
                "data": {"auction_id": auction_id, "amount_sar": amount},
                "is_read": False,
                "created_at": now,
            })
        # Seller: notify on every new bid
        seller_id = auction.get("seller_id")
        if seller_id and seller_id != user_id:
            await db.tair_notifications.insert_one({
                "notif_id": f"ntf_{uuid.uuid4().hex[:12]}",
                "user_id": seller_id,
                "type": "auction_new_bid",
                "title": "مزايدة جديدة على مزادك",
                "body": f"{bidder_name} زايد بمبلغ {amount:.0f} ر.س",
                "data": {"auction_id": auction_id, "amount_sar": amount},
                "is_read": False,
                "created_at": now,
            })
    except Exception:
        pass

    doc = await db.tair_auctions.find_one({"auction_id": auction_id})
    return {
        "success": True,
        "bid_id": bid_id,
        "extended": extended,
        "auction": _serialize(doc),
    }


# ==================== Delete/Cancel ====================
@router.delete("/{auction_id}")
async def cancel_auction(auction_id: str, user_id: str = Query(...)):
    auction = await db.tair_auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="المزاد غير موجود")

    admin = await db.admins.find_one({"email": user_id}) or await db.admins.find_one({"user_id": user_id})
    is_admin = bool(admin)
    if auction["seller_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="غير مصرح")

    await db.tair_auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {"status": "cancelled"}},
    )
    return {"success": True}
