"""طير — KYC (Identity Verification) for carriers/shops."""
import os
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

router = APIRouter(prefix="/kyc", tags=["Tair-KYC"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for key in ("created_at", "updated_at", "reviewed_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    return doc


def _now():
    return datetime.now(timezone.utc)


class KycSubmit(BaseModel):
    role: str  # "carrier" or "shop"
    full_name: str
    id_number: str
    phone: str
    id_front_url: Optional[str] = None
    id_back_url: Optional[str] = None
    selfie_url: Optional[str] = None
    commercial_reg: Optional[str] = None  # for shops
    business_license_url: Optional[str] = None  # for shops
    city: Optional[str] = None
    notes: Optional[str] = None


ALLOWED_ROLES = {"carrier", "shop"}
DOC_TYPES = {"id_front", "id_back", "selfie", "business_license"}


@router.get("/me")
async def get_my_kyc(user_id: str = Query(...)):
    doc = await db.kyc_submissions.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)],
    )
    return _serialize(doc) if doc else {"status": "not_submitted"}


@router.post("/submit")
async def submit_kyc(payload: KycSubmit, user_id: str = Query(...)):
    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(400, "Invalid role")
    if len(payload.full_name.strip()) < 3:
        raise HTTPException(400, "الاسم الكامل مطلوب")
    if not re.fullmatch(r"[0-9]{10,}", payload.id_number.strip()):
        raise HTTPException(400, "رقم الهوية يجب أن يكون 10 أرقام أو أكثر")
    if not re.fullmatch(r"[0-9+]{9,}", payload.phone.strip()):
        raise HTTPException(400, "رقم الجوال غير صالح")
    if not payload.id_front_url or not payload.selfie_url:
        raise HTTPException(400, "صور الهوية والصورة الشخصية مطلوبة")
    if payload.role == "shop" and not payload.business_license_url:
        raise HTTPException(400, "السجل التجاري مطلوب للمتاجر")

    submission = {
        "kyc_id": f"kyc_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "role": payload.role,
        "full_name": payload.full_name.strip(),
        "id_number": payload.id_number.strip(),
        "phone": payload.phone.strip(),
        "id_front_url": payload.id_front_url,
        "id_back_url": payload.id_back_url,
        "selfie_url": payload.selfie_url,
        "commercial_reg": payload.commercial_reg,
        "business_license_url": payload.business_license_url,
        "city": payload.city,
        "notes": payload.notes,
        "status": "pending",  # pending | approved | rejected
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.kyc_submissions.insert_one(submission.copy())
    return _serialize(submission)


@router.post("/upload-doc")
async def upload_doc(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    doc_type: str = Form(...),
):
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, "Invalid doc_type")

    filename = file.filename or "doc.jpg"
    ext = ("." + filename.split(".")[-1].lower()) if "." in filename else ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".pdf"}:
        raise HTTPException(400, "صيغة الملف غير مدعومة")

    content = await file.read()
    if not content:
        raise HTTPException(400, "الملف فارغ")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "الحجم يتجاوز 10MB")

    file_id = uuid.uuid4().hex
    object_key = f"tair-kyc/{user_id}/{doc_type}/{file_id}{ext}"
    content_type = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".pdf": "application/pdf",
    }.get(ext, "application/octet-stream")

    url: Optional[str] = None
    try:
        from services.r2_storage import r2  # type: ignore
        if getattr(r2, "is_configured", False):
            url = r2.upload_bytes(object_key, content, content_type=content_type)
    except Exception as exc:
        print(f"[kyc_upload] R2 failed, fallback: {exc}")

    if not url:
        # Local fallback
        import aiofiles
        os.makedirs("/tmp/tair_kyc", exist_ok=True)
        path = f"/tmp/tair_kyc/{file_id}{ext}"
        async with aiofiles.open(path, "wb") as f:
            await f.write(content)
        url = f"/local-uploads/kyc/{file_id}{ext}"

    return {"url": url, "doc_type": doc_type}


# === Admin (list submissions) ===
@router.get("/admin/list")
async def admin_list(status: Optional[str] = None, limit: int = 100):
    q = {"status": status} if status else {}
    cursor = db.kyc_submissions.find(q).sort("created_at", -1).limit(min(limit, 500))
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "total": len(items)}


@router.post("/admin/{kyc_id}/decision")
async def admin_decision(kyc_id: str, decision: str = Query(...), reviewer_id: str = Query(...), note: Optional[str] = None):
    if decision not in {"approve", "reject"}:
        raise HTTPException(400, "Invalid decision")
    new_status = "approved" if decision == "approve" else "rejected"
    r = await db.kyc_submissions.update_one(
        {"kyc_id": kyc_id},
        {"$set": {
            "status": new_status,
            "reviewed_at": _now(),
            "reviewer_id": reviewer_id,
            "review_note": note,
            "updated_at": _now(),
        }},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Submission not found")

    submission = await db.kyc_submissions.find_one({"kyc_id": kyc_id})
    if submission:
        # Auto-set verified flag on the user when approved
        if new_status == "approved":
            update_field = "is_verified_carrier" if submission["role"] == "carrier" else "is_verified_shop"
            await db.users.update_one(
                {"$or": [{"id": submission["user_id"]}, {"user_id": submission["user_id"]}]},
                {"$set": {update_field: True, "updated_at": _now()}},
            )
        # Notify user
        from routes.tair_notifications_routes import create_tair_notification
        title = "تم قبول التحقق من الهوية" if new_status == "approved" else "تم رفض التحقق من الهوية"
        body = "تهانينا! أصبحت الآن موثّقاً في تطبيق طير." if new_status == "approved" else (note or "يرجى إعادة الإرسال بمعلومات صحيحة.")
        await create_tair_notification(
            user_id=submission["user_id"],
            title=title,
            body=body,
            notif_type="kyc_decision",
            data={"kyc_id": kyc_id, "status": new_status},
        )

    return {"success": True, "status": new_status}
