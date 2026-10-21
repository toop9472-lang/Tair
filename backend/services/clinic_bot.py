"""
Clinic Bot — بوت العيادة البيطرية الذكي
- يستخدم مكتبة tayr-vet-master (بطاقات عربية تعليمية)
- يطابق الأعراض والأسماء ⇒ يقترح تشخيصاً مبدئياً
- بلا جرعات وبلا طرق زرع، ويختم بانتظار مشرف العيادة
"""
import os
import json
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_KB_PATH = Path(__file__).resolve().parent.parent / "data" / "clinic_kb.json"
_KB = None


def load_kb():
    """Load the clinic knowledge base once into memory."""
    global _KB
    if _KB is None:
        try:
            with open(_KB_PATH, "r", encoding="utf-8") as f:
                _KB = json.load(f)
            logger.info("Clinic KB loaded: %d entries (v%s)", len(_KB.get("entries", [])), _KB.get("version"))
        except Exception as e:
            logger.exception("Failed to load clinic KB: %s", e)
            _KB = {"entries": [], "folk_remedies": [], "folk_forbidden": []}
    return _KB


# --- Arabic normalization ---
_AR_DIAC = re.compile(r"[\u064B-\u0652\u0670]")

def _norm(s: str) -> str:
    if not s:
        return ""
    s = _AR_DIAC.sub("", s.lower())
    # unify alef variations and tah-marbutah
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي").replace("ة", "ه")
    return s


def _bare(word: str) -> str:
    word = _norm(word)
    if word.startswith("ال") and len(word) > 4:
        return word[2:]
    return word


def _tokens(text: str):
    text = _norm(text or "")
    return set(re.findall(r"[\u0600-\u06ffA-Za-z0-9]+", text))


# لهجة المربّي → ألفاظ البطاقات. الكلمات القصيرة جداً مستبعدة حتى لا يخطئ التطابق.
_SYNONYMS = [
    ("كاسكو", "ببغاء"),
    ("كوكاتو", "ببغاء"),
    ("مكاو", "ببغاء"),
    ("درة", "ببغاء"),
    ("روزيلا", "ببغاء"),
    ("كروان", "كوكتيل"),
    ("يصرخ", "صراخ متكرر إزعاج"),
    ("صراخ", "صراخ متكرر إزعاج"),
    ("ازعاج", "صراخ إزعاج"),
    ("إزعاج", "صراخ إزعاج"),
    ("ينتف ريشه", "نتف الريش جلد عاري"),
    ("ينتف", "نتف الريش"),
    ("ما يبيض", "لا يبيض تأخر الإنتاج"),
    ("ما تبيض", "لا تبيض صعوبة إنتاج بيضة عالقة"),
    ("ما ينتج", "عدم الإنتاج تأخر الإنتاج"),
    ("بيضة عالقة", "احتباس البيضة صعوبة إنتاج"),
    ("ينزف", "نزيف ريشة دم"),
    ("نقاط بيضاء", "نقاط بيضاء بالفم"),
    ("نقاط صفراء", "نقاط صفراء بالفم"),
    ("سريلاك", "سريلاك حوصلة بواقي"),
    ("بواقي سريلاك", "حوصلة ممتلئة سريلاك"),
    ("فرخ", "فراخ"),
    ("شاهين", "صقر"),
    ("وكري", "صقر"),
    ("زاجل", "حمام"),
    ("ضأن", "غنم"),
    ("خروف", "غنم"),
    ("حوار", "إبل"),
    ("ناقة", "إبل"),
    ("جمل", "إبل"),
    ("هجن", "إبل"),
    ("حصان", "خيل"),
    ("فرس", "خيل"),
    ("يسعال", "سعال"),
    ("فروج", "دجاج لاحم"),
    ("دجاجة", "دجاج"),
    ("لويحة صفراء", "لويحة صفراء في الفم"),
    ("فروونس", "تريكوموناس قلاع"),
    ("قلاع", "تريكوموناس"),
    ("شوطة", "نيوكاسل"),
    ("طاعون كاذب", "نيوكاسل"),
    ("ذرق اخضر", "إسهال أخضر"),
    ("ذرق أخضر", "إسهال أخضر"),
    ("رقبة ملفوفة", "التواء رقبة"),
    ("يدوخ", "التواء رقبة"),
    ("نفسه ثقيل", "صعوبة تنفس"),
    ("يفتح منقاره", "صعوبة تنفس"),
    ("يفتح فمه", "صعوبة تنفس"),
    ("ريش يتساقط", "تساقط ريش"),
    ("ما ياكل", "لا أكل"),
    ("ما يأكل", "لا أكل"),
    ("ضربة شمس", "ضربة الحر"),
    ("يلهث", "ضربة الحر"),
    ("بامل فوت", "التهاب باطن القدم"),
    ("باراتيفايد", "سالمونيلا"),
    ("رعام", "الرعام"),
    ("سعار", "السعار"),
    ("نفاخ", "النفاخ"),
    ("انقطع الحليب", "انقطاع الحليب"),
    ("يسعل", "سعال"),
    ("تسعل", "سعال"),
    ("يعطس", "عطاس"),
    ("تعطس", "عطاس"),
    ("يعرج", "عرج"),
    ("تنفق", "نفوق"),
    ("نافق", "نفوق"),
    ("حضنة طباشير", "تعفن الحضنة الطباشيري"),
    ("فاروا", "الفاروا"),
]

