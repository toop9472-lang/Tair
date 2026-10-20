"""طير — Orders API (state machine linking buyer + seller + carrier)."""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient

from models.order import (
    Order,
    OrderCreate,
    OrderDispute,
    OrderItem,
    OrderStatusEvent,
)

router = APIRouter(prefix="/orders", tags=["Tair-Orders"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _now():
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for k in ("created_at", "completed_at"):
        v = doc.get(k)
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    for evt in doc.get("status_history", []) or []:
        if isinstance(evt.get("at"), datetime):
            evt["at"] = evt["at"].isoformat()
    return doc


# ==================== Create ====================
@router.post("/create")
async def create_order(payload: OrderCreate, user_id: str = Query(...)):
    # user_id is buyer
    order_id = f"ord_{uuid.uuid4().hex[:12]}"

    order = Order(
        order_id=order_id,
        buyer_id=user_id,
        seller_id=payload.seller_id,
        carrier_id=payload.carrier_id,
        listing_id=payload.listing_id,
        trip_id=payload.trip_id,
        items=[
            OrderItem(
                listing_id=payload.listing_id,
                quantity=payload.quantity,
                agreed_price_sar=payload.agreed_price_sar,
            )
        ],
        agreed_price_sar=payload.agreed_price_sar,
        delivery_fee_hint_sar=payload.delivery_fee_hint_sar,
        pickup_address_hint=payload.pickup_address_hint,
        dropoff_address_hint=payload.dropoff_address_hint,
        status_history=[
            OrderStatusEvent(status="pending", actor_id=user_id, note="Order created")
        ],
    )
    doc = order.model_dump()
    await db.tair_orders.insert_one(doc)

    # If linked to a trip, reserve one cage.
    if payload.trip_id:
        await db.trips.update_one(
            {"trip_id": payload.trip_id, "available_cages": {"$gte": 1}},
            {
                "$inc": {"available_cages": -1, "bookings_count": 1},
                "$push": {"bookings_ids": order_id},
            },
        )

    return _serialize(doc)


# ==================== Transitions ====================
async def _transition(
    order_id: str,
    new_status: str,
    actor_id: str,
    allowed_prev: list,
    note: Optional[str] = None,
    is_final: bool = False,
):
    doc = await db.tair_orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    if doc["status"] not in allowed_prev:
        raise HTTPException(400, f"Invalid transition from {doc['status']}")
    updates = {"status": new_status}
    if is_final:
        updates["completed_at"] = _now()
    event = OrderStatusEvent(
        status=new_status, actor_id=actor_id, note=note
    ).model_dump()
    await db.tair_orders.update_one(
        {"order_id": order_id},
        {"$set": updates, "$push": {"status_history": event}},
    )
    fresh = await db.tair_orders.find_one({"order_id": order_id})

    # Notify all parties (excluding the actor)
    try:
        from routes.tair_notifications_routes import create_tair_notification
        STATUS_MSG = {
            "accepted_by_carrier": ("قبول الناقل", "قبل الناقل طلبك وسيبدأ التنسيق قريباً"),
            "in_transit": ("الطلب في الطريق", "بدأت رحلة النقل"),
            "delivered": ("تم التسليم", "أفاد الناقل بأن الطلب سُلّم — يُرجى التأكيد"),
            "completed": ("اكتمل الطلب", "تمت الصفقة بنجاح — لا تنس التقييم"),
            "cancelled": ("تم إلغاء الطلب", "تم إلغاء الطلب"),
            "disputed": ("نزاع مفتوح", "تم فتح نزاع على هذا الطلب — سيراجعه فريقنا"),
        }
        title, body = STATUS_MSG.get(new_status, (new_status, ""))
        recipients = {fresh.get("buyer_id"), fresh.get("seller_id"), fresh.get("carrier_id")}
        recipients.discard(None)
        recipients.discard(actor_id)
        for rid in recipients:
            await create_tair_notification(
                user_id=rid, title=title, body=body,
                notif_type="order_update",
                data={"order_id": order_id, "status": new_status},
            )
    except Exception as exc:  # pragma: no cover
        print(f"[order notify] failed: {exc}")

    return _serialize(fresh)


@router.post("/{order_id}/accept-carrier")
async def accept_by_carrier(order_id: str, user_id: str = Query(...)):
    doc = await db.tair_orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    if doc.get("carrier_id") and doc["carrier_id"] != user_id:
        raise HTTPException(403, "Not the assigned carrier")
    return await _transition(order_id, "accepted_by_carrier", user_id, ["pending"])


@router.post("/{order_id}/start-transit")
async def start_transit(order_id: str, user_id: str = Query(...)):
    doc = await db.tair_orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    if doc.get("carrier_id") != user_id:
        raise HTTPException(403, "Only the carrier can start transit")
    return await _transition(
        order_id, "in_transit", user_id, ["accepted_by_carrier"]
    )


@router.post("/{order_id}/mark-delivered")
async def mark_delivered(order_id: str, user_id: str = Query(...)):
    doc = await db.tair_orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    if doc.get("carrier_id") != user_id:
        raise HTTPException(403, "Only the carrier can mark delivered")
    return await _transition(order_id, "delivered", user_id, ["in_transit"])


@router.post("/{order_id}/complete")
async def complete_order(order_id: str, user_id: str = Query(...)):
    """Buyer confirms receipt — final."""
    doc = await db.tair_orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    if doc.get("buyer_id") != user_id:
        raise HTTPException(403, "Only buyer can complete")
    return await _transition(
        order_id, "completed", user_id, ["delivered"], is_final=True
    )


@router.post("/{order_id}/cancel")
async def cancel_order(order_id: str, user_id: str = Query(...), note: Optional[str] = None):
    doc = await db.tair_orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    if user_id not in {doc.get("buyer_id"), doc.get("seller_id"), doc.get("carrier_id")}:
        raise HTTPException(403, "Not a party in this order")
    if doc["status"] in {"completed", "cancelled", "delivered"}:
        raise HTTPException(400, "Cannot cancel a completed/delivered order")

    # Release cage if linked to trip.
    if doc.get("trip_id") and doc["status"] not in {"pending"}:
        await db.trips.update_one(
            {"trip_id": doc["trip_id"]},
            {"$inc": {"available_cages": 1, "bookings_count": -1}},
        )
    return await _transition(
        order_id,
        "cancelled",
        user_id,
        ["pending", "accepted_by_carrier", "in_transit"],
        note=note,
    )


@router.post("/{order_id}/dispute")
async def file_dispute(
    order_id: str,
    reason: str,
    user_id: str = Query(...),
    details: Optional[str] = None,
):
    doc = await db.tair_orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    if user_id not in {doc.get("buyer_id"), doc.get("seller_id"), doc.get("carrier_id")}:
        raise HTTPException(403, "Not a party")
    dispute = OrderDispute(
        reason=reason, details=details, filed_by=user_id
    ).model_dump()
    await db.tair_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "disputed", "dispute": dispute}},
    )
    return {"success": True, "order_id": order_id, "status": "disputed"}


# ==================== Reads ====================
@router.get("/{order_id}")
async def get_order(order_id: str, user_id: str = Query(...)):
    doc = await db.tair_orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    if user_id not in {
        doc.get("buyer_id"),
        doc.get("seller_id"),
        doc.get("carrier_id"),
    }:
        # allow admin
        admin = await db.admins.find_one(
            {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
            {"_id": 0, "id": 1},
        )
        if not admin:
            raise HTTPException(403, "Not authorized")
    return _serialize(doc)


@router.get("/user/{user_id}")
async def orders_by_user(user_id: str, role: str = "all", status: Optional[str] = None):
    query: dict = {}
    if role == "buyer":
        query["buyer_id"] = user_id
    elif role == "seller":
        query["seller_id"] = user_id
    elif role == "carrier":
        query["carrier_id"] = user_id
    else:
        query["$or"] = [
            {"buyer_id": user_id},
            {"seller_id": user_id},
            {"carrier_id": user_id},
        ]
    if status:
        query["status"] = status

    cursor = db.tair_orders.find(query).sort("created_at", -1)
    docs = await cursor.to_list(500)
    items = [_serialize(d) for d in docs]
    return {"items": items, "total": len(items)}
