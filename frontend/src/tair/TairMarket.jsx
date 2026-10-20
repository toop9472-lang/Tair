/**
 * TairMarket (Web) — نموذج شاشة السوق طبق المواصفات.
 * الاتجاه RTL، الألوان: كريمي/زمرد/ذهب.
 */
import React, { useEffect, useState, useMemo } from "react";
import { Search, MapPin, Feather, Music, Bird, Fish, Cat, Dog, Wheat, ShoppingBag, Landmark, Wrench, Rat, PawPrint, Bug, X, Sprout, Package, Bed, GraduationCap, Zap, Footprints } from "lucide-react";
import { tairApi } from "./tairApi";
import { LocationPicker } from "./locations";
import marketHeader from "../assets/tair-design/headers/market.jpg";
import auctionBanner from "../assets/tair-design/headers/auction_banner.jpg";
import { TAIR, TAIR_PAGE_STYLE, TairAppHeader, TairAppBottomBar } from "./TairAppChrome";

const FAMILY_ICONS = {
  parrots: Bird, songbirds: Music, pigeons: Feather, poultry: Bird, falcons: Zap,
  livestock: PawPrint, horses: Footprints, cats: Cat, dogs: Dog, small_mammals: Rat,
  pets: PawPrint, reptiles: Sprout, fish: Fish, insects: Bug, feed: Wheat,
  bird_supplies: ShoppingBag, animal_supplies: Package, hotel_services: Bed,
  training: GraduationCap, services: Wrench, reserves: Landmark,
};
const FALLBACK_FAMILIES = [
  { family_id: "parrots", name_ar: "ببغاوات", group: "birds", group_ar: "طيور" },
  { family_id: "songbirds", name_ar: "طيور صغيرة", group: "birds", group_ar: "طيور" },
  { family_id: "pigeons", name_ar: "حمام", group: "birds", group_ar: "طيور" },
  { family_id: "poultry", name_ar: "دواجن", group: "birds", group_ar: "طيور" },
  { family_id: "falcons", name_ar: "صقور", group: "birds", group_ar: "طيور" },
  { family_id: "livestock", name_ar: "مواشي", group: "animals", group_ar: "حيوانات" },
  { family_id: "horses", name_ar: "خيل", group: "animals", group_ar: "حيوانات" },
  { family_id: "cats", name_ar: "قطط", group: "animals", group_ar: "حيوانات" },
  { family_id: "dogs", name_ar: "كلاب", group: "animals", group_ar: "حيوانات" },
  { family_id: "small_mammals", name_ar: "حيوانات صغيرة", group: "animals", group_ar: "حيوانات" },
  { family_id: "pets", name_ar: "أليفة أخرى", group: "animals", group_ar: "حيوانات" },
  { family_id: "reptiles", name_ar: "زواحف", group: "animals", group_ar: "حيوانات" },
  { family_id: "fish", name_ar: "أسماك", group: "animals", group_ar: "حيوانات" },
  { family_id: "insects", name_ar: "نحل وحشرات", group: "animals", group_ar: "حيوانات" },
  { family_id: "feed", name_ar: "أعلاف وأكل", group: "care", group_ar: "عناية وخدمات" },
  { family_id: "bird_supplies", name_ar: "مستلزمات الطيور", group: "care", group_ar: "عناية وخدمات" },
  { family_id: "animal_supplies", name_ar: "مستلزمات الحيوانات", group: "care", group_ar: "عناية وخدمات" },
  { family_id: "hotel_services", name_ar: "فندقة الطيور", group: "care", group_ar: "عناية وخدمات" },
  { family_id: "training", name_ar: "تدريب", group: "care", group_ar: "عناية وخدمات" },
  { family_id: "services", name_ar: "تركيب وتجهيز", group: "care", group_ar: "عناية وخدمات" },
  { family_id: "reserves", name_ar: "محميات", group: "care", group_ar: "عناية وخدمات" },
];
const GROUP_ORDER = ["birds", "animals", "care"];

function toArabicNumerals(n) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

