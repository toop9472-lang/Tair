"""طير — Wholesale suppliers directory.

MVP: verified merchants who sell birds/supplies at wholesale prices.
Buyers browse & contact them via WhatsApp / phone. Admins add & verify.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

router = APIRouter(prefix="/wholesale", tags=["wholesale"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

# ---------------------------------------------------------------- models


class SupplierIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    logo_url: Optional[str] = None
    cover_url: Optional[str] = None
    city: str = Field(..., min_length=1, max_length=60)
    categories: List[str] = Field(default_factory=list)  # e.g. ["feed", "cages", "parrots"]
    description: Optional[str] = Field(default=None, max_length=1500)
    min_order_sar: Optional[float] = 0
    whatsapp: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, max_length=40)
    website: Optional[str] = Field(default=None, max_length=200)
    is_verified: bool = False
    is_active: bool = True


def _now():
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for k in ("created_at", "updated_at"):
        v = doc.get(k)
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


# ---------------------------------------------------------------- public


@router.get("/suppliers")
async def list_suppliers(
    city: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    verified_only: bool = Query(default=False),
    limit: int = Query(default=40, le=100),
):
    q = {"is_active": True}
    if city:
        q["city"] = city
    if category:
        q["categories"] = category
    if verified_only:
        q["is_verified"] = True
    cursor = db.wholesale_suppliers.find(q).sort([("is_verified", -1), ("created_at", -1)]).limit(limit)
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "count": len(items)}


@router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str):
    doc = await db.wholesale_suppliers.find_one({"supplier_id": supplier_id, "is_active": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _serialize(doc)


@router.get("/categories")
async def wholesale_categories():
    """Static list of high-value wholesale categories."""
    return {
        "items": [
            {"id": "feed",          "name_ar": "أعلاف وحبوب"},
            {"id": "cages",         "name_ar": "أقفاص ومستلزمات"},
            {"id": "parrots",       "name_ar": "ببغاوات"},
            {"id": "songbirds",     "name_ar": "طيور مغردة"},
            {"id": "pigeons",       "name_ar": "حمام"},
            {"id": "poultry",       "name_ar": "دواجن"},
            {"id": "vitamins",      "name_ar": "فيتامينات وأدوية"},
            {"id": "incubators",    "name_ar": "فقّاسات"},
            {"id": "accessories",   "name_ar": "إكسسوارات"},
        ]
    }


# ---------------------------------------------------------------- admin


class AdminCreateSupplier(SupplierIn):
    admin_key: str = Field(..., min_length=8)


def _check_admin(key: str) -> None:
    expected = os.environ.get("ADMIN_SECRET_KEY") or os.environ.get("ADMIN_MASTER_KEY")
    if not expected or key != expected:
        raise HTTPException(status_code=403, detail="Invalid admin key")


@router.post("/admin/suppliers")
async def admin_create_supplier(body: AdminCreateSupplier):
    _check_admin(body.admin_key)
    now = _now()
    doc = body.model_dump(exclude={"admin_key"})
    doc.update({
        "supplier_id": f"ws_{uuid.uuid4().hex[:12]}",
        "created_at": now,
        "updated_at": now,
    })
    await db.wholesale_suppliers.insert_one(doc.copy())
    return _serialize(doc)


class AdminUpdateSupplier(BaseModel):
    admin_key: str
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    categories: Optional[List[str]] = None
    whatsapp: Optional[str] = None
    phone: Optional[str] = None


@router.patch("/admin/suppliers/{supplier_id}")
async def admin_update_supplier(supplier_id: str, body: AdminUpdateSupplier):
    _check_admin(body.admin_key)
    update = {k: v for k, v in body.model_dump().items() if v is not None and k != "admin_key"}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = _now()
    r = await db.wholesale_suppliers.update_one({"supplier_id": supplier_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"ok": True, "updated": r.modified_count}


@router.delete("/admin/suppliers/{supplier_id}")
async def admin_delete_supplier(supplier_id: str, admin_key: str = Query(...)):
    _check_admin(admin_key)
    r = await db.wholesale_suppliers.delete_one({"supplier_id": supplier_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"ok": True}
