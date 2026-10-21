"""طير — Storefront: comprehensive merchant customization + analytics."""
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from auth.actor import require_actor
from services.storefront_logic import (
    DEFAULT_HOURS,
    active_flash_sales,
    is_open_now,
    normalize_coupon_code,
    sanitize_settings_patch,
)

router = APIRouter(prefix="/storefront", tags=["storefront"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ.get("DB_NAME", "saqr_db")]


def get_db():
    return db


MEDIA_DIR = Path(__file__).resolve().parent.parent / "static" / "media" / "storefront"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SETTINGS = {
    # Identity (Pack 1)
    "identity_color": "#0f766e",
    "logo_url": None,
    "about_text": "",
    "contact_prefs": {"whatsapp": True, "call": False, "chat": True},
    "business_hours": DEFAULT_HOURS,
    "announcement": "",
    "shipping_note": "",
    "return_note": "",
    "delivery_cities": [],
    "store_paused": False,
    "response_promise": "",
    # Media (Pack 2)
    "portfolio_images": [],  # up to 6 URLs
    "highlights": [],  # [{title, cover, items:[{image,caption}]}]
    "banner_slides": [],  # up to 5 URLs for animated slider
    # Location & delivery (Pack 3)
    "location": None,  # {lat, lng, city, address_label}
    "pickup_enabled": False,
    "pickup_note": "",
    # Sales (Pack 4)
    "flash_sales": [],  # [{id, title, discount_pct, ends_at, listing_ids}]
    "coupons": [],  # [{code, discount_pct, active}]
    "inventory": {},  # {species_id: {available: int, reserved: int}}
    # Automation (Pack 5)
    "auto_reply_enabled": False,
    "auto_reply_message": "شكراً لتواصلك مع متجرنا. متجرنا يعمل من 9 صباحاً إلى 10 مساءً. سنرد قريباً.",
    "vip_customer_ids": [],
}


class SettingsIn(BaseModel):
    identity_color: Optional[str] = None
    logo_url: Optional[str] = None
    about_text: Optional[str] = None
    contact_prefs: Optional[dict] = None
    business_hours: Optional[List[dict]] = None
    portfolio_images: Optional[List[str]] = None
    highlights: Optional[List[dict]] = None
    banner_slides: Optional[List[str]] = None
    location: Optional[dict] = None
    pickup_enabled: Optional[bool] = None
    pickup_note: Optional[str] = None
    auto_reply_enabled: Optional[bool] = None
    auto_reply_message: Optional[str] = None
    vip_customer_ids: Optional[List[str]] = None
    announcement: Optional[str] = None
    shipping_note: Optional[str] = None
    return_note: Optional[str] = None
    delivery_cities: Optional[List[str]] = None
    store_paused: Optional[bool] = None
    response_promise: Optional[str] = None


class FlashSaleIn(BaseModel):
    title: str
    discount_pct: float = Field(gt=0, le=90)
    ends_at: str  # ISO
    listing_ids: List[str] = []


class CouponIn(BaseModel):
    code: str
    discount_pct: float = Field(gt=0, le=90)
    active: bool = True


class CouponActiveIn(BaseModel):
    active: bool


class InventoryUpdateIn(BaseModel):
    species_id: str
    available: int = 0
    reserved: int = 0


class PriceAlertIn(BaseModel):
    user_id: str
    species_id: Optional[str] = None
    family_id: Optional[str] = None
    max_price: float
    city: Optional[str] = None


# --------------------------- Helpers ---------------------------
async def _get_user_settings(db, uid: str) -> dict:
    user = await db.users.find_one({"$or": [{"user_id": uid}, {"id": uid}, {"email": uid}]})
    if not user:
        return DEFAULT_SETTINGS.copy()
    existing = user.get("storefront_settings") or {}
    merged = {**DEFAULT_SETTINGS, **existing}
    return merged


async def _update_settings(db, uid: str, patch: dict):
    """Save storefront_settings and mirror identity fields to top-level user.

    Mirror is UNI-DIRECTIONAL and CONDITIONAL:
      - about_text → user.bio  (only if storefront patch explicitly set about_text)
      - logo_url   → user.avatar (only if patch set logo_url)
      - banner_slides[0] → user.profile_bg_url (only if patch set banner_slides)

    We DO NOT re-mirror on unrelated storefront saves (e.g. saving business_hours
    should not overwrite the user's avatar). This preserves stability so a user
    who edits their name/bio on ProfileScreen does not see it overwritten the
    next time they save an unrelated storefront section.
    """
    update_doc: dict = {
        f"storefront_settings.{k}": v for k, v in patch.items() if v is not None
    }
    # Only mirror when the storefront patch explicitly contains the field
    if "about_text" in patch and patch["about_text"] is not None:
        update_doc["bio"] = patch["about_text"]
    if "logo_url" in patch and patch["logo_url"]:
        update_doc["avatar"] = patch["logo_url"]
    if "banner_slides" in patch:
        banners = patch["banner_slides"]
        if isinstance(banners, list) and banners:
            update_doc["profile_bg_url"] = banners[0]

    await db.users.update_one(
        {"$or": [{"user_id": uid}, {"id": uid}, {"email": uid}]},
        {"$set": update_doc},
    )


# =========================== ROUTES ===========================

@router.get("/settings")
async def get_settings(user_id: str = Query(...), actor: str = Depends(require_actor)):
    """Owner settings, including offers and the automatic reply."""
    db = get_db()
    return await _get_user_settings(db, user_id)


@router.get("/export")
async def export_storefront(
    user_id: str = Query(...),
    actor: str = Depends(require_actor),
):
    """
    Admin/owner export — returns a JSON snapshot of the seller's storefront settings
    and safe identity fields (phone / whatsapp / profile_bg_url), ready to be POSTed
    to `/api/storefront/restore` on another environment (Preview → Production).
    """
    db = get_db()
    is_owner = actor and (actor == user_id)
    if not is_owner:
        admin = await db.admins.find_one(
            {"$or": [{"id": actor}, {"user_id": actor}, {"email": actor}]},
            {"_id": 0, "id": 1},
        )
        if not admin:
            u = await db.users.find_one(
                {"$or": [{"id": actor}, {"user_id": actor}, {"email": actor}]},
                {"_id": 0, "email": 1, "is_admin": 1},
            )
            if u and (u.get("is_admin") or (u.get("email") and await db.admins.find_one({"email": u["email"]}))):
                admin = {"id": actor}
        if not admin:
            raise HTTPException(403, "Admin required")

    user = await db.users.find_one(
        {"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]},
        {"_id": 0},
    )
    if not user:
        raise HTTPException(404, "user_not_found")
    sf = user.get("storefront_settings") or {}
    payload = {
        "user_id": user_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "storefront_settings": sf,
        "user_fields": {
            "phone": user.get("phone"),
            "whatsapp": user.get("whatsapp"),
            "profile_bg_url": user.get("profile_bg_url"),
        },
    }
    return payload


@router.patch("/settings")
async def update_settings(user_id: str, payload: SettingsIn, actor: str = Depends(require_actor)):
    """Partially update storefront settings."""
    db = get_db()
    patch = sanitize_settings_patch(payload.dict(exclude_none=True))
    if not patch:
        raise HTTPException(400, "Nothing to update")
    await _update_settings(db, user_id, patch)
    return {"ok": True, "updated": list(patch.keys())}


@router.post("/restore")
async def restore_storefront(
    user_id: str = Query(...),
    payload: dict = None,
    actor: str = Depends(require_actor),
):
    """
    Admin restore endpoint — imports a full storefront_settings blob for a user.
    Used to migrate settings between environments (e.g., preview → production).

    Body: { "storefront_settings": {...}, "user_fields": { "phone", "whatsapp", "profile_bg_url" } }
    """
    db = get_db()
    # Ensure caller is admin (or the owner)
    is_owner = actor and (actor == user_id)
    admin = None
    if not is_owner:
        admin = await db.admins.find_one(
            {"$or": [{"id": actor}, {"user_id": actor}, {"email": actor}]},
            {"_id": 0, "id": 1},
        )
        if not admin:
            u = await db.users.find_one(
                {"$or": [{"id": actor}, {"user_id": actor}, {"email": actor}]},
                {"_id": 0, "email": 1, "is_admin": 1},
            )
            if u and (u.get("is_admin") or (u.get("email") and await db.admins.find_one({"email": u["email"]}))):
                admin = {"id": actor}
        if not admin:
            raise HTTPException(403, "Admin required")

    if not payload or not isinstance(payload, dict):
        raise HTTPException(400, "payload required")

    sf = payload.get("storefront_settings") or {}
    user_fields = payload.get("user_fields") or {}

    # Merge on top of any existing settings (do not wipe fields not provided)
    existing = await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "storefront_settings": 1},
    ) or {}
    merged = {**(existing.get("storefront_settings") or {}), **{k: v for k, v in sf.items() if v is not None}}

    update = {"storefront_settings": merged}
    # Only accept safe user fields
    for k in ("phone", "whatsapp", "profile_bg_url"):
        if user_fields.get(k) is not None:
            update[k] = user_fields[k]

    res = await db.users.update_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"$set": update},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "user_not_found")
    return {"ok": True, "user_id": user_id, "updated_keys": list(update.keys()), "settings_keys": list(merged.keys())}




