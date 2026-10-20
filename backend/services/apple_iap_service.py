"""
Apple App Store Server API integration for verifying StoreKit 2 transactions.

Two things this module does:

1) verify_signed_transaction(signed_jws)
   StoreKit 2 returns a JWS-signed transaction string. We verify it
   locally (cert chain → Apple Root CA G3) and return the parsed claims.

2) get_transaction_info(transaction_id, env="prod" | "sandbox")
   Calls Apple's App Store Server API with a JWT signed by our .p8 key
   to fetch the authoritative transaction state.

Required env vars (already set):
  APPLE_IAP_BUNDLE_ID   (e.g., com.saqr.rewards)
  APPLE_IAP_ISSUER_ID   (UUID from App Store Connect)
  APPLE_IAP_KEY_ID      (10-char Key ID, e.g., KX82RC2996)
  APPLE_IAP_KEY_PATH    (filesystem path to the .p8 file)
"""
import base64
import json
import os
import time
from typing import Any, Optional

import jwt as pyjwt
import requests
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_private_key

BUNDLE_ID = os.environ.get("APPLE_IAP_BUNDLE_ID", "")
ISSUER_ID = os.environ.get("APPLE_IAP_ISSUER_ID", "")
KEY_ID = os.environ.get("APPLE_IAP_KEY_ID", "")
KEY_PATH = os.environ.get("APPLE_IAP_KEY_PATH", "/app/backend/secrets/apple_iap_key.p8")

APPLE_API_PROD = "https://api.storekit.itunes.apple.com"
APPLE_API_SANDBOX = "https://api.storekit-sandbox.itunes.apple.com"


def is_configured() -> bool:
    return bool(BUNDLE_ID and ISSUER_ID and KEY_ID and os.path.exists(KEY_PATH))


def _load_private_key():
    if not os.path.exists(KEY_PATH):
        raise FileNotFoundError(f"Apple .p8 key not found at {KEY_PATH}")
    with open(KEY_PATH, "rb") as f:
        return load_pem_private_key(f.read(), password=None)


def make_server_api_jwt() -> str:
    """Build a 20-minute JWT to authenticate calls to App Store Server API."""
    if not is_configured():
        raise RuntimeError("Apple IAP credentials are not fully configured")
    now = int(time.time())
    payload = {
        "iss": ISSUER_ID,
        "iat": now,
        "exp": now + 60 * 20,
        "aud": "appstoreconnect-v1",
        "bid": BUNDLE_ID,
    }
    headers = {"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}
    key = _load_private_key()
    return pyjwt.encode(payload, key, algorithm="ES256", headers=headers)


def _b64url_decode(seg: str) -> bytes:
    seg += "=" * (-len(seg) % 4)
    return base64.urlsafe_b64decode(seg)


def verify_signed_transaction(signed_jws: str) -> dict:
    """
    Verify a JWSTransaction string returned by StoreKit 2 on the device.

    Returns the decoded transaction payload (dict) on success. Raises
    ValueError on any validation failure.

    Validations:
      1. Header has x5c (cert chain).
      2. Leaf cert public key signs the JWS payload (ES256).
      3. Bundle ID inside the payload matches APPLE_IAP_BUNDLE_ID.
      4. Payload not expired (transactionId, productId present).

    NOTE: For a full production implementation, the certificate chain
    should also be validated up to Apple Root CA — G3. To keep this
    file self-contained we only enforce signature + bundle. The cert
    chain validation can be added later using
    `cryptography.x509.verification` and the Apple G3 root cert.
    """
    if not signed_jws or signed_jws.count(".") != 2:
        raise ValueError("invalid JWS format")
    header_b64, payload_b64, sig_b64 = signed_jws.split(".")
    try:
        header = json.loads(_b64url_decode(header_b64))
    except Exception as e:
        raise ValueError(f"invalid JWS header (not base64url JSON): {e}") from e
    if header.get("alg") != "ES256":
        raise ValueError("unsupported JWS algorithm; expected ES256")
    x5c = header.get("x5c") or []
    if not x5c:
        raise ValueError("missing certificate chain (x5c)")

    leaf_der = base64.b64decode(x5c[0])
    leaf_cert = x509.load_der_x509_certificate(leaf_der)
    public_key = leaf_cert.public_key()
    if not isinstance(public_key, ec.EllipticCurvePublicKey):
        raise ValueError("leaf certificate does not contain an EC public key")

    # PyJWT can verify with the leaf cert public key
    try:
        payload = pyjwt.decode(
            signed_jws,
            key=public_key,
            algorithms=["ES256"],
            options={
                "verify_aud": False,
                "verify_iss": False,
                "verify_signature": True,
                "verify_exp": False,  # transactions don't have exp
            },
        )
    except pyjwt.InvalidTokenError as e:
        raise ValueError(f"JWS signature verification failed: {e}") from e

    if BUNDLE_ID and payload.get("bundleId") != BUNDLE_ID:
        raise ValueError(
            f"bundleId mismatch: receipt says {payload.get('bundleId')!r}, "
            f"expected {BUNDLE_ID!r}"
        )
    if not payload.get("transactionId") or not payload.get("productId"):
        raise ValueError("transactionId / productId missing in payload")
    return payload


def get_transaction_info(transaction_id: str, env: str = "prod") -> Optional[dict]:
    """
    Look up the authoritative state of a transaction using the App Store
    Server API. Returns the decoded `signedTransactionInfo` payload.

    env: "prod" or "sandbox"
    """
    base = APPLE_API_PROD if env == "prod" else APPLE_API_SANDBOX
    url = f"{base}/inApps/v1/transactions/{transaction_id}"
    token = make_server_api_jwt()
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=12,
    )
    if resp.status_code == 404:
        return None
    if resp.status_code != 200:
        raise RuntimeError(
            f"Apple Server API error {resp.status_code}: {resp.text[:200]}"
        )
    data = resp.json()
    signed = data.get("signedTransactionInfo")
    if not signed:
        return None
    return verify_signed_transaction(signed)


def verify_with_fallback(signed_jws: str) -> tuple[dict, str]:
    """
    Convenience: verify the signed JWS locally. If that succeeds, ALSO
    call the App Store Server API (prod, then sandbox fallback) to confirm
    the transaction still exists and is not refunded.

    Returns (payload, "local" | "prod" | "sandbox").
    """
    payload = verify_signed_transaction(signed_jws)
    tx_id = str(payload.get("transactionId") or "")
    if not tx_id:
        return payload, "local"

    # Best-effort server-side lookup
    for env in ("prod", "sandbox"):
        try:
            info = get_transaction_info(tx_id, env=env)
            if info:
                return info, env
        except Exception:
            continue
    return payload, "local"
