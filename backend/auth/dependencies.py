from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import os
from motor.motor_asyncio import AsyncIOMotorClient
from auth.jwt_handler import get_user_id_from_token

security = HTTPBearer()

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]


async def _touch_last_seen(user_id: str) -> None:
    try:
        await _db.users.update_one(
            {"$or": [{"user_id": user_id}, {"email": user_id}, {"id": user_id}]},
            {"$set": {"last_seen": datetime.now(timezone.utc)}},
        )
    except Exception:
        pass


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Dependency to get current user ID from JWT token.
    Also updates `last_seen` to track active users.
    """
    token = credentials.credentials
    user_id = get_user_id_from_token(token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or expired token'
        )

    await _touch_last_seen(user_id)
    return user_id
