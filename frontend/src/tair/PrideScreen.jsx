/**
 * PrideScreen — فخر المُربّي: شبكة كاملة لأفضل الإعلانات.
 * لا علاقة له بالمنتدى القديم — يقرأ من /api/community/pride/list
 */
import React, { useEffect, useState } from "react";
import { ChevronRight, Heart, Bookmark, Award } from "lucide-react";
import { tairApi } from "./tairApi";
import { TAIR, TAIR_PAGE_STYLE } from "./TairAppChrome";

export default function PrideScreen({ onBack, onOpenListing }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tairApi.communityPride()
      .then((d) => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div dir="rtl" style={TAIR_PAGE_STYLE} data-testid="pride-screen">
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: TAIR.bg, padding: "16px", display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 12, borderBottom: `1px solid ${TAIR.divider}` }}>
        <button
          onClick={onBack}
          data-testid="pride-back-btn"
          aria-label="رجوع"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", color: TAIR.emerald }}
        >
          <ChevronRight size={24} strokeWidth={2} />
        </button>
        <div style={{ flex: 1, textAlign: "right", display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
          <Award size={20} color={TAIR.gold} />
          <span style={{ color: TAIR.emerald, fontSize: 18, fontWeight: 900 }}>فخر المُربّي</span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>...جاري التحميل</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>
            لا توجد إعلانات مميّزة بعد.<br />
            الإعلانات ذات الإعجابات الأعلى ستظهر هنا.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {items.map((it) => (
              <button
                key={it.listing_id}
                onClick={() => onOpenListing?.(it.listing_id)}
                data-testid={`pride-item-${it.listing_id}`}
                style={{
                  background: TAIR.card, border: `1px solid ${TAIR.divider}`,
                  borderRadius: 14, overflow: "hidden", cursor: "pointer",
                  textAlign: "right", fontFamily: "inherit", padding: 0,
                  display: "flex", flexDirection: "column",
                  boxShadow: TAIR.softShadow,
                }}
              >
                <div style={{ position: "relative", width: "100%", aspectRatio: "1.4/1", background: TAIR.divider }}>
                  {it.image_url ? (
                    <img src={it.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #6BB77A 0%, #3D6B54 100%)" }} />
                  )}
                  {it.is_new && (
                    <span style={{
                      position: "absolute", top: 8, left: 8,
                      background: TAIR.emerald, color: TAIR.gold,
                      fontSize: 11, fontWeight: 900,
                      padding: "3px 10px", borderRadius: 999,
                    }}>★ جديد</span>
                  )}
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ color: TAIR.emerald, fontSize: 13, fontWeight: 900, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                  <div style={{ color: TAIR.textSoft, fontSize: 11, marginBottom: 8 }}>
                    {it.city ? `${it.city} — ` : ""}{it.price_sar ? `${it.price_sar} ر.س` : ""}
                  </div>
                  <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 4, color: "#DC2626", fontSize: 12, fontWeight: 800 }}>
                      <Heart size={14} fill="#DC2626" strokeWidth={0} />
                      <span>{it.likes || 0}</span>
                    </div>
                    <Bookmark size={16} color={TAIR.textSoft} strokeWidth={1.8} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