@router.post("/upload-media")
async def upload_media(
    user_id: str = Query(...),
    kind: str = Query(..., regex="^(logo|portfolio|banner|highlight)$"),
    file: UploadFile = File(...),
    actor: str = Depends(require_actor),
):
    """Upload logo / portfolio / banner / highlight image → returns URL."""
    if not user_id:
        raise HTTPException(400, "user_id required")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(413, "File too large (>8MB)")
    suffix = Path(file.filename or "").suffix.lower() or ".jpg"
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        suffix = ".jpg"
    filename = f"{kind}_{user_id[:12]}_{uuid.uuid4().hex[:8]}{suffix}"
    ct_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    content_type = ct_map.get(suffix, "image/jpeg")

    url = None
    try:
        from services.r2_storage import r2
        if getattr(r2, "is_configured", False):
            url = r2.upload_bytes(f"storefront/{filename}", raw, content_type=content_type)
    except Exception as exc:
        print(f"[storefront upload] R2 failed, fallback local: {exc}")

    if not url:
        target = MEDIA_DIR / filename
        target.write_bytes(raw)
        url = f"/media/storefront/{filename}"

    return {"ok": True, "url": url}


# ================= Flash Sales =================
@router.post("/flash-sales")
async def create_flash_sale(user_id: str, payload: FlashSaleIn, actor: str = Depends(require_actor)):
    db = get_db()
    settings = await _get_user_settings(db, user_id)
    sales = list(settings.get("flash_sales") or [])
    if len(active_flash_sales(sales)) >= 8:
        raise HTTPException(400, "يمكن نشر ٨ عروض جارية كحد أقصى")
    ends = payload.ends_at
    try:
        datetime.fromisoformat(str(ends).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "تاريخ انتهاء العرض غير صالح")
    entry = payload.dict()
    entry["listing_ids"] = [i for i in (entry.get("listing_ids") or []) if isinstance(i, str)][:12]
    entry["title"] = (entry.get("title") or "عرض").strip()[:80]
    entry["id"] = f"flash_{uuid.uuid4().hex[:10]}"
    entry["created_at"] = datetime.now(timezone.utc).isoformat()
    sales.append(entry)
    await _update_settings(db, user_id, {"flash_sales": sales})
    return {"ok": True, "flash_sale": entry}


