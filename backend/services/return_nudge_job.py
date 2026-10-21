"""يرسل نداء العودة مرة واحدة لكل غياب."""
from datetime import datetime, timedelta, timezone

from services.return_nudge import activity_at, should_nudge


async def send_return_nudges(db, now: datetime = None, limit: int = 200) -> int:
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=2)
    query = {
        "is_banned": {"$ne": True},
        "$or": [
            {"last_seen": {"$lte": cutoff}},
            {"last_active": {"$lte": cutoff}},
        ],
    }
    from routes.tair_notifications_routes import create_tair_notification

    sent = 0
    cursor = db.users.find(query, {
        "_id": 0,
        "user_id": 1,
        "id": 1,
        "is_banned": 1,
        "last_seen": 1,
        "last_active": 1,
        "last_return_nudge": 1,
    }).limit(limit)
    async for user in cursor:
        if not should_nudge(user, now):
            continue
        uid = user.get("user_id") or user.get("id")
        activity = activity_at(user)
        claimed = await db.users.update_one(
            {"$and": [
                {"$or": [{"user_id": uid}, {"id": uid}]},
                {"$or": [
                    {"last_return_nudge": {"$exists": False}},
                    {"last_return_nudge": None},
                    {"last_return_nudge": {"$lt": activity}},
                ]},
            ]},
            {"$set": {"last_return_nudge": now}},
        )
        if not claimed.modified_count:
            continue
        await create_tair_notification(
            user_id=uid,
            title="طير بانتظارك",
            body="مرّ يومان منذ زيارتك. السوق والرحلات والعيادة ما زالت هنا.",
            notif_type="return_nudge",
            data={},
        )
        sent += 1
    return sent
