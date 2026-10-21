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


async def staff_user_ids(db, wanted) -> list:
    """حسابات المشرفين المطابقة للنطاق، ومعهم المشرف العام والمدير."""
    wanted = set(wanted or [])
    ids = []
    async for mod in db.tair_moderators.find({}, {"_id": 0, "user_id": 1, "scopes": 1}):
        scopes = mod.get("scopes") or []
        if isinstance(scopes, str):
            scopes = [scopes]
        if mod.get("user_id") and ("general" in scopes or any(s in wanted for s in scopes)):
            ids.append(mod["user_id"])
    async for admin in db.admins.find({}, {"_id": 0, "id": 1, "user_id": 1, "email": 1}):
        uid = admin.get("user_id") or admin.get("id") or admin.get("email")
        if uid:
            ids.append(uid)
    async for user in db.users.find(
        {"$or": [{"is_admin": True}, {"role": {"$in": ["admin", "super_admin"]}}]},
        {"_id": 0, "id": 1, "user_id": 1, "email": 1},
    ):
        uid = user.get("user_id") or user.get("id") or user.get("email")
        if uid:
            ids.append(uid)
    return ids


async def notify_staff(db, wanted, exclude, title, body, notif_type, data=None):
    from routes.tair_notifications_routes import create_tair_notification

    blocked = {str(x) for x in (exclude or []) if x}
    sent = set()
    for uid in await staff_user_ids(db, wanted):
        if not uid or str(uid) in blocked or uid in sent:
            continue
        sent.add(uid)
        try:
            await create_tair_notification(
                user_id=uid,
                title=title,
                body=body,
                notif_type=notif_type,
                data=data or {},
            )
        except Exception as exc:
            print(f"[notify_staff] {exc}")
