"""Iteration 19: phone OTP auth + profile updates + verified badges + listings enrichment."""
import os
import uuid
import time
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback for local test runs, but tests will still hit /api
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE}/api"


def _rand_saudi_phone():
    # 05 + 8 random digits
    return "05" + str(uuid.uuid4().int)[:8]


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Phone OTP send ----------
def test_send_otp_returns_debug(s):
    phone = _rand_saudi_phone()
    r = s.post(f"{API}/phone/send-otp", json={"phone": phone})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    assert "otp_debug" in body, f"no otp_debug in dev mode: {body}"
    assert len(body["otp_debug"]) == 6
    # attach for later chained test
    test_send_otp_returns_debug.phone = phone
    test_send_otp_returns_debug.otp = body["otp_debug"]


def test_otp_login_new_user_requires_name(s):
    phone = _rand_saudi_phone()
    r = s.post(f"{API}/phone/send-otp", json={"phone": phone})
    otp = r.json()["otp_debug"]
    # no name → should 400
    r2 = s.post(f"{API}/phone/otp-login", json={"phone": phone, "otp": otp})
    assert r2.status_code == 400, r2.text
    assert "الاسم" in r2.text


def test_otp_login_new_user_with_name(s):
    phone = _rand_saudi_phone()
    r = s.post(f"{API}/phone/send-otp", json={"phone": phone})
    otp = r.json()["otp_debug"]
    r2 = s.post(f"{API}/phone/otp-login", json={"phone": phone, "otp": otp, "name": "TEST User Alpha"})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["is_new_user"] is True
    assert body.get("token")
    assert body["user"]["name"] == "TEST User Alpha"
    assert body["user"].get("id")
    # store for reuse
    test_otp_login_new_user_with_name.phone = phone
    test_otp_login_new_user_with_name.user_id = body["user"]["id"]


def test_otp_login_existing_user_is_not_new(s):
    phone = test_otp_login_new_user_with_name.phone
    # request new OTP
    r = s.post(f"{API}/phone/send-otp", json={"phone": phone})
    # existing user → send-otp may reject with 400 (existing phone). Handle both.
    if r.status_code == 400:
        # send-otp blocks existing users — this is a real bug for passwordless login
        pytest.fail(f"send-otp rejects existing user (blocks re-login): {r.text}")
    otp = r.json()["otp_debug"]
    r2 = s.post(f"{API}/phone/otp-login", json={"phone": phone, "otp": otp})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["is_new_user"] is False
    assert body["user"]["id"] == test_otp_login_new_user_with_name.user_id


# ---------- Profile update + fetch ----------
def test_update_profile_bg_and_fetch(s):
    uid = test_otp_login_new_user_with_name.user_id
    bg = "https://example.com/bg.jpg"
    r = s.post(f"{API}/phone/update-profile?user_id={uid}", json={"profile_bg_url": bg, "bio": "TEST bio"})
    assert r.status_code == 200, r.text
    r2 = s.get(f"{API}/phone/profile/{uid}")
    assert r2.status_code == 200, r2.text
    prof = r2.json()
    assert prof.get("profile_bg_url") == bg
    assert prof.get("bio") == "TEST bio"


# ---------- Verified badges via KYC ----------
def _register_user(s, name="TEST Verified"):
    phone = _rand_saudi_phone()
    r = s.post(f"{API}/phone/send-otp", json={"phone": phone})
    otp = r.json()["otp_debug"]
    r2 = s.post(f"{API}/phone/otp-login", json={"phone": phone, "otp": otp, "name": name})
    assert r2.status_code == 200, r2.text
    return r2.json()["user"]["id"], phone


def _submit_and_approve_kyc(s, uid, role):
    payload = {
        "role": role,
        "full_name": "TEST Full Name",
        "id_number": "1234567890",
        "phone": "0501234567",
        "id_front_url": "https://example.com/front.jpg",
        "selfie_url": "https://example.com/selfie.jpg",
    }
    if role == "shop":
        payload["business_license_url"] = "https://example.com/license.jpg"
    r = s.post(f"{API}/kyc/submit?user_id={uid}", json=payload)
    assert r.status_code == 200, r.text
    kyc_id = r.json()["kyc_id"]
    # approve
    r2 = s.post(f"{API}/kyc/admin/{kyc_id}/decision?decision=approve&reviewer_id=admin_test")
    assert r2.status_code == 200, r2.text
    return kyc_id


def test_verified_carrier_flag(s):
    uid, _ = _register_user(s, "TEST Carrier")
    _submit_and_approve_kyc(s, uid, "carrier")
    r = s.get(f"{API}/phone/profile/{uid}")
    assert r.status_code == 200
    prof = r.json()
    assert prof.get("is_verified_carrier") is True, prof
    test_verified_carrier_flag.uid = uid


def test_verified_shop_flag(s):
    uid, _ = _register_user(s, "TEST Shop")
    _submit_and_approve_kyc(s, uid, "shop")
    r = s.get(f"{API}/phone/profile/{uid}")
    assert r.status_code == 200
    prof = r.json()
    assert prof.get("is_verified_shop") is True, prof
    test_verified_shop_flag.uid = uid


# ---------- Listings feed enrichment ----------
def test_feed_enriches_seller_verified(s):
    shop_uid = test_verified_shop_flag.uid
    # create a listing as this shop
    payload = {
        "title": "TEST Listing enrichment",
        "description": "test",
        "price_sar": 100,
        "city": "Riyadh",
        "category": "birds",
        "species": None,
        "family": None,
        "images": ["https://example.com/a.jpg"],
    }
    r = s.post(f"{API}/listings/create?user_id={shop_uid}", json=payload)
    assert r.status_code == 200, r.text
    # fetch feed
    r2 = s.get(f"{API}/listings/feed?limit=50")
    assert r2.status_code == 200
    items = r2.json()["items"]
    mine = [i for i in items if i.get("seller_id") == shop_uid]
    assert mine, f"listing not in feed: {items[:3]}"
    it = mine[0]
    assert it.get("seller_verified_shop") is True, it
    assert "seller_name" in it
    assert "seller_avatar" in it
