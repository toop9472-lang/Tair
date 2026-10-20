"""طير — Listings API routes."""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, Depends
from motor.motor_asyncio import AsyncIOMotorClient

from models.listing import Listing, ListingCreate, ListingUpdate
from models.places import city_match_values
from models.species import FAMILY_QUERY_ALIASES, listing_category
from models.listing_comment import ListingComment, ListingCommentCreate
from services.r2_storage import r2
from auth.actor import require_actor
from services.moderation import moderator_scopes

router = APIRouter(prefix="/listings", tags=["Tair-Listings"])

MEDIA_LISTINGS_DIR = Path(__file__).resolve().parent.parent / "static" / "media" / "listings"
MEDIA_LISTINGS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
CONTENT_TYPE_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
}
MAX_LISTING_IMAGE_MB = 8

ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v"}
VIDEO_CONTENT_TYPE_BY_EXT = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".m4v": "video/x-m4v",
}
MAX_LISTING_VIDEO_MB = 30

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _now():
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    """Remove _id and coerce datetime for JSON."""
    if not doc:
        return doc
    doc.pop("_id", None)
    for key in ("posted_at", "expires_at", "sold_at", "updated_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    return doc


@router.post("/create")
async def create_listing(payload: ListingCreate, user_id: str = Query(...), actor: str = Depends(require_actor)):
    # Business-level validation with Arabic messages (avoids raw pydantic 422s)
    if not payload.title or not payload.title.strip():
        raise HTTPException(400, "الرجاء إدخال عنوان الإعلان")
    if not payload.description or not payload.description.strip():
        raise HTTPException(400, "الرجاء إدخال وصف الإعلان")
    if not payload.city or not payload.city.strip():
        raise HTTPException(400, "الرجاء اختيار المدينة")
    # Accept Arabic-Indic and Persian digits by normalizing before rejecting
    if payload.price_sar is None or payload.price_sar <= 0:
        raise HTTPException(400, "الرجاء إدخال سعر صحيح للإعلان")

    listing_id = f"lst_{uuid.uuid4().hex[:12]}"
    payload_dict = payload.model_dump()
    mapped = listing_category(payload_dict.get("family"))
    if mapped:
        payload_dict["category"] = mapped
    if not payload_dict.get("cover_image"):
        imgs = payload_dict.get("images") or []
        payload_dict["cover_image"] = imgs[0] if imgs else None

    # Prohibited species check (auto-flag)
    is_flagged = False
    moderation_notes = None
    if payload.species:
        spec = await db.species_catalog.find_one({"species_id": payload.species})
        if spec and spec.get("is_prohibited"):
            is_flagged = True
            moderation_notes = "Auto-flag: prohibited species"

    listing = Listing(
        listing_id=listing_id,
        seller_id=user_id,
        is_flagged=is_flagged,
        moderation_notes=moderation_notes,
        **payload_dict,
    )
    doc = listing.model_dump()
    await db.listings.insert_one(doc)
    try:
        from services.moderation import notify_staff
        title = (payload.title or "إعلان").strip()
        await notify_staff(
            db,
            {"market"},
            [user_id],
            "إعلان جديد في السوق",
            f"{payload.city}: {title}",
            "listing_new",
            {"listing_id": listing_id},
        )
    except Exception as exc:
        print(f"[listing notify] {exc}")
    return _serialize(doc)



@router.get("/feed")
async def feed_listings(
    city: Optional[str] = None,
    category: Optional[str] = None,
    species: Optional[str] = None,
    family: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    q: Optional[str] = None,
    limit: int = 20,
    skip: int = 0,
):
    query: dict = {"status": "active", "is_flagged": False}
    if city:
        names = city_match_values(city)
        query.setdefault("$and", []).append(
            {"$or": [{"city": {"$in": names}}, {"district": {"$in": names}}]}
        )
    if category:
        query["category"] = category
    if species:
        query["species"] = species
    if family:
        # Match either listings tagged directly with this family, OR listings whose species is in this family.
        fam_species = await db.species_catalog.find(
            {"family": family}, {"_id": 0, "species_id": 1}
        ).to_list(500)
        species_ids = [s["species_id"] for s in fam_species]
        aliases = [family, *FAMILY_QUERY_ALIASES.get(family, [])]
        family_clauses = [{"family": {"$in": aliases}}]
        if species_ids:
            family_clauses.append({"species": {"$in": species_ids}})
        # Compose with any existing $and clauses safely.
        existing_or = query.pop("$or", None)
        if existing_or:
            query["$and"] = [{"$or": existing_or}, {"$or": family_clauses}]
        else:
            query["$or"] = family_clauses
    if min_price is not None or max_price is not None:
        query["price_sar"] = {}
        if min_price is not None:
            query["price_sar"]["$gte"] = min_price
        if max_price is not None:
            query["price_sar"]["$lte"] = max_price
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"district": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]

    cursor = (
        db.listings.find(query).sort("posted_at", -1).skip(skip).limit(min(limit, 100))
    )
    items = [_serialize(d) async for d in cursor]
    # Enrich with seller_verified flag
    seller_ids = list({i.get("seller_id") for i in items if i.get("seller_id")})
    if seller_ids:
        users = await db.users.find(
            {"$or": [
                {"id": {"$in": seller_ids}},
                {"user_id": {"$in": seller_ids}},
                {"email": {"$in": seller_ids}},  # mobile may pass email as user_id
            ]},
            {"_id": 0, "id": 1, "user_id": 1, "email": 1, "name": 1, "avatar": 1,
             "is_verified_shop": 1, "is_verified_carrier": 1, "profile_bg_url": 1,
             "phone": 1, "whatsapp": 1, "storefront_settings": 1},
        ).to_list(200)
        u_map = {}
        for u in users:
            for key in (u.get("id"), u.get("user_id"), u.get("email")):
                if key:
                    u_map[key] = u
        for i in items:
            u = u_map.get(i.get("seller_id"))
            if u:
                # Always overwrite with latest data from users collection
                i["seller_name"] = u.get("name") or i.get("seller_name")
                i["seller_avatar"] = u.get("avatar")
                i["seller_verified_shop"] = bool(u.get("is_verified_shop"))
                i["seller_verified_carrier"] = bool(u.get("is_verified_carrier"))
                i["seller_phone"] = u.get("phone")
                i["seller_whatsapp"] = u.get("whatsapp") or u.get("phone")
                # Storefront identity (so browse feed reflects seller's brand)
                sf = u.get("storefront_settings") or {}
                i["seller_identity_color"] = sf.get("identity_color") or "#0f766e"
                i["seller_logo_url"] = sf.get("logo_url")
    total = await db.listings.count_documents(query)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/{listing_id}")