# كلمات عامة لا تكفي وحدها لتطابق عَرَض مركّب مثل «صعوبة بلع».
_SIGN_STOP = {
    _norm(w) for w in
    "بعد مع في من على أو ثم عند غير كان فيه فيها هذا هذه مرض الطير الحيوان".split()
}

_URGENT_PHRASES = [
    "صعوبة تنفس", "نفسه ثقيل", "ما يقدر يتنفس", "نفوق جماعي", "نفوق مفاجئ",
    "تشنج", "لا يتبول", "مغص شديد", "ضربة شمس", "ضربة الحر", "سيلان لعاب",
    "ينزف", "نزيف", "بيضة عالقة", "ما تقدر تبيض", "حوصلة ما تفضى",
]

_UNSAFE_LINE = re.compile(
    r"(مليغرام|ملغم|\bmg\b|جرعة|زرع|عزل الفيروس|عزل البكتير|إكثار|بيئة استنبات|حقن البيض)",
    re.I,
)


def _expand(text: str) -> str:
    base = text or ""
    norm = _norm(base)
    extras = [dst for src, dst in _SYNONYMS if _norm(src) in norm]
    if not extras:
        return base
    return base + "\n" + " ".join(extras)


def _is_urgent(text: str) -> bool:
    norm = _norm(text or "")
    return any(_norm(p) in norm for p in _URGENT_PHRASES)


def _has_term(text: str, word: str) -> bool:
    """الكلمة أو الكلمة مع ضمير متصل: بطن داخل بطنه."""
    if not word:
        return False
    if word in text:
        return True
    return any(word + suf in text for suf in ("ه", "ها", "هم", "هن", "ك"))


def _has_phrase(text: str, phrase: str) -> bool:
    phrase = _norm(phrase)
    if not phrase or len(phrase) < 3:
        return False
    if phrase in text:
        return True
    words = [w for w in phrase.split() if len(w) >= 3 and w not in _SIGN_STOP]
    return len(words) >= 2 and all(_has_term(text, w) for w in words)


