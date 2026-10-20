"""أسماء العرض: رفض الاسم الافتراضي ومنع التكرار."""
import re

PLACEHOLDER_NAMES = {
    "ضيف طير",
    "ضيف",
    "guest",
    "مستخدم",
    "مستخدم apple",
    "مستخدم google",
    "صديق صقر",
}


def name_key(name: str) -> str:
    return " ".join((name or "").strip().split())


def is_placeholder_name(name: str) -> bool:
    key = name_key(name)
    if not key:
        return True
    folded = key.casefold()
    if folded in PLACEHOLDER_NAMES:
        return True
    if folded.startswith("صديق صقر"):
        return True
    if folded.startswith("guest"):
        return True
    return False


def clean_display_name(name: str) -> str:
    key = name_key(name)
    if len(key) < 2:
        raise ValueError("الاسم يجب أن يكون حرفين على الأقل")
    if len(key) > 24:
        raise ValueError("الاسم طويل. اختر اسماً أقصر من ٢٤ حرفاً")
    if is_placeholder_name(key):
        raise ValueError("اختر اسماً غير «ضيف طير»")
    if re.search(r"https?://|www\.", key, re.I):
        raise ValueError("الاسم لا يقبل الروابط")
    return key


async def assert_unique_name(db, name: str, *except_ids: str) -> str:
    key = clean_display_name(name)
    skip = {str(x) for x in except_ids if x}
    pattern = f"^{re.escape(key)}$"
    cursor = db.users.find(
        {"name": {"$regex": pattern, "$options": "i"}},
        {"_id": 0, "id": 1, "user_id": 1, "email": 1, "name": 1},
    )
    async for doc in cursor:
        owners = {str(doc.get(k)) for k in ("id", "user_id", "email") if doc.get(k)}
        if owners.isdisjoint(skip):
            raise ValueError("هذا الاسم مستخدم. اختر اسماً آخر")
    return key