async def get_listing(listing_id: str, viewer_id: Optional[str] = None):
    # Accept both listing_id (UUID string) or Mongo _id fallback
    doc = await db.listings.find_one({"listing_id": listing_id})
    if not doc:
        doc = await db.listings.find_one({"id": listing_id})
    if not doc:
        try:
            from bson import ObjectId
            if len(listing_id) == 24:
                doc = await db.listings.find_one({"_id": ObjectId(listing_id)})
        except Exception:
            pass
    if not doc:
        raise HTTPException(404, "Listing not found")
    # Always increment view count on every open (per user request)
    await db.listings.update_one(
        {"listing_id": doc.get("listing_id")}, {"$inc": {"view_count": 1}}
    )
    doc["view_count"] = (doc.get("view_count") or 0) + 1
    serialized = _serialize(doc)
    # Enrich with seller contact + verification info
    sid = serialized.get("seller_id")
    if sid:
        u = await db.users.find_one(
            {"$or": [{"id": sid}, {"user_id": sid}, {"email": sid}]},
            {"_id": 0, "name": 1, "avatar": 1, "phone": 1, "whatsapp": 1,
             "is_verified_shop": 1, "is_verified_carrier": 1, "profile_bg_url": 1,
             "storefront_settings": 1},
        )
        if u:
            # Always overwrite with fresh user data
            serialized["seller_name"] = u.get("name") or serialized.get("seller_name")
            serialized["seller_avatar"] = u.get("avatar")
            serialized["seller_verified_shop"] = bool(u.get("is_verified_shop"))
            serialized["seller_verified_carrier"] = bool(u.get("is_verified_carrier"))
            serialized["seller_phone"] = u.get("phone")
            serialized["seller_whatsapp"] = u.get("whatsapp") or u.get("phone")
            sf = u.get("storefront_settings") or {}
            serialized["seller_identity_color"] = sf.get("identity_color") or "#0f766e"
            serialized["seller_logo_url"] = sf.get("logo_url")
    return serialized


