"""طير — Web Push notifications (browser push, works even when tab is closed).

Uses the standard Web Push Protocol with VAPID keys. Compatible with any browser
that supports the Push API (Chrome, Firefox, Edge, Safari 16.4+).

Environment variables required:
- VAPID_PRIVATE_KEY_PEM  (PEM string, may contain escaped \n)
- VAPID_PUBLIC_KEY       (base64url of the EC point, for the frontend)
- VAPID_CONTACT_EMAIL    (e.g. "mailto:admin@tair.app")
"""
from __future__ import annotations

import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional, Any, Dict

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

router = APIRouter(prefix="/webpush", tags=["Tair-WebPush"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_client = AsyncIOMotorClient(mongo_url)
_db = _client[os.environ.get("DB_NAME", "saqr_db")]


def _now():
    return datetime.now(timezone.utc)


def _vapid_private_key() -> str:
    raw = os.environ.get("VAPID_PRIVATE_KEY_PEM", "")
    # Strip wrapping quotes if the env stored them, unescape literal \n
    if raw.startswith('"') and raw.endswith('"'):
        raw = raw[1:-1]
    return raw.replace("\\n", "\n")


def _vapid_claims() -> Dict[str, str]:
    return {"sub": os.environ.get("VAPID_CONTACT_EMAIL", "mailto:admin@tair.app")}


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class WebPushSubscription(BaseModel):
    endpoint: str
    keys: SubscriptionKeys
    expirationTime: Optional[Any] = None


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    return {"key": os.environ.get("VAPID_PUBLIC_KEY", "")}


@router.post("/subscribe")
async def subscribe(sub: WebPushSubscription, user_id: str = Query(...)):
    """Register a Web Push subscription for a user (idempotent by endpoint)."""
    doc = {
        "user_id": user_id,
        "endpoint": sub.endpoint,
        "p256dh": sub.keys.p256dh,
        "auth": sub.keys.auth,
        "created_at": _now(),
        "updated_at": _now(),
        "is_active": True,
    }
    await _db.web_push_subscriptions.update_one(
        {"endpoint": sub.endpoint},
        {"$set": doc},
        upsert=True,
    )
    return {"success": True}


@router.post("/unsubscribe")
async def unsubscribe(endpoint: str = Query(...)):
    await _db.web_push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": {"is_active": False, "updated_at": _now()}},
    )
    return {"success": True}


@router.post("/test")
async def test_push(user_id: str = Query(...), title: str = "طير", body: str = "مرحباً من طير 🐦"):
    """Send a test push to all active subscriptions of a user."""
    result = await send_web_push_to_user(user_id, title, body, data={"type": "test"})
    return result


# ============================================================
#  Helper: send Web Push to a specific user (called by other routes)
# ============================================================
async def send_web_push_to_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    url: Optional[str] = None,
) -> Dict[str, Any]:
    """Send a Web Push notification to all active subscriptions of a user.

    Runs synchronously via asyncio.to_thread. Fails silently on individual
    subscription errors (410 = gone → mark inactive).
    """
    try:
        from pywebpush import webpush, WebPushException
    except Exception as exc:
        return {"success": False, "error": f"pywebpush not available: {exc}"}

    private_key = _vapid_private_key()
    if not private_key:
        return {"success": False, "error": "VAPID_PRIVATE_KEY_PEM not configured"}

    subs = await _db.web_push_subscriptions.find(
        {"user_id": user_id, "is_active": True}
    ).to_list(100)

    if not subs:
        return {"success": True, "sent": 0}

    payload = json.dumps({
        "title": title,
        "body": body,
        "data": data or {},
        "url": url or "/",
    })

    sent = 0
    failed = 0
    claims = _vapid_claims()

    def _send_one(sub_info):
        try:
            webpush(
                subscription_info={
                    "endpoint": sub_info["endpoint"],
                    "keys": {"p256dh": sub_info["p256dh"], "auth": sub_info["auth"]},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims=claims,
                ttl=60 * 60 * 24,
            )
            return ("ok", None)
        except WebPushException as e:
            status = getattr(e.response, "status_code", None) if getattr(e, "response", None) else None
            return ("fail", status)
        except Exception as e:  # pragma: no cover
            return ("fail", str(e))

    for sub in subs:
        result_status, err = await asyncio.to_thread(_send_one, sub)
        if result_status == "ok":
            sent += 1
        else:
            failed += 1
            # 404/410 mean the subscription is gone — mark inactive
            if err in (404, 410):
                await _db.web_push_subscriptions.update_one(
                    {"endpoint": sub["endpoint"]},
                    {"$set": {"is_active": False, "updated_at": _now()}},
                )

    return {"success": True, "sent": sent, "failed": failed}
