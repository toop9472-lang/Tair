/**
 * MyRequestsScreen — طلباتي = محادثات مرتبطة بإعلاناتي فقط.
 * لا يوجد نظام طلبات/ضمان في هذا التطبيق. كل الصفقات عبر المحادثة/واتساب.
 */
import React, { useEffect, useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { tairApi } from "./tairApi";

import { TAIR, TAIR_PAGE_STYLE, timeAgo12 as timeAgo } from "./TairAppChrome";

const TAIR_STYLE = TAIR;

function timeAgoLocal(iso) {
  if (!iso) return "";
  return "";
}

export default function MyRequestsScreen({ user, onBack, onOpenThread }) {
  const uid = user?.id || user?.user_id;
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    tairApi
      .chatThreads(uid)
      .then((items) => {
        // احتفظ فقط بالمحادثات المرتبطة بإعلان
        const withListing = (items || []).filter((t) => !!t.listing_id);
        setThreads(withListing);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: TAIR.bg, fontFamily: '"Tajawal", "IBM Plex Sans Arabic", system-ui', paddingBottom: 40 }}>
      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: TAIR.bg, padding: "16px", display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 12, borderBottom: `1px solid ${TAIR.divider}` }}>
        <button
          onClick={onBack}
          data-testid="back-btn"
          aria-label="رجوع"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", color: TAIR.emerald }}
        >
          <ChevronRight size={24} strokeWidth={2} />
        </button>
        <div style={{ flex: 1, textAlign: "right", color: TAIR.emerald, fontSize: 18, fontWeight: 900 }}>طلباتي</div>
      </div>

      <div style={{ padding: "12px 16px", color: TAIR.textSoft, fontSize: 13, textAlign: "right" }}>
        كل الصفقات تتم عبر المحادثة أو واتساب. هذه محادثاتك المرتبطة بإعلانات.
      </div>

      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>...جاري التحميل</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>
            لا توجد طلبات/محادثات إعلانات بعد
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {threads.map((t) => (
              <button
                key={t.thread_id || t.id}
                onClick={() => onOpenThread?.(t.thread_id || t.id)}
                data-testid={`request-thread-${t.thread_id || t.id}`}
                style={{
                  display: "flex",
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 14,
                  background: TAIR.card,
                  border: `1px solid ${TAIR.divider}`,
                  boxShadow: TAIR.shadow,
                  cursor: "pointer",
                  textAlign: "right",
                  fontFamily: "inherit",
                  width: "100%",
                }}
              >
                <div style={{ width: 56, height: 56, borderRadius: 10, background: TAIR.divider, overflow: "hidden", flexShrink: 0 }}>
                  {t.listing_image ? (
                    <img src={t.listing_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: TAIR.textSoft }}>
                      <MessageCircle size={22} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: TAIR.emerald, fontSize: 15, fontWeight: 800, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.listing_title || t.peer_name || "محادثة"}
                  </div>
                  <div style={{ color: TAIR.textSoft, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.last_message || "—"}
                  </div>
                </div>
                <div style={{ color: TAIR.textSoft, fontSize: 11, direction: "ltr" }}>{timeAgo(t.last_at || t.updated_at)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
