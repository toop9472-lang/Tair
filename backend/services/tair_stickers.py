"""ملصقات طير — الرمز النصي [[tair:id]] يُخزَّن كما هو، والمعاينة تُعرض بالعربية."""
import re

# المعرّف يبقى لاتينياً حتى يمرّ من فلاتر الدردشة العامة (لا روابط ولا أرقام).
STICKERS = {
    "hello": "سلام",
    "thanks": "شكراً",
    "laugh": "ضحك",
    "love": "إعجاب",
    "wow": "واو",
    "sad": "حزين",
    "ok": "تمام",
    "deal": "صفقة",
    "fly": "على الطريق",
    "care": "عناية",
    "ask": "سؤال",
    "celebrate": "مبروك",
}

_TOKEN = re.compile(r"\[\[tair:([a-z0-9_]+)\]\]")


def sticker_preview(text: str) -> str:
    """يستبدل رمز الملصق بعبارة «ملصق: …» في المعاينة والإشعار."""
    if not text:
        return text or ""

    def repl(match):
        name = STICKERS.get(match.group(1))
        return f"ملصق: {name}" if name else match.group(0)

    return _TOKEN.sub(repl, text)
