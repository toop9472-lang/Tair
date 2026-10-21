// طير — Notifications screen (in-app inbox)
import React, { useCallback, useEffect, useState } from "react";
import { Bell, MessageCircle, ShoppingBag, ShieldCheck, CheckCheck, ChevronRight, Plane, HeartPulse, Package, Users, Megaphone, Sparkles, UserPlus } from "lucide-react";
import { tairApi } from "./tairApi";
import { EmptyState } from "./TairUI";
import { TAIR, TAIR_PAGE_STYLE, timeAgo12 as timeAgo } from "./TairAppChrome";

const FACE = {
  chat: ["رسالة", "messages", MessageCircle],
  community_chat: ["دردشة عامة", "messages", Users],
  clinic_topic: ["موضوع في العيادة", "clinic", HeartPulse],
  clinic_reply: ["رد في العيادة", "clinic", HeartPulse],
  trip_match: ["رحلة تناسبك", "trips", Plane],
  trip_request: ["طلب رحلة", "trips", Plane],
  trip_booking: ["حجز رحلة", "trips", Plane],
  trip_motion: ["حركة الرحلة", "trips", Plane],
  trip_status: ["رحلة", "trips", Plane],
  order_update: ["طلب", "orders", Package],
  order_disputed: ["نزاع على طلب", "orders", Package],
  follow: ["متابعة", "general", UserPlus],
  kyc_decision: ["توثيق", "general", ShieldCheck],
  verification_request: ["توثيق", "general", ShieldCheck],
  admin_broadcast: ["من طير", "general", Megaphone],
  app_update: ["تحديث التطبيق", "general", Sparkles],
  listing_new: ["إعلان", "general", ShoppingBag],
  listing_watch: ["طلبك في السوق", "general", ShoppingBag],
  return_nudge: ["طير", "general", Bell],
  listing: ["إعلان", "general", ShoppingBag],
  story_new: ["قصة", "general", Sparkles],
};

function faceOf(item) {
  const kind = String(item?.type || "");
  const known = FACE[kind];
  const fallback = kind.startsWith("chat")
    ? ["رسالة", "messages", MessageCircle]
    : kind.startsWith("clinic")
      ? ["العيادة", "clinic", HeartPulse]
      : kind.startsWith("trip")
        ? ["رحلة", "trips", Plane]
        : kind.startsWith("order")
          ? ["طلب", "orders", Package]
          : ["طير", "general", Bell];
  const [label, channel, Icon] = known || fallback;
  return { label: item?.label || label, channel: item?.channel || channel, Icon };
}

function dayBucket(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "أقدم";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(then);
  day.setHours(0, 0, 0, 0);
  const diff = (start.getTime() - day.getTime()) / 86400000;
  if (diff < 1) return "اليوم";
  if (diff < 2) return "أمس";
  if (diff < 7) return "هذا الأسبوع";
  return "أقدم";
}

function withSections(items) {
  const rows = [];
  let last = "";
  items.forEach((item) => {
    const bucket = dayBucket(item.created_at);
    if (bucket !== last) {
      rows.push({ row: "head", id: `head-${bucket}`, title: bucket });
      last = bucket;
    }
    rows.push({ row: "item", id: item.notif_id, item });
  });
  return rows;
}

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
            {withSections(items).map((row) => {
              if (row.row === "head") {
                return <div key={row.id} style={styles.section}>{row.title}</div>;
              }
              const n = row.item;
              const face = faceOf(n);
              const Icon = face.Icon;
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
                  <div style={{ ...styles.icon, background: TAIR.emerald, color: TAIR.gold }}>
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <div style={styles.body}>
                    <div style={styles.rowTop}>
                      <span style={styles.kind} data-testid={`notif-kind-${n.notif_id}`}>{face.label}</span>
                      <div style={styles.time}>{timeAgo(n.created_at)}</div>
                    </div>
                    <div style={styles.title}>{n.title}</div>
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
  section: {
    color: TAIR.textSoft, fontSize: 12, fontWeight: 800,
    textAlign: "right", marginTop: 8, marginBottom: 2,
  },
  kind: {
    display: "inline-flex",
    background: "rgba(27,61,47,0.08)",
    color: TAIR.emerald,
    border: "1px solid rgba(198,161,91,0.45)",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 10, fontWeight: 800,
  },
  title: {
    fontSize: 13, fontWeight: 800, color: TAIR.emerald, marginTop: 6,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
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
