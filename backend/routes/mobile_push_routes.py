"""طير — Native mobile push notifications via Expo Push service.

Uses Expo's free push service (https://exp.host/--/api/v2/push/send) so we
don't need Firebase or APNS credentials directly. Expo handles delivery to
both iOS (APNS) and Android (FCM).

Endpoints:
- POST /api/mobile/push/register    — save an Expo push token for a user
- POST /api/mobile/push/unregister  — remove a token
- POST /api/mobile/push/test        — send a test push to yourself
"""
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import httpx
from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

router = APIRouter(prefix="/mobile/push", tags=["mobile-push"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class RegisterBody(BaseModel):
    user_id: str = Field(..., max_length=128)
    token: str = Field(..., max_length=256)
    platform: Optional[str] = Field(default=None, max_length=16)  # "ios" | "android"
    app_version: Optional[str] = Field(default=None, max_length=32)


class UnregisterBody(BaseModel):
    token: str = Field(..., max_length=256)


@router.post("/register")
async def register_push_token(body: RegisterBody):
    """Store (or refresh) an Expo push token for a given user."""
    if not body.token.startswith("ExponentPushToken[") and not body.token.startswith("ExpoPushToken["):
        # Still accept but flag — Expo tokens typically look like ExponentPushToken[...]
        pass
    now = datetime.now(timezone.utc)
    await db.mobile_push_tokens.update_one(
        {"token": body.token},
        {
            "$set": {
                "token": body.token,
                "user_id": body.user_id,
                "platform": body.platform,
                "app_version": body.app_version,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {"ok": True}


@router.post("/unregister")
async def unregister_push_token(body: UnregisterBody):
    r = await db.mobile_push_tokens.delete_one({"token": body.token})
    return {"ok": True, "removed": r.deleted_count}


@router.post("/test")
async def test_push(user_id: str = Query(...)):
    tokens = [d["token"] async for d in db.mobile_push_tokens.find({"user_id": user_id})]
    if not tokens:
        raise HTTPException(status_code=404, detail="No push tokens registered for this user")
    delivered = await send_expo_push(
        tokens=tokens,
        title="طير",
        body="اختبار الإشعارات — يعمل بنجاح!",
        data={"type": "test"},
    )
    return {"ok": True, "targets": len(tokens), "expo_result": delivered}


async def send_expo_push(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send a push notification to one or more Expo tokens. Silent on failure."""
    if not tokens:
        return {"skipped": "no tokens"}
    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
            "data": data or {},
        }
        for t in tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            payload = resp.json()
            # Expo sometimes returns DeviceNotRegistered — clean those tokens
            data_arr = payload.get("data") or []
            if isinstance(data_arr, list):
                for i, item in enumerate(data_arr):
                    if isinstance(item, dict) and item.get("status") == "error":
                        err = (item.get("details") or {}).get("error")
                        if err in ("DeviceNotRegistered", "InvalidCredentials"):
                            try:
                                await db.mobile_push_tokens.delete_one({"token": tokens[i]})
                            except Exception:
                                pass
            return payload
    except Exception as exc:
        return {"error": str(exc)}


async def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """Send a native push notification to all of a user's registered devices.
    Fire-and-forget helper — never raises."""
    try:
        tokens = [d["token"] async for d in db.mobile_push_tokens.find({"user_id": user_id})]
        if not tokens:
            return
        await send_expo_push(tokens=tokens, title=title, body=body, data=data)
    except Exception as exc:
        print(f"[mobile_push] send_push_to_user failed: {exc}")