@router.patch("/{listing_id}")
async def update_listing(
    listing_id: str, payload: ListingUpdate, user_id: str = Query(...), actor: str = Depends(require_actor)
):
    doc = await db.listings.find_one({"listing_id": listing_id})
    if not doc:
        raise HTTPException(404, "Listing not found")
    is_owner = doc.get("seller_id") == user_id
    admin = await db.admins.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1},
    )
    if not is_owner and not admin:
        raise HTTPException(403, "Not authorized")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    updates["updated_at"] = _now()
    if updates.get("status") == "sold":
        updates["sold_at"] = _now()

    await db.listings.update_one({"listing_id": listing_id}, {"$set": updates})
    fresh = await db.listings.find_one({"listing_id": listing_id})
    return _serialize(fresh)


@router.post("/{listing_id}/mark-sold")
async def mark_listing_sold(listing_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    """Owner (or admin) marks a listing as sold. Adds `sold_at` timestamp."""
    doc = await db.listings.find_one({"listing_id": listing_id})
    if not doc:
        doc = await db.listings.find_one({"id": listing_id})
    if not doc:
        raise HTTPException(404, "Listing not found")

    admin = await db.admins.find_one({"$or": [{"id": user_id}, {"email": user_id}, {"user_id": user_id}]})
    is_owner = doc.get("seller_id") == user_id or doc.get("owner_id") == user_id
    if not is_owner and not admin:
        raise HTTPException(403, "غير مصرح")

    now = _now()
    await db.listings.update_one(
        {"listing_id": doc.get("listing_id")},
        {"$set": {"status": "sold", "sold_at": now, "updated_at": now}},
    )
    return {"success": True, "listing_id": doc.get("listing_id"), "sold_at": now.isoformat()}


@router.post("/{listing_id}/unmark-sold")
async def unmark_listing_sold(listing_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    """Reverse mark-as-sold — back to active."""
    doc = await db.listings.find_one({"listing_id": listing_id})
    if not doc:
        doc = await db.listings.find_one({"id": listing_id})
    if not doc:
        raise HTTPException(404, "Listing not found")

    admin = await db.admins.find_one({"$or": [{"id": user_id}, {"email": user_id}, {"user_id": user_id}]})
    is_owner = doc.get("seller_id") == user_id or doc.get("owner_id") == user_id
    if not is_owner and not admin:
        raise HTTPException(403, "غير مصرح")

    now = _now()
    await db.listings.update_one(
        {"listing_id": doc.get("listing_id")},
        {"$set": {"status": "active", "updated_at": now}, "$unset": {"sold_at": ""}},
    )
    return {"success": True}


@router.delete("/{listing_id}")
async def delete_listing(listing_id: str, user_id: str = Query(...), actor: str = Depends(require_actor)):
    doc = await db.listings.find_one({"listing_id": listing_id})
    if not doc:
        doc = await db.listings.find_one({"id": listing_id})
    if not doc:
        try:
            from bson import ObjectId
            if len(listing_id) == 24:
                doc = await db.listings.find_one({"_id": ObjectId(listing_id)})
        except Exception:
            pass
    if not doc:
        raise HTTPException(404, "Listing not found")
    # ensure we always have the canonical listing_id for downstream deletes
    canonical_id = doc.get("listing_id") or doc.get("id") or str(doc.get("_id"))
    is_owner = doc.get("seller_id") == user_id
    # Robust admin lookup: admins collection OR user with is_admin flag OR admin linked by email
    admin = await db.admins.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1},
    )
    if not admin:
        user = await db.users.find_one(
            {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
            {"_id": 0, "email": 1, "is_admin": 1},
        )
        if user:
            if user.get("is_admin"):
                admin = {"id": user_id}
            elif user.get("email"):
                admin = await db.admins.find_one({"email": user["email"]}, {"_id": 0, "id": 1})
    if not is_owner and not admin:
        scopes = await moderator_scopes(db, user_id)
        if "market" in scopes or "general" in scopes:
            admin = {"id": user_id, "moderator": True}
    if not is_owner and not admin:
        raise HTTPException(403, "Not authorized")
    if admin:
        # Admin: HARD delete so purge is permanent and can never re-surface
        await db.listings.delete_one({"listing_id": canonical_id})
        await db.listing_comments.delete_many({"listing_id": canonical_id})
        await db.tair_favorites.delete_many({"listing_id": canonical_id})
        return {"success": True, "listing_id": canonical_id, "mode": "hard"}
    # Owner: SOFT delete (never re-surfaces because /seller/{id} excludes 'removed')
    await db.listings.update_one(
        {"listing_id": listing_id}, {"$set": {"status": "removed", "updated_at": _now()}}
    )
    return {"success": True, "listing_id": listing_id, "mode": "soft"}


@router.get("/seller/{seller_id}")
async def listings_by_seller(seller_id: str, include_all: bool = False):
    """List a seller's listings.

    Even with include_all=True we NEVER surface soft-deleted (`removed`) items —
    those are the seller's own DELETE actions and must stay hidden so a delete
    is not perceived as "the listing came back" on refresh.
    """
    query: dict = {"seller_id": seller_id}
    if include_all:
        # Include active/paused/sold but exclude removed
        query["status"] = {"$ne": "removed"}
    else:
        query["status"] = {"$in": ["active", "paused", "sold"]}
    cursor = db.listings.find(query).sort("posted_at", -1)
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "total": len(items)}


