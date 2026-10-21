import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.notification_face import apply_face, notification_face  # noqa: E402


def test_faces_split_messages_clinic_trips_and_orders():
    assert notification_face("chat") == {"label": "رسالة", "channel": "messages"}
    assert notification_face("clinic_topic")["channel"] == "clinic"
    assert notification_face("clinic_reply")["label"] == "رد في العيادة"
    assert notification_face("trip_booking")["channel"] == "trips"
    assert notification_face("order_update")["channel"] == "orders"
    assert notification_face("community_chat")["label"] == "دردشة عامة"
    assert notification_face("")["channel"] == "general"
    assert "جرعة" not in notification_face("clinic_topic")["label"]


def test_old_rows_receive_a_label_and_a_saved_label_stays():
    old = {"type": "clinic_reply"}
    apply_face(old)
    assert old["label"] == "رد في العيادة"
    assert old["channel"] == "clinic"
    kept = {"type": "chat", "label": "محادثة خاصة", "channel": "messages"}
    apply_face(kept)
    assert kept["label"] == "محادثة خاصة"


def test_inboxes_show_the_kind_chip():
    root = Path(__file__).resolve().parents[2]
    mobile = (root / "mobile/src/screens/NotificationsScreen.js").read_text(encoding="utf-8")
    web = (root / "frontend/src/tair/NotificationsScreen.jsx").read_text(encoding="utf-8")
    for text in (mobile, web):
        assert "notif-kind" in text
        assert "رسالة" in text
        assert "اليوم" in text
