"""
Generates 1024x1024 App Store Connect screenshots for the 12 Saqr gift IAPs
using Playwright + HTML/CSS (perfect Arabic rendering, no BiDi/shaping bugs).

Output: /app/frontend/public/app-store-assets/gift_<id>.png
"""
import asyncio
import os
from playwright.async_api import async_playwright

OUT_DIR = "/app/frontend/public/app-store-assets"
os.makedirs(OUT_DIR, exist_ok=True)

GIFTS = [
    {"id": "rose",      "name_ar": "وردة",          "price": 3,   "accent": "#ef4444",
     "icon": "Rose/3D/rose_3d.png"},
    {"id": "bouquet",   "name_ar": "باقة ورد",      "price": 10,  "accent": "#f472b6",
     "icon": "Bouquet/3D/bouquet_3d.png"},
    {"id": "chocolate", "name_ar": "شوكولاتة",      "price": 25,  "accent": "#c2410c",
     "icon": "Chocolate%20bar/3D/chocolate_bar_3d.png"},
    {"id": "teddy",     "name_ar": "دبدوب",         "price": 50,  "accent": "#d97706",
     "icon": "Teddy%20bear/3D/teddy_bear_3d.png"},
    {"id": "gem",       "name_ar": "ألماسة",        "price": 75,  "accent": "#22d3ee",
     "icon": "Gem%20stone/3D/gem_stone_3d.png"},
    {"id": "crown",     "name_ar": "تاج ملكي",      "price": 100, "accent": "#fbbf24",
     "icon": "Crown/3D/crown_3d.png"},
    {"id": "cake",      "name_ar": "كعكة احتفال",   "price": 130, "accent": "#ec4899",
     "icon": "Birthday%20cake/3D/birthday_cake_3d.png"},
    {"id": "car",       "name_ar": "سيارة فاخرة",   "price": 160, "accent": "#3b82f6",
     "icon": "Sport%20utility%20vehicle/3D/sport_utility_vehicle_3d.png"},
    {"id": "ring",      "name_ar": "خاتم ألماس",    "price": 190, "accent": "#a855f7",
     "icon": "Ring/3D/ring_3d.png"},
    {"id": "castle",    "name_ar": "قلعة الأحلام",  "price": 220, "accent": "#8b5cf6",
     "icon": "Castle/3D/castle_3d.png"},
    {"id": "yacht",     "name_ar": "يخت فاخر",      "price": 260, "accent": "#0ea5e9",
     "icon": "Sailboat/3D/sailboat_3d.png"},
    {"id": "trophy",    "name_ar": "صقر الذهبي",    "price": 299, "accent": "#f59e0b",
     "icon": "Trophy/3D/trophy_3d.png"},
]

BASE_URL = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/"


def html_template(gift):
    icon_url = BASE_URL + gift["icon"]
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&display=swap" rel="stylesheet">
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    html, body {{ width: 1024px; height: 1024px; overflow: hidden; }}
    body {{
      font-family: 'Tajawal', system-ui, sans-serif;
      width: 1024px;
      height: 1024px;
      position: relative;
      background:
        radial-gradient(circle at 50% 40%, {gift['accent']}88 0%, {gift['accent']}33 28%, #060814 72%);
      color: #fff;
      overflow: hidden;
      direction: rtl;
    }}
    body::before {{
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        radial-gradient(2px 2px at 14% 22%, rgba(255,255,255,0.8) 0%, transparent 100%),
        radial-gradient(2px 2px at 86% 18%, rgba(255,255,255,0.7) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 18% 86%, rgba(255,255,255,0.6) 0%, transparent 100%),
        radial-gradient(2px 2px at 84% 88%, rgba(255,255,255,0.7) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 52% 9%, rgba(255,255,255,0.5) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 8% 56%, rgba(255,255,255,0.5) 0%, transparent 100%);
      pointer-events: none;
    }}
    .brand {{
      position: absolute;
      top: 64px;
      left: 0;
      right: 0;
      text-align: center;
      font-weight: 900;
      font-size: 46px;
      letter-spacing: 4px;
      text-shadow: 0 2px 14px rgba(0,0,0,0.5);
    }}
    .subtitle {{
      position: absolute;
      top: 130px;
      left: 0;
      right: 0;
      text-align: center;
      font-weight: 700;
      font-size: 28px;
      color: rgba(255,255,255,0.9);
      letter-spacing: 4px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.6);
      z-index: 2;
    }}
    .brand-wrap {{ z-index: 2; }}
    .icon-wrap {{
      position: absolute;
      top: 210px;
      left: 50%;
      transform: translateX(-50%);
      width: 520px;
      height: 520px;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .icon-glow {{
      position: absolute;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      background: {gift['accent']};
      opacity: 0.6;
      filter: blur(50px);
      z-index: 0;
    }}
    .icon-wrap img {{
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 24px 36px rgba(0,0,0,0.55));
    }}
    .name {{
      position: absolute;
      top: 770px;
      left: 0; right: 0;
      text-align: center;
      font-size: 104px;
      font-weight: 900;
      letter-spacing: -1px;
      text-shadow: 0 4px 20px rgba(0,0,0,0.6);
    }}
    .price-pill {{
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      padding: 18px 56px;
      border-radius: 999px;
      background: {gift['accent']};
      box-shadow:
        0 8px 30px {gift['accent']}66,
        inset 0 1px 0 rgba(255,255,255,0.4);
      font-size: 54px;
      font-weight: 900;
      line-height: 1;
    }}
  </style>
</head>
<body>
  <div class="brand">صقـر</div>
  <div class="subtitle">هدية فاخرة</div>
  <div class="icon-wrap">
    <div class="icon-glow"></div>
    <img src="{icon_url}" alt="{gift['name_ar']}">
  </div>
  <div class="name">{gift['name_ar']}</div>
  <div class="price-pill">{gift['price']} ر.س</div>
</body>
</html>"""


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for gift in GIFTS:
            # Fix typo in chocolate entry
            if gift["id"] == "chocolate" and "name_    ar" in gift:
                gift["name_ar"] = gift.pop("name_    ar")
            print(f"→ {gift['id']} ({gift['name_ar']}, {gift['price']} ر.س)")
            page = await browser.new_page(viewport={"width": 1024, "height": 1024})
            html = html_template(gift)
            await page.set_content(html, wait_until="networkidle")
            # Extra wait for Google Font + remote image
            await page.wait_for_timeout(1500)
            out_path = os.path.join(OUT_DIR, f"gift_{gift['id']}.png")
            await page.screenshot(path=out_path, omit_background=False,
                                  clip={"x": 0, "y": 0, "width": 1024, "height": 1024})
            await page.close()
            print(f"   saved: {out_path} ({os.path.getsize(out_path) // 1024} KB)")
        await browser.close()
    print()
    print("DONE.")


if __name__ == "__main__":
    asyncio.run(main())
