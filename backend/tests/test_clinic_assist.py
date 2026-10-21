import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.clinic_assist import case_alerts, lesson_text, missing_labels  # noqa: E402


def test_alerts_name_gaps_without_a_treatment():
    topic = {
        "title": "ببغاء خامل",
        "description": "ما ياكل",
        "q_lethargy": "نعم",
        "is_chick": False,
        "images": [],
        "videos": [],
    }
    alerts = case_alerts(topic, has_mod_reply=False)
    assert "بانتظار رد المشرف" in alerts
    assert "الحالة بلا صورة أو فيديو" in alerts
    assert any(line.startswith("أسئلة ناقصة") for line in alerts)
    joined = " ".join(alerts)
    assert "مليغرام" not in joined
    assert "جرعة" not in joined
    assert "بيئة استنبات" not in joined


def test_urgent_phrase_is_only_a_review_flag():
    alerts = case_alerts(
        {"title": "نفوق جماعي في القفص", "description": "اليوم", "images": ["a.jpg"], "q_lethargy": "نعم",
         "q_appetite": "لا", "q_onset": "اليوم", "q_diet": "حب", "q_gender": "ذكر", "q_breeding": "لا",
         "q_medications": "لا", "q_seen_vet": "لا", "q_age": "سنة", "q_time_with_owner": "شهر",
         "q_tame": "نعم", "q_vomits": "لا", "q_mouth_droppings": "لا"},
        has_mod_reply=True,
    )
    assert alerts == ["علامات تستحق المراجعة قبل بقية الحالات"]


def test_lesson_keeps_moderator_words_and_drops_doses():
    kept = lesson_text("الطير خامل من يومين والشهية ناقصة. راقب الأكل والماء وانتظر صورة الفضلات.")
    assert "راقب الأكل" in kept
    dropped = lesson_text("أعطِ ٥ مليغرام مرتين. جرعة يومية.")
    assert dropped == ""
    assert lesson_text("https://example.com/file.pdf") == ""


def test_chick_questions_join_the_gaps():
    labels = missing_labels({"is_chick": True, "q_lethargy": "نعم"})
    assert "عمر الفرخ" in labels
    assert "خمول" not in labels
