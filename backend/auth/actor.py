"""طير — Actor authorization helper.

Enforces that a caller's JWT identity matches the acted-upon `user_id` param.
Admins (row exists in db.admins matching id/user_id/email) bypass the match.

Use as a FastAPI dependency on any endpoint that mutates data:
    async def endpoint(actor = Depends(require_actor("path_or_query_user_id"))):
        ...
"""
import os
from typing import Optional
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

from auth.dependencies import get_current_user_id

_mongo = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
_db = _mongo[os.environ.get("DB_NAME", "saqr_db")]


async def _resolve_aliases(user_id: str) -> set[str]:
    """Return the set of identifiers (id, user_id, email) that refer to the
    same user document as `user_id`. Empty set if no user matches."""
    if not user_id:
        return set()
    u = await _db.users.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1, "user_id": 1, "email": 1},
    )
    if not u:
        return set()
    return {v for v in (u.get("id"), u.get("user_id"), u.get("email")) if v}


async def _is_admin(user_id: str) -> bool:
    if not user_id:
        return False
    adm = await _db.admins.find_one(
        {"$or": [{"id": user_id}, {"user_id": user_id}, {"email": user_id}]},
        {"_id": 0, "id": 1},
    )
    return bool(adm)


async def require_actor(
    request: Request,
    token_user_id: str = Depends(get_current_user_id),
) -> str:
    """Ensure the JWT holder matches the mutation target (query/path user_id).

    Returns the CANONICAL user_id from the JWT — endpoint code should use this
    rather than the untrusted `user_id` param.
    """
    target = request.query_params.get("user_id") or request.path_params.get("user_id")
    if not target:
        # No target specified — the JWT identity IS the actor.
        return token_user_id

    # Same string is trivially the same actor.
    if target == token_user_id:
        return token_user_id

    # Resolve aliases for both sides so email/user_id/id all match.
    token_aliases = await _resolve_aliases(token_user_id)
    if target in token_aliases:
        return token_user_id

    # Admin bypass: token holder must be a real admin.
    if await _is_admin(token_user_id):
        return token_user_id

    raise HTTPException(
        status_code=403,
        detail="غير مصرح لك بتعديل بيانات مستخدم آخر",
    )
