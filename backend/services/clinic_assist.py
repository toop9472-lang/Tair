"""أدوات مساعد المشرف: ترتيب الحالات القريبة، وملخص للمراجعة، بلا جرعات ولا طرق زرع."""
import re

from services.clinic_bot import _expand, _is_urgent, _strip_unsafe, _tokens

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


_STOP = {
    "بعد", "مع", "في", "من", "على", "او", "أو", "ثم", "عند", "غير", "كان",
    "فيه", "فيها", "هذا", "هذه", "الطير", "الحيوان", "اليوم", "الان",
}


def case_blob(topic: dict) -> str:
    topic = topic or {}
    parts = [str(topic.get("title") or ""), str(topic.get("description") or "")]
    for key, _label in INTAKE + CHICK:
        value = str(topic.get(key) or "").strip()
        if value:
            parts.append(value)
    if topic.get("is_chick"):
        parts.append("فرخ")
    return _expand("\n".join(parts))


def case_tokens(topic: dict) -> list:
    tokens = [
        token for token in _tokens(case_blob(topic))
        if len(token) >= 3 and token not in _STOP
    ]
    tokens.sort(key=lambda word: (-len(word), word))
    return tokens[:24]


def safe_query_tokens(tokens) -> list:
    """يهرب رموز البحث حتى لا يكسر قوس أو نقطة استعلام قاعدة البيانات."""
    safe = []
    for token in tokens or []:
        word = str(token or "").strip()
        if len(word) < 3:
            continue
        safe.append(re.escape(word))
        if len(safe) == 8:
            break
    return safe


def overlap_score(case: set, other_text: str) -> int:
    other = {token for token in _tokens(_expand(other_text or "")) if len(token) >= 3 and token not in _STOP}
    if not case or not other:
        return 0
    shared = case & other
    if not shared:
        return 0
    return int(round(200 * len(shared) / (len(case) + len(other))))


def rank_items(tokens, items, text_of, limit=4, min_score=8) -> list:
    case = set(tokens or [])
    scored = []
    for item in items or []:
        score = overlap_score(case, text_of(item))
        if score >= min_score:
            scored.append((score, item))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    ranked = []
    for score, item in scored[:limit]:
        row = dict(item)
        row["score"] = score
        ranked.append(row)
    return ranked


def priority_level(topic: dict, has_mod_reply: bool = False) -> str:
    topic = topic or {}
    if _is_urgent(case_blob(topic)):
        return "review"
    images = topic.get("images") or []
    videos = topic.get("videos") or []
    if not has_mod_reply or (not images and not videos):
        return "watch"
    return "steady"


PRIORITY_LABEL = {
    "review": "راجعها قبل غيرها",
    "watch": "بانتظار المشرف",
    "steady": "فيها رد مشرف",
}


def compose_note(topic: dict, best_text: str = "") -> str:
    """ملاحظة ثابتة من وصف المربي وأقرب رد محفوظ. لا تضيف خطة علاج."""
    topic = topic or {}
    lines = ["ملاحظة للمراجعة قبل الإرسال:"]
    title = str(topic.get("title") or "").strip()
    if title:
        lines.append(f"الحالة: {title}")
    description = str(topic.get("description") or "").strip()
    if description:
        lines.append("وصف المربي: " + description[:220])
    missing = missing_labels(topic)
    if missing:
        lines.append("ينقص قبل الرأي: " + "، ".join(missing[:5]))
    clean_best = lesson_text(best_text or "")
    if clean_best:
        lines.append("أقرب رد مشرف محفوظ:")
        lines.append(clean_best[:500])
    lines.append("راجع الملاحظة ثم أرسلها إن وافقت عليها.")
    return lesson_text("\n".join(lines)) or "\n".join(lines)[:900]
