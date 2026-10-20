"""طير — AI Bird Identification & Price Suggestion.

Uses Gemini vision (via Emergent LLM key) to identify the bird in an uploaded
image and suggest an approximate SAR price range for the Saudi market.

Endpoint:
    POST /api/ai/identify-bird
        multipart/form-data: file=<image>  (JPEG / PNG / WEBP)
    OR
        JSON: { "image_base64": "..." }
"""
import os
import json
import base64
import logging
import tempfile
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

BIRD_SYSTEM_PROMPT = (
    "أنت خبير طيور محترف في السوق السعودي. مهمتك: تحليل صورة طائر وإرجاع "
    "JSON فقط (بدون أي نص إضافي) بالمخطط التالي:\n"
    "{\n"
    '  "is_bird": true/false,\n'
    '  "species_ar": "اسم النوع بالعربي أو null إذا لم يكن طائرًا",\n'
    '  "species_en": "English species name or null",\n'
    '  "confidence": 0-1,\n'
    '  "estimated_price_sar": {"min": int, "max": int} أو null,\n'
    '  "age_estimate_ar": "فرخ|صغير|بالغ|غير محدد",\n'
    '  "notes_ar": "ملاحظة قصيرة (سطر واحد) للبائع/المشتري. حتى إذا لم يكن طائرًا يجب إرجاع سبب بشكل مختصر مثل: (الصورة ليست لطائر — الرجاء رفع صورة أوضح)."\n'
    "}\n"
    "notes_ar يجب أن تكون دائمًا نصًا عربيًا مفيدًا وليس null. "
    "التسعير خاص بالسوق السعودي فبراير 2026. لا تشرح، فقط JSON."
)


class Base64Body(BaseModel):
    image_base64: str = Field(..., description="Base64 (no data: prefix) or full data URL")
    mime_type: Optional[str] = "image/jpeg"


def _clean_base64(s: str) -> tuple[str, str]:
    """Strip data URL prefix if present, return (base64_str, mime)."""
    if s.startswith("data:"):
        try:
            head, b64 = s.split(",", 1)
            mime = head.split(";")[0].replace("data:", "") or "image/jpeg"
            return b64, mime
        except Exception:
            return s, "image/jpeg"
    return s, "image/jpeg"


async def _identify_from_path(path: str, mime: str) -> dict:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI service not configured")
    try:
        from emergentintegrations.llm.chat import (
            LlmChat,
            UserMessage,
            FileContentWithMimeType,
        )
    except Exception as e:
        logger.exception("emergentintegrations import failed: %s", e)
        raise HTTPException(503, "AI library unavailable")

    # Normalize the image: many providers reject exotic formats / very small
    # or extremely large payloads. Re-encode to a plain sRGB JPEG at ≤ 1600px.
    normalized_path = path
    normalized_mime = mime
    try:
        from PIL import Image
        with Image.open(path) as im:
            im = im.convert("RGB")
            w, h = im.size
            max_side = 1600
            if max(w, h) > max_side:
                if w >= h:
                    im = im.resize((max_side, int(h * max_side / w)))
                else:
                    im = im.resize((int(w * max_side / h), max_side))
            normalized_path = path + ".norm.jpg"
            im.save(normalized_path, "JPEG", quality=88, optimize=True)
            normalized_mime = "image/jpeg"
    except Exception as e:
        logger.warning("image normalize failed, using original: %s", e)

    chat = (
        LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tair-bird-id-{os.urandom(4).hex()}",
            system_message=BIRD_SYSTEM_PROMPT,
        ).with_model("gemini", "gemini-2.5-flash")
    )
    image_file = FileContentWithMimeType(file_path=normalized_path, mime_type=normalized_mime)
    msg = UserMessage(
        text="حلّل هذه الصورة وأرجع JSON فقط حسب المخطط.",
        file_contents=[image_file],
    )

    try:
        resp = await chat.send_message(msg)
    except Exception as e:
        err_txt = str(e)
        logger.warning("Gemini vision call failed: %s", err_txt[:400])
        # Return a graceful "not a bird" response instead of surfacing 502 up.
        return {
            "is_bird": False,
            "species_ar": None,
            "species_en": None,
            "confidence": None,
            "estimated_price_sar": None,
            "age_estimate_ar": None,
            "notes_ar": "تعذّرت معالجة الصورة. جرّب صورة أوضح.",
            "_error": err_txt[:200],
        }
    finally:
        # Clean up the normalized copy if we made one
        if normalized_path != path:
            try: os.unlink(normalized_path)
            except Exception: pass

    raw = resp.strip() if isinstance(resp, str) else str(resp)
    # Model may wrap JSON in markdown fences; strip them.
    if raw.startswith("```"):
        raw = raw.strip("`")
        # remove leading "json\n"
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip("`\n ")

    # Find first '{' and last '}' to extract JSON substring safely.
    start, end = raw.find("{"), raw.rfind("}")
    if start >= 0 and end > start:
        raw = raw[start : end + 1]

    try:
        data = json.loads(raw)
    except Exception:
        logger.warning("Bird ID response was not valid JSON: %s", raw[:200])
        return {
            "is_bird": None,
            "raw": raw[:500],
            "error": "AI returned non-JSON response",
        }

    # Ensure notes_ar is always a helpful Arabic string (mobile UI depends on it)
    if not data.get("notes_ar"):
        if data.get("is_bird"):
            data["notes_ar"] = "تم التعرّف على الطائر بنجاح."
        else:
            data["notes_ar"] = "الصورة لا تبدو طائرًا واضحًا — جرّب صورة أوضح وبإضاءة أفضل."
    return data


@router.post("/identify-bird")
async def identify_bird(file: Optional[UploadFile] = File(default=None)):
    """Upload a bird image and get species + suggested SAR price range."""
    if file is None:
        raise HTTPException(400, "No file uploaded. Use multipart 'file' or POST /identify-bird-b64")

    if file.content_type and file.content_type not in (
        "image/jpeg", "image/png", "image/webp",
    ):
        raise HTTPException(400, f"Unsupported content type: {file.content_type}")

    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "Image too large (max 8 MB)")

    mime = file.content_type or "image/jpeg"
    ext = ".jpg" if mime == "image/jpeg" else (".png" if mime == "image/png" else ".webp")
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        result = await _identify_from_path(tmp_path, mime)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
    return result


@router.post("/identify-bird-b64")
async def identify_bird_b64(body: Base64Body):
    b64, mime = _clean_base64(body.image_base64)
    try:
        blob = base64.b64decode(b64)
    except Exception:
        raise HTTPException(400, "Invalid base64")
    if len(blob) > 8 * 1024 * 1024:
        raise HTTPException(413, "Image too large (max 8 MB)")

    ext = ".jpg" if mime == "image/jpeg" else (".png" if mime == "image/png" else ".webp")
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(blob)
        tmp_path = tmp.name
    try:
        return await _identify_from_path(tmp_path, mime)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