# ==================== Favorites ====================
@router.post("/{listing_id}/favorite")
async def toggle_favorite(listing_id: str, user_id: str = Query(...)):
    existing = await db.tair_favorites.find_one(
        {"user_id": user_id, "listing_id": listing_id}
    )
    if existing:
        await db.tair_favorites.delete_one(
            {"user_id": user_id, "listing_id": listing_id}
        )
        await db.listings.update_one(
            {"listing_id": listing_id}, {"$inc": {"favorite_count": -1}}
        )
        return {"favorited": False}
    await db.tair_favorites.insert_one(
        {"user_id": user_id, "listing_id": listing_id, "added_at": _now()}
    )
    await db.listings.update_one(
        {"listing_id": listing_id}, {"$inc": {"favorite_count": 1}}
    )
    return {"favorited": True}


@router.get("/favorites/me")
async def my_favorites(user_id: str = Query(...)):
    favs = await db.tair_favorites.find({"user_id": user_id}).to_list(500)
    ids = [f["listing_id"] for f in favs]
    listings = await db.listings.find({"listing_id": {"$in": ids}}).to_list(500)
    return {"items": [_serialize(d) for d in listings]}


# ==================== Image Upload ====================
@router.post("/upload-image")
async def upload_listing_image(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    if not user_id:
        raise HTTPException(400, "user_id required")

    filename = file.filename or "image.jpg"
    ext = ("." + filename.split(".")[-1].lower()) if "." in filename else ".jpg"
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(400, "صيغة الصورة غير مدعومة")

    content = await file.read()
    if not content:
        raise HTTPException(400, "الملف فارغ")
    if len(content) > MAX_LISTING_IMAGE_MB * 1024 * 1024:
        raise HTTPException(413, f"الصورة تتجاوز {MAX_LISTING_IMAGE_MB}MB")

    file_id = uuid.uuid4().hex
    object_key = f"tair-listings/{user_id}/{file_id}{ext}"
    content_type = CONTENT_TYPE_BY_EXT.get(ext, "image/jpeg")

    image_url: Optional[str] = None
    if r2.is_configured:
        try:
            image_url = r2.upload_bytes(object_key, content, content_type=content_type)
        except Exception as exc:
            print(f"[tair_upload_image] R2 failed, fallback: {exc}")
            image_url = None

    if not image_url:
        local_path = MEDIA_LISTINGS_DIR / f"{file_id}{ext}"
        local_path.write_bytes(content)
        image_url = f"/media/listings/{file_id}{ext}"

    return {"success": True, "url": image_url, "image_url": image_url}


@router.post("/upload-video")
async def upload_listing_video(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Upload a short bird-preview video (max 15s enforced client-side, max 30MB server-side)."""
    if not user_id:
        raise HTTPException(400, "user_id required")

    filename = file.filename or "video.mp4"
    ext = ("." + filename.split(".")[-1].lower()) if "." in filename else ".mp4"
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(400, "صيغة الفيديو غير مدعومة")

    content = await file.read()
    if not content:
        raise HTTPException(400, "الملف فارغ")
    if len(content) > MAX_LISTING_VIDEO_MB * 1024 * 1024:
        raise HTTPException(413, f"الفيديو يتجاوز {MAX_LISTING_VIDEO_MB}MB")

    file_id = uuid.uuid4().hex
    object_key = f"tair-listings/{user_id}/videos/{file_id}{ext}"
    content_type = VIDEO_CONTENT_TYPE_BY_EXT.get(ext, "video/mp4")

    video_url: Optional[str] = None
    if r2.is_configured:
        try:
            video_url = r2.upload_bytes(object_key, content, content_type=content_type)
        except Exception as exc:
            print(f"[tair_upload_video] R2 failed, fallback: {exc}")
            video_url = None

    if not video_url:
        local_path = MEDIA_LISTINGS_DIR / f"{file_id}{ext}"
        local_path.write_bytes(content)
        video_url = f"/media/listings/{file_id}{ext}"

    return {"success": True, "url": video_url, "video_url": video_url}


@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Upload a PDF for clinic library (also accepts images for cover thumbnails)."""
    if not user_id:
        raise HTTPException(400, "user_id required")
    filename = file.filename or "doc.pdf"
    ext = ("." + filename.split(".")[-1].lower()) if "." in filename else ".pdf"
    allowed = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed:
        raise HTTPException(400, "صيغة الملف غير مدعومة (PDF/JPG/PNG فقط)")

    content = await file.read()
    if not content:
        raise HTTPException(400, "الملف فارغ")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(413, "الملف يتجاوز 25MB")

    file_id = uuid.uuid4().hex
    object_key = f"tair-library/{user_id}/{file_id}{ext}"
    ct_map = {
        ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp",
    }
    content_type = ct_map.get(ext, "application/octet-stream")

    url: Optional[str] = None
    if r2.is_configured:
        try:
            url = r2.upload_bytes(object_key, content, content_type=content_type)
        except Exception as exc:
            print(f"[tair_upload_pdf] R2 failed, fallback: {exc}")
            url = None
    if not url:
        local_path = MEDIA_LISTINGS_DIR / f"{file_id}{ext}"
        local_path.write_bytes(content)
        url = f"/media/listings/{file_id}{ext}"

    return {"success": True, "url": url, "file_url": url, "ext": ext, "size": len(content)}


# ==================== Listing Comments (Public replies) ====================
@router.get("/{listing_id}/comments")
async def list_comments(listing_id: str, limit: int = 100):
    cursor = db.listing_comments.find({"listing_id": listing_id}).sort("created_at", 1).limit(min(limit, 200))
    items = []
    async for d in cursor:
        d.pop("_id", None)
        val = d.get("created_at")
        if isinstance(val, datetime):
            d["created_at"] = val.isoformat()
        items.append(d)
    return {"items": items, "total": len(items)}


@router.post("/{listing_id}/comment")
async def add_comment(listing_id: str, payload: ListingCommentCreate, user_id: str = Query(...)):
    body = payload.body.strip()
    if not body:
        raise HTTPException(400, "Empty comment")
    exists = await db.listings.find_one({"listing_id": listing_id})
    if not exists:
        raise HTTPException(404, "Listing not found")
    comment_id = f"cmt_{uuid.uuid4().hex[:12]}"
    comment = ListingComment(
        comment_id=comment_id,
        listing_id=listing_id,
        author_id=user_id,
        author_name=payload.author_name,
        body=body,
    )
    doc = comment.model_dump()
    await db.listing_comments.insert_one(doc)
    await db.listings.update_one(
        {"listing_id": listing_id},
        {"$inc": {"comments_count": 1}},
    )
    d = {**doc}
    d.pop("_id", None)
    d["created_at"] = d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at")
    return d


@router.post("/comment/{comment_id}/like")
async def toggle_comment_like(comment_id: str, user_id: str = Query(...)):
    c = await db.listing_comments.find_one({"comment_id": comment_id})
    if not c:
        raise HTTPException(404, "Comment not found")
    liked_by = c.get("liked_by", [])
    if user_id in liked_by:
        await db.listing_comments.update_one(
            {"comment_id": comment_id},
            {"$pull": {"liked_by": user_id}, "$inc": {"likes_count": -1}},
        )
        return {"liked": False}
    await db.listing_comments.update_one(
        {"comment_id": comment_id},
        {"$addToSet": {"liked_by": user_id}, "$inc": {"likes_count": 1}},
    )
    return {"liked": True}


@router.delete("/comment/{comment_id}")
async def delete_comment(comment_id: str, user_id: str = Query(...)):
    c = await db.listing_comments.find_one({"comment_id": comment_id})
    if not c:
        raise HTTPException(404, "Comment not found")
    if c.get("author_id") != user_id:
        raise HTTPException(403, "Not the author")
    await db.listing_comments.delete_one({"comment_id": comment_id})
    await db.listings.update_one(
        {"listing_id": c["listing_id"]},
        {"$inc": {"comments_count": -1}},
    )
    return {"success": True}

