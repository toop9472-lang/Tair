# Iter29: features from Cursor branch (trips split/booking/motion/location, city filters,
# Gulf shelves, wholesale self-register + admin verify/hide, moderator scopes, clinic bot + notifications, share)
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "sky-321@hotmail.com"
ADMIN_PASS = "Talal12@"

_created = {"trips": [], "listings": [], "requests": [], "topics": [], "suppliers": [], "mods": []}


def _user(name):
    email = f"test_iter29_{name}_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "TestPass#2026x", "name": f"TEST_{name}"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    u = d.get("user") or {}
    tok = d.get("token") or d.get("access_token")
    return {"id": u.get("id") or u.get("user_id"), "email": email, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/signin", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    u = d.get("user") or {}
    return {"id": u.get("id") or u.get("user_id"), "email": ADMIN_EMAIL, "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def carrier():
    return _user("carrier")


@pytest.fixture(scope="module")
def rider():
    return _user("rider")


@pytest.fixture(scope="module")
def stranger():
    return _user("stranger")


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin):
    yield
    for t in _created["trips"]:
        requests.delete(f"{API}/trips/{t}", params={"user_id": ADMIN_EMAIL}, headers=admin["h"], timeout=30)
    for l in _created["listings"]:
        requests.delete(f"{API}/listings/{l}", params={"user_id": ADMIN_EMAIL}, headers=admin["h"], timeout=30)
    for t in _created["topics"]:
        requests.delete(f"{API}/clinic/topics/{t}", params={"user_id": ADMIN_EMAIL}, headers=admin["h"], timeout=30)
    for m in _created["mods"]:
        requests.delete(f"{API}/admin/moderators/{m}", headers=admin["h"], timeout=30)


def _trip(c, frm="الرياض", to="جدة", waypoints=None, cages=2):
    depart = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    r = requests.post(f"{API}/trips/create", params={"user_id": c["id"]}, headers=c["h"], json={
        "from_city": frm, "to_city": to, "waypoints": waypoints or [], "is_direct": not waypoints,
        "depart_at": depart, "vehicle_type": "سيدان", "has_ac": True, "total_cages": cages,
        "accepts_sensitive": False,
    }, timeout=30)
    assert r.status_code == 200, r.text
    tid = r.json()["trip_id"]
    _created["trips"].append(tid)
    return r.json()


# ---------- Trips: published routes ----------
class TestTrips:
    def test_create_requires_jwt(self, carrier):
        r = requests.post(f"{API}/trips/create", params={"user_id": carrier["id"]}, json={
            "from_city": "الرياض", "to_city": "جدة", "depart_at": datetime.now(timezone.utc).isoformat(),
            "total_cages": 1}, timeout=30)
        assert r.status_code in (401, 403)

    def test_booking_flow_motion_location_notifications(self, carrier, rider, stranger):
        t = _trip(carrier, "الرياض", "مكة المكرمة", ["القصيم"], cages=1)
        tid = t["trip_id"]
        assert t["available_cages"] == 1
        # carrier cannot book own trip
        r = requests.post(f"{API}/trips/{tid}/book", params={"user_id": carrier["id"]}, headers=carrier["h"], timeout=30)
        assert r.status_code == 400
        # impersonation blocked
        r = requests.post(f"{API}/trips/{tid}/book", params={"user_id": rider["id"]}, headers=stranger["h"], timeout=30)
        assert r.status_code == 403
        r = requests.post(f"{API}/trips/{tid}/book", params={"user_id": rider["id"]}, headers=rider["h"], timeout=30)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["available_cages"] == 0 and b["bookings_count"] == 1 and b["booking_id"]
        assert "bookings" not in b
        # full
        r = requests.post(f"{API}/trips/{tid}/book", params={"user_id": stranger["id"]}, headers=stranger["h"], timeout=30)
        assert r.status_code == 400
        # carrier notified
        n = requests.get(f"{API}/tair-notifications/list", params={"user_id": carrier["id"]}, timeout=30).json()
        assert any(i.get("type") == "trip_booking" and (i.get("data") or {}).get("trip_id") == tid for i in n["items"])
        # motion: moving from stop 0
        r = requests.patch(f"{API}/trips/{tid}/status", params={"user_id": carrier["id"]}, headers=carrier["h"],
                           json={"status": "departed"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["motion"] == "moving" and r.json()["stop_index"] == 0
        # stopped at waypoint
        r = requests.patch(f"{API}/trips/{tid}/status", params={"user_id": carrier["id"]}, headers=carrier["h"],
                           json={"status": "in_transit", "motion": "stopped", "stop_index": 1}, timeout=30)
        assert r.status_code == 200 and r.json()["stop_index"] == 1
        # location share
        r = requests.patch(f"{API}/trips/{tid}/location", params={"user_id": carrier["id"]}, headers=carrier["h"],
                           json={"lat": 24.7, "lng": 46.7}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["live_lat"] == 24.7 and r.json()["live_at"]
        r = requests.patch(f"{API}/trips/{tid}/location", params={"user_id": carrier["id"]}, headers=carrier["h"],
                           json={"lat": 200, "lng": 46.7}, timeout=30)
        assert r.status_code == 422
        assert "live_lng" not in requests.get(f"{API}/trips/{tid}", timeout=30).json()
        g = requests.get(f"{API}/trips/{tid}", headers=carrier["h"], timeout=30).json()
        assert g["live_lng"] == 46.7
        # arrived -> last stop
        r = requests.patch(f"{API}/trips/{tid}/status", params={"user_id": carrier["id"]}, headers=carrier["h"],
                           json={"status": "arrived"}, timeout=30)
        assert r.json()["motion"] == "arrived" and r.json()["stop_index"] == 2
        # rider notified about motion (3 events)
        n = requests.get(f"{API}/tair-notifications/list", params={"user_id": rider["email"]}, timeout=30).json()
        motion = [i for i in n["items"] if i.get("type") == "trip_motion" and (i.get("data") or {}).get("trip_id") == tid]
        assert len(motion) >= 3, n["items"][:5]
        # stranger not notified
        n2 = requests.get(f"{API}/tair-notifications/list", params={"user_id": stranger["id"]}, timeout=30).json()
        assert not any((i.get("data") or {}).get("trip_id") == tid and i.get("type") == "trip_motion" for i in n2["items"])
        # no booking on arrived trip
        r = requests.post(f"{API}/trips/{tid}/book", params={"user_id": stranger["id"]}, headers=stranger["h"], timeout=30)
        assert r.status_code == 400

    def test_status_update_requires_jwt(self, carrier):
        """Security: PATCH /trips/{id}/status must not be callable without the carrier's token."""
        t = _trip(carrier)
        r = requests.patch(f"{API}/trips/{t['trip_id']}/status", params={"user_id": carrier["id"]},
                           json={"status": "departed"}, timeout=30)
        assert r.status_code in (401, 403), f"unauthenticated status change allowed: {r.status_code}"

    def test_location_non_carrier_forbidden(self, carrier, stranger):
        t = _trip(carrier)
        r = requests.patch(f"{API}/trips/{t['trip_id']}/location", params={"user_id": stranger["id"]},
                           headers=stranger["h"], json={"lat": 1, "lng": 1}, timeout=30)
        assert r.status_code == 403

    def test_owner_cancel_notifies_bookers(self, carrier, rider):
        t = _trip(carrier, "الدمام", "الرياض")
        tid = t["trip_id"]
        assert requests.post(f"{API}/trips/{tid}/book", params={"user_id": rider["id"]}, headers=rider["h"], timeout=30).status_code == 200
        r = requests.delete(f"{API}/trips/{tid}", params={"user_id": carrier["id"]}, headers=carrier["h"], timeout=30)
        assert r.status_code == 200 and r.json()["mode"] == "soft"
        n = requests.get(f"{API}/tair-notifications/list", params={"user_id": rider["id"]}, timeout=30).json()
        assert any(i.get("type") == "trip_cancelled" and (i.get("data") or {}).get("trip_id") == tid for i in n["items"])

    def test_city_alias_filter(self, carrier):
        t = _trip(carrier, "الرياض", "مكة المكرمة")
        r = requests.get(f"{API}/trips/list", params={"to_city": "مكة", "status": "all", "limit": 100}, timeout=30).json()
        assert any(i["trip_id"] == t["trip_id"] for i in r["items"])

    def test_gulf_country_filter(self, carrier):
        t = _trip(carrier, "الرياض", "دبي")
        r = requests.get(f"{API}/trips/list", params={"to_city": "الإمارات العربية المتحدة", "status": "all", "limit": 100}, timeout=30).json()
        assert any(i["trip_id"] == t["trip_id"] for i in r["items"])


# ---------- Trip requests ----------
class TestTripRequests:
    def test_request_lifecycle(self, rider, carrier, stranger):
        day = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/trips/requests", params={"user_id": rider["id"]}, headers=rider["h"], json={
            "from_city": "جدة", "to_city": "الرياض", "depart_on": day, "details": "TEST_ قفص ببغاء",
            "contact_phone": "٠٥٥١٢٣٤٥٦٧"}, timeout=30)
        assert r.status_code == 200, r.text
        req = r.json()
        rid = req["request_id"]
        assert req["status"] == "pending" and req["contact_phone"] == "0551234567"
        board = requests.get(f"{API}/trips/requests", timeout=30).json()
        assert any(i["request_id"] == rid for i in board["items"])
        # validations
        bad = requests.post(f"{API}/trips/requests", params={"user_id": rider["id"]}, headers=rider["h"], json={
            "from_city": "جدة", "to_city": "جدة", "depart_on": day, "contact_phone": "0551234567"}, timeout=30)
        assert bad.status_code == 400
        # owner cannot accept own
        r = requests.patch(f"{API}/trips/requests/{rid}/status", params={"user_id": rider["id"]}, headers=rider["h"], json={"status": "accepted"}, timeout=30)
        assert r.status_code == 400
        r = requests.patch(f"{API}/trips/requests/{rid}/status", params={"user_id": carrier["id"]}, headers=carrier["h"], json={"status": "accepted"}, timeout=30)
        assert r.status_code == 200 and r.json()["accepted_by"] == carrier["id"]
        # stranger cannot progress
        r = requests.patch(f"{API}/trips/requests/{rid}/status", params={"user_id": stranger["id"]}, headers=stranger["h"], json={"status": "in_progress"}, timeout=30)
        assert r.status_code == 403
        for st in ("in_progress", "completed"):
            r = requests.patch(f"{API}/trips/requests/{rid}/status", params={"user_id": carrier["id"]}, headers=carrier["h"], json={"status": st}, timeout=30)
            assert r.status_code == 200 and r.json()["status"] == st
        mine = requests.get(f"{API}/trips/requests", params={"scope": "mine", "user_id": rider["id"]}, timeout=30).json()
        assert any(i["request_id"] == rid and i["status"] == "completed" for i in mine["items"])
        n = requests.get(f"{API}/tair-notifications/list", params={"user_id": rider["id"]}, timeout=30).json()
        assert sum(1 for i in n["items"] if i.get("type") == "trip_request") >= 3


# ---------- Listings city filter ----------
class TestListingsCity:
    def test_feed_country_and_alias(self, carrier):
        r = requests.post(f"{API}/listings/create", params={"user_id": carrier["id"]}, headers=carrier["h"], json={
            "title": "TEST_iter29 ببغاء", "description": "iter29 listing test desc", "category": "birds",
            "price_sar": 150.0, "city": "المنامة", "images": ["https://cdn.example.com/i.jpg"]}, timeout=30)
        assert r.status_code == 200, r.text
        lid = r.json()["listing_id"]
        _created["listings"].append(lid)
        f = requests.get(f"{API}/listings/feed", params={"city": "البحرين", "limit": 100}, timeout=30).json()
        items = f.get("items", f if isinstance(f, list) else [])
        assert any(i.get("listing_id") == lid for i in items)
        f2 = requests.get(f"{API}/listings/feed", params={"city": "قطر", "limit": 100}, timeout=30).json()
        assert not any(i.get("listing_id") == lid for i in f2.get("items", []))


# ---------- Species shelves ----------
class TestSpecies:
    def test_parrot_and_songbird_shelves(self):
        for fam in ("parrots", "songbirds"):
            r = requests.get(f"{API}/species/list", params={"family": fam}, timeout=30).json()
            assert r["total"] > 3, fam
        fams = requests.get(f"{API}/species/families", timeout=30).json()["items"]
        assert any(f.get("category") == "services" for f in fams)


# ---------- Wholesale ----------
class TestWholesale:
    def test_self_register_admin_verify_hide(self, stranger, admin, rider):
        body = {"name": "TEST_شركة توريد", "city": "الرياض", "categories": ["feed", "cages"],
                "description": "توريد أعلاف وأقفاص بالجملة", "whatsapp": "0551234567", "is_verified": True}
        r = requests.post(f"{API}/wholesale/suppliers", headers=stranger["h"], json=body, timeout=30)
        assert r.status_code == 200, r.text
        sup = r.json()
        sid = sup["supplier_id"]
        _created["suppliers"].append(sid)
        assert sup["is_verified"] is False and sup["whatsapp"] == "+966551234567"
        assert requests.post(f"{API}/wholesale/suppliers", headers=stranger["h"], json=body, timeout=30).status_code == 409
        mine = requests.get(f"{API}/wholesale/suppliers/mine", headers=stranger["h"], timeout=30).json()
        assert mine["supplier"]["supplier_id"] == sid
        # non-admin panel denied
        assert requests.get(f"{API}/wholesale/admin/panel", headers=rider["h"], timeout=30).status_code == 403
        p = requests.get(f"{API}/wholesale/admin/panel", headers=admin["h"], timeout=30)
        assert p.status_code == 200 and any(i["supplier_id"] == sid for i in p.json()["items"])
        r = requests.patch(f"{API}/wholesale/admin/panel/{sid}", headers=admin["h"], json={"is_verified": True}, timeout=30)
        assert r.status_code == 200 and r.json()["is_verified"] is True
        r = requests.patch(f"{API}/wholesale/admin/panel/{sid}", headers=admin["h"], json={"is_active": False}, timeout=30)
        assert r.status_code == 200
        pub = requests.get(f"{API}/wholesale/suppliers", params={"limit": 100}, timeout=30).json()
        assert not any(i["supplier_id"] == sid for i in pub["items"])
        assert requests.get(f"{API}/wholesale/suppliers/{sid}", timeout=30).status_code == 404

    def test_owner_cannot_unhide_after_admin_hides(self, stranger):
        """After admin hides the supplier, owner PATCH /mine should not re-publish it."""
        body = {"name": "TEST_شركة توريد", "city": "الرياض", "categories": ["feed"],
                "description": "توريد أعلاف بالجملة محدث", "whatsapp": "0551234567"}
        r = requests.patch(f"{API}/wholesale/suppliers/mine", headers=stranger["h"], json=body, timeout=30)
        assert r.status_code == 200
        assert r.json()["is_active"] is False, "owner re-activated a supplier hidden by admin"


# ---------- Moderators + clinic ----------
class TestModeratorsClinic:
    def test_scopes_and_clinic_bot_notifications(self, admin, rider, stranger, carrier):
        r = requests.post(f"{API}/admin/moderators/assign", headers=admin["h"], json={"user_id": rider["email"], "scopes": ["clinic"]}, timeout=30)
        assert r.status_code == 200, r.text
        _created["mods"].append(rider["email"])
        ms = requests.get(f"{API}/admin/moderators/my-scopes", headers=rider["h"], timeout=30).json()
        assert ms["is_admin"] is False and ms["scopes"] == ["clinic"]
        # clinic mod can't list moderators / can't assign
        assert requests.get(f"{API}/admin/moderators/list", headers=rider["h"], timeout=30).status_code == 403
        # clinic mod can't delete a trip (market tool)
        t = _trip(carrier)
        r = requests.delete(f"{API}/trips/{t['trip_id']}", params={"user_id": rider["id"]}, headers=rider["h"], timeout=30)
        assert r.status_code == 403
        assert requests.get(f"{API}/clinic/bot/status", timeout=30).json()["enabled"] is True
        # user creates topic -> bot reply + clinic mod notified
        r = requests.post(f"{API}/clinic/topics", params={"user_id": stranger["id"]}, json={
            "title": "TEST_ ببغاء خامل", "description": "الببغاء عنده خمول وقلة شهية وإسهال أخضر منذ يومين",
            "q_lethargy": "نعم", "q_appetite": "قليلة"}, timeout=60)
        assert r.status_code == 200, r.text
        tid = r.json()["topic_id"]
        _created["topics"].append(tid)
        reps = requests.get(f"{API}/clinic/topics/{tid}/replies", timeout=30).json()["items"]
        bot = [x for x in reps if x.get("is_bot")]
        assert bot and len(bot[0]["text"]) > 40
        n = requests.get(f"{API}/tair-notifications/list", params={"user_id": rider["id"]}, timeout=30).json()
        assert any(i.get("type") == "clinic_topic" and (i.get("data") or {}).get("topic_id") == tid for i in n["items"])
        # non-mod reply blocked, mod reply allowed + owner notified
        assert requests.post(f"{API}/clinic/topics/{tid}/replies", params={"user_id": carrier["id"]}, headers=carrier["h"], json={"text": "x"}, timeout=30).status_code == 403
        r = requests.post(f"{API}/clinic/topics/{tid}/replies", params={"user_id": rider["id"]}, headers=rider["h"], json={"text": "TEST_ اعزله ودفّه"}, timeout=30)
        assert r.status_code == 200 and r.json()["is_moderator"] is True
        rep_id = r.json()["reply_id"]
        n = requests.get(f"{API}/tair-notifications/list", params={"user_id": stranger["id"]}, timeout=30).json()
        assert any(i.get("type") == "clinic_reply" and (i.get("data") or {}).get("topic_id") == tid for i in n["items"])
        reps = requests.get(f"{API}/clinic/topics/{tid}/replies", timeout=30).json()["items"]
        assert any(x["reply_id"] == rep_id and x["is_moderator"] for x in reps)
        # mod deletes bot reply
        r = requests.delete(f"{API}/clinic/replies/{bot[0]['reply_id']}", params={"user_id": rider["id"]}, headers=rider["h"], timeout=30)
        assert r.status_code == 200
        assert requests.post(f"{API}/tair-notifications/read-all", params={"user_id": rider["email"]}, timeout=30).json()["success"]


# ---------- Share pages ----------
class TestShare:
    @pytest.mark.xfail(reason="share router mounted at /share (no /api prefix) -> public ingress serves React SPA, not backend HTML")
    def test_share_trip_and_listing(self, carrier):
        t = _trip(carrier)
        r = requests.get(f"{API}/share/trip/{t['trip_id']}", timeout=30)
        assert r.status_code == 200 and "طير" in r.text
        assert requests.get(f"{API}/share/listing/nope_x", timeout=30).status_code == 404
