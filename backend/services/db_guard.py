"""طير — DB safety guard.

Refuses any bulk `delete_many` on core collections (users, listings, trips)
unless the caller sets an explicit `TAIR_ALLOW_BULK_DELETE=1` env flag.
Loaded at server startup as a defensive net: even if an admin script mistakenly
runs `db.users.delete_many({})`, this wrapper aborts and logs the attempt.
"""
import os
import logging

_PROTECTED_COLLECTIONS = {"users", "listings", "trips", "orders", "ratings", "chats"}
_ALLOW_FLAG = "TAIR_ALLOW_BULK_DELETE"

logger = logging.getLogger("tair.db_guard")


def install_delete_guard(db) -> None:
    """Wrap delete_many on protected collections via a class-level shim.

    Motor rebuilds methods dynamically per call, so we cannot patch the
    instance. Instead we patch the underlying pymongo `Collection` class-level
    method. If it's already wrapped we no-op.
    """
    try:
        from pymongo.collection import Collection  # sync class Motor delegates to
    except Exception:
        logger.warning("pymongo not importable for delete guard")
        return

    if getattr(Collection.delete_many, "_tair_guarded", False):
        return

    original = Collection.delete_many

    def guarded(self, filter, *args, **kwargs):  # noqa: A002
        name = getattr(self, "name", "?")
        if name in _PROTECTED_COLLECTIONS and os.environ.get(_ALLOW_FLAG) != "1":
            logger.error(
                "REFUSED delete_many on protected collection '%s' (filter=%s). "
                "Set TAIR_ALLOW_BULK_DELETE=1 to override.",
                name,
                str(filter)[:300],
            )
            raise PermissionError(
                f"delete_many on '{name}' is disabled without TAIR_ALLOW_BULK_DELETE=1"
            )
        return original(self, filter, *args, **kwargs)

    guarded._tair_guarded = True  # type: ignore[attr-defined]
    Collection.delete_many = guarded
    # Also wrap Motor's collection class if available (belt & suspenders)
    try:
        from motor.motor_asyncio import AsyncIOMotorCollection

        if not getattr(AsyncIOMotorCollection.delete_many, "_tair_guarded", False):
            m_original = AsyncIOMotorCollection.delete_many

            async def m_guarded(self, filter, *args, **kwargs):  # noqa: A002
                name = getattr(self, "name", "?")
                if name in _PROTECTED_COLLECTIONS and os.environ.get(_ALLOW_FLAG) != "1":
                    logger.error(
                        "REFUSED delete_many on protected collection '%s' (filter=%s). "
                        "Set TAIR_ALLOW_BULK_DELETE=1 to override.",
                        name,
                        str(filter)[:300],
                    )
                    raise PermissionError(
                        f"delete_many on '{name}' is disabled without TAIR_ALLOW_BULK_DELETE=1"
                    )
                return await m_original(self, filter, *args, **kwargs)

            m_guarded._tair_guarded = True  # type: ignore[attr-defined]
            AsyncIOMotorCollection.delete_many = m_guarded
    except Exception as e:
        logger.warning("Failed to guard Motor's AsyncIOMotorCollection: %s", e)
