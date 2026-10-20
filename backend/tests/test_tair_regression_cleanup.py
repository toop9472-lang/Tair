# Tair regression after Saqr cleanup + new features (broadcast, app-update, clinic bot toggle, reply delete)
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "sky-321@hotmail.com"
ADMIN_PASS = "Talal12@"
ADMIN_ID = "admin_e014ed8981b8"
ADMIN_USERS_ID = "user_93fd2a08e40e"


@pytest.fixture(scope="session")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/signin", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def ah(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def normal_user(s):
    email = f"test_tair_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass#2026x", "name": "TEST_User"})
    if r.status_code not in (200, 201):
        pytest.skip(f"register failed {r.status_code} {r.text[:200]}")
    d = r.json()
    u = d.get("user") or {}
    return {"token": d.get("token") or d.get("access_token"), "id": u.get("id") or u.get("user_id"), "email": email}


# ---------- Auth ----------
class TestAuth:
    def test_signin_and_me(self, s, ah):
        r = s.get(f"{API}/auth/me", headers=ah)
        assert r.status_code == 200, r.text
        assert ADMIN_EMAIL in r.text

    def test_signin_bad(self, s):
        r = s.post(f"{API}/auth/signin", json={"email": ADMIN_EMAIL, "password": "wrong-pass-x"})
        assert r.status_code in (400, 401)


# ---------- Regression GET endpoints ----------
GETS = [
    "/listings/feed", "/trips/list", "/auctions/list", "/community/stories/list",
    "/community/chat", "/forum/categories", "/forum/feed", "/clinic/topics", "/clinic/library",
    "/species/list", "/species/families", "/wholesale/suppliers", "/wholesale/categories",
    "/clinic/bot/status", "/app/latest-update", "/auctions/window-status", "/auctions/settings",
]


@pytest.mark.parametrize("path", GETS)
def test_public_get(s, path):
    r = s.get(f"{API}{path}")
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"


ADMIN_GETS = [
    "/admin/stats/full", "/admin/moderators/list", "/admin/verification/list",
    "/admin/users/list", "/admin/users/stats/overview",
]


@pytest.mark.parametrize("path", ADMIN_GETS)
def test_admin_get(s, ah, path):
    r = s.get(f"{API}{path}", headers=ah, params={"user_id": ADMIN_EMAIL})
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"


USER_GETS = [
    ("/chat/threads", {}), ("/chat/unread-count", {}), ("/tair-notifications/list", {}),
    ("/auctions/pending", {}), ("/admin/moderators/my-scopes", {}), ("/tair-reports/list", {}),
    ("/storefront/settings", {}), ("/storefront/analytics", {}), ("/ratings/user/" + ADMIN_USERS_ID, {}),
    ("/ratings/seller/" + ADMIN_USERS_ID + "/summary", {}), ("/sellers/" + ADMIN_USERS_ID, {}),
    ("/sellers/" + ADMIN_USERS_ID + "/listings", {}), ("/listings/seller/" + ADMIN_USERS_ID, {}),
    ("/listings/favorites/me", {}),
]


@pytest.mark.parametrize("path,params", USER_GETS)
def test_user_scoped_get(s, ah, path, params):
    p = {"user_id": ADMIN_USERS_ID, **params}
    r = s.get(f"{API}{path}", headers=ah, params=p)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"


REMOVED = ["/games/leaderboard", "/diamonds/packages", "/gifts/list", "/challenges/list",
           "/leaderboards/global", "/referrals/me", "/withdrawal-methods/list", "/invitations/list"]


@pytest.mark.parametrize("path", REMOVED)
def test_removed_404(s, path):
    r = s.get(f"{API}{path}")
    assert r.status_code in (404, 405), f"{path} -> {r.status_code}"