export default function TairMarket({ onOpenListing, onOpenTrips, onOpenAuction, activeTab = "market", onTabChange, onOpenNotifications }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pickedCat, setPickedCat] = useState(null);
  const [pickedCity, setPickedCity] = useState(null);
  const [catOpen, setCatOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [families, setFamilies] = useState(FALLBACK_FAMILIES);

  useEffect(() => {
    tairApi.listFamilies().then((items) => {
      if (Array.isArray(items) && items.length) setFamilies(items);
    }).catch(() => {});
  }, []);

  const familyGroups = useMemo(() => {
    return GROUP_ORDER.map((id) => ({
      id,
      label: families.find((f) => f.group === id)?.group_ar || FALLBACK_FAMILIES.find((f) => f.group === id)?.group_ar,
      items: families.filter((f) => (f.group || FALLBACK_FAMILIES.find((x) => x.family_id === f.family_id)?.group || "care") === id),
    })).filter((g) => g.items.length);
  }, [families]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    tairApi
      .feedListings({ limit: 40, family: pickedCat || undefined, city: pickedCity || undefined, q: query || undefined })
      .then((r) => {
        if (alive) setItems(Array.isArray(r?.items) ? r.items : []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pickedCat, pickedCity, query]);

  const filtered = items;

  return (
    <div dir="rtl" style={TAIR_PAGE_STYLE}>
      <TairAppHeader image={marketHeader} onBell={onOpenNotifications} hasNotif={true} />

      {/* صف البحث + الفئات */}
      <div style={{ display: "flex", flexDirection: "row-reverse", gap: 8, padding: "0 16px", alignItems: "center" }}>
        <button
          onClick={() => setCatOpen(true)}
          data-testid="market-categories-btn"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: TAIR.card,
            border: `1.5px solid ${TAIR.gold}`,
            boxShadow: TAIR.softShadow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
          aria-label="الفئات"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="8" cy="8" r="2.5" fill={TAIR.gold} />
            <circle cx="16" cy="8" r="2.5" fill={TAIR.gold} />
            <circle cx="8" cy="16" r="2.5" fill={TAIR.gold} />
            <circle cx="16" cy="16" r="2.5" fill={TAIR.gold} />
          </svg>
        </button>
        <button
          onClick={() => setCityOpen(true)}
          data-testid="market-city-btn"
          aria-label="المدينة"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: pickedCity ? TAIR.emerald : TAIR.card,
            border: `1.5px solid ${TAIR.gold}`,
            boxShadow: TAIR.softShadow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <MapPin size={18} color={TAIR.gold} />
        </button>

        <div style={{ flex: 1, height: 44, borderRadius: 22, background: TAIR.card, border: `1px solid ${TAIR.divider}`, display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: "0 14px", boxShadow: TAIR.softShadow }}>
          <Search size={18} color={TAIR.textSoft} />
          <input
            type="search"
            placeholder={pickedCity || (pickedCat ? families.find((c) => c.family_id === pickedCat)?.name_ar : "ابحث في السوق")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="market-search-input"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              color: TAIR.text,
              textAlign: "right",
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* بانر دخول المزاد — شريط زمردي مع جناح ذهبي (كما في التصميم) */}
      <button
        onClick={onOpenAuction}
        data-testid="market-auction-banner"
        aria-label="ادخل المزاد الآن"
        style={{
          display: "flex",
          flexDirection: "row-reverse",
          gap: 10,
          alignItems: "center",
          justifyContent: "center",
          width: "calc(100% - 32px)",
          margin: "14px 16px 6px",
          padding: "10px 16px",
          borderRadius: 10,
          background: TAIR.emerald,
          color: TAIR.gold,
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow: TAIR.softShadow,
          position: "relative",
        }}
      >
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, opacity: 0.9 }}>٤:٠٠ م – ٩:٠٠ م</span>
        <svg width="46" height="18" viewBox="0 0 100 32" fill="none" aria-hidden="true">
          <path d="M50 4 L52 24 L48 24 Z M52 12 Q70 4 96 8 Q78 14 52 16 Z M48 12 Q30 4 4 8 Q22 14 48 16 Z" fill={TAIR.gold} stroke={TAIR.goldLight} strokeWidth="0.5"/>
          <circle cx="50" cy="6" r="1.5" fill={TAIR.goldLight}/>
        </svg>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 900 }}>ادخل المزاد</span>
      </button>

      {/* 4) قائمة الإعلانات */}
      <div style={{ padding: "12px 16px 8px" }}>
        {loading && filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>...جاري التحميل</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>لا توجد عروض حالياً</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((it) => (
              <ListingCard key={it.listing_id || it.id} item={it} onClick={() => onOpenListing?.(it.listing_id || it.id)} />
            ))}
          </div>
        )}
      </div>

      {/* زر رحلات الطيور القادمة (يوجّه لصفحة الرحلات) */}
      <div style={{ padding: "10px 16px 24px", textAlign: "center" }}>
        <button
          onClick={onOpenTrips}
          data-testid="market-trips-cta"
          style={{
            padding: "10px 26px",
            borderRadius: 22,
            background: TAIR.card,
            border: `1px solid ${TAIR.divider}`,
            color: TAIR.emerald,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: TAIR.softShadow,
          }}
        >رحلات الطيور القادمة</button>
      </div>

      {/* الشريط السفلي */}
      <TairAppBottomBar active={activeTab} onChange={onTabChange} />

      {cityOpen && (
        <div onClick={() => setCityOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,36,28,0.35)", zIndex: 20, display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: TAIR.card, width: "100%", padding: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: "8px 8px 4px" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: TAIR.emerald }}>مدينة الإعلان</div>
              <button onClick={() => setCityOpen(false)} aria-label="إغلاق" style={{ width: 34, height: 34, borderRadius: 17, background: TAIR.bg, border: `1px solid ${TAIR.divider}`, cursor: "pointer", color: TAIR.emerald }}>
                <X size={18} />
              </button>
            </div>
            <LocationPicker
              selected={pickedCity}
              allowAll
              onSelect={(c) => { setPickedCity(c); setCityOpen(false); }}
            />
          </div>
        </div>
      )}

      {catOpen && (
        <div onClick={() => setCatOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,36,28,0.35)", zIndex: 20, display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: TAIR.card, width: "100%", padding: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: TAIR.emerald }}>اختر فئة</div>
              <button
                onClick={() => setCatOpen(false)}
                data-testid="cat-sheet-close"
                aria-label="إغلاق"
                style={{
                  width: 34, height: 34, borderRadius: 17,
                  background: TAIR.bg, border: `1px solid ${TAIR.divider}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: TAIR.emerald,
                }}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
            {familyGroups.map((group) => (
              <div key={group.id}>
                <div style={{ marginTop: 10, marginBottom: 4, color: TAIR.gold, fontSize: 12, fontWeight: 800, textAlign: "right" }}>{group.label}</div>
                {group.items.map((c) => {
              const I = FAMILY_ICONS[c.family_id] || Bird;
              const selected = pickedCat === c.family_id;
              return (
                <button
                  key={c.family_id}
                  onClick={() => { setPickedCat(selected ? null : c.family_id); setCatOpen(false); }}
                  data-testid={`category-${c.family_id}`}
                  style={{
                    display: "flex", flexDirection: "row-reverse",
                    justifyContent: "space-between", alignItems: "center",
                    width: "100%", padding: "12px 4px",
                    background: "transparent", border: "none",
                    borderBottom: `0.5px solid ${TAIR.divider}`,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
                    <span style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: selected ? TAIR.emerald : TAIR.bg,
                      border: `1px solid ${selected ? TAIR.gold : TAIR.divider}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <I size={18} color={selected ? TAIR.gold : TAIR.emerald} strokeWidth={1.8} />
                    </span>
                    <span style={{ color: TAIR.text, fontSize: 15, fontWeight: 600 }}>{c.name_ar}</span>
                  </span>
                  {selected ? <span style={{ color: TAIR.gold, fontWeight: 800 }}>✓</span> : null}
                </button>
              );
                })}
              </div>
            ))}
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={() => { setPickedCat(null); setCatOpen(false); }} data-testid="cat-clear-btn" style={{ padding: "8px 22px", borderRadius: 999, background: TAIR.bg, border: `1px solid ${TAIR.divider}`, color: TAIR.emerald, fontWeight: 800, cursor: "pointer" }}>
                مسح الفلترة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- كرت الإعلان ----------
