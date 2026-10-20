"""Public share pages — HTML landing pages for shared Tair content.
These are the URLs users see when someone shares a listing/trip/store.
They show basic info + a CTA to open in the Tair app.
"""
import os
from html import escape
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/share", tags=["Share"], include_in_schema=False)

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]
PUBLIC_ORIGIN = os.environ.get("PUBLIC_APP_URL", "https://saqr-ui-sync.emergent.host").rstrip("/")


def _abs(url) -> str:
    if not url:
        return ""
    text = str(url)
    if text.startswith("http://") or text.startswith("https://"):
        return text
    if text.startswith("/"):
        return f"{PUBLIC_ORIGIN}{text}"
    return text


def _e(value) -> str:
    return escape("" if value is None else str(value), quote=True)


def _deep(kind: str, item_id: str) -> str:
    return f"saqr://{kind}/{item_id}"


def _html(title: str, body: str, image: str = "", deep_link: str = "saqr://open", description: str = "", page_url: str = "") -> str:
    image = _abs(image)
    img_meta = f'<meta property="og:image" content="{_e(image)}" />' if image else ""
    desc_meta = f'<meta property="og:description" content="{_e(description)}" />' if description else ""
    url_meta = f'<meta property="og:url" content="{_e(page_url)}" />' if page_url else ""
    safe_title = _e(title)
    safe_link = _e(deep_link)
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{safe_title} — طير</title>
<meta property="og:title" content="{safe_title}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="طير — سوق الطيور" />
{desc_meta}
{url_meta}
{img_meta}
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif;
         background: #F7F1E8; margin: 0; min-height: 100vh;
         display: flex; align-items: center; justify-content: center; padding: 20px; color: #0F241C; }}
  .card {{ max-width: 460px; width: 100%; background: #FFFDF8; border-radius: 20px;
          overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.1); border: 2px solid #C6A15B; }}
  .cover {{ width: 100%; aspect-ratio: 16/10; background: #1B3D2F; display: block; object-fit: cover; }}
  .inner {{ padding: 22px; }}
  h1 {{ margin: 0 0 10px; color: #1B3D2F; font-size: 22px; }}
  p {{ color: #4C4234; line-height: 1.7; margin: 8px 0; }}
  .brand {{ color: #C6A15B; font-weight: 900; font-size: 12px; letter-spacing: 1px; }}
  .cta {{ display: block; margin-top: 18px; background: #1B3D2F; color: #C6A15B; text-align: center;
          padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 15px;
          border: 1.5px solid #C6A15B; }}
  .cta:hover {{ opacity: .9; }}
</style>
</head>
<body>
  <div class="card">
    {body}
    <div class="inner">
      <a class="cta" href="{safe_link}">افتح داخل تطبيق طير</a>
      <p style="text-align:center; margin-top:14px; font-size:12px;">
        <a href="https://apps.apple.com" style="color:#1B3D2F;">iOS</a> ·
        <a href="https://play.google.com" style="color:#1B3D2F;">Android</a>
      </p>
    </div>
  </div>
</body>
</html>
"""


@router.get("/listing/{listing_id}", response_class=HTMLResponse)
async def share_listing(listing_id: str):
    l = await db.listings.find_one({"$or": [{"listing_id": listing_id}, {"id": listing_id}]})
    if not l:
        return HTMLResponse(_html("إعلان غير موجود", '<div class="inner"><h1>الإعلان غير متاح</h1></div>'), 404)
    img = _abs(l.get("cover_image") or (l.get("images") or [None])[0] or "")
    district = f" · {_e(l.get('district'))}" if l.get("district") else ""
    body = (
        (f'<img class="cover" src="{_e(img)}" />' if img else '') +
        f'<div class="inner"><div class="brand">طير · إعلان</div>'
        f'<h1>{_e(l.get("title") or "إعلان طير")}</h1>'
        f'<p>💰 <b>{_e(l.get("price_sar", "—"))} ر.س</b></p>'
        f'<p>📍 {_e(l.get("city", ""))}{district}</p>'
        f'<p>{_e((l.get("description") or "")[:200])}</p></div>'
    )
    return _html(
        l.get("title") or "إعلان طير", body, img, _deep("listing", listing_id),
        description=f'{l.get("price_sar", "")} ر.س · {l.get("city") or ""}',
        page_url=f"{PUBLIC_ORIGIN}/share/listing/{listing_id}",
    )


@router.get("/trip/{trip_id}", response_class=HTMLResponse)
async def share_trip(trip_id: str):
    t = await db.trips.find_one({"$or": [{"trip_id": trip_id}, {"id": trip_id}]})
    if not t:
        return HTMLResponse(_html("رحلة غير موجودة", '<div class="inner"><h1>الرحلة غير متاحة</h1></div>'), 404)
    body = (
        f'<div class="inner"><div class="brand">طير · رحلة</div>'
        f'<h1>{_e(t.get("from_city", ""))} ← {_e(t.get("to_city", ""))}</h1>'
        f'<p>📅 {_e(t.get("depart_at") or "")}</p>'
        f'<p>👤 الموصل: {_e(t.get("carrier_name") or "")}</p></div>'
    )
    return _html(
        f'{t.get("from_city", "")} ← {t.get("to_city", "")}', body, "", _deep("trip", trip_id),
        description=f'رحلة من {t.get("from_city") or ""} إلى {t.get("to_city") or ""}',
        page_url=f"{PUBLIC_ORIGIN}/share/trip/{trip_id}",
    )


@router.get("/store/{user_id}", response_class=HTMLResponse)
async def share_store(user_id: str):
    u = await db.users.find_one({"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]})
    if not u:
        return HTMLResponse(_html("متجر غير موجود", '<div class="inner"><h1>المتجر غير متاح</h1></div>'), 404)
    sf = u.get("storefront_settings") or {}
    logo = _abs(sf.get("logo_url") or (sf.get("banner_slides") or [None])[0] or u.get("profile_bg_url") or u.get("avatar") or "")
    bio = u.get("storefront_settings", {}).get("bio") or u.get("bio") or ""
    body = (
        (f'<img class="cover" src="{_e(logo)}" />' if logo else '') +
        f'<div class="inner"><div class="brand">طير · متجر</div>'
        f'<h1>{_e(u.get("name") or "متجر طير")}</h1>'
        f'<p>{_e(bio)}</p></div>'
    )
    return _html(
        u.get("name") or "متجر طير", body, logo, _deep("store", user_id),
        description=bio[:140],
        page_url=f"{PUBLIC_ORIGIN}/share/store/{user_id}",
    )


@router.get("/auction/{auction_id}", response_class=HTMLResponse)
async def share_auction(auction_id: str):
    a = await db.tair_auctions.find_one({"auction_id": auction_id})
    if not a:
        return HTMLResponse(_html("مزاد غير موجود", '<div class="inner"><h1>المزاد غير متاح</h1></div>'), 404)
    img = _abs((a.get("images") or [None])[0] or a.get("cover_image") or "")
    price = a.get("current_bid_sar") or a.get("starting_price_sar") or "—"
    body = (
        (f'<img class="cover" src="{_e(img)}" />' if img else '') +
        f'<div class="inner"><div class="brand">طير · مزاد</div>'
        f'<h1>{_e(a.get("title") or "مزاد طير")}</h1>'
        f'<p>💰 <b>{_e(price)} ر.س</b></p>'
        f'<p>📍 {_e(a.get("city") or "")}</p></div>'
    )
    return _html(
        a.get("title") or "مزاد طير", body, img, _deep("auction", auction_id),
        description=f'المزاد الحالي {price} ر.س',
        page_url=f"{PUBLIC_ORIGIN}/share/auction/{auction_id}",
    )


@router.get("/story/{story_id}", response_class=HTMLResponse)
async def share_story(story_id: str):
    st = await db.tair_stories.find_one({"story_id": story_id})
    if not st:
        return HTMLResponse(_html("قصة غير موجودة", '<div class="inner"><h1>القصة غير متاحة</h1></div>'), 404)
    img = _abs(st.get("image_url") or "")
    body = (
        (f'<img class="cover" src="{_e(img)}" />' if img else '') +
        f'<div class="inner"><div class="brand">طير · قصة</div>'
        f'<h1>{_e(st.get("user_name") or "مربّي")}</h1>'
        f'<p>{_e((st.get("caption") or "")[:200])}</p></div>'
    )
    return _html(
        st.get("user_name") or "قصة طير", body, img, _deep("story", story_id),
        description=(st.get("caption") or "قصة على طير")[:140],
        page_url=f"{PUBLIC_ORIGIN}/share/story/{story_id}",
    )
