"""
Generates 1024x1024 App Store Connect screenshots for the 12 Saqr gift IAPs.
Each image: radial gradient (accent color) + 3D gift PNG + Arabic name + price + Saqr brand.
Output: /app/frontend/public/app-store-assets/gift_<id>.png
"""
import io
import os
import sys
import urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import arabic_reshaper
from bidi.algorithm import get_display

OUT_DIR = "/app/frontend/public/app-store-assets"
os.makedirs(OUT_DIR, exist_ok=True)

CANVAS = 1024
ICON_SIZE = 520

ARABIC_BOLD = "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf"
ARABIC_REG = "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf"
LATIN_BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"

GIFTS = [
    {"id": "rose",      "name_ar": "وردة",          "price": 3,   "accent": "#ef4444",
     "icon": "Rose/3D/rose_3d.png"},
    {"id": "bouquet",   "name_ar": "باقة ورد",      "price": 10,  "accent": "#f472b6",
     "icon": "Bouquet/3D/bouquet_3d.png"},
    {"id": "chocolate", "name_ar": "شوكولاتة",      "price": 25,  "accent": "#92400e",
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


def ar(text: str) -> str:
    """Reshape Arabic text for proper RTL display in PIL."""
    return get_display(arabic_reshaper.reshape(text))


def hex_to_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def make_radial_gradient(size: int, center_color, edge_color):
    """Manual radial gradient using PIL."""
    img = Image.new("RGB", (size, size), edge_color)
    cx, cy = size / 2, size / 2 - 60
    max_r = size * 0.75
    cr, cg, cb = center_color
    er, eg, eb = edge_color

    # Use a smaller buffer + upscale for speed
    scale = 4
    small = Image.new("RGB", (size // scale, size // scale), edge_color)
    draw = ImageDraw.Draw(small)
    steps = 80
    for i in range(steps, 0, -1):
        t = i / steps
        # ease
        a = t * t
        r = int(er * a + cr * (1 - a))
        g = int(eg * a + cg * (1 - a))
        b = int(eb * a + cb * (1 - a))
        radius = (max_r / scale) * t
        bbox = [
            (cx / scale) - radius, (cy / scale) - radius,
            (cx / scale) + radius, (cy / scale) + radius,
        ]
        draw.ellipse(bbox, fill=(r, g, b))
    big = small.resize((size, size), Image.BICUBIC)
    return big


def fetch_icon(rel_path: str) -> Image.Image:
    url = BASE_URL + rel_path
    print(f"  downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return Image.open(io.BytesIO(data)).convert("RGBA")


def make_screenshot(gift):
    accent = hex_to_rgb(gift["accent"])
    edge = (8, 12, 24)            # near-black luxury edge
    center = tuple(int(c * 0.35 + 12) for c in accent)  # darkened accent

    bg = make_radial_gradient(CANVAS, center, edge)
    canvas = bg.convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    # Subtle bokeh / star particles in corners
    for x, y, r in [(120, 200, 4), (940, 160, 3), (180, 880, 3),
                    (880, 900, 4), (520, 80, 2), (90, 540, 2)]:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 180))

    # Glow behind the icon
    glow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gr = ICON_SIZE * 0.7
    gcx, gcy = CANVAS // 2, 470
    gdraw.ellipse([gcx - gr, gcy - gr, gcx + gr, gcy + gr],
                  fill=accent + (110,))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=60))
    canvas = Image.alpha_composite(canvas, glow)

    # Gift icon
    icon = fetch_icon(gift["icon"])
    icon = icon.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
    ix = (CANVAS - ICON_SIZE) // 2
    iy = 210
    canvas.paste(icon, (ix, iy), icon)

    draw = ImageDraw.Draw(canvas)

    # Name (Arabic) — large
    name_font = ImageFont.truetype(ARABIC_BOLD, 100)
    name_text = ar(gift["name_ar"])
    bbox = draw.textbbox((0, 0), name_text, font=name_font)
    name_w = bbox[2] - bbox[0]
    name_h = bbox[3] - bbox[1]
    nx = (CANVAS - name_w) // 2
    ny = 760
    # Shadow
    draw.text((nx + 3, ny + 3), name_text, font=name_font, fill=(0, 0, 0, 180))
    draw.text((nx, ny), name_text, font=name_font, fill=(255, 255, 255, 255))

    # Price pill
    price_label = ar(f"{gift['price']} ر.س")
    price_font = ImageFont.truetype(ARABIC_BOLD, 56)
    pbbox = draw.textbbox((0, 0), price_label, font=price_font)
    pw = pbbox[2] - pbbox[0]
    ph = pbbox[3] - pbbox[1]
    pad_x, pad_y = 36, 14
    pill_w = pw + pad_x * 2
    pill_h = ph + pad_y * 2 + 16
    px = (CANVAS - pill_w) // 2
    py = ny + name_h + 60
    # pill background
    pill_layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(pill_layer)
    pdraw.rounded_rectangle(
        [px, py, px + pill_w, py + pill_h],
        radius=pill_h // 2,
        fill=accent + (235,),
    )
    canvas = Image.alpha_composite(canvas, pill_layer)
    draw = ImageDraw.Draw(canvas)
    draw.text((px + pad_x, py + pad_y - 4), price_label,
              font=price_font, fill=(255, 255, 255, 255))

    # Saqr brand at the top
    brand_font = ImageFont.truetype(ARABIC_BOLD, 44)
    brand = ar("صقـر")
    bb = draw.textbbox((0, 0), brand, font=brand_font)
    bw = bb[2] - bb[0]
    bx = (CANVAS - bw) // 2
    draw.text((bx + 2, 70 + 2), brand, font=brand_font, fill=(0, 0, 0, 160))
    draw.text((bx, 70), brand, font=brand_font, fill=(255, 255, 255, 235))

    # Subtitle under brand
    sub_font = ImageFont.truetype(ARABIC_REG, 30)
    sub = ar("هدية فاخرة")
    sb = draw.textbbox((0, 0), sub, font=sub_font)
    sw = sb[2] - sb[0]
    sx = (CANVAS - sw) // 2
    draw.text((sx, 134), sub, font=sub_font, fill=(255, 255, 255, 180))

    out_path = os.path.join(OUT_DIR, f"gift_{gift['id']}.png")
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def main():
    print("Generating 1024x1024 App Store screenshots for 12 gifts...")
    for g in GIFTS:
        print(f"→ {g['id']} ({g['name_ar']}, {g['price']} ر.س)")
        path = make_screenshot(g)
        print(f"   saved: {path} ({os.path.getsize(path) // 1024} KB)")
    print()
    print("ALL DONE. Files in:", OUT_DIR)


if __name__ == "__main__":
    main()
