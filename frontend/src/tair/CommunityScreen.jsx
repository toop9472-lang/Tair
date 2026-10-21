/**
 * CommunityScreen — استعادة الهيدر الصورة + بيانات من API فعلي
 *  - القصص (٢٤ ساعة): GET /api/community/stories/list
 *  - فخر المُربّي (أفضل الإعلانات): GET /api/community/pride/list
 *  - اسأل الخبراء: AskExpertsScreen
 */
import React, { useEffect, useState } from "react";
import { Heart, Bookmark, Sparkles, Plus, MessageSquare, Feather, Award } from "lucide-react";
import { TAIR, TAIR_PAGE_STYLE, TairAppHeader } from "./TairAppChrome";
import { tairApi } from "./tairApi";
import communityHeader from "../assets/tair-design/headers/community.jpg";

export default function CommunityScreen({ user, onOpenStories, onOpenPride, onOpenAskExperts, onOpenNotifications, onAddStory, onOpenListing, unreadCount = 0 }) {
  const [stories, setStories] = useState([]);
  const [pride, setPride] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          tairApi.communityStories().catch(() => ({ items: [] })),
          tairApi.communityPride().catch(() => ({ items: [] })),
        ]);
        setStories(s.items || []);
        setPride(p.items || []);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div dir="rtl" style={TAIR_PAGE_STYLE} data-testid="community-screen">
      {/* الهيدر بالصورة كباقي الصفحات */}
      <TairAppHeader image={communityHeader} onBell={onOpenNotifications} unreadCount={unreadCount} />

      {/* === قسم القصص === */}
      <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: "8px 16px 8px" }}>
        <Sparkles size={18} color={TAIR.gold} />
        <span style={{ color: TAIR.emerald, fontSize: 16, fontWeight: 900 }}>القصص</span>
      </div>
      <div style={{
        display: "flex",
        flexDirection: "row-reverse",
        gap: 14,
        padding: "0 16px 14px",
        overflowX: "auto",
      }} data-testid="community-stories-strip">
        {/* أضف قصتك */}
        <div style={{ textAlign: "center", flexShrink: 0 }} onClick={onAddStory}>
          <div style={{
            width: 68, height: 68, borderRadius: 34,
            border: `2px dashed ${TAIR.gold}`,
            background: TAIR.emerald,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} data-testid="add-story-btn">
            <Plus size={26} color={TAIR.gold} strokeWidth={2.4} />
          </div>
          <div style={{ fontSize: 11, color: TAIR.emerald, marginTop: 6, fontWeight: 700 }}>
            أضف قصتك
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 12, color: TAIR.textSoft, fontSize: 12 }}>...</div>
        ) : stories.length === 0 ? (
          <div style={{ padding: "24px 12px", color: TAIR.textSoft, fontSize: 12 }}>لا قصص بعد</div>
        ) : stories.map((s) => (
          <div key={s.story_id} style={{ textAlign: "center", flexShrink: 0 }} onClick={() => onOpenStories?.(s.story_id)}>
            <div style={{
              width: 68, height: 68, borderRadius: 34,
              border: `2px solid ${TAIR.gold}`,
              background: TAIR.divider,
              cursor: "pointer",
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: TAIR.emerald, fontSize: 22, fontWeight: 900,
            }}>
              {s.image_url ? (
                <img src={s.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : ((s.user_name || "?").charAt(0))}
            </div>
            <div style={{ fontSize: 11, color: TAIR.emerald, marginTop: 6, fontWeight: 700, maxWidth: 72, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.user_name || "مربّي"}
            </div>
          </div>
        ))}
      </div>

      {/* === فخر المربي === */}
      <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: "6px 16px 8px" }}>
        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
          <Award size={16} color={TAIR.gold} />
          <span style={{ color: TAIR.emerald, fontSize: 15, fontWeight: 900 }}>فخر المربي</span>
        </div>
        <button data-testid="pride-view-all" onClick={onOpenPride} style={{
          background: "transparent", border: "none",
          color: TAIR.goldDark, fontSize: 12, fontWeight: 800, cursor: "pointer",
          fontFamily: "inherit",
        }}>عرض الكل</button>
      </div>
      {pride.length === 0 ? (
        <div style={{ padding: "18px 16px", color: TAIR.textSoft, fontSize: 13, textAlign: "center" }}>
          {loading ? "..." : "لا توجد إعلانات مميزة بعد"}
        </div>
      ) : (
        <div style={{ padding: "0 16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {pride.slice(0, 4).map((it) => (
            <PrideCard key={it.listing_id} item={it} onClick={() => onOpenListing?.(it.listing_id)} />
          ))}
        </div>
      )}

      {/* === اسأل الخبراء === */}
      <div style={{ margin: "6px 16px 20px", padding: "16px 18px", background: TAIR.card, border: `1px solid ${TAIR.divider}`, borderRadius: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 16, top: 12, opacity: 0.9 }}>
          <Feather size={44} color={TAIR.gold} strokeWidth={1.4} />
        </div>
        <div style={{ textAlign: "center", color: TAIR.emerald, marginBottom: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>اسأل الخبراء</div>
          <div style={{ fontSize: 12, color: TAIR.textSoft }}>استفساراتك، إجابات من المتخصصين</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <button onClick={onOpenAskExperts} data-testid="ask-experts-btn" style={{
            display: "inline-flex", flexDirection: "row-reverse", alignItems: "center", gap: 6,
            padding: "9px 22px", borderRadius: 20,
            background: TAIR.gold, color: TAIR.card, border: "none",
            fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            <MessageSquare size={16} strokeWidth={2.4} />
            <span>اسأل الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PrideCard({ item, onClick }) {
  return (
    <button onClick={onClick} data-testid={`pride-${item.listing_id}`} style={{
      background: TAIR.card, border: `1px solid ${TAIR.divider}`,
      borderRadius: 14, overflow: "hidden", cursor: "pointer",
      textAlign: "right", fontFamily: "inherit", padding: 0,
      display: "flex", flexDirection: "column",
      boxShadow: TAIR.softShadow,
    }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1.4/1", background: TAIR.divider }}>
        {item.image_url ? (
          <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #6BB77A 0%, #3D6B54 100%)" }} />
        )}
        {item.is_new && (
          <span style={{
            position: "absolute", top: 8, left: 8,
            background: TAIR.emerald, color: TAIR.gold,
            fontSize: 11, fontWeight: 900,
            padding: "3px 10px", borderRadius: 999,
          }}>★ جديد</span>
        )}
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ color: TAIR.emerald, fontSize: 13, fontWeight: 900, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
        <div style={{ color: TAIR.textSoft, fontSize: 11, marginBottom: 8, lineHeight: 1.4 }}>
          {item.city ? `${item.city} — ` : ""}{item.price_sar ? `${item.price_sar} ر.س` : ""}
        </div>
        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 4, color: "#DC2626", fontSize: 12, fontWeight: 800 }}>
            <Heart size={14} fill="#DC2626" strokeWidth={0} />
            <span>{item.likes || 0}</span>
          </div>
          <Bookmark size={16} color={TAIR.textSoft} strokeWidth={1.8} />
        </div>
      </div>
    </button>
  );
}
