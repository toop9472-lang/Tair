"""Send the store's automatic reply once per conversation each Riyadh day."""
from datetime import datetime, timezone

from services.storefront_logic import RIYADH, auto_reply_text


async def maybe_store_auto_reply(db, thread: dict, sender_id: str, send_message) -> None:
    if not thread or not sender_id:
        return
    others = [p for p in (thread.get("participants") or []) if p and p != sender_id]
    if len(others) != 1:
        return
    seller_id = others[0]
    today = datetime.now(RIYADH).date().isoformat()
    if thread.get("auto_reply_on") == today:
        return

    user = await db.users.find_one(
        {"$or": [{"user_id": seller_id}, {"id": seller_id}, {"email": seller_id}]},
        {"_id": 0, "name": 1, "storefront_settings": 1},
    )
    if not user:
        return
    text = auto_reply_text(user.get("storefront_settings") or {}, datetime.now(timezone.utc))
    if not text:
        return

    claimed = await db.chat_threads.update_one(
        {"thread_id": thread.get("thread_id"), "auto_reply_on": {"$ne": today}},
        {"$set": {"auto_reply_on": today}},
    )
    if getattr(claimed, "modified_count", 0) == 0:
        return
    await send_message(thread["thread_id"], seller_id, text, user.get("name") or "المتجر", True)
