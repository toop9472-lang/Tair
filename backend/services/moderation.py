"""Resolve moderator scopes from id, user_id, or email."""


async def moderator_scopes(db, user_id: str) -> list:
    if not user_id:
        return []
    keys = {str(user_id)}
    user = await db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1, "user_id": 1, "email": 1},
    )
    if user:
        for key in ("id", "user_id", "email"):
            if user.get(key):
                keys.add(str(user[key]))
    key_list = list(keys)
    doc = await db.tair_moderators.find_one(
        {"$or": [{"user_id": {"$in": key_list}}, {"email": {"$in": key_list}}]},
        {"_id": 0, "scopes": 1},
    )
    if not doc:
        return []
    scopes = doc.get("scopes") or []
    if isinstance(scopes, str):
        scopes = [scopes]
    return [s for s in scopes if s]