# ---------- Listings CRUD + share ----------
class TestListings:
    def test_create_get_share_delete(self, s, ah):
        r = s.post(f"{API}/listings/create", headers=ah, params={"user_id": ADMIN_USERS_ID}, json={
            "title": "TEST_Listing", "description": "TEST desc for listing", "city": "الرياض", "price_sar": 100})
        assert r.status_code == 200, r.text
        lid = r.json()["listing_id"]
        g = s.get(f"{API}/listings/{lid}")
        assert g.status_code == 200 and g.json()["title"] == "TEST_Listing"
        # NOTE: /share/* is mounted at root (no /api) -> on preview ingress it's served by React; verified on :8001 manually
        d = s.delete(f"{API}/listings/{lid}", headers=ah, params={"user_id": ADMIN_EMAIL})
        assert d.status_code == 200, d.text


# ---------- Community chat / forum / chat threads ----------
class TestSocial:
    def test_community_chat_send_delete(self, s, ah):
        r = s.post(f"{API}/community/chat", params={"user_id": ADMIN_USERS_ID}, headers=ah, json={"text": "TEST_msg hello"})
        assert r.status_code == 200, r.text
        mid = r.json().get("msg_id") or (r.json().get("message") or {}).get("msg_id")
        if mid:
            s.delete(f"{API}/community/chat/{mid}", params={"user_id": ADMIN_EMAIL}, headers=ah)

    def test_chat_start_and_messages(self, s, ah, normal_user):
        r = s.post(f"{API}/chat/start", headers=ah, params={"user_id": ADMIN_USERS_ID},
                   json={"peer_id": normal_user["id"], "initial_message": "TEST_hi"})
        assert r.status_code == 200, r.text
        tid = r.json()["thread_id"]
        m = s.get(f"{API}/chat/thread/{tid}/messages", headers=ah, params={"user_id": ADMIN_USERS_ID})
        assert m.status_code == 200, m.text

    def test_mobile_push_register(self, s, normal_user):
        r = s.post(f"{API}/mobile/push/register", json={"user_id": normal_user["id"],
                   "token": "ExponentPushToken[TEST_fake_token]", "platform": "ios"})
        assert r.status_code == 200, r.text