@router.delete("/flash-sales/{sale_id}")
async def delete_flash_sale(user_id: str, sale_id: str, actor: str = Depends(require_actor)):
    db = get_db()
    settings = await _get_user_settings(db, user_id)
    sales = [s for s in settings.get("flash_sales", []) if s.get("id") != sale_id]
    await _update_settings(db, user_id, {"flash_sales": sales})
    return {"ok": True}


# ================= Coupons =================
@router.post("/coupons")
async def create_coupon(user_id: str, payload: CouponIn, actor: str = Depends(require_actor)):
    db = get_db()
    try:
        code = normalize_coupon_code(payload.code)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    settings = await _get_user_settings(db, user_id)
    coupons = list(settings.get("coupons") or [])
    if len(coupons) >= 12:
        raise HTTPException(400, "الحد ١٢ كوبوناً. احذف قديماً قبل إضافة جديد")
    if any(str(c.get("code", "")).upper() == code for c in coupons):
        raise HTTPException(400, "هذا الكود مستخدم في متجرك")
    entry = {
        "code": code,
        "discount_pct": payload.discount_pct,
        "active": bool(payload.active),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    coupons.append(entry)
    await _update_settings(db, user_id, {"coupons": coupons})
    return {"ok": True, "coupon": entry}


@router.patch("/coupons/{code}")
async def set_coupon_active(code: str, user_id: str, payload: CouponActiveIn, actor: str = Depends(require_actor)):
    db = get_db()
    try:
        wanted = normalize_coupon_code(code)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    settings = await _get_user_settings(db, user_id)
    coupons = list(settings.get("coupons") or [])
    found = False
    for coupon in coupons:
        if str(coupon.get("code", "")).upper() == wanted:
            coupon["active"] = bool(payload.active)
            found = True
    if not found:
        raise HTTPException(404, "الكوبون غير موجود")
    await _update_settings(db, user_id, {"coupons": coupons})
    return {"ok": True, "coupons": coupons}


@router.delete("/coupons/{code}")
async def delete_coupon(code: str, user_id: str, actor: str = Depends(require_actor)):
    db = get_db()
    try:
        wanted = normalize_coupon_code(code)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    settings = await _get_user_settings(db, user_id)
    coupons = [c for c in (settings.get("coupons") or []) if str(c.get("code", "")).upper() != wanted]
    await _update_settings(db, user_id, {"coupons": coupons})
    return {"ok": True, "coupons": coupons}


# ================= Inventory =================
@router.post("/inventory")
async def update_inventory(user_id: str, payload: InventoryUpdateIn, actor: str = Depends(require_actor)):
    db = get_db()
    settings = await _get_user_settings(db, user_id)
    inv = settings.get("inventory", {}) or {}
    if payload.available == 0 and payload.reserved == 0:
        inv.pop(payload.species_id, None)
    else:
        inv[payload.species_id] = {"available": payload.available, "reserved": payload.reserved}
    await _update_settings(db, user_id, {"inventory": inv})
    return {"ok": True, "inventory": inv}


# ================= Price Alerts =================
@router.post("/price-alerts")
async def create_price_alert(payload: PriceAlertIn):
    db = get_db()
    alert = payload.dict()
    alert["alert_id"] = f"alert_{uuid.uuid4().hex[:12]}"
    alert["created_at"] = datetime.now(timezone.utc).isoformat()
    alert["triggered"] = False
    await db.price_alerts.insert_one(alert)
    alert.pop("_id", None)
    return {"ok": True, "alert": alert}


@router.get("/price-alerts")
async def list_price_alerts(user_id: str):
    db = get_db()
    cursor = db.price_alerts.find({"user_id": user_id}).sort("created_at", -1)
    items = []
    async for a in cursor:
        a.pop("_id", None)
        items.append(a)
    return {"items": items}


@router.delete("/price-alerts/{alert_id}")
async def delete_price_alert(alert_id: str):
    db = get_db()
    await db.price_alerts.delete_one({"alert_id": alert_id})
    return {"ok": True}


# ================= Analytics =================
@router.get("/analytics")
async def analytics(user_id: str = Query(...), days: int = 30, actor: str = Depends(require_actor)):
    """Aggregate analytics for a seller storefront."""
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 365)))
    since_iso = since.isoformat()
    owner = await db.users.find_one(
        {"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]},
        {"_id": 0, "user_id": 1, "id": 1, "email": 1, "storefront_settings": 1},
    ) or {}
    aliases = [v for v in {user_id, owner.get("user_id"), owner.get("id"), owner.get("email")} if v]
    settings = owner.get("storefront_settings") or {}

    # Visits were stored under `at` or `created_at`, and seller_id may be any alias.
    visitor_query = {
        "seller_id": {"$in": aliases},
        "$or": [{"at": {"$gte": since_iso}}, {"created_at": {"$gte": since_iso}}],
    }
    daily_visitors = {}
    cities = {}
    cursor = db.storefront_visits.find(visitor_query)
    total_visitors = 0
    async for v in cursor:
        total_visitors += 1
        d = str(v.get("at") or v.get("created_at") or "")[:10]
        if d:
            daily_visitors[d] = daily_visitors.get(d, 0) + 1
        c = v.get("city") or "غير معروف"
        cities[c] = cities.get(c, 0) + 1

    # Listings performance
    listing_perf = []
    cursor2 = db.listings.find({"seller_id": {"$in": aliases}})
    total_views = 0
    async for l in cursor2:
        views = l.get("view_count", 0)
        total_views += views
        listing_perf.append(
            {
                "listing_id": l.get("listing_id"),
                "title": l.get("title"),
                "views": views,
                "likes": l.get("likes_count", 0),
                "status": l.get("status"),
                "price": l.get("price_sar"),
            }
        )
    listing_perf.sort(key=lambda x: x["views"], reverse=True)

    # Revenue prediction (based on past orders)
    order_cursor = db.orders.find({"seller_id": {"$in": aliases}})
    revenues_by_month = {}
    completed_count = 0
    completed_total = 0
    async for o in order_cursor:
        if o.get("status") in {"completed", "delivered", "paid"}:
            price = float(o.get("price_sar", 0) or 0)
            month = str(o.get("created_at", ""))[:7]
            revenues_by_month[month] = revenues_by_month.get(month, 0) + price
            completed_count += 1
            completed_total += price

    avg_month = (completed_total / max(len(revenues_by_month), 1)) if revenues_by_month else 0
    predicted_next_month = round(avg_month * 1.05, 2)  # 5% growth projection

    messages_received = 0
    try:
        thread_ids = []
        async for thread in db.chat_threads.find(
            {"participants": {"$in": aliases}}, {"_id": 0, "thread_id": 1}
        ).limit(300):
            if thread.get("thread_id"):
                thread_ids.append(thread["thread_id"])
        if thread_ids:
            messages_received = await db.chat_messages.count_documents({
                "thread_id": {"$in": thread_ids},
                "sender_id": {"$nin": aliases},
                "created_at": {"$gte": since},
            })
    except Exception:
        messages_received = 0

    low_stock = []
    for name, row in (settings.get("inventory") or {}).items():
        available = int((row or {}).get("available") or 0)
        if available <= 2:
            low_stock.append({"name": name, "available": available})

    paused = bool(settings.get("store_paused"))
    return {
        "total_visitors": total_visitors,
        "daily_visitors": daily_visitors,
        "top_cities": sorted(cities.items(), key=lambda x: -x[1])[:5],
        "total_listings_views": total_views,
        "top_listings": listing_perf[:5],
        "revenue_by_month": revenues_by_month,
        "predicted_next_month_sar": predicted_next_month,
        "completed_orders_count": completed_count,
        "messages_received": messages_received,
        "low_stock": low_stock[:8],
        "store_paused": paused,
        "open_now": (not paused) and is_open_now(settings.get("business_hours") or DEFAULT_HOURS),
        "active_offers": len(active_flash_sales(settings.get("flash_sales") or [])),
    }


@router.post("/analytics/visit")
async def track_visit(seller_id: str, visitor_id: str = "", city: str = ""):
    """Track a storefront visit (called from client when opening a store)."""
    if not seller_id:
        return {"ok": False}
    db = get_db()
    await db.storefront_visits.insert_one(
        {
            "seller_id": seller_id,
            "visitor_id": visitor_id,
            "city": city,
            "at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"ok": True}


# ================= Push tokens =================
@router.post("/push-token")
async def register_push_token(user_id: str, token: str, platform: str = "ios", actor: str = Depends(require_actor)):
    """Register Expo push token for a user."""
    db = get_db()
    await db.push_tokens.update_one(
        {"user_id": user_id, "platform": platform},
        {
            "$set": {
                "token": token,
                "platform": platform,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return {"ok": True}
