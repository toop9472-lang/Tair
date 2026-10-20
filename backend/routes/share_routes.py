"""Public share pages — HTML landing pages for shared Tair content.
These are the URLs users see when someone shares a listing/trip/store.
They show basic info + a CTA to open in the Tair app.
"""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/share", tags=["Share"], include_in_schema=False)

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]


def _html(title: str, body: str, image: str = "") -> str:
    img_meta = f'<meta property="og:image" content="{image}" />' if image else ""
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{title} — طير</title>
<meta property="og:title" content="{title}" />
<meta property="og:site_name" content="طير — سوق الطيور" />
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
      <a class="cta" href="tair://open">افتح في تطبيق طير</a>
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
    img = (l.get("images") or [None])[0] or ""
    body = (
        (f'<img class="cover" src="{img}" />' if img else '') +
        f'<div class="inner"><div class="brand">طير · إعلان</div>'
        f'<h1>{l.get("title") or "إعلان طير"}</h1>'
        f'<p>💰 <b>{l.get("price_sar", "—")} ر.س</b></p>'
        f'<p>📍 {l.get("city", "")}{" · " + l.get("district", "") if l.get("district") else ""}</p>'
        f'<p>{(l.get("description") or "")[:200]}</p></div>'
    )
    return _html(l.get("title") or "إعلان طير", body, img)


@router.get("/trip/{trip_id}", response_class=HTMLResponse)
async def share_trip(trip_id: str):
    t = await db.trips.find_one({"$or": [{"trip_id": trip_id}, {"id": trip_id}]})
    if not t:
        return HTMLResponse(_html("رحلة غير موجودة", '<div class="inner"><h1>الرحلة غير متاحة</h1></div>'), 404)
    body = (
        f'<div class="inner"><div class="brand">طير · رحلة</div>'
        f'<h1>{t.get("from_city", "")} ← {t.get("to_city", "")}</h1>'
        f'<p>📅 {t.get("depart_at") or ""}</p>'
        f'<p>👤 الموصل: {t.get("carrier_name") or ""}</p></div>'
    )
    return _html(f'{t.get("from_city", "")} ← {t.get("to_city", "")}', body)


@router.get("/store/{user_id}", response_class=HTMLResponse)
async def share_store(user_id: str):
    u = await db.users.find_one({"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]})
    if not u:
        return HTMLResponse(_html("متجر غير موجود", '<div class="inner"><h1>المتجر غير متاح</h1></div>'), 404)
    logo = u.get("storefront_settings", {}).get("logo_url") or u.get("avatar") or ""
    body = (
        (f'<img class="cover" src="{logo}" />' if logo else '') +
        f'<div class="inner"><div class="brand">طير · متجر</div>'
        f'<h1>{u.get("name") or "متجر طير"}</h1>'
        f'<p>{u.get("storefront_settings", {}).get("bio") or u.get("bio") or ""}</p></div>'
    )
    return _html(u.get("name") or "متجر طير", body, logo)