def match_entries(text: str, species_hint: Optional[str] = None, top_n: int = 3):
    """Score entries against user text — returns top N matches with score."""
    kb = load_kb()
    text = _expand(text)
    user_tokens = _tokens(text)
    user_text_norm = _norm(text or "")
    if not user_tokens:
        return []

    # العائلة الأب فقط. الأخوة لا تتطابق: غنم لا يفتح بطاقة بقر، وبادجي لا يفتح بطاقة صقر.
    _FAMILY = {
        "دجاج": "دواجن", "لاحم": "دواجن", "حمام": "طيور", "ببغاء": "طيور",
        "صقر": "طيور", "بادجي": "طيور", "كناري": "طيور", "كوكتيل": "طيور",
        "غنم": "مجترات", "ماعز": "مجترات", "بقر": "مجترات", "إبل": "مجترات",
        "خيل": "خيل", "كلب": "كلاب", "قط": "قطط", "سمك": "سمك", "نحل": "نحل",
    }

    def _parts(label: str):
        bare = _bare(label)
        parts = set()
        if len(bare) >= 3:
            parts.add(bare)
        for w in bare.split():
            bw = _bare(w)
            if len(bw) >= 3:
                parts.add(bw)
        return parts

    known_species = set()
    for ent in kb.get("entries", []):
        for sp in ent.get("species") or []:
            known_species.add(_bare(sp))
    user_bares = {_bare(w) for w in user_text_norm.split()}
    mentioned = {sp for sp in known_species if len(sp) >= 3 and sp in user_bares}

    def _species_ok(entry_species):
        if not mentioned or not entry_species:
            return True
        entry_parts = set()
        for sp in entry_species:
            entry_parts |= _parts(sp)
        if entry_parts & mentioned:
            return True
        for sp in mentioned:
            fam = _FAMILY.get(sp)
            if fam and fam in entry_parts:
                return True
        for sp in entry_parts:
            fam = _FAMILY.get(sp)
            if fam and fam in mentioned:
                return True
        return False

    results = []
    for e in kb.get("entries", []):
        score = 0
        signs_matched = 0
        name_hit = False

        # Match disease names (ar/local/en) — substring أو كل كلمات الاسم المميزة
        for key in ("name_ar", "name_local", "name_en", "name_scientific"):
            val = _norm(e.get(key, ""))
            if not val or len(val) < 3 or val == "—":
                continue
            if val in user_text_norm:
                score += 30  # ذكر الاسم صراحة يتقدم على عرض مشترك
                name_hit = True
                continue
            parts = [_bare(w) for w in val.split() if len(_bare(w)) >= 3 and _bare(w) not in _SIGN_STOP]
            if len(parts) >= 2 and all(w in user_bares for w in parts):
                score += 22
                name_hit = True

        # Match keywords — العبارة أو كلماتها مع ضمير متصل
        seen_kw = set()
        for kw in e.get("keywords", []):
            kw_norm = _norm(kw)
            if not kw_norm or len(kw_norm) < 3 or kw_norm in seen_kw:
                continue
            if _has_phrase(user_text_norm, kw_norm):
                seen_kw.add(kw_norm)
                score += 4

        # Match clinical signs — كل كلمة مميزة يجب أن تظهر، بلا تكرار
        seen_signs = set()
        for sign in e.get("signs", []) or []:
            sign_norm = _norm(sign)
            if not sign_norm or sign_norm in seen_signs:
                continue
            seen_signs.add(sign_norm)
            sign_words = [w for w in sign_norm.split() if len(w) >= 3 and w not in _SIGN_STOP]
            if sign_words and all(_has_term(user_text_norm, w) for w in sign_words):
                score += 6
                signs_matched += 1

        # Multi-sign bonus — the more signs match, the higher confidence
        if signs_matched >= 2:
            score += signs_matched * 4
        if signs_matched >= 3:
            score += 10

        # النوع مذكور في كلام المربّي
        for sp in e.get("species", []) or []:
            sp_norm = _norm(sp)
            if sp_norm and len(sp_norm) >= 3 and sp_norm in user_text_norm:
                score += 6
                break

        if mentioned and not name_hit and not _species_ok(e.get("species") or []):
            score = 0

        # Species hint boost
        if species_hint:
            sp_text = _norm(species_hint)
            for sp in e.get("species", []) or []:
                sp_norm = _norm(sp)
                if sp_norm and (sp_norm in sp_text or sp_text in sp_norm):
                    score += 4
                    break

        if score > 0:
            results.append((score, e))

    results.sort(key=lambda x: x[0], reverse=True)
    results = [r for r in results if r[0] >= 12]
    return results[:top_n]


