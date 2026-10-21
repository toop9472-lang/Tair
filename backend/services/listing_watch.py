"""مطابقة طلب «نبّهني» مع إعلان جديد، بلا دفع وداخل حدود السوق."""
import re
from typing import Optional

_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_DIACRITICS = re.compile(r"[\u064B-\u0652\u0670\u0640]")
_FAMILY_AR = {
    "parrots": "ببغاوات",
    "songbirds": "طيور صغيرة",
    "pigeons": "حمام",
    "poultry": "دواجن",
    "falcons": "صقور",
    "livestock": "مواشي",
    "horses": "خيل",
    "cats": "قطط",
    "dogs": "كلاب",
    "small_mammals": "حيوانات صغيرة",
    "pets": "أليفة أخرى",
    "reptiles": "زواحف",
    "fish": "أسماك",
    "insects": "نحل وحشرات",
    "feed": "أعلاف وأكل",
    "bird_supplies": "مستلزمات الطيور",
    "animal_supplies": "مستلزمات الحيوانات",
    "hotel_services": "فندقة الطيور",
    "training": "تدريب",
    "services": "تركيب وتجهيز",
    "reserves": "محميات",
}


def norm(text: str) -> str:
    value = _DIACRITICS.sub("", str(text or "")).strip().lower()
    value = value.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    value = value.replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"\s+", " ", value)


def parse_price(raw) -> Optional[float]:
    if raw is None or raw == "":
        return None
    cleaned = str(raw).translate(_AR_DIGITS).replace(",", "").replace(" ", "")
    try:
        price = float(cleaned)
    except ValueError:
        return None
    if price <= 0:
        return None
    return price


def listing_blob(listing: dict) -> str:
    family_id = str((listing or {}).get("family") or "")
    parts = [
        listing.get("title"),
        listing.get("description"),
        listing.get("breed"),
        listing.get("species"),
        listing.get("species_name"),
        family_id,
        _FAMILY_AR.get(family_id, ""),
    ]
    return norm(" ".join(str(part) for part in parts if part))


def watch_matches(watch: dict, listing: dict) -> bool:
    if not watch or not listing:
        return False
    if watch.get("active") is False:
        return False
    if listing.get("is_flagged"):
        return False
    if listing.get("status") not in (None, "active"):
        return False
    seller = str(listing.get("seller_id") or "")
    owner = str(watch.get("user_id") or "")
    if seller and owner and seller == owner:
        return False
    words = [word for word in norm(watch.get("bird") or "").split() if len(word) >= 2]
    if not words:
        return False
    blob = listing_blob(listing)
    if not all(word in blob for word in words):
        return False
    cap = watch.get("max_price")
    if cap is None or cap == "":
        return True
    try:
        price = float(listing.get("price_sar"))
    except (TypeError, ValueError):
        return False
    return price <= float(cap)


def already_sent(watch: dict, listing_id: str) -> bool:
    return listing_id in (watch.get("notified_ids") or [])
