// طير — Wholesale suppliers directory screen
import React, { useEffect, useState } from "react";
import { ArrowRight, Phone, MessageCircle, Globe, ShieldCheck, MapPin, Boxes, Package } from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi } from "./tairApi";
import { LocationPicker } from "./locations";
import TairBanner, { BannerCircleBtn, PAGE_BG_STYLE } from "./TairBanner";
import { EmptyState } from "./TairUI";
import { toWhatsAppPhone } from "./contactPhone";

const EMPTY_FORM = {
  name: "", city: "الرياض", categories: [], description: "",
  min_order_sar: "", whatsapp: "", phone: "", website: "", is_active: true,
};

export default function WholesaleScreen({ user, onBack }) {
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    tairApi.wholesaleCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!(user?.user_id || user?.id)) return;
    tairApi.getMySupplier().then(setMine).catch(() => setMine(null));
  }, [user]);

  const openForm = () => {
    if (!(user?.user_id || user?.id)) {
      setError("سجّل دخولك ثم أضف شركتك.");
      return;
    }
    setForm({
      name: mine?.name || "",
      city: mine?.city || "الرياض",
      categories: Array.isArray(mine?.categories) ? mine.categories : [],
      description: mine?.description || "",
      min_order_sar: mine?.min_order_sar ? String(mine.min_order_sar) : "",
      whatsapp: mine?.whatsapp || user?.whatsapp || user?.phone || "",
      phone: mine?.phone || "",
      website: mine?.website || "",
      is_active: mine ? mine.is_active !== false : true,
    });
    setError("");
    setFormOpen(true);
  };

  const toggleCat = (id) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter((x) => x !== id) : [...f.categories, id],
    }));
  };

  const submit = async () => {
    setError("");
    if (form.name.trim().length < 2) return setError("اكتب اسم الشركة");
    if (!form.categories.length) return setError("اختر فئة واحدة على الأقل");
    if (form.description.trim().length < 10) return setError("صف نشاط الشركة بعشر أحرف على الأقل");
    if (!form.whatsapp.trim() && !form.phone.trim()) return setError("أدخل واتساب أو رقم جوال");
    const payload = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      min_order_sar: Number(form.min_order_sar) || 0,
      whatsapp: form.whatsapp.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
    };
    setSaving(true);
    try {
      const saved = mine ? await tairApi.updateMySupplier(payload) : await tairApi.registerSupplier(payload);
      setMine(saved);
      setFormOpen(false);
      const params = { limit: 40 };
      if (category) params.category = category;
      setSuppliers((await tairApi.listWholesaleSuppliers(params)) || []);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "تعذّر حفظ الشركة");
    } finally {
      setSaving(false);
    }
  };

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
          سجّل شركتك فتظهر في الدليل. التوثيق من إدارة طير.
        </div>
        <button type="button" onClick={openForm} data-testid="wholesale-register-btn" style={styles.registerBtn}>
          {mine ? "عدّل بيانات شركتك" : "سجّل شركتك كمورد"}
        </button>
        {error && !formOpen ? <div style={{ color: "#8B3A2F", marginTop: 8, fontWeight: 700 }}>{error}</div> : null}
      </div>

      {formOpen && (
        <div style={styles.form} data-testid="supplier-form">
          <div style={styles.formTitle}>{mine ? "بيانات الشركة" : "تسجيل شركة توريد"}</div>
          <p style={styles.formHint}>تظهر الشركة فوراً بعلامة «بانتظار التوثيق».</p>
          <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الشركة" />
          <button type="button" style={styles.input} onClick={() => setCityOpen(true)}>{form.city}</button>
          <div style={styles.tags}>
            {categories.map((c) => {
              const on = form.categories.includes(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggleCat(c.id)} style={{ ...styles.tag, background: on ? "#1B3D2F" : "#F7F1E8", color: on ? "#C6A15B" : "#1B3D2F" }}>
                  {c.name_ar}
                </button>
              );
            })}
          </div>
          <textarea style={{ ...styles.input, minHeight: 80 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ماذا توردون؟" />
          <input style={styles.input} value={form.min_order_sar} onChange={(e) => setForm({ ...form, min_order_sar: e.target.value })} placeholder="الحد الأدنى بالريال" />
          <input style={styles.input} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="واتساب 05xxxxxxxx" />
          <input style={styles.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="جوال آخر (اختياري)" />
          <input style={styles.input} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="الموقع (اختياري)" />
          <label style={styles.check}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> ظاهرة في الدليل</label>
          {error ? <div style={{ color: "#8B3A2F", fontWeight: 700 }}>{error}</div> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setFormOpen(false)} style={styles.ghost}>إلغاء</button>
            <button type="button" onClick={submit} disabled={saving} data-testid="supplier-form-submit" style={styles.registerBtn}>{saving ? "جارٍ الحفظ…" : "حفظ"}</button>
          </div>
        </div>
      )}

      {cityOpen && (
        <div onClick={() => setCityOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,36,28,0.35)", zIndex: 30, display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxHeight: "80vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 8 }}>
            <LocationPicker selected={form.city} onSelect={(c) => { if (c) { setForm((f) => ({ ...f, city: c })); setCityOpen(false); } }} />
          </div>
        </div>
      )}

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
            desc="ما فيه موردين بهالفئة الحين. سجّل شركتك من الزر أعلاه."
          />
        ) : (
          <div style={styles.list}>
            {suppliers.map((s) => (
              <SupplierCard key={s.supplier_id} supplier={s} categories={categories} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SupplierCard({ supplier, categories = [] }) {
  const openWhatsApp = () => {
    if (!supplier.whatsapp) return;
    const num = toWhatsAppPhone(supplier.whatsapp);
    if (!num) return;
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
            <span style={supplier.is_verified ? styles.verifiedBadge : styles.pendingBadge}>
              {supplier.is_verified ? <ShieldCheck size={12} strokeWidth={2.6} /> : null}
              <span>{supplier.is_verified ? "موثّق" : "بانتظار التوثيق"}</span>
            </span>
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
            <span key={c} style={styles.tag}>{categories.find((x) => x.id === c)?.name_ar || c}</span>
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
    background: "#1B3D2F",
    color: "#C6A15B", fontSize: 10, fontWeight: 800,
    padding: "2px 8px", borderRadius: 8,
  },
  pendingBadge: {
    display: "inline-flex", alignItems: "center",
    background: "#F7F1E8", color: "#6B5E4A", fontSize: 10, fontWeight: 800,
    padding: "2px 8px", borderRadius: 8,
  },
  registerBtn: {
    marginTop: 10, background: "#1B3D2F", color: "#C6A15B", border: "none",
    borderRadius: 12, padding: "10px 14px", fontWeight: 900, cursor: "pointer", fontFamily: "inherit",
  },
  form: {
    margin: "12px 16px", padding: 14, background: "#fff", borderRadius: 16,
    border: "1px solid #E6DCC8", display: "flex", flexDirection: "column", gap: 8,
  },
  formTitle: { fontWeight: 900, color: "#1B3D2F", textAlign: "right" },
  formHint: { margin: 0, color: "#6B5E4A", fontSize: 12, textAlign: "right" },
  input: {
    width: "100%", boxSizing: "border-box", border: "1px solid #E6DCC8", borderRadius: 12,
    padding: "10px 12px", textAlign: "right", fontFamily: "inherit", background: "#fff",
  },
  check: { display: "flex", flexDirection: "row-reverse", gap: 8, alignItems: "center", color: "#1B3D2F", fontWeight: 700 },
  ghost: { background: "transparent", border: "1px solid #E6DCC8", borderRadius: 12, padding: "10px 14px", fontFamily: "inherit", cursor: "pointer" },
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
