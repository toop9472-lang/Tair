"""
Mobile crash/error reporter endpoint.

React Native (Expo) cannot easily embed native Sentry SDK without a new EAS
build. Instead, the mobile app catches JS errors and POSTs them here, and we
forward them into the same Sentry project that already covers Web + Backend.
"""
import os
import logging
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mobile", tags=["mobile"])


class MobileErrorPayload(BaseModel):
    message: str = Field(..., max_length=2000)
    stack: Optional[str] = Field(default=None, max_length=8000)
    fatal: bool = False
    platform: Optional[str] = Field(default=None, max_length=32)   # "ios" | "android"
    app_version: Optional[str] = Field(default=None, max_length=32)
    build: Optional[str] = Field(default=None, max_length=32)
    user_id: Optional[str] = Field(default=None, max_length=128)
    screen: Optional[str] = Field(default=None, max_length=128)
    extra: Optional[Dict[str, Any]] = None


@router.post("/error")
async def mobile_error(payload: MobileErrorPayload, request: Request):
    """Forward mobile JS errors to Sentry. Silent no-op if Sentry disabled."""
    dsn = os.environ.get("SENTRY_DSN")
    log_line = (
        f"[mobile] {payload.platform or '?'} v{payload.app_version or '?'} "
        f"screen={payload.screen or '-'} fatal={payload.fatal} :: {payload.message}"
    )
    if payload.fatal:
        logger.error(log_line)
    else:
        logger.warning(log_line)

    if not dsn:
        return {"ok": True, "forwarded": False}

    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("source", "mobile")
            if payload.platform:
                scope.set_tag("platform", payload.platform)
            if payload.app_version:
                scope.set_tag("app_version", payload.app_version)
            if payload.build:
                scope.set_tag("build", payload.build)
            if payload.screen:
                scope.set_tag("screen", payload.screen)
            if payload.user_id:
                scope.set_user({"id": payload.user_id})
            if payload.extra:
                scope.set_context("mobile_extra", payload.extra)
            if payload.stack:
                scope.set_context("stack", {"trace": payload.stack})

            sentry_sdk.capture_message(
                payload.message,
                level="fatal" if payload.fatal else "error",
            )
        return {"ok": True, "forwarded": True}
    except Exception as e:
        logger.exception("Failed to forward mobile error to Sentry: %s", e)
        return {"ok": True, "forwarded": False}
