"""Pure helpers for the professional store: hours, offers, and auto-reply text."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

RIYADH = ZoneInfo("Asia/Riyadh")
# datetime.weekday(): Monday = 0
PY_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

DEFAULT_HOURS = [
    {"day": "sat", "open": "09:00", "close": "22:00", "closed": False},
    {"day": "sun", "open": "09:00", "close": "22:00", "closed": False},
    {"day": "mon", "open": "09:00", "close": "22:00", "closed": False},
    {"day": "tue", "open": "09:00", "close": "22:00", "closed": False},
    {"day": "wed", "open": "09:00", "close": "22:00", "closed": False},
    {"day": "thu", "open": "09:00", "close": "22:00", "closed": False},
    {"day": "fri", "open": "16:00", "close": "22:00", "closed": False},
]

_CODE = re.compile(r"^[\u0600-\u06FFA-Z0-9\-]{3,16}$")
_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def clip(value, limit: int) -> str:
    return str(value or "").replace("\x00", "").strip()[:limit]


def clean_cities(values) -> list:
    out = []
    for raw in values or []:
        city = clip(raw, 24)
        if city and city not in out:
            out.append(city)
        if len(out) >= 8:
            break
    return out


def normalize_coupon_code(raw: str) -> str:
    text = clip(raw, 32).upper().translate(_AR_DIGITS)
    text = re.sub(r"\s+", "", text)
    if not _CODE.fullmatch(text):
        raise ValueError("كود الكوبون من ٣ إلى ١٦ حرفاً أو رقماً")
    return text


def sanitize_settings_patch(patch: dict) -> dict:
    """Trim store copy the seller can publish. Drops nothing the caller set."""
    if not isinstance(patch, dict):
        return {}
    out = dict(patch)
    for key, limit in (
        ("announcement", 180),
        ("shipping_note", 400),
        ("return_note", 400),
        ("response_promise", 40),
        ("about_text", 800),
        ("pickup_note", 240),
        ("auto_reply_message", 320),
    ):
        if key in out and out[key] is not None:
            out[key] = clip(out[key], limit)
    if "delivery_cities" in out and out["delivery_cities"] is not None:
        out["delivery_cities"] = clean_cities(out["delivery_cities"])
    if "store_paused" in out and out["store_paused"] is not None:
        out["store_paused"] = bool(out["store_paused"])
    if "banner_slides" in out and isinstance(out["banner_slides"], list):
        out["banner_slides"] = [u for u in out["banner_slides"] if isinstance(u, str) and u][:5]
    if "portfolio_images" in out and isinstance(out["portfolio_images"], list):
        out["portfolio_images"] = [u for u in out["portfolio_images"] if isinstance(u, str) and u][:6]
    if "highlights" in out and isinstance(out["highlights"], list):
        out["highlights"] = out["highlights"][:8]
    return out


def _minutes(value) -> int | None:
    text = clip(value, 8).translate(_AR_DIGITS)
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", text)
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    if hour > 23 or minute > 59:
        return None
    return hour * 60 + minute


def is_open_now(hours, now: datetime | None = None) -> bool:
    """True when the store's weekly hours cover `now` in Asia/Riyadh.

    Missing hours mean the seller has not published a schedule, so the store
    is treated as open and no after-hours reply is sent.
    """
    if not hours:
        return True
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    local = moment.astimezone(RIYADH)
    key = PY_DAYS[local.weekday()]
    row = next((h for h in hours if isinstance(h, dict) and h.get("day") == key), None)
    if not row or row.get("closed"):
        return False
    start = _minutes(row.get("open"))
    end = _minutes(row.get("close"))
    if start is None or end is None or start == end:
        return False
    current = local.hour * 60 + local.minute
    if end < start:
        return current >= start or current < end
    return start <= current < end


def _parse_end(value) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def active_flash_sales(sales, now: datetime | None = None) -> list:
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    fresh = []
    for sale in sales or []:
        if not isinstance(sale, dict):
            continue
        ends = _parse_end(sale.get("ends_at"))
        if ends and ends > moment:
            fresh.append(sale)
    return fresh


def auto_reply_text(settings: dict | None, now: datetime | None = None) -> str | None:
    """One short automatic line, or None when a person should answer."""
    if not settings:
        return None
    moment = now or datetime.now(timezone.utc)
    if settings.get("store_paused"):
        note = clip(settings.get("announcement") or "", 180)
        line = "المتجر متوقف مؤقتاً."
        if note:
            line = f"{line} {note}"
        return f"رد آلي: {line}"[:400]
    if not settings.get("auto_reply_enabled"):
        return None
    hours = settings.get("business_hours") or DEFAULT_HOURS
    if is_open_now(hours, moment):
        return None
    message = clip(settings.get("auto_reply_message") or "سنرد عليك خلال ساعات العمل.", 320)
    if not message:
        return None
    return f"رد آلي: {message}"[:400]