async def ai_reconsider(user_text: str, top_matches: list, species_hint: Optional[str] = None):
    """
    Use Gemini to re-rank candidates when KB confidence is low.
    Returns the best entry_id or None if the model considers it unknown.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key or not top_matches:
            return None
        candidates_text = "\n".join(
            f"- {i+1}. entry_id={e.get('entry_id')} | {e.get('name_ar')} ({e.get('name_en','')}) "
            f"| signs: {', '.join(e.get('signs', [])[:4])}"
            for i, (_, e) in enumerate(top_matches)
        )
        prompt = (
            f"حالة بيطرية من المستخدم:\n'{user_text}'\n\n"
            f"نوع الحيوان: {species_hint or 'غير محدد'}\n\n"
            f"المرشحات من قاعدة البيانات:\n{candidates_text}\n\n"
            "أي واحدة أقرب للوصف؟ أعد entry_id فقط كاستجابة سطر واحد (بدون أي شرح). "
            "إذا لم يوجد تطابق جيد، أعد كلمة UNKNOWN فقط."
        )
        chat = LlmChat(
            api_key=api_key,
            session_id="clinic_bot_rerank",
            system_message="أنت مصنف أمراض بيطرية. أجب entry_id واحد فقط أو UNKNOWN.",
        ).with_model("gemini", "gemini-3-flash-preview")
        resp = await chat.send_message(UserMessage(text=prompt))
        pick = (resp or "").strip().split()[0].upper() if resp else ""
        if pick == "UNKNOWN" or not pick:
            return None
        return pick.lower()
    except Exception as e:
        logger.warning("AI reconsider failed: %s", e)
        return None


def _strip_unsafe(text: str) -> str:
    kept = []
    for line in (text or "").splitlines():
        if _UNSAFE_LINE.search(line):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


async def _polish_reply(user_text: str, entry: dict, draft: str) -> Optional[str]:
    """Rewrite the draft in clear Arabic. The model may not add doses or lab methods."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key or not draft:
            return None
        facts = {
            "name_ar": entry.get("name_ar"),
            "name_local": entry.get("name_local"),
            "name_en": entry.get("name_en"),
            "name_scientific": entry.get("name_scientific"),
            "species": entry.get("species"),
            "category": entry.get("category"),
            "definition": entry.get("definition"),
            "signs": entry.get("signs"),
            "what_to_do": entry.get("what_to_do"),
            "treatment": entry.get("treatment"),
            "reportable_sa": bool(entry.get("reportable_sa")),
        }
        prompt = (
            "أعد صياغة المسودة بالعربية الواضحة لمربي في السعودية.\n"
            "لا تضف حقيقة غير موجودة في البطاقة.\n"
            "ممنوع: أي جرعة، أي مليغرام، أي اسم دواء بتركيز، أي شرح لزرع أو عزل أو إكثار الممرض.\n"
            "التشخيص مبدئي فقط. إذا كانت البطاقة مبلّغاً عنها فابدأ بسطر إبلاغ وقاء.\n"
            "اختم بجملة: انتظر تأكيد مشرف العيادة قبل أي علاج.\n"
            "الطول بين 90 و 160 كلمة.\n\n"
            f"وصف المربي:\n{user_text}\n\n"
            f"البطاقة:\n{json.dumps(facts, ensure_ascii=False)}\n\n"
            f"المسودة:\n{draft}"
        )
        chat = LlmChat(
            api_key=api_key,
            session_id="clinic_bot_polish",
            system_message=(
                "أنت بوت عيادة طير. تلخّص بطاقة بيطرية تعليمية بالعربية. "
                "لا تعطِ جرعات ولا طرقاً مخبرية، ولا تجزم بالتشخيص."
            ),
        ).with_model("gemini", "gemini-3-flash-preview")
        resp = _strip_unsafe((await chat.send_message(UserMessage(text=prompt))) or "")
        if len(resp) < 40:
            return None
        if "مشرف" not in resp:
            resp += "\n\n⚠️ انتظر تأكيد مشرف العيادة قبل تنفيذ أي خطوة علاجية."
        return "🤖 بوت العيادة\n" + resp
    except Exception as e:
        logger.warning("Clinic polish failed: %s", e)
        return None


async def build_reply_async(user_text: str, species_hint: Optional[str] = None) -> dict:
    """
    Async version — uses Gemini to re-rank when KB confidence is low.
    """
    kb = load_kb()
    matches = match_entries(user_text, species_hint=species_hint, top_n=5)

    # If top score is weak OR top two scores are very close, ask Gemini to decide
    if matches:
        top_score = matches[0][0]
        close_second = len(matches) > 1 and matches[1][0] >= top_score * 0.85
        if top_score < 20 or close_second:
            picked_id = await ai_reconsider(user_text, matches, species_hint)
            if picked_id:
                # Reorder — move picked to top
                reordered = [m for m in matches if m[1].get("entry_id") == picked_id]
                others = [m for m in matches if m[1].get("entry_id") != picked_id]
                if reordered:
                    matches = reordered + others
            elif picked_id is None and top_score < 15:
                # Model rejected ⇒ treat as unknown
                matches = []

    rendered = _render_from_matches(user_text, matches, kb)
    if rendered.get("matched") and matches:
        polished = await _polish_reply(user_text, matches[0][1], rendered["reply"])
        if polished:
            rendered["reply"] = polished
            rendered["polished"] = True
    return rendered


