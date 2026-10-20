"""Cloudflare R2 (S3-compatible) storage service.

Used to persist user-uploaded media (Reels, ads) outside the ephemeral pod disk
so files survive deployments. Falls back to indicating "not configured" when
required env vars are missing — callers should still keep local disk fallback.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import boto3
from botocore.client import Config

logger = logging.getLogger(__name__)


class R2Storage:
    def __init__(self) -> None:
        self.account_id = os.environ.get("R2_ACCOUNT_ID", "").strip()
        self.access_key = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
        self.secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
        self.bucket = os.environ.get("R2_BUCKET", "").strip()
        self.endpoint = os.environ.get("R2_ENDPOINT", "").strip()
        if not self.endpoint and self.account_id:
            self.endpoint = f"https://{self.account_id}.r2.cloudflarestorage.com"
        self.public_base = os.environ.get("R2_PUBLIC_BASE_URL", "").strip().rstrip("/")
        self._client = None

    @property
    def is_configured(self) -> bool:
        return bool(
            self.access_key and self.secret_key and self.bucket and self.endpoint
        )

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=self.endpoint,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name="auto",
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},
                ),
            )
        return self._client

    def upload_bytes(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        cache_control: str = "public, max-age=86400",
    ) -> str:
        """Upload bytes to R2 and return a public URL (or signed URL fallback)."""
        if not self.is_configured:
            raise RuntimeError("R2 not configured")
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            CacheControl=cache_control,
        )
        return self.public_url(key)

    def public_url(self, key: str) -> str:
        """Build a publicly accessible URL for a stored object.

        Priority:
        1. R2_PUBLIC_BASE_URL (custom domain or r2.dev subdomain) → preferred
        2. Otherwise, fall back to a presigned URL (7 days) so playback still works.
        """
        key_clean = key.lstrip("/")
        if self.public_base:
            return f"{self.public_base}/{key_clean}"
        # Presigned fallback (limited validity) — better than nothing if the
        # bucket isn't yet configured for public access.
        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key_clean},
                ExpiresIn=60 * 60 * 24 * 7,  # 7 days
            )
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to build presigned URL for %s: %s", key_clean, exc)
            return ""

    def delete(self, key: str) -> None:
        if not self.is_configured:
            return
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key.lstrip("/"))
        except Exception as exc:
            logger.warning("R2 delete failed for %s: %s", key, exc)


# Module-level singleton — safe because boto3 client is thread-safe.
r2 = R2Storage()
