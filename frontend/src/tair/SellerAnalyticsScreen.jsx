// طير — Seller analytics: overview KPIs + per-listing performance
import React, { useEffect, useState } from "react";
import {
  ArrowRight, TrendingUp, Eye, Heart, MessageCircle, ShoppingBag, Star, BarChart3,
} from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi } from "./tairApi";
import TairBanner, { BannerCircleBtn, PAGE_BG_STYLE } from "./TairBanner";
import { EmptyState } from "./TairUI";

const fmt = (v) => new Intl.NumberFormat("ar-SA").format(v || 0);

export default function SellerAnalyticsScreen({ user, onBack, onOpenListing }) {
  const [overview, setOverview] = useState(null);
  const [listings, setListings] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const uid = user?.user_id || user?.id;
    if (!uid) return;
    setLoading(true);
    (async () => {
      try {
        const [ov, ls] = await Promise.all([
          tairApi.getSellerAnalyticsOverview(uid, days),
          tairApi.getSellerAnalyticsListings(uid, 50),
        ]);
        if (!alive) return;
        setOverview(ov);
        setListings(ls || []);
      } catch (e) {
        if (alive) setErr(e?.response?.data?.detail || "تعذّر تحميل الإحصائيات");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user, days]);

  return (
    <div style={{ ...S.screen, ...PAGE_BG_STYLE }} data-testid="seller-analytics">
      <TairBanner
        rightSlot={
          <BannerCircleBtn onClick={onBack} testId="analytics-back">
            <ArrowRight size={22} strokeWidth={2.4} color="#fff" />
          </BannerCircleBtn>
        }
      />

      <div style={styles.header}>
        <div style={styles.titleRow}>
          <BarChart3 size={20} color={T.primary} strokeWidth={2.4} />
          <div style={styles.title}>إحصائياتي</div>
        </div>

        <div style={styles.chipRow}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                ...styles.chip,
                background: days === d ? T.primary : T.surface,
                color: days === d ? "#fff" : T.text,
                borderColor: days === d ? T.primary : T.border,
              }}
              data-testid={`analytics-range-${d}`}
            >
              آخر {d} يوم
            </button>
          ))}
        </div>
      </div>

      <div style={S.container}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>جاري التحميل…</div>
        ) : err ? (
          <EmptyState icon={<TrendingUp size={36} strokeWidth={1.5} />} title={err} />
        ) : (
          <>
            {/* KPI grid */}
            <div style={styles.kpiGrid}>
              <Kpi
                icon={<Eye size={18} color="#0f766e" />}
                label="مشاهدات"
                value={fmt(overview?.engagement?.views)}
              />
              <Kpi
                icon={<Heart size={18} color="#ec4899" />}
                label="إعجابات"
                value={fmt(overview?.engagement?.likes)}
              />
              <Kpi
                icon={<MessageCircle size={18} color="#2563eb" />}
                label={`رسائل (${days}ي)`}
                value={fmt(overview?.engagement?.messages_received)}
              />
              <Kpi
                icon={<ShoppingBag size={18} color="#f59e0b" />}
                label="طلبات"
                value={fmt(overview?.orders?.total)}
                sub={overview?.orders?.completed > 0 ? `${overview.orders.completed} مكتملة` : null}
              />
            </div>

            {/* Rating + listing counts */}
            <div style={styles.summaryCard}>
              <SummaryRow
                label="إعلانات نشطة"
                value={overview?.listings?.active}
                total={overview?.listings?.total}
              />
              <SummaryRow
                label="إعلانات مباعة"
                value={overview?.listings?.sold}
                total={overview?.listings?.total}
              />
              <SummaryRow
                label="نسبة إتمام الطلبات"
                value={
                  overview?.orders?.total
                    ? `${Math.round((overview.orders.completion_rate || 0) * 100)}%`
                    : "—"
                }
              />
              <SummaryRow
                label="متوسط التقييم"
                value={
                  overview?.rating?.avg != null
                    ? `${overview.rating.avg.toFixed(1)} ⭐`
                    : "—"
                }
                sub={overview?.rating?.count > 0 ? `${overview.rating.count} مراجعة` : null}
              />
            </div>

            {/* Per-listing performance */}
            <div style={S.h2}>أداء كل إعلان</div>
            {listings.length === 0 ? (
              <EmptyState icon={<TrendingUp size={36} strokeWidth={1.5} />} title="لا توجد إعلانات بعد" />
            ) : (
              <div style={styles.listingList}>
                {listings.map((l) => (
                  <button
                    key={l.listing_id}
                    onClick={() => onOpenListing && onOpenListing(l.listing_id)}
                    style={styles.listingRow}
                    data-testid={`analytics-listing-${l.listing_id}`}
                  >
                    <div style={styles.listingImg}>
                      {l.cover ? (
                        <img src={l.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}
                    </div>
                    <div style={styles.listingBody}>
                      <div style={styles.listingTitle}>{l.title}</div>
                      <div style={styles.listingStats}>
                        <span><Eye size={11} strokeWidth={2.5} /> {fmt(l.view_count)}</span>
                        <span><Heart size={11} strokeWidth={2.5} /> {fmt(l.likes_count)}</span>
                        <span style={{
                          color: l.status === "sold" ? "#ef4444" : l.status === "paused" ? "#f59e0b" : "#0f766e",
                          fontWeight: 800,
                        }}>
                          {l.status === "sold" ? "مباع" : l.status === "paused" ? "متوقّف" : "نشط"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiIcon}>{icon}</div>
      <div style={styles.kpiVal}>{value}</div>
      <div style={styles.kpiLbl}>{label}</div>
      {sub && <div style={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

function SummaryRow({ label, value, total, sub }) {
  return (
    <div style={styles.sumRow}>
      <div style={styles.sumLabel}>{label}</div>
      <div style={styles.sumValue}>
        {value}
        {total != null && <span style={styles.sumTotal}> / {total}</span>}
        {sub && <div style={styles.sumSub}>{sub}</div>}
      </div>
    </div>
  );
}

const styles = {
  header: { background: T.surface, padding: "14px 16px 10px", borderBottom: `1px solid ${T.border}` },
  titleRow: { display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { fontSize: 17, fontWeight: 900, color: T.textStrong },
  chipRow: { display: "flex", flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" },
  chip: {
    padding: "6px 12px", borderRadius: T.radiusPill,
    border: `1px solid ${T.border}`, fontFamily: "inherit",
    fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
  },

  kpiGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
    margin: "12px 0",
  },
  kpi: {
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd, padding: 14, textAlign: "right",
  },
  kpiIcon: { marginBottom: 6 },
  kpiVal: { fontSize: 22, fontWeight: 900, color: T.textStrong, lineHeight: 1 },
  kpiLbl: { fontSize: 11, color: T.textMuted, fontWeight: 700, marginTop: 4 },
  kpiSub: { fontSize: 10, color: T.textFaint, marginTop: 2 },

  summaryCard: {
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd, padding: 4, marginBottom: 14,
  },
  sumRow: {
    display: "flex", flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", padding: "10px 12px",
    borderBottom: `1px solid ${T.divider}`,
  },
  sumLabel: { fontSize: 13, color: T.textMuted, fontWeight: 600 },
  sumValue: { fontSize: 14, fontWeight: 800, color: T.textStrong, textAlign: "left" },
  sumTotal: { color: T.textFaint, fontWeight: 600, fontSize: 12 },
  sumSub: { fontSize: 10, color: T.textFaint, fontWeight: 600, marginTop: 2 },

  listingList: { display: "flex", flexDirection: "column", gap: 8 },
  listingRow: {
    display: "flex", flexDirection: "row-reverse", gap: 10,
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd, padding: 10, cursor: "pointer",
    fontFamily: "inherit", textAlign: "right",
  },
  listingImg: {
    width: 56, height: 56, borderRadius: 10, overflow: "hidden",
    background: T.bgAlt, flexShrink: 0,
  },
  listingBody: { flex: 1, minWidth: 0 },
  listingTitle: {
    fontSize: 13, fontWeight: 700, color: T.text,
    display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
  listingStats: {
    display: "flex", flexDirection: "row-reverse", gap: 10, marginTop: 6,
    color: T.textMuted, fontSize: 11, fontWeight: 700,
    alignItems: "center",
  },
};