# ---------- Broadcast ----------
class TestBroadcast:
    def test_broadcast_all_admin_sees_it(self, s, ah):
        title = f"TEST_bcast_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/admin/broadcast", headers=ah, json={"title": title, "body": "TEST body", "audience": "all"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True and "recipients" in d and "push_devices" in d
        assert d["recipients"] > 0
        for uid in (ADMIN_ID, ADMIN_USERS_ID, ADMIN_EMAIL):
            lst = s.get(f"{API}/tair-notifications/list", params={"user_id": uid}).json()
            assert any(i.get("title") == title for i in lst["items"]), f"not visible for {uid}"
        ra = s.post(f"{API}/tair-notifications/read-all", params={"user_id": ADMIN_ID})
        assert ra.status_code == 200 and ra.json()["success"]
        lst = s.get(f"{API}/tair-notifications/list", params={"user_id": ADMIN_ID}).json()
        assert lst["unread_count"] == 0

    def test_broadcast_sellers_only(self, s, ah):
        r = s.post(f"{API}/admin/broadcast", headers=ah, json={"title": "TEST_sellers", "body": "x", "audience": "sellers"})
        assert r.status_code == 200
        # DB currently has 0 sellers (role=seller) -> recipients should be 0 (admin is super_admin)
        lst = s.get(f"{API}/tair-notifications/list", params={"user_id": ADMIN_ID}).json()
        assert not any(i.get("title") == "TEST_sellers" for i in lst["items"])

    def test_broadcast_non_admin(self, s, normal_user):
        r = s.post(f"{API}/admin/broadcast", headers={"Authorization": f"Bearer {normal_user['token']}"},
                   json={"title": "TEST_x", "body": "x"})
        assert r.status_code == 403
        r2 = s.post(f"{API}/admin/broadcast", json={"title": "TEST_x", "body": "x"})
        assert r2.status_code in (401, 403)


# ---------- App update ----------
class TestAppUpdate:
    def test_publish_and_latest(self, s, ah):
        r = s.post(f"{API}/admin/app-update", headers=ah, json={"version": "TEST_9.9.9", "notes": "TEST notes", "store_url": "https://x"})
        assert r.status_code == 200, r.text
        uid = r.json()["update_id"]
        g = s.get(f"{API}/app/latest-update").json()
        assert g["update_id"] == uid and g["version"] == "TEST_9.9.9" and g["notes"] == "TEST notes"
        assert "_id" not in g

    def test_non_admin_rejected(self, s, normal_user):
        r = s.post(f"{API}/admin/app-update", headers={"Authorization": f"Bearer {normal_user['token']}"},
                   json={"version": "1", "notes": "x"})
        assert r.status_code == 403


# ---------- Clinic bot toggle + reply delete ----------
def _topic(s, uid, title):
    r = s.post(f"{API}/clinic/topics", params={"user_id": uid},
               json={"title": title, "description": "TEST bird sneezing and lethargy for days"})
    assert r.status_code == 200, r.text
    return r.json()["topic_id"]


class TestClinic:
    def test_bot_toggle_flow(self, s, ah, normal_user):
        uid = normal_user["id"]
        try:
            r = s.post(f"{API}/clinic/bot/toggle", params={"enabled": "false", "user_id": ADMIN_EMAIL}, headers=ah)
            assert r.status_code == 200 and r.json()["enabled"] is False
            assert s.get(f"{API}/clinic/bot/status").json()["enabled"] is False
            t1 = _topic(s, uid, "TEST_topic_nobot")
            reps = s.get(f"{API}/clinic/topics/{t1}/replies").json()["items"]
            assert not any(x["user_id"] == "clinic_bot" for x in reps)
            r = s.post(f"{API}/clinic/bot/toggle", params={"enabled": "true", "user_id": ADMIN_EMAIL}, headers=ah)
            assert r.status_code == 200 and r.json()["enabled"] is True
            t2 = _topic(s, uid, "TEST_topic_bot")
            reps = s.get(f"{API}/clinic/topics/{t2}/replies").json()["items"]
            assert any(x["user_id"] == "clinic_bot" for x in reps)
            assert s.get(f"{API}/clinic/topics/{t2}").json()["replies_count"] >= 1
        finally:
            s.post(f"{API}/clinic/bot/toggle", params={"enabled": "true", "user_id": ADMIN_EMAIL}, headers=ah)
            for t in locals().get("t1"), locals().get("t2"):
                if t:
                    s.delete(f"{API}/clinic/topics/{t}", params={"user_id": ADMIN_EMAIL}, headers=ah)

    def test_bot_toggle_non_mod(self, s, normal_user):
        nh = {"Authorization": f"Bearer {normal_user['token']}"}
        r = s.post(f"{API}/clinic/bot/toggle", params={"enabled": "false", "user_id": normal_user["id"]}, headers=nh)
        assert r.status_code == 403
        assert s.get(f"{API}/clinic/bot/status").json()["enabled"] is True

    def test_delete_reply(self, s, ah, normal_user):
        tid = _topic(s, normal_user["id"], "TEST_topic_del")
        try:
            r = s.post(f"{API}/clinic/topics/{tid}/replies", params={"user_id": ADMIN_EMAIL}, headers=ah, json={"text": "TEST reply"})
            assert r.status_code == 200, r.text
            rid = r.json()["reply_id"]
            before = s.get(f"{API}/clinic/topics/{tid}").json()["replies_count"]
            # random user forbidden
            f = s.delete(f"{API}/clinic/replies/{rid}", params={"user_id": f"rand_{uuid.uuid4().hex[:6]}"}, headers={"Authorization": f"Bearer {normal_user['token']}"})
            assert f.status_code == 403
            d = s.delete(f"{API}/clinic/replies/{rid}", params={"user_id": ADMIN_ID}, headers=ah)
            assert d.status_code == 200
            after = s.get(f"{API}/clinic/topics/{tid}").json()["replies_count"]
            assert after == before - 1
            reps = s.get(f"{API}/clinic/topics/{tid}/replies").json()["items"]
            assert not any(x["reply_id"] == rid for x in reps)
            assert s.delete(f"{API}/clinic/replies/{rid}", params={"user_id": ADMIN_ID}, headers=ah).status_code == 404
        finally:
            s.delete(f"{API}/clinic/topics/{tid}", params={"user_id": ADMIN_EMAIL}, headers=ah)
