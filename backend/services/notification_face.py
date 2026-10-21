"""شكل الإشعار: نوع عربي وقناة هاتف، من غير تغيير نص الرسالة نفسها."""

_EXACT = {
    "chat": ("رسالة", "messages"),
    "community_chat": ("دردشة عامة", "messages"),
    "clinic_topic": ("موضوع في العيادة", "clinic"),
    "clinic_reply": ("رد في العيادة", "clinic"),
    "trip_match": ("رحلة تناسبك", "trips"),
    "trip_request": ("طلب رحلة", "trips"),
    "trip_booking": ("حجز رحلة", "trips"),
    "trip_motion": ("حركة الرحلة", "trips"),
    "trip_status": ("رحلة", "trips"),
    "order_update": ("طلب", "orders"),
    "order_disputed": ("نزاع على طلب", "orders"),
    "follow": ("متابعة", "general"),
    "kyc_decision": ("توثيق", "general"),
    "verification_request": ("توثيق", "general"),
    "admin_broadcast": ("من طير", "general"),
    "app_update": ("تحديث التطبيق", "general"),
    "listing_new": ("إعلان", "general"),
    "listing_watch": ("طلبك في السوق", "general"),
    "return_nudge": ("طير", "general"),
    "story_new": ("قصة", "general"),
}


def notification_face(notif_type: str) -> dict:
    kind = str(notif_type or "")
    if kind in _EXACT:
        label, channel = _EXACT[kind]
    elif kind.startswith("chat"):
        label, channel = "رسالة", "messages"
    elif kind.startswith("clinic"):
        label, channel = "العيادة", "clinic"
    elif kind.startswith("trip"):
        label, channel = "رحلة", "trips"
    elif kind.startswith("order"):
        label, channel = "طلب", "orders"
    else:
        label, channel = "طير", "general"
    return {"label": label, "channel": channel}


def apply_face(doc: dict) -> dict:
    """Fill a stored row that was written before labels existed. Keep a saved label."""
    face = notification_face((doc or {}).get("type"))
    if not doc.get("label"):
        doc["label"] = face["label"]
    if not doc.get("channel"):
        doc["channel"] = face["channel"]
    return doc