def _render_from_matches(user_text: str, matches: list, kb: dict) -> dict:
    unknown_fallback = kb.get("unknown_fallback_ar") or (
        "ما قدرت أجزم من الوصف. حوّل حالتك للمشرف في صفحة العيادة وأرفق صورة الحيوان والأعراض والعدد."
    )
    supervisor_tail = "\n\n⚠️ انتظر تأكيد مشرف العيادة قبل تنفيذ أي خطوة علاجية."

    if not matches:
        return {
            "reply": f"🤖 بوت العيادة\n\n{unknown_fallback}{supervisor_tail}",
            "matched": False,
            "matches": [],
            "confidence": 0,
        }

    top_score, e = matches[0]
    name_ar = e.get("name_ar") or e.get("title") or "مرض"
    name_local = e.get("name_local") or "—"
    name_en = e.get("name_en") or "—"
    sci = e.get("name_scientific") or "—"
    definition = e.get("definition") or e.get("summary") or ""
    sym_course = e.get("symptom_course") or {}
    starts = sym_course.get("starts_with") or "—"
    then = sym_course.get("then") or "—"
    later = sym_course.get("then_later") or "—"
    stages = e.get("stages") or {}
    stage_lines = []
    if stages.get("early"):
        stage_lines.append(f"• {stages['early']}")
    if stages.get("middle"):
        stage_lines.append(f"• {stages['middle']}")
    if stages.get("advanced"):
        stage_lines.append(f"• {stages['advanced']}")
    stages_text = "\n".join(stage_lines) if stage_lines else "—"

    what_to_do = e.get("what_to_do") or []
    what_to_do_text = "\n".join(f"• {x}" for x in what_to_do) if what_to_do else "—"
    treatment = e.get("treatment") or "—"
    reportable = bool(e.get("reportable_sa"))

    alt_hint = ""
    if len(matches) > 1 and matches[1][0] >= top_score * 0.6:
        alt = matches[1][1]
        alt_hint = f"\n\n🔍 احتمال ثانٍ قد يُشابه: {alt.get('name_ar')} ({alt.get('name_en','')})"

    # لا تصل الثقة إلى الجزم؛ ٥٥ نقطة تقريباً هي سقف البطاقة القوية.
    confidence = min(90, int((top_score / 55.0) * 100))

    report_line = ""
    if reportable:
        report_line = "\n🚨 هذا المرض مُبلَّغ عنه رسمياً — أبلغ وقاء أو الوزارة فوراً، ولا تنقل الحيوان."

    urgent_line = ""
    if _is_urgent(user_text):
        urgent_line = "⛔ علامة تستدعي العزل اليوم والاتصال بالمشرف أو البيطري. لا تنتظر إن صعب التنفس أو كثر النفوق.\n\n"

    species = "، ".join(e.get("species") or []) or "—"
    category = e.get("category") or "—"
    refs = kb.get("references") or [
        "ملخصات تعليمية من دليل وواه، ودليل ميرك البيطري، وإرشادات الإبلاغ لدى وقاء",
    ]
    ref_line = "\n\n📚 المرجع: " + "؛ ".join(refs[:3]) + ". هذه بطاقة تعليمية لا تغني عن الفحص."

    reply = (
        f"🤖 بوت العيادة — تحليل مبدئي (ثقة ~{confidence}%)\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"{urgent_line}"
        f"**{e.get('diagnosis_line') or 'التشخيص المبدئي: ' + name_ar}**\n\n"
        f"📘 الأسماء:\n"
        f"• عربي: {name_ar}\n"
        f"• محلي: {name_local}\n"
        f"• إنجليزي: {name_en}\n"
        f"• علمي: {sci}\n"
        f"• التصنيف: {category} · يصيب: {species}\n\n"
        f"📝 التعريف:\n{definition}\n\n"
        f"🩺 تسلسل الأعراض: {starts} ← {then} ← {later}\n\n"
        f"📊 المراحل:\n{stages_text}\n\n"
        f"✅ ما يجب فعله:\n{what_to_do_text}\n\n"
        f"💊 الدعم (بدون جرعات):\n{treatment}"
        f"{report_line}"
        f"{alt_hint}"
        f"{ref_line}"
        f"{supervisor_tail}"
    )

    return {
        "reply": reply,
        "matched": True,
        "matches": [
            {
                "entry_id": e2.get("entry_id"),
                "name_ar": e2.get("name_ar"),
                "score": s2,
            }
            for s2, e2 in matches
        ],
        "confidence": confidence,
    }


def build_reply(user_text: str, species_hint: Optional[str] = None) -> dict:
    """Sync version — no Gemini re-rank. Used in tests and sync contexts."""
    kb = load_kb()
    matches = match_entries(user_text, species_hint=species_hint, top_n=3)
    return _render_from_matches(user_text, matches, kb)