function ListingCard({ item, onClick }) {
  const isNew = useMemo(() => {
    if (!item.created_at) return false;
    const t = new Date(item.created_at).getTime();
    return Date.now() - t < 1000 * 60 * 60 * 24 * 3;
  }, [item.created_at]);
  const img = item.cover_image || (Array.isArray(item.images) ? item.images[0] : null);
  const price = item.price_sar != null ? item.price_sar : item.price;

  return (
    <div
      onClick={onClick}
      data-testid={`listing-${item.listing_id || item.id}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row-reverse",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 18,
        background: TAIR.card,
        border: `1px solid ${TAIR.divider}`,
        boxShadow: TAIR.shadow,
        cursor: "pointer",
      }}
    >
      {/* شارة "جديد" ذهبية في أعلى اليمين */}
      {isNew && (
        <span style={{
          position: "absolute",
          top: 10, right: 12,
          padding: "3px 12px",
          borderRadius: 999,
          background: TAIR.goldLight,
          color: TAIR.goldDark,
          fontSize: 11,
          fontWeight: 800,
          boxShadow: "0 1px 2px rgba(27,61,47,0.1)",
        }}>جديد</span>
      )}

      {/* معلومات على اليمين */}
      <div style={{ flex: 1, textAlign: "right", paddingTop: isNew ? 12 : 0 }}>
        <div style={{ color: TAIR.emerald, fontWeight: 800, fontSize: 16, marginBottom: 6, marginTop: isNew ? 6 : 0 }}>{item.title || "بلا عنوان"}</div>
        {item.city && (
          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <MapPin size={14} color={TAIR.textSoft} />
            <span style={{ color: TAIR.textSoft, fontSize: 12 }}>{item.city}</span>
          </div>
        )}
        <div style={{ color: TAIR.emerald, fontSize: 18, fontWeight: 900 }}>
          {price != null ? `${toArabicNumerals(price)} ر.س` : "—"}
        </div>
      </div>

      {/* الصورة على اليسار */}
      <div style={{ width: 110, height: 100, borderRadius: 12, overflow: "hidden", background: TAIR.divider, flexShrink: 0 }}>
        {img ? (
          <img src={img} alt={item.title || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: TAIR.textSoft, fontSize: 28 }}>📷</div>
        )}
      </div>
    </div>
  );
}

// ---------- الشريط السفلي — من TairAppChrome ----------

