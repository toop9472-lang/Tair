// طير — مكوّنات ثيم عامة (هيدر صورة، شريط سفلي، خلفية كريمية)
import React from "react";
import { Bell, User, Users, MessageCircle, Plane, Store } from "lucide-react";

export const TAIR = {
  bg: "#F7F1E8",
  card: "#FFFDF8",
  emerald: "#1B3D2F",
  emeraldSoft: "#3D6B54",
  gold: "#C6A15B",
  goldLight: "#E0C580",
  goldDark: "#8A6A2E",
  text: "#1B3D2F",
  textSoft: "#6B5E4A",
  divider: "#E6DCC8",
  shadow: "0 4px 12px -6px rgba(27,61,47,0.16)",
  softShadow: "0 2px 6px -3px rgba(27,61,47,0.12)",
};

export const TAIR_PAGE_STYLE = {
  minHeight: "100vh",
  background: TAIR.bg,
  fontFamily: '"Tajawal", "IBM Plex Sans Arabic", "SF Arabic", system-ui',
  paddingBottom: 96,
};

// ============ صيغة الوقت (١٢ ساعة + ص/م بالعربية) ============
export function toArabicDigits(n) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

export function format12(dt) {
  const d = dt instanceof Date ? dt : new Date(dt);
  if (isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "م" : "ص";
  h = h % 12;
  if (h === 0) h = 12;
  return `${toArabicDigits(String(h))}:${toArabicDigits(String(m).padStart(2, "0"))} ${suffix}`;
}

export function formatDate12(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("ar-SA")} — ${format12(d)}`;
}

export function timeAgo12(iso) {
  if (!iso) return "";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${toArabicDigits(Math.floor(diff / 60))} د`;
  if (diff < 86400) return `قبل ${toArabicDigits(Math.floor(diff / 3600))} س`;
  if (diff < 86400 * 7) return `قبل ${toArabicDigits(Math.floor(diff / 86400))} يوم`;
  return formatDate12(iso);
}

/**
 * TairAppHeader — هيدر صورة ثابت لكل الصفحات الرئيسية
 * الوضع: نسبة عرض/ارتفاع ثابتة → زر الجرس بإحداثيات نسبية (٪) يغطي الجرس المحفور تماماً في كل مقاسات الشاشة.
 * props:
 *   image: import path for the header image
 *   onBell?: click handler for bell (optional, shown if provided)
 *   hasNotif?: boolean — show gold dot on bell
 */
export function TairAppHeader({ image, onBell, hasNotif = false }) {
  return (
    <div style={{
      position: "relative",
      width: "100%",
      aspectRatio: "1.49 / 1",  // ثابت لكل الهيدرات
      maxHeight: 260,
      background: TAIR.bg,
      overflow: "hidden",
    }}>
      <img
        src={image}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          display: "block",
        }}
      />
      {/* تدرّج تلاشي إلى الخلفية الكريمية */}
      <div style={{
        position: "absolute",
        left: 0, right: 0, bottom: 0,
        height: "18%",
        background: `linear-gradient(to bottom, transparent 0%, ${TAIR.bg} 100%)`,
        pointerEvents: "none",
      }} />
      {onBell && (
        <button
          onClick={onBell}
          aria-label="الإشعارات"
          data-testid="header-bell"
          style={{
            position: "absolute",
            top: "51%",
            right: "3.5%",
            width: "14%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: TAIR.card,
            border: "none",
            boxShadow: "0 3px 8px rgba(27,61,47,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Bell size={22} color={TAIR.emerald} strokeWidth={1.8} />
          {hasNotif && (
            <span style={{
              position: "absolute",
              top: "16%",
              right: "20%",
              width: 10,
              height: 10,
              borderRadius: 5,
              background: TAIR.gold,
              border: `2px solid ${TAIR.card}`,
            }} />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * TairAppBottomBar — ٥ تبويبات فقط: السوق | الرحلات | الرسائل | المجتمع | حسابي
 * props:
 *   active: "market" | "trips" | "messages" | "community" | "account"
 *   onChange: (key) => void
 *   messagesBadge?: number
 */
export function TairAppBottomBar({ active = "market", onChange, messagesBadge = 0 }) {
  const TABS = [
    { key: "account", label: "حسابي", Icon: User },
    { key: "community", label: "المجتمع", Icon: Users },
    { key: "messages", label: "الرسائل", Icon: MessageCircle },
    { key: "trips", label: "الرحلات", Icon: Plane },
    { key: "market", label: "السوق", Icon: Store },
  ];
  return (
    <div dir="rtl" style={{
      position: "fixed",
      left: 0, right: 0, bottom: 0,
      height: 64,
      background: TAIR.bg,
      borderTop: `0.5px solid ${TAIR.divider}`,
      display: "flex",
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-around",
      padding: "0 12px",
      zIndex: 10,
    }}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        const Icon = t.Icon;
        const showBadge = t.key === "messages" && messagesBadge > 0;
        return (
          <button
            key={t.key}
            onClick={() => onChange?.(t.key)}
            data-testid={`tab-${t.key}`}
            style={{
              position: "relative",
              flex: isActive ? 1.5 : 1,
              height: 48,
              borderRadius: 24,
              background: isActive ? TAIR.emerald : "transparent",
              border: "none",
              display: "flex",
              flexDirection: "row-reverse",
              gap: 6,
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: isActive ? TAIR.gold : TAIR.emerald,
              padding: "0 12px",
              fontFamily: "inherit",
            }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} color={isActive ? TAIR.gold : TAIR.emerald} />
            <span style={{ fontSize: 11, fontWeight: 800 }}>{t.label}</span>
            {showBadge && (
              <span style={{
                position: "absolute",
                top: 4,
                insetInlineStart: isActive ? 8 : 12,
                background: "#DC2626",
                color: "#fff",
                fontSize: 9,
                fontWeight: 800,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                padding: "0 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1.5px solid ${TAIR.bg}`,
              }}>
                {messagesBadge > 99 ? "99+" : messagesBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
