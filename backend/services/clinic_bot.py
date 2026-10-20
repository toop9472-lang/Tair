"""
Clinic Bot — بوت العيادة البيطرية الذكي
- يستخدم قاعدة بيانات tair-vet-master (153 مرض)
- يطابق أعراض/كلمات مفتاحية ⇒ يقترح تشخيص مبدئي
- يتبع قالب الرد الصارم ويختم برسالة انتظار المشرف
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


def _tokens(text: str):
    text = _norm(text or "")
    return set(re.findall(r"[\u0600-\u06ffA-Za-z0-9]+", text))


def match_entries(text: str, species_hint: Optional[str] = None, top_n: int = 3):
    """Score entries against user text — returns top N matches with score."""
    kb = load_kb()
    user_tokens = _tokens(text)
    user_text_norm = _norm(text or "")
    if not user_tokens:
        return []

    results = []
    for e in kb.get("entries", []):
        score = 0
        signs_matched = 0

        # Match disease names (ar/local/en) — substring match
        for key in ("name_ar", "name_local", "name_en", "name_scientific"):
            val = _norm(e.get(key, ""))
            if val and len(val) >= 3 and val in user_text_norm:
                score += 15  # explicit name mention = very strong signal

        # Match keywords — substring match
        for kw in e.get("keywords", []):
            kw_norm = _norm(kw)
            if kw_norm and len(kw_norm) >= 3 and kw_norm in user_text_norm:
                score += 4

        # Match clinical signs — substring match + bonus for multiple signs
        for sign in e.get("signs", []) or []:
            sign_norm = _norm(sign)
            if not sign_norm:
                continue
            # Try substring match of each word in the sign
            sign_words = [w for w in sign_norm.split() if len(w) >= 3]
            matched_words = sum(1 for w in sign_words if w in user_text_norm)
            if sign_words and matched_words >= max(1, len(sign_words) // 2):
                score += 5
                signs_matched += 1

        # Multi-sign bonus — the more signs match, the higher confidence
        if signs_matched >= 2:
            score += signs_matched * 4
        if signs_matched >= 3:
            score += 10

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

    return _render_from_matches(user_text, matches, kb)


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

    confidence = min(100, int((top_score / 25.0) * 100))

    report_line = ""
    if reportable:
        report_line = "\n🚨 **هذا المرض مُبلَّغ عنه رسمياً — أبلغ وقاء/الوزارة فوراً.**"

    reply = (
        f"🤖 بوت العيادة — تحليل مبدئي (ثقة ~{confidence}%)\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"**{e.get('diagnosis_line') or 'التشخيص المبدئي: ' + name_ar}**\n\n"
        f"📘 الأسماء:\n"
        f"• عربي: {name_ar}\n"
        f"• محلي: {name_local}\n"
        f"• إنجليزي: {name_en}\n"
        f"• علمي: {sci}\n\n"
        f"📝 التعريف:\n{definition}\n\n"
        f"🩺 تسلسل الأعراض: {starts} ← {then} ← {later}\n\n"
        f"📊 المراحل:\n{stages_text}\n\n"
        f"✅ ما يجب فعله:\n{what_to_do_text}\n\n"
        f"💊 العلاج (بدون جرعات):\n{treatment}"
        f"{report_line}"
        f"{alt_hint}"
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
