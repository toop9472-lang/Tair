// طير — Notifications screen (in-app inbox)
import React, { useCallback, useEffect, useState } from "react";
import { Bell, MessageCircle, ShoppingBag, ShieldCheck, CheckCheck, ChevronRight } from "lucide-react";
import { tairApi } from "./tairApi";
import { EmptyState } from "./TairUI";
import { TAIR, TAIR_PAGE_STYLE, timeAgo12 as timeAgo } from "./TairAppChrome";

function timeAgoLocal(iso) {
  if (!iso) return "";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  if (diff < 86400 * 7) return `قبل ${Math.floor(diff / 86400)} يوم`;
  return "";
}

const TYPE_META = {
  chat: { Icon: MessageCircle, color: TAIR.emerald },
  listing: { Icon: ShoppingBag, color: TAIR.gold },
  kyc_decision: { Icon: ShieldCheck, color: TAIR.emeraldSoft },
  default: { Icon: Bell, color: TAIR.textSoft },
};

export default function NotificationsScreen({ user, onBack, onOpenThread, onOpenListing }) {
  const uid = user.id || user.user_id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tairApi.myNotifications(uid);
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const openItem = async (n) => {
    if (!n.is_read) {
      await tairApi.markNotifRead(n.notif_id, uid).catch(() => {});
    }
    if (n.type === "chat" && n.data?.thread_id) {
      onOpenThread(n.data.thread_id);
    } else if (n.type === "listing" && n.data?.listing_id) {
      onOpenListing(n.data.listing_id);
    } else {
      load();
    }
  };

  const markAll = async () => {
    await tairApi.markAllNotifsRead(uid);
    load();
  };

  return (
    <div dir="rtl" style={TAIR_PAGE_STYLE} data-testid="notifications-screen">
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: TAIR.bg, padding: "16px", display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 12, borderBottom: `1px solid ${TAIR.divider}` }}>
        <button onClick={onBack} data-testid="back-btn" aria-label="رجوع" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", color: TAIR.emerald }}>
          <ChevronRight size={24} strokeWidth={2} />
        </button>
        <div style={{ flex: 1, textAlign: "right", color: TAIR.emerald, fontSize: 18, fontWeight: 900 }}>الإشعارات</div>
        {items.some((n) => !n.is_read) && (
          <button onClick={markAll} data-testid="mark-all-read" style={styles.markAllBtn}>
            <CheckCheck size={14} strokeWidth={2.4} />
            <span>قراءة الكل</span>
          </button>
        )}
      </div>

      <div style={{ padding: "12px 16px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>جاري التحميل…</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell size={36} strokeWidth={1.5} />}
            title="لا توجد إشعارات بعد"
            desc="ستصلك هنا رسائل جديدة وتحديثات على إعلاناتك ورحلاتك"
          />
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {items.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.default;
              const Icon = meta.Icon;
              return (
                <button
                  key={n.notif_id}
                  onClick={() => openItem(n)}
                  style={{
                    ...styles.card,
                    background: n.is_read ? TAIR.card : "#FBF4E4",
                    borderColor: n.is_read ? TAIR.divider : TAIR.gold,
                  }}
                  data-testid={`notif-${n.notif_id}`}
                >
                  <div style={{ ...styles.icon, background: meta.color + "20", color: meta.color }}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div style={styles.body}>
                    <div style={styles.rowTop}>
                      <div style={styles.title}>{n.title}</div>
                      <div style={styles.time}>{timeAgo(n.created_at)}</div>
                    </div>
                    <div style={styles.desc}>{n.body}</div>
                  </div>
                  {!n.is_read && <span style={styles.dot} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  markAllBtn: {
    display: "inline-flex", alignItems: "center", gap: 5,
    background: TAIR.emerald, color: TAIR.gold, border: "none",
    borderRadius: 999, padding: "6px 12px",
    fontSize: 11, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit",
  },
  card: {
    position: "relative",
    display: "flex", flexDirection: "row-reverse",
    alignItems: "flex-start", gap: 12,
    padding: 12, border: `1px solid ${TAIR.divider}`,
    borderRadius: 14, cursor: "pointer",
    fontFamily: "inherit", textAlign: "right", width: "100%",
    boxShadow: TAIR.softShadow,
  },
  icon: {
    width: 40, height: 40, borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0, textAlign: "right" },
  rowTop: {
    display: "flex", flexDirection: "row-reverse",
    justifyContent: "space-between", alignItems: "center", gap: 8,
  },
  title: {
    fontSize: 13, fontWeight: 800, color: TAIR.emerald,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    flex: 1, minWidth: 0,
  },
  time: { fontSize: 10, color: TAIR.textSoft, fontWeight: 700, flexShrink: 0 },
  desc: {
    fontSize: 12, color: TAIR.textSoft, marginTop: 3,
    lineHeight: 1.5,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  dot: {
    position: "absolute", top: 12, insetInlineStart: 12,
    width: 8, height: 8, borderRadius: 4, background: TAIR.gold,
  },
};
