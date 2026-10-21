"""طير — Seller Storefronts + Seller Analytics.

Storefront (public):
    GET  /api/sellers/{user_id}                       → public seller profile
    GET  /api/sellers/{user_id}/listings              → their active listings
    GET  /api/sellers/{user_id}/stats                 → public counts (listings, rating, joined)

Analytics (owner-only, guarded by user_id in query):
    GET  /api/sellers/{user_id}/analytics/overview    → views/likes/messages/orders totals
    GET  /api/sellers/{user_id}/analytics/listings    → per-listing performance
"""
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient

from services.moderation import moderator_scopes
from services.storefront_logic import active_flash_sales

router = APIRouter(prefix="/sellers", tags=["sellers"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _iso(v):
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def _serialize_listing(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for k in ("posted_at", "created_at", "updated_at", "sold_at"):
        if k in doc:
            doc[k] = _iso(doc[k])
    return doc


# ------------------------------------------------------------------ public


@router.get("/{user_id}")
async def get_seller_profile(user_id: str, viewer_id: Optional[str] = None):
    """Public seller profile — safe fields only."""
    u = await db.users.find_one({"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]}, {"_id": 0})
    if not u:
        raise HTTPException(404, "Seller not found")

    # Track a page-view visit (dedup by viewer_id per hour if provided, else raw increment)
    try:
        seller_key = u.get("user_id") or u.get("id") or u.get("email") or user_id
        now = datetime.now(timezone.utc)
        if viewer_id and viewer_id != seller_key:
            # Deduplicate: one visit per viewer per hour
            recent = await db.storefront_visits.find_one({
                "seller_id": seller_key,
                "viewer_id": viewer_id,
                "created_at": {"$gt": (now - timedelta(hours=1)).isoformat()},
            })
            if not recent:
                await db.storefront_visits.insert_one({
                    "seller_id": seller_key,
                    "viewer_id": viewer_id,
                    "created_at": now.isoformat(),
                })
    except Exception:
        pass  # never break profile fetch

    listings_count = await db.listings.count_documents(
        {"seller_id": user_id, "status": {"$in": ["active", "paused", "sold"]}}
    )
    sold_count = await db.listings.count_documents({"seller_id": user_id, "status": "sold"})
    # rating avg from user_ratings collection (role="seller")
    agg = await db.user_ratings.aggregate([
        {"$match": {"target_id": user_id, "role": "seller"}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    rating_avg = round(agg[0]["avg"], 2) if agg else None
    rating_count = agg[0]["count"] if agg else 0

    # Total unique-ish visits count
    try:
        visits_count = await db.storefront_visits.count_documents({"seller_id": (u.get("user_id") or u.get("id") or u.get("email") or user_id)})
    except Exception:
        visits_count = 0

    # === Include storefront customizations (from Storefront Manager) ===
    sf = u.get("storefront_settings") or {}
    seller_key = u.get("user_id") or u.get("id") or u.get("email") or user_id
    scopes = await moderator_scopes(db, seller_key)
    admin_doc = await db.admins.find_one(
        {"$or": [
            {"id": seller_key},
            {"user_id": seller_key},
            {"email": u.get("email") or seller_key},
        ]},
        {"_id": 0, "id": 1},
    )
    is_admin = bool(admin_doc or u.get("is_admin") or u.get("role") in ("admin", "super_admin"))

    return {
        "user_id": u.get("user_id") or u.get("id"),
        "name": u.get("name") or "بائع طير",
        "avatar": u.get("avatar"),
        "bg_image": u.get("bg_image") or u.get("profile_bg_url"),
        "profile_bg_url": u.get("profile_bg_url"),
        "bio": u.get("bio"),
        "city": u.get("city"),
        "phone": u.get("phone"),
        "whatsapp": u.get("whatsapp") or u.get("phone"),
        "is_verified_merchant": bool(u.get("is_verified_merchant") or u.get("is_verified_shop")),
        "is_verified_shop": bool(u.get("is_verified_shop")),
        "is_verified_carrier": bool(u.get("is_verified_carrier")),
        "is_admin": is_admin,
        "moderator_scopes": scopes,
        "joined_at": _iso(u.get("created_at")),
        "listings_count": listings_count,
        "sold_count": sold_count,
        "rating_avg": rating_avg,
        "rating_count": rating_count,
        "visits_count": visits_count,
        # Storefront customization fields (from Storefront Manager)
        "identity_color": sf.get("identity_color", "#0f766e"),
        "logo_url": sf.get("logo_url"),
        "about_text": sf.get("about_text", ""),
        "contact_prefs": sf.get("contact_prefs", {"whatsapp": True, "call": False, "chat": True}),
        "business_hours": sf.get("business_hours", []),
        "portfolio_images": sf.get("portfolio_images", []),
        "highlights": sf.get("highlights", []),
        "banner_slides": sf.get("banner_slides", []),
        "location": sf.get("location"),
        "pickup_enabled": bool(sf.get("pickup_enabled", False)),
        "pickup_note": sf.get("pickup_note", ""),
        "flash_sales": await _public_flash_sales(sf.get("flash_sales") or []),
        "coupons": [c for c in sf.get("coupons", []) if c.get("active")],
        "announcement": sf.get("announcement") or "",
        "shipping_note": sf.get("shipping_note") or "",
        "return_note": sf.get("return_note") or "",
        "delivery_cities": sf.get("delivery_cities") or [],
        "store_paused": bool(sf.get("store_paused")),
        "response_promise": sf.get("response_promise") or "",
    }


async def _public_flash_sales(sales) -> list:
    fresh = active_flash_sales(sales)
    ids = []
    for sale in fresh:
        ids.extend([i for i in (sale.get("listing_ids") or []) if isinstance(i, str)])
    titles = {}
    if ids:
        cursor = db.listings.find(
            {"listing_id": {"$in": list(set(ids))}},
            {"_id": 0, "listing_id": 1, "title": 1},
        )
        async for row in cursor:
            if row.get("listing_id"):
                titles[row["listing_id"]] = row.get("title") or ""
    public = []
    for sale in fresh:
        item = dict(sale)
        item["listing_titles"] = [
            titles[i] for i in (sale.get("listing_ids") or []) if titles.get(i)
        ]
        public.append(item)
    return public


@router.get("/{user_id}/listings")
async def get_seller_listings(user_id: str, limit: int = Query(50, le=100)):
    cursor = (
        db.listings.find({"seller_id": user_id, "status": {"$in": ["active", "paused", "sold"]}})
        .sort("posted_at", -1)
        .limit(limit)
    )
    items = [_serialize_listing(d) async for d in cursor]
    return {"items": items, "count": len(items)}


@router.get("/{user_id}/reviews")
async def get_seller_reviews(user_id: str, limit: int = Query(30, le=100)):
    cursor = (
        db.user_ratings.find({"target_id": user_id, "role": "seller"}, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
    )
    items = []
    async for r in cursor:
        for k in ("created_at",):
            if k in r:
                r[k] = _iso(r[k])
        items.append(r)
    return {"items": items, "count": len(items)}


# ------------------------------------------------------------------ analytics (private)


async def _assert_owner(user_id: str, expected: str):
    if user_id != expected:
        raise HTTPException(403, "Not authorized")


@router.get("/{user_id}/analytics/overview")
async def analytics_overview(
    user_id: str,
    requester_id: str = Query(..., description="Must equal user_id"),
    days: int = Query(30, ge=1, le=365),
):
    """Aggregated stats for the last N days for this seller."""
    await _assert_owner(requester_id, user_id)

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Listings totals
    total_listings = await db.listings.count_documents({"seller_id": user_id})
    active_listings = await db.listings.count_documents({"seller_id": user_id, "status": "active"})
    sold_listings = await db.listings.count_documents({"seller_id": user_id, "status": "sold"})

    # Aggregate view + like counts across all seller listings
    agg = await db.listings.aggregate([
        {"$match": {"seller_id": user_id}},
        {"$group": {
            "_id": None,
            "total_views": {"$sum": {"$ifNull": ["$view_count", 0]}},
            "total_likes": {"$sum": {"$ifNull": ["$likes_count", 0]}},
        }},
    ]).to_list(1)
    total_views = agg[0]["total_views"] if agg else 0
    total_likes = agg[0]["total_likes"] if agg else 0

    # Messages received (chats where seller is participant)
    try:
        messages_received = await db.chat_messages.count_documents({
            "to_user_id": user_id,
            "created_at": {"$gte": since},
        })
    except Exception:
        messages_received = 0

    # Orders
    orders_total = await db.orders.count_documents({"seller_id": user_id})
    orders_completed = await db.orders.count_documents({"seller_id": user_id, "status": "completed"})

    # Rating
    rating_agg = await db.user_ratings.aggregate([
        {"$match": {"target_id": user_id, "role": "seller"}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]).to_list(1)

    return {
        "range_days": days,
        "listings": {
            "total": total_listings,
            "active": active_listings,
            "sold": sold_listings,
        },
        "engagement": {
            "views": total_views,
            "likes": total_likes,
            "messages_received": messages_received,
        },
        "orders": {
            "total": orders_total,
            "completed": orders_completed,
            "completion_rate": (
                round(orders_completed / orders_total, 2) if orders_total else 0
            ),
        },
        "rating": {
            "avg": round(rating_agg[0]["avg"], 2) if rating_agg else None,
            "count": rating_agg[0]["count"] if rating_agg else 0,
        },
    }


@router.get("/{user_id}/analytics/listings")
async def analytics_per_listing(
    user_id: str,
    requester_id: str = Query(...),
    limit: int = Query(50, le=200),
):
    """Per-listing performance for the seller."""
    await _assert_owner(requester_id, user_id)
    cursor = (
        db.listings.find(
            {"seller_id": user_id},
            {"_id": 0, "listing_id": 1, "title": 1, "price_sar": 1,
             "status": 1, "view_count": 1, "likes_count": 1,
             "posted_at": 1, "images": 1},
        )
        .sort("posted_at", -1)
        .limit(limit)
    )
    items = []
    async for d in cursor:
        d["view_count"] = d.get("view_count") or 0
        d["likes_count"] = d.get("likes_count") or 0
        if isinstance(d.get("posted_at"), datetime):
            d["posted_at"] = d["posted_at"].isoformat()
        # First image only, for a compact card
        imgs = d.pop("images", None)
        d["cover"] = imgs[0] if isinstance(imgs, list) and imgs else None
        items.append(d)
    return {"items": items, "count": len(items)}
