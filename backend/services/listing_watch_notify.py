"""إرسال إشعار الشاشة عند نزول إعلان يطابق طلباً فعّالاً."""
from services.listing_watch import already_sent, watch_matches


def _ar_amount(price) -> str:
    try:
        number = float(price)
    except (TypeError, ValueError):
        return ""
    shown = str(int(number)) if number.is_integer() else str(number)
    return shown.translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))


async def notify_listing_watches(db, listing: dict) -> int:
    if not listing or listing.get("is_flagged") or listing.get("status") not in (None, "active"):
        return 0
    listing_id = listing.get("listing_id")
    if not listing_id:
        return 0
    from routes.tair_notifications_routes import create_tair_notification

    sent = 0
    cursor = db.tair_listing_watches.find({"active": True}).limit(400)
    async for watch in cursor:
        if sent >= 30:
            break
        if already_sent(watch, listing_id) or not watch_matches(watch, listing):
            continue
        title = (listing.get("title") or "إعلان").strip()
        amount = _ar_amount(listing.get("price_sar"))
        city = (listing.get("city") or "").strip()
        bits = [title]
        if amount:
            bits.append(f"بسعر {amount} ر.س")
        if city:
            bits.append(f"في {city}")
        await create_tair_notification(
            user_id=watch["user_id"],
            title="إعلان يناسب طلبك",
            body=" · ".join(bits),
            notif_type="listing_watch",
            data={"listing_id": listing_id, "watch_id": watch.get("watch_id")},
        )
        await db.tair_listing_watches.update_one(
            {"watch_id": watch.get("watch_id")},
            {"$addToSet": {"notified_ids": listing_id}},
        )
        sent += 1
    return sent
