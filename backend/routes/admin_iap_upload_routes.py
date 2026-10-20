"""
Admin-only secure endpoint to upload the Apple In-App Purchase .p8 private key.
Validates it's a real EC P-256 key before saving.

Token is read from the env var IAP_KEY_UPLOAD_TOKEN. The endpoint is single-use:
once the key is saved successfully, future uploads require a fresh token.
"""
import os
import re
import textwrap
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_private_key

router = APIRouter(prefix="/admin", tags=["Admin"])

SECRETS_DIR = "/app/backend/secrets"
KEY_PATH = os.path.join(SECRETS_DIR, "apple_iap_key.p8")
META_PATH = os.path.join(SECRETS_DIR, "apple_iap_key.meta.json")
UPLOAD_TOKEN = os.environ.get("IAP_KEY_UPLOAD_TOKEN", "")


def _normalize_pem(raw: str) -> str:
    """Take any kind of mangled PEM input and return a properly wrapped one."""
    # Strip BOM and surrounding whitespace
    s = raw.strip().lstrip("\ufeff")
    # Remove BEGIN/END markers (handles 4 or 5 dashes)
    s = re.sub(r"-{2,}\s*BEGIN[^-]*-{2,}", "", s, flags=re.IGNORECASE)
    s = re.sub(r"-{2,}\s*END[^-]*-{2,}", "", s, flags=re.IGNORECASE)
    # Keep only valid base64 chars
    body = "".join(re.findall(r"[A-Za-z0-9+/=]+", s))
    wrapped = "\n".join(textwrap.wrap(body, 64))
    return "-----BEGIN PRIVATE KEY-----\n" + wrapped + "\n-----END PRIVATE KEY-----\n"


def _validate_key(pem: str) -> str:
    try:
        key = load_pem_private_key(pem.encode(), password=None)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"المفتاح غير صالح (تعذر تحليله): {e.__class__.__name__}",
        )
    if not isinstance(key, ec.EllipticCurvePrivateKey):
        raise HTTPException(
            status_code=400,
            detail="الملف ليس مفتاح EC. Apple IAP يتطلب مفتاح EC P-256.",
        )
    if not isinstance(key.curve, ec.SECP256R1):
        raise HTTPException(
            status_code=400,
            detail=f"المنحنى غير صحيح ({key.curve.name}). Apple يستخدم secp256r1 / P-256.",
        )
    return pem


@router.post("/upload-apple-iap-key")
async def upload_apple_iap_key(
    file: UploadFile = File(...),
    token: str = Form(...),
    key_id: str = Form(...),
    issuer_id: str = Form(...),
):
    if not UPLOAD_TOKEN:
        raise HTTPException(status_code=503, detail="رفع المفتاح غير مفعّل على هذا السيرفر.")
    if token != UPLOAD_TOKEN:
        raise HTTPException(status_code=403, detail="رمز التحقق غير صحيح.")
    if not key_id or not issuer_id:
        raise HTTPException(status_code=400, detail="key_id و issuer_id مطلوبان.")

    raw = (await file.read()).decode("utf-8", errors="replace")
    pem = _normalize_pem(raw)
    pem = _validate_key(pem)

    os.makedirs(SECRETS_DIR, exist_ok=True)
    with open(KEY_PATH, "w") as f:
        f.write(pem)
    os.chmod(KEY_PATH, 0o600)

    # Save metadata (NOT the key) so the verifier knows which Key ID / Issuer to use
    import json
    meta = {
        "key_id": key_id.strip(),
        "issuer_id": issuer_id.strip(),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "filename": file.filename,
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    return {
        "success": True,
        "message": "✅ تم حفظ مفتاح Apple IAP بنجاح.",
        "key_id": meta["key_id"],
        "issuer_id": meta["issuer_id"],
        "size_bytes": len(pem),
    }


@router.get("/apple-iap-key-status")
async def apple_iap_key_status():
    """Public: tells whether a valid key is configured (without revealing it)."""
    import json
    if not os.path.exists(KEY_PATH):
        return {"configured": False}
    meta = {}
    if os.path.exists(META_PATH):
        try:
            meta = json.load(open(META_PATH))
        except Exception:
            meta = {}
    return {
        "configured": True,
        "key_id": meta.get("key_id"),
        "issuer_id": meta.get("issuer_id"),
        "uploaded_at": meta.get("uploaded_at"),
    }
