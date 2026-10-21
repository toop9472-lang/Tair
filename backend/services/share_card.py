"""صفحة المشاركة التي يراها واتساب والمتصفح: صورة، شرح، ورابط يفتح التطبيق."""
import json
from html import escape

ORIGIN = "https://saqr-ui-sync.emergent.host"
PLAY_URL = "https://play.google.com/store/apps/details?id=com.saqr.rewards&pcampaignid=web_share"
APPLE_URL = "https://apps.apple.com/sa/app/%D8%B7%D9%8A%D8%B1-%D8%B3%D9%88%D9%82-%D8%A7%D9%84%D8%B7%D9%8A%D9%88%D8%B1-%D9%88-%D8%A7%D9%84%D8%AD%D9%8A%D9%88%D8%A7%D9%86%D8%A7%D8%AA/id6758868843?l=ar"
LOGO_URL = f"{ORIGIN}/tair_logo.png"

HOOKS = {
    "listing": "انظر لهذا الإعلان، أعجبني",
    "store": "انظر لهذا المتجر، أعجبني",
    "trip": "هذه الرحلة نالت على اهتمامي",
    "clinic": "هذا الموضوع في العيادة لفت انتباهي",
    "auction": "هذا المزاد نال على اهتمامي",
    "story": "هذه اللحظة على طير أعجبتني",
    "app": "أعجبني هذا التطبيق",
}


def page_url(kind: str, item_id: str) -> str:
    return f"{ORIGIN}/api/share/{kind}/{item_id}"


def deep_link(kind: str, item_id: str) -> str:
    return f"saqr://{kind}/{item_id}"


def absolute_url(url: str) -> str:
    text = (url or "").strip()
    if not text:
        return ""
    if text.startswith("http://") or text.startswith("https://"):
        return text
    if text.startswith("/"):
        return f"{ORIGIN}{text}"
    return text


def first_image(*candidates) -> str:
    for value in candidates:
        found = _one_image(value)
        if found:
            return absolute_url(found)
    return ""


def _one_image(value) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("url", "uri", "image", "src"):
            found = _one_image(value.get(key))
            if found:
                return found
        return ""
    if isinstance(value, (list, tuple)):
        for item in value:
            found = _one_image(item)
            if found:
                return found
    return ""


def _e(value) -> str:
    return escape("" if value is None else str(value), quote=True)


def render_share_page(*, kind: str, item_id: str, title: str, lines=None, image: str = "") -> str:
    hook = HOOKS.get(kind, "من تطبيق طير")
    clean_title = (title or "طير").strip()
    details = [str(line).strip() for line in (lines or []) if str(line or "").strip()][:4]
    picture = absolute_url(image) or LOGO_URL
    link = deep_link(kind, item_id)
    deep_js = json.dumps(link)
    description = " · ".join([clean_title, *details])[:180]
    detail_html = "".join(f"<p>{_e(line)}</p>" for line in details)
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{_e(hook)} — {_e(clean_title)}</title>
<meta property="og:site_name" content="طير" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="ar_SA" />
<meta property="og:title" content="{_e(hook)}" />
<meta property="og:description" content="{_e(description)}" />
<meta property="og:url" content="{_e(page_url(kind, item_id))}" />
<meta property="og:image" content="{_e(picture)}" />
<meta property="og:image:secure_url" content="{_e(picture)}" />
<meta property="og:image:alt" content="{_e(clean_title)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{_e(hook)}" />
<meta name="twitter:description" content="{_e(description)}" />
<meta name="twitter:image" content="{_e(picture)}" />
<meta name="description" content="{_e(description)}" />
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; min-height: 100vh; background: #F7F1E8; color: #0F241C;
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, Arial, sans-serif;
         display: flex; align-items: center; justify-content: center; padding: 20px; }}
  .card {{ width: 100%; max-width: 460px; background: #FFFDF8; border-radius: 22px;
          overflow: hidden; border: 2px solid #C6A15B; box-shadow: 0 12px 32px rgba(27,61,47,.12); }}
  .cover {{ width: 100%; aspect-ratio: 16/10; object-fit: cover; display: block; background: #1B3D2F; }}
  .inner {{ padding: 22px; }}
  .hook {{ color: #8A6A2E; font-weight: 900; font-size: 15px; margin: 0 0 8px; }}
  h1 {{ margin: 0 0 8px; color: #1B3D2F; font-size: 22px; line-height: 1.45; }}
  p {{ margin: 6px 0; color: #4C4234; line-height: 1.7; }}
  .open {{ display: block; margin-top: 16px; background: #1B3D2F; color: #C6A15B; text-align: center;
          text-decoration: none; font-weight: 900; font-size: 16px; padding: 14px; border-radius: 14px;
          border: 1.5px solid #C6A15B; }}
  .stores {{ display: flex; gap: 10px; margin-top: 12px; }}
  .stores a {{ flex: 1; text-align: center; background: #1B3D2F; color: #C6A15B; text-decoration: none;
              font-weight: 900; font-size: 18px; padding: 14px 8px; border-radius: 14px;
              border: 1.5px solid #C6A15B; }}
</style>
</head>
<body>
  <div class="card">
    <img class="cover" src="{_e(picture)}" alt="{_e(clean_title)}" />
    <div class="inner">
      <p class="hook">{_e(hook)}</p>
      <h1>{_e(clean_title)}</h1>
      {detail_html}
      <a class="open" href="{_e(link)}">افتح داخل تطبيق طير</a>
      <div class="stores">
        <a href="{_e(APPLE_URL)}">ايفون</a>
        <a href="{_e(PLAY_URL)}">اندرويد</a>
      </div>
    </div>
  </div>
  <script>
    (function () {{
      var deep = {deep_js};
      var mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
      if (!mobile) return;
      setTimeout(function () {{ window.location.href = deep; }}, 400);
    }})();
  </script>
</body>
</html>
"""
