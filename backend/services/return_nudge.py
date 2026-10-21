"""رسالة واحدة لمن غاب يومين، ثم تتوقف حتى يفتح التطبيق من جديد."""
from datetime import datetime, timedelta, timezone

ABSENCE = timedelta(days=2)


def _aware(value):
    if value is None or value == "":
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if isinstance(value, datetime) and value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value if isinstance(value, datetime) else None


def activity_at(user: dict):
    moments = [_aware((user or {}).get("last_seen")), _aware((user or {}).get("last_active"))]
    moments = [moment for moment in moments if moment]
    return max(moments) if moments else None


def should_nudge(user: dict, now: datetime) -> bool:
    if not user or user.get("is_banned"):
        return False
    uid = str(user.get("user_id") or user.get("id") or "")
    if not uid or uid.startswith("guest_"):
        return False
    activity = activity_at(user)
    if activity is None or now - activity < ABSENCE:
        return False
    nudged = _aware(user.get("last_return_nudge"))
    if nudged and nudged >= activity:
        return False
    return True
