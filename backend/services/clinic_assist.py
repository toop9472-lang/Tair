"""أدوات مساعد المشرف: تنبيهات الحالة، وتعلّم ردود المشرفين بلا جرعات ولا طرق زرع."""
from services.clinic_bot import _is_urgent, _strip_unsafe

INTAKE = (
    ("q_lethargy", "خمول"),
    ("q_appetite", "الشهية"),
    ("q_onset", "بداية الأعراض"),
    ("q_diet", "التغذية"),
    ("q_gender", "ذكر أو أنثى"),
    ("q_breeding", "حضن أو تزاوج"),
    ("q_medications", "أدوية أخيرة"),
    ("q_seen_vet", "عُرضت من قبل"),
    ("q_age", "عمر الطير"),
    ("q_time_with_owner", "منذ متى عندك"),
    ("q_tame", "أليف"),
    ("q_vomits", "استفراغ"),
    ("q_mouth_droppings", "فم أو رائحة براز"),
)

CHICK = (
    ("chick_serelac_brand", "شركة السريلاك"),
    ("chick_exact_age", "عمر الفرخ"),
    ("chick_serelac_temp", "حرارة السريلاك"),
    ("chick_feeding_count", "مرات الغر والكمية"),
    ("chick_feeding_method", "طريقة التأكيل"),
    ("chick_serelac_leftover", "بواقي السريلاك"),
)


def _filled(topic: dict, key: str) -> bool:
    return bool(str((topic or {}).get(key) or "").strip())


def missing_labels(topic: dict) -> list:
    topic = topic or {}
    missing = [label for key, label in INTAKE if not _filled(topic, key)]
    if topic.get("is_chick"):
        missing.extend(label for key, label in CHICK if not _filled(topic, key))
    return missing


def case_alerts(topic: dict, has_mod_reply: bool = False) -> list:
    topic = topic or {}
    alerts = []
    if not has_mod_reply:
        alerts.append("بانتظار رد المشرف")
    images = topic.get("images") or []
    videos = topic.get("videos") or []
    if not images and not videos:
        alerts.append("الحالة بلا صورة أو فيديو")
    missing = missing_labels(topic)
    if missing:
        alerts.append("أسئلة ناقصة: " + "، ".join(missing[:6]))
    blob = " ".join(
        str(topic.get(key) or "")
        for key in ("title", "description", "q_lethargy", "q_appetite", "q_mouth_droppings", "q_vomits")
    )
    if _is_urgent(blob):
        alerts.append("علامات تستحق المراجعة قبل بقية الحالات")
    return alerts


def lesson_text(raw: str) -> str:
    """يُحفظ رد المشرف بعد حذف سطور الجرعات والزرع. الروابط وحدها لا تُعلّم."""
    text = _strip_unsafe(raw or "")
    if len(text) < 12:
        return ""
    without_links = text.replace("http://", "").replace("https://", "")
    if "http" in text.lower() and len(without_links.strip()) < 24:
        return ""
    return text[:900]
