// طير — Wholesale suppliers directory screen
import React, { useEffect, useState } from "react";
import { ArrowRight, Phone, MessageCircle, Globe, ShieldCheck, MapPin, Boxes, Package } from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi } from "./tairApi";
import TairBanner, { BannerCircleBtn, PAGE_BG_STYLE } from "./TairBanner";
import { EmptyState } from "./TairUI";

export default function WholesaleScreen({ onBack }) {
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tairApi.wholesaleCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { limit: 40 };
    if (category) params.category = category;
    tairApi
      .listWholesaleSuppliers(params)
      .then((items) => setSuppliers(items || []))
      .catch(() => setSuppliers([]))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div style={{ ...S.screen, ...PAGE_BG_STYLE }} data-testid="wholesale-screen">
      <TairBanner
        rightSlot={
          <BannerCircleBtn onClick={onBack} testId="wholesale-back" ariaLabel="رجوع">
            <ArrowRight size={22} strokeWidth={2.4} color="#fff" />
          </BannerCircleBtn>
        }
      />

      <div style={styles.header}>
        <div style={styles.headerRow}>
          <Boxes size={20} strokeWidth={2.2} color={T.primary} />
          <div style={styles.headerTitle}>موردو الطيور بالجملة والمستلزمات</div>
        </div>
        <div style={styles.headerSub}>
          طيور، أعلاف، أقفاص، وأدوات بأسعار الجملة — تواصل مباشرة عبر واتساب.
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div style={styles.chipsWrap}>
          <div style={styles.chipsRow}>
            <button
              onClick={() => setCategory(null)}
              style={{
                ...styles.chip,
                background: !category ? T.primary : T.surface,
                color: !category ? "#fff" : T.text,
                borderColor: !category ? T.primary : T.border,
              }}
              data-testid="wholesale-cat-all"
            >
              الكل
            </button>
            {categories.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  style={{
                    ...styles.chip,
                    background: active ? T.primary : T.surface,
                    color: active ? "#fff" : T.text,
                    borderColor: active ? T.primary : T.border,
                  }}
                  data-testid={`wholesale-cat-${c.id}`}
                >
                  {c.name_ar}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={S.container}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>جاري التحميل…</div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={<Package size={36} strokeWidth={1.5} />}
            title="لا يوجد موردون حالياً"
            desc="نعمل على إضافة موردي الطيور والمستلزمات بالجملة قريباً. ترقّبوا التحديثات!"
          />
        ) : (
          <div style={styles.list}>
            {suppliers.map((s) => (
              <SupplierCard key={s.supplier_id} supplier={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SupplierCard({ supplier }) {
  const openWhatsApp = () => {
    if (!supplier.whatsapp) return;
    const num = String(supplier.whatsapp).replace(/[^\d]/g, "");
    window.open(`https://wa.me/${num}`, "_blank", "noopener");
  };
  const openPhone = () => {
    if (!supplier.phone) return;
    window.location.href = `tel:${supplier.phone}`;
  };
  const openSite = () => {
    if (!supplier.website) return;
    window.open(supplier.website, "_blank", "noopener");
  };

  return (
    <div style={styles.card} data-testid={`supplier-${supplier.supplier_id}`}>
      <div style={styles.cardHead}>
        <div style={styles.logo}>
          {supplier.logo_url ? (
            <img src={supplier.logo_url} alt={supplier.name} style={styles.logoImg} />
          ) : (
            <Package size={26} strokeWidth={2} color={T.primary} />
          )}
        </div>
        <div style={styles.cardHeadBody}>
          <div style={styles.nameRow}>
            <div style={styles.name}>{supplier.name}</div>
            {supplier.is_verified && (
              <span style={styles.verifiedBadge}>
                <ShieldCheck size={12} strokeWidth={2.6} />
                <span>موثّق</span>
              </span>
            )}
          </div>
          <div style={styles.metaRow}>
            <MapPin size={13} strokeWidth={2} color={T.textMuted} />
            <span>{supplier.city}</span>
            {supplier.min_order_sar > 0 && (
              <>
                <span style={styles.dot}>•</span>
                <span>حد أدنى {supplier.min_order_sar} ر.س</span>
              </>
            )}
          </div>
        </div>
      </div>

      {supplier.description && (
        <div style={styles.desc}>{supplier.description}</div>
      )}

      {Array.isArray(supplier.categories) && supplier.categories.length > 0 && (
        <div style={styles.tags}>
          {supplier.categories.slice(0, 6).map((c) => (
            <span key={c} style={styles.tag}>{c}</span>
          ))}
        </div>
      )}

      <div style={styles.actions}>
        {supplier.whatsapp && (
          <button onClick={openWhatsApp} style={{ ...styles.actionBtn, ...styles.waBtn }} data-testid={`supplier-${supplier.supplier_id}-wa`}>
            <MessageCircle size={16} strokeWidth={2.4} />
            <span>واتساب</span>
          </button>
        )}
        {supplier.phone && (
          <button onClick={openPhone} style={styles.actionBtn} data-testid={`supplier-${supplier.supplier_id}-call`}>
            <Phone size={16} strokeWidth={2.4} />
            <span>اتصال</span>
          </button>
        )}
        {supplier.website && (
          <button onClick={openSite} style={styles.actionBtn}>
            <Globe size={16} strokeWidth={2.4} />
            <span>الموقع</span>
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  header: {
    background: T.surface,
    padding: "14px 16px 12px",
    borderBottom: `1px solid ${T.border}`,
  },
  headerRow: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: 900, color: T.textStrong },
  headerSub: { fontSize: 12, color: T.textMuted, textAlign: "right", marginTop: 4, lineHeight: 1.5 },

  chipsWrap: {
    background: "rgba(255,255,255,0.9)",
    borderBottom: `1px solid ${T.border}`,
    padding: "8px 0",
  },
  chipsRow: {
    display: "flex", flexDirection: "row-reverse", gap: 6,
    padding: "0 12px", overflowX: "auto", scrollbarWidth: "none",
  },
  chip: {
    padding: "6px 14px",
    borderRadius: T.radiusPill,
    border: `1px solid ${T.border}`,
    fontSize: 12, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
    transition: "all 0.15s",
  },

  list: { display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 5 },
  card: {
    background: T.surface,
    borderRadius: T.radiusMd,
    padding: 14,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowXs,
    display: "flex", flexDirection: "column", gap: 10,
  },
  cardHead: {
    display: "flex", flexDirection: "row-reverse", gap: 12, alignItems: "flex-start",
  },
  logo: {
    width: 56, height: 56, borderRadius: 14,
    background: T.bgAlt,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%", objectFit: "cover" },
  cardHeadBody: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  nameRow: { display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: 800, color: T.textStrong },
  verifiedBadge: {
    display: "inline-flex", flexDirection: "row-reverse", alignItems: "center", gap: 3,
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#fff", fontSize: 10, fontWeight: 800,
    padding: "2px 8px", borderRadius: 8,
  },
  metaRow: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 4,
    color: T.textMuted, fontSize: 12, fontWeight: 600,
  },
  dot: { color: T.textFaint },
  desc: { fontSize: 13, color: T.text, lineHeight: 1.6, textAlign: "right" },
  tags: { display: "flex", flexDirection: "row-reverse", flexWrap: "wrap", gap: 5 },
  tag: {
    fontSize: 10, fontWeight: 700, color: T.primary,
    background: "rgba(15,118,110,0.08)",
    padding: "3px 8px", borderRadius: 999,
  },
  actions: { display: "flex", flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  actionBtn: {
    flex: 1, minWidth: 0,
    display: "inline-flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 12px", borderRadius: T.radius,
    border: `1px solid ${T.border}`, background: T.surface,
    color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  waBtn: {
    background: "#25D366",
    color: "#fff",
    borderColor: "#25D366",
  },
};
