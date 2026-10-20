"""طير — دليل موردي الجملة.

التاجر يسجّل شركته فتظهر فوراً بعلامة «بانتظار التوثيق».
التوثيق والإيقاف من الإدارة فقط، ولا يستطيع المسجّل منح نفسه التوثيق.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from auth.actor import require_actor
from auth.jwt_handler import get_user_id_from_token
from models.places import city_match_values

router = APIRouter(prefix="/wholesale", tags=["wholesale"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

# ---------------------------------------------------------------- models


WHOLESALE_CATEGORIES = [
    {"id": "parrots", "name_ar": "ببغاوات"},
    {"id": "songbirds", "name_ar": "طيور صغيرة"},
    {"id": "falcons", "name_ar": "صقور"},
    {"id": "pigeons", "name_ar": "حمام"},
    {"id": "poultry", "name_ar": "دواجن"},
    {"id": "feed", "name_ar": "أعلاف وحبوب"},
    {"id": "cages", "name_ar": "أقفاص ومستلزمات"},
    {"id": "vitamins", "name_ar": "فيتامينات ومقويات"},
    {"id": "incubators", "name_ar": "فقاسات"},
    {"id": "accessories", "name_ar": "إكسسوارات"},
]
ALLOWED_CATEGORIES = {c["id"] for c in WHOLESALE_CATEGORIES}


class SupplierIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    logo_url: Optional[str] = None
    cover_url: Optional[str] = None
    city: str = Field(..., min_length=1, max_length=60)
    categories: List[str] = Field(default_factory=list)
    description: Optional[str] = Field(default=None, max_length=1500)
    min_order_sar: Optional[float] = 0
    whatsapp: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, max_length=40)
    website: Optional[str] = Field(default=None, max_length=200)
    is_verified: bool = False
    is_active: bool = True


class SupplierRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    city: str = Field(..., min_length=1, max_length=60)
    categories: List[str] = Field(default_factory=list)
    description: str = Field(..., min_length=1, max_length=1500)
    min_order_sar: float = 0
    whatsapp: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, max_length=40)
    website: Optional[str] = Field(default=None, max_length=200)
    is_active: bool = True


def _now():
    return datetime.now(timezone.utc)


def _digits(raw: str) -> str:
    trans = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
    return "".join(ch for ch in str(raw or "").translate(trans) if ch.isdigit())


def _store_phone(raw: Optional[str]) -> Optional[str]:
    if raw is None or not str(raw).strip():
        return None
    d = _digits(raw)
    if d.startswith("00"):
        d = d[2:]
    if not d.startswith("966"):
        d = d.lstrip("0")
        if len(d) == 9 and d.startswith("5"):
            d = "966" + d
    if len(d) < 9:
        raise HTTPException(status_code=400, detail="رقم التواصل غير مكتمل")
    return f"+{d}"


def _clean_categories(ids: List[str]) -> List[str]:
    clean = []
    for item in ids or []:
        if item not in ALLOWED_CATEGORIES:
            raise HTTPException(status_code=400, detail="فئة غير معروفة")
        if item not in clean:
            clean.append(item)
    if not clean:
        raise HTTPException(status_code=400, detail="اختر فئة واحدة على الأقل")
    return clean


def _clean_website(raw: Optional[str]) -> Optional[str]:
    if raw is None or not str(raw).strip():
        return None
    site = str(raw).strip()
    if not site.startswith("http://") and not site.startswith("https://"):
        site = "https://" + site
    return site[:200]


def _apply_contact(data: dict) -> dict:
    data["categories"] = _clean_categories(data.get("categories") or [])
    data["whatsapp"] = _store_phone(data.get("whatsapp"))
    data["phone"] = _store_phone(data.get("phone"))
    if not data["whatsapp"] and not data["phone"]:
        raise HTTPException(status_code=400, detail="أدخل واتساب أو رقم جوال")
    data["website"] = _clean_website(data.get("website"))
    data["name"] = str(data.get("name") or "").strip()
    data["city"] = str(data.get("city") or "").strip()
    data["description"] = str(data.get("description") or "").strip()
    if len(data["description"]) < 10:
        raise HTTPException(status_code=400, detail="صف نشاط الشركة بعشر أحرف على الأقل")
    if data.get("min_order_sar") is None or data["min_order_sar"] < 0:
        data["min_order_sar"] = 0
    return data


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for k in ("created_at", "updated_at"):
        v = doc.get(k)
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


def _category_labels(ids) -> List[str]:
    names = {c["id"]: c["name_ar"] for c in WHOLESALE_CATEGORIES}
    return [names.get(i, i) for i in (ids or [])]


def _with_labels(doc: dict) -> dict:
    row = _serialize(doc)
    if row:
        row["category_labels"] = _category_labels(row.get("categories"))
    return row


_panel_bearer = HTTPBearer()


async def _panel_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_panel_bearer),
) -> str:
    user_id = get_user_id_from_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="انتهت الجلسة — سجّل الدخول مرة أخرى")
    return user_id


async def _require_panel_admin(user_id: str) -> dict:
    """نفس فحص لوحة المدير: حساب في admins، أو بريد مطابق، أو is_admin."""
    admin = await db.admins.find_one(
        {"$or": [{"id": user_id}, {"email": user_id}]},
        {"_id": 0},
    )
    if admin:
        return admin
    user = await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0},
    )
    if user:
        email = user.get("email")
        if email:
            admin = await db.admins.find_one({"email": email}, {"_id": 0})
            if admin:
                return admin
        if user.get("is_admin"):
            return {
                "id": user.get("id") or user.get("user_id"),
                "email": email,
                "role": "admin",
            }
    raise HTTPException(status_code=403, detail="غير مصرح")


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
        q["city"] = {"$in": city_match_values(city)}
    if category:
        q["categories"] = category
    if verified_only:
        q["is_verified"] = True
    cursor = db.wholesale_suppliers.find(q).sort([("is_verified", -1), ("created_at", -1)]).limit(limit)
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "count": len(items)}


@router.get("/categories")
async def wholesale_categories():
    """Static list of high-value wholesale categories."""
    return {"items": WHOLESALE_CATEGORIES, "total": len(WHOLESALE_CATEGORIES)}


@router.get("/suppliers/mine")
async def my_supplier(actor: str = Depends(require_actor)):
    doc = await db.wholesale_suppliers.find_one({"owner_id": actor}, {"_id": 0})
    return {"supplier": _serialize(doc) if doc else None}


@router.post("/suppliers")
async def register_supplier(body: SupplierRegister, actor: str = Depends(require_actor)):
    """الشركة تسجّل نفسها. تظهر في الدليل وغير موثّقة حتى تعتمدها الإدارة."""
    existing = await db.wholesale_suppliers.find_one({"owner_id": actor}, {"_id": 0, "supplier_id": 1})
    if existing:
        raise HTTPException(status_code=409, detail="لديك شركة مسجّلة. عدّل بياناتها بدل إنشاء شركة ثانية")
    data = _apply_contact(body.model_dump())
    now = _now()
    doc = {
        **data,
        "supplier_id": f"ws_{uuid.uuid4().hex[:12]}",
        "owner_id": actor,
        "is_verified": False,
        "is_active": bool(data.get("is_active", True)),
        "created_at": now,
        "updated_at": now,
    }
    await db.wholesale_suppliers.insert_one(doc.copy())
    return _serialize(doc)


@router.patch("/suppliers/mine")
async def update_my_supplier(body: SupplierRegister, actor: str = Depends(require_actor)):
    doc = await db.wholesale_suppliers.find_one({"owner_id": actor})
    if not doc:
        raise HTTPException(status_code=404, detail="لا توجد شركة مسجّلة بهذا الحساب")
    data = _apply_contact(body.model_dump())
    data["is_active"] = False if doc.get("hidden_by_admin") else bool(data.get("is_active", True))
    if doc.get("is_verified") and any(
        data.get(k) != doc.get(k) for k in ("name", "whatsapp", "phone")
    ):
        data["is_verified"] = False
    data["updated_at"] = _now()
    await db.wholesale_suppliers.update_one({"owner_id": actor}, {"$set": data})
    fresh = await db.wholesale_suppliers.find_one({"owner_id": actor}, {"_id": 0})
    return _serialize(fresh)


@router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str):
    doc = await db.wholesale_suppliers.find_one({"supplier_id": supplier_id, "is_active": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _serialize(doc)


# ---------------------------------------------------------------- admin panel (JWT)


class PanelSupplierUpdate(BaseModel):
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None


@router.get("/admin/panel")
async def admin_panel_suppliers(user_id: str = Depends(_panel_user_id)):
    """كل الشركات، بما فيها المخفية وغير الموثّقة. للمدير فقط."""
    await _require_panel_admin(user_id)
    cursor = db.wholesale_suppliers.find({}).sort([("is_verified", 1), ("created_at", -1)])
    items = []
    pending = 0
    async for doc in cursor:
        row = _with_labels(doc)
        if row.get("is_active", True) and not row.get("is_verified"):
            pending += 1
        items.append(row)
    return {"items": items, "count": len(items), "pending": pending}


@router.patch("/admin/panel/{supplier_id}")
async def admin_panel_update_supplier(
    supplier_id: str,
    body: PanelSupplierUpdate,
    user_id: str = Depends(_panel_user_id),
):
    """توثيق الشركة أو إخفاؤها من الدليل. الشركة لا تقدر تنفّذ هذا على نفسها."""
    await _require_panel_admin(user_id)
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="لا يوجد تعديل")
    if "is_active" in update:
        update["hidden_by_admin"] = not update["is_active"]
    update["updated_at"] = _now()
    result = await db.wholesale_suppliers.update_one(
        {"supplier_id": supplier_id},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="الشركة غير موجودة")
    fresh = await db.wholesale_suppliers.find_one({"supplier_id": supplier_id})
    return _with_labels(fresh)


# ---------------------------------------------------------------- admin key (scripts)


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
