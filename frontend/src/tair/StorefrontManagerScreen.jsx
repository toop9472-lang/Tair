// طير — Professional store manager on the web
import React, { useEffect, useState } from "react";
import { ArrowRight, Eye } from "lucide-react";
import { T } from "./tairTheme";
import { tairApi } from "./tairApi";
import { toast } from "../hooks/use-toast";

const COLORS = ["#1B3D2F", "#3D6B54", "#C6A15B", "#8A6A2E", "#0F241C", "#0E7490", "#059669", "#8B3A2F"];
const DAYS = [
  ["sat", "السبت"], ["sun", "الأحد"], ["mon", "الاثنين"], ["tue", "الثلاثاء"],
  ["wed", "الأربعاء"], ["thu", "الخميس"], ["fri", "الجمعة"],
];
const PROMISES = ["خلال ساعة", "نفس اليوم", "خلال يومين"];
const TABS = [
  ["identity", "الهوية"],
  ["hours", "الدوام"],
  ["media", "الوسائط"],
  ["service", "الخدمة"],
  ["sales", "العروض"],
  ["analytics", "التحليلات"],
];

export default function StorefrontManagerScreen({ user, onBack, onPreview }) {
  const uid = user?.id || user?.user_id;
  const [tab, setTab] = useState("identity");
  const [settings, setSettings] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponPct, setCouponPct] = useState("10");
  const [flashTitle, setFlashTitle] = useState("");
  const [flashPct, setFlashPct] = useState("10");
  const [flashHours, setFlashHours] = useState("24");
  const [stockName, setStockName] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [cityDraft, setCityDraft] = useState("");

  const load = () => {
    if (!uid) return;
    tairApi.storefrontSettings(uid).then(setSettings).catch((e) => {
      toast({ title: "تعذّر تحميل المتجر", description: e?.message, variant: "destructive" });
    });
  };
  useEffect(() => { load(); }, [uid]);
  useEffect(() => {
    if (tab === "analytics" && uid) {
      tairApi.storeAnalytics(uid, 30).then(setAnalytics).catch(() => setAnalytics(null));
    }
  }, [tab, uid]);

  const save = async (patch) => {
    setBusy(true);
    try {
      await tairApi.updateStorefront(uid, patch);
      setSettings((prev) => ({ ...(prev || {}), ...patch }));
      toast({ title: "تم الحفظ" });
    } catch (e) {
      toast({ title: "تعذّر الحفظ", description: e?.response?.data?.detail || e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (kind, file, apply) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await tairApi.uploadStoreMedia(uid, kind, file);
      await apply(url);
    } catch (e) {
      toast({ title: "تعذّر رفع الصورة", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return <Shell onBack={onBack} title="إدارة المتجر"><p style={muted}>جاري التحميل…</p></Shell>;
  }
  const s = settings;

  return (
    <Shell onBack={onBack} onPreview={onPreview} title="إدارة المتجر الاحترافي" busy={busy}>
      <div style={tabsRow}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} data-testid={`sf-tab-${id}`} style={{ ...tabBtn, ...(tab === id ? tabOn : null) }}>{label}</button>
        ))}
      </div>

      {tab === "identity" && (
        <Card title="الهوية">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => save({ identity_color: c })} style={{ width: 36, height: 36, borderRadius: 18, background: c, border: s.identity_color === c ? "3px solid #0F241C" : "3px solid transparent" }} />
            ))}
          </div>
          <Field label="من نحن" value={s.about_text || ""} onChange={(v) => setSettings({ ...s, about_text: v })} multiline />
          <button type="button" style={primary} onClick={() => save({ about_text: s.about_text || "" })}>حفظ النبذة</button>
          {["whatsapp", "call", "chat"].map((k) => (
            <label key={k} style={row}>
              <span>{k === "whatsapp" ? "واتساب" : k === "call" ? "اتصال" : "دردشة داخلية"}</span>
              <input type="checkbox" checked={!!s.contact_prefs?.[k]} onChange={(e) => save({ contact_prefs: { ...(s.contact_prefs || {}), [k]: e.target.checked } })} />
            </label>
          ))}
        </Card>
      )}

      {tab === "hours" && (
        <Card title="ساعات العمل">
          {(s.business_hours || []).map((h, i) => (
            <div key={h.day} style={row}>
              <span style={{ width: 72 }}>{DAYS.find((d) => d[0] === h.day)?.[1] || h.day}</span>
              <input style={mini} value={h.open || ""} onChange={(e) => {
                const next = [...s.business_hours];
                next[i] = { ...next[i], open: e.target.value };
                setSettings({ ...s, business_hours: next });
              }} />
              <input style={mini} value={h.close || ""} onChange={(e) => {
                const next = [...s.business_hours];
                next[i] = { ...next[i], close: e.target.value };
                setSettings({ ...s, business_hours: next });
              }} />
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={!h.closed} onChange={(e) => {
                  const next = [...s.business_hours];
                  next[i] = { ...next[i], closed: !e.target.checked };
                  setSettings({ ...s, business_hours: next });
                }} /> مفتوح
              </label>
            </div>
          ))}
          <button type="button" style={primary} onClick={() => save({ business_hours: s.business_hours })}>حفظ الدوام</button>
        </Card>
      )}

      {tab === "media" && (
        <>
          <Card title="الشعار والبانر">
            <FileLabel label="رفع الشعار" onFile={(file) => upload("logo", file, async (url) => { await tairApi.updateStorefront(uid, { logo_url: url }); setSettings((p) => ({ ...p, logo_url: url })); })} />
            {s.logo_url ? <img alt="" src={s.logo_url} style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} /> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {(s.banner_slides || []).map((url, i) => (
                <button key={url} type="button" onClick={() => save({ banner_slides: s.banner_slides.filter((_, x) => x !== i) })} style={{ padding: 0, border: 0, background: "transparent" }}>
                  <img alt="" src={url} style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 8 }} />
                </button>
              ))}
            </div>
            {(s.banner_slides || []).length < 5 && (
              <FileLabel label="أضف بانر" onFile={(file) => upload("banner", file, async (url) => {
                const slides = [...(s.banner_slides || []), url].slice(0, 5);
                await tairApi.updateStorefront(uid, { banner_slides: slides });
                setSettings((p) => ({ ...p, banner_slides: slides }));
              })} />
            )}
            <p style={muted}>اضغط صورة البانر لحذفها. تظهر كل الصور في واجهة المتجر.</p>
          </Card>
        </>
      )}

      {tab === "service" && (
        <Card title="خدمة الزبائن">
          <label style={row}>
            <span>إيقاف المتجر مؤقتاً</span>
            <input type="checkbox" checked={!!s.store_paused} onChange={(e) => save({ store_paused: e.target.checked })} />
          </label>
          <Field label="إعلان قصير" value={s.announcement || ""} onChange={(v) => setSettings({ ...s, announcement: v })} multiline />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {PROMISES.map((label) => (
              <button key={label} type="button" onClick={() => setSettings({ ...s, response_promise: s.response_promise === label ? "" : label })} style={{ ...tabBtn, ...(s.response_promise === label ? tabOn : null) }}>{label}</button>
            ))}
          </div>
          <Field label="التوصيل" value={s.shipping_note || ""} onChange={(v) => setSettings({ ...s, shipping_note: v })} multiline />
          <Field label="الاسترجاع" value={s.return_note || ""} onChange={(v) => setSettings({ ...s, return_note: v })} multiline />
          <Field label="مدينة المتجر" value={s.location?.city || ""} onChange={(v) => setSettings({ ...s, location: { ...(s.location || {}), city: v, address_label: v } })} />
          <label style={row}>
            <span>الاستلام من المتجر</span>
            <input type="checkbox" checked={!!s.pickup_enabled} onChange={(e) => setSettings({ ...s, pickup_enabled: e.target.checked })} />
          </label>
          <Field label="تعليمات الاستلام" value={s.pickup_note || ""} onChange={(v) => setSettings({ ...s, pickup_note: v })} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {(s.delivery_cities || []).map((city) => (
              <button key={city} type="button" style={tabBtn} onClick={() => setSettings({ ...s, delivery_cities: s.delivery_cities.filter((c) => c !== city) })}>{city} ×</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...mini, flex: 1 }} value={cityDraft} placeholder="مدينة توصيل" onChange={(e) => setCityDraft(e.target.value)} />
            <button type="button" style={primary} onClick={() => {
              const city = cityDraft.trim();
              if (!city || (s.delivery_cities || []).includes(city)) return;
              setSettings({ ...s, delivery_cities: [...(s.delivery_cities || []), city].slice(0, 8) });
              setCityDraft("");
            }}>أضف</button>
          </div>
          <label style={row}>
            <span>رد آلي خارج الدوام</span>
            <input type="checkbox" checked={!!s.auto_reply_enabled} onChange={(e) => setSettings({ ...s, auto_reply_enabled: e.target.checked })} />
          </label>
          <Field label="نص الرد" value={s.auto_reply_message || ""} onChange={(v) => setSettings({ ...s, auto_reply_message: v })} multiline />
          <p style={muted}>يصل الرد مرة في اليوم لكل محادثة عندما يكون المتجر مغلقاً أو متوقفاً.</p>
          <button type="button" style={primary} onClick={() => save({
            announcement: s.announcement || "",
            response_promise: s.response_promise || "",
            shipping_note: s.shipping_note || "",
            return_note: s.return_note || "",
            delivery_cities: s.delivery_cities || [],
            pickup_enabled: !!s.pickup_enabled,
            pickup_note: s.pickup_note || "",
            location: s.location || null,
            auto_reply_enabled: !!s.auto_reply_enabled,
            auto_reply_message: s.auto_reply_message || "",
          })}>حفظ الخدمة</button>
        </Card>
      )}

      {tab === "sales" && (
        <>
          <Card title="عرض لفترة محدودة">
            <Field label="العنوان" value={flashTitle} onChange={setFlashTitle} />
            <div style={{ display: "flex", gap: 8 }}>
              <Field label="الخصم %" value={flashPct} onChange={setFlashPct} />
              <Field label="الساعات" value={flashHours} onChange={setFlashHours} />
            </div>
            <button type="button" style={primary} onClick={async () => {
              try {
                await tairApi.createFlashSale(uid, {
                  title: flashTitle || "عرض",
                  discount_pct: Number(flashPct) || 10,
                  ends_at: new Date(Date.now() + (Number(flashHours) || 24) * 3600000).toISOString(),
                  listing_ids: [],
                });
                setFlashTitle("");
                load();
              } catch (e) {
                toast({ title: "تعذّر إنشاء العرض", description: e?.response?.data?.detail || e?.message, variant: "destructive" });
              }
            }}>نشر العرض</button>
            {(s.flash_sales || []).map((sale) => (
              <div key={sale.id} style={row}>
                <span>{sale.title} — {sale.discount_pct}%</span>
                <button type="button" style={danger} onClick={async () => { await tairApi.deleteFlashSale(uid, sale.id); load(); }}>حذف</button>
              </div>
            ))}
          </Card>
          <Card title="كوبونات">
            <p style={muted}>الكود يظهر للزائر لينسخه. الخصم يُذكر عند التواصل ولا يُخصم تلقائياً من سعر الإعلان.</p>
            {(s.coupons || []).map((c) => (
              <div key={c.code} style={row}>
                <span>{c.code} — {c.discount_pct}% {c.active === false ? "(مخفي)" : ""}</span>
                <button type="button" style={tabBtn} onClick={async () => { await tairApi.setCouponActive(uid, c.code, c.active === false); load(); }}>{c.active === false ? "إظهار" : "إخفاء"}</button>
                <button type="button" style={danger} onClick={async () => { await tairApi.deleteCoupon(uid, c.code); load(); }}>حذف</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...mini, flex: 1 }} value={couponCode} placeholder="TAIR10" onChange={(e) => setCouponCode(e.target.value)} />
              <input style={{ ...mini, width: 70 }} value={couponPct} onChange={(e) => setCouponPct(e.target.value)} />
            </div>
            <button type="button" style={primary} onClick={async () => {
              try {
                await tairApi.createCoupon(uid, { code: couponCode, discount_pct: Number(couponPct) || 10, active: true });
                setCouponCode("");
                load();
              } catch (e) {
                toast({ title: "تعذّر إضافة الكوبون", description: e?.response?.data?.detail || e?.message, variant: "destructive" });
              }
            }}>أضف الكوبون</button>
          </Card>
          <Card title="المخزون">
            {Object.entries(s.inventory || {}).map(([name, row]) => (
              <div key={name} style={row}>
                <span>{name}: {row?.available ?? 0}</span>
                <button type="button" style={danger} onClick={async () => {
                  const res = await tairApi.updateInventory(uid, { species_id: name, available: 0, reserved: 0 });
                  setSettings((p) => ({ ...p, inventory: res?.inventory || {} }));
                }}>حذف</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...mini, flex: 1 }} value={stockName} placeholder="النوع" onChange={(e) => setStockName(e.target.value)} />
              <input style={{ ...mini, width: 80 }} value={stockQty} placeholder="العدد" onChange={(e) => setStockQty(e.target.value)} />
            </div>
            <button type="button" style={primary} onClick={async () => {
              const name = stockName.trim();
              if (!name) return;
              const res = await tairApi.updateInventory(uid, { species_id: name, available: Number(stockQty) || 0, reserved: 0 });
              setSettings((p) => ({ ...p, inventory: res?.inventory || p.inventory }));
              setStockName("");
              setStockQty("");
            }}>احفظ الكمية</button>
          </Card>
        </>
      )}

      {tab === "analytics" && (
        <Card title="آخر ٣٠ يوماً">
          {!analytics ? <p style={muted}>جاري التحميل…</p> : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Stat label="زائر" value={analytics.total_visitors} />
              <Stat label="مشاهدة" value={analytics.total_listings_views} />
              <Stat label="طلب مكتمل" value={analytics.completed_orders_count} />
              <Stat label="رسالة" value={analytics.messages_received || 0} />
              <Stat label="الحالة" value={analytics.store_paused ? "متوقف" : analytics.open_now ? "مفتوح" : "مغلق"} />
              <Stat label="توقع الشهر" value={`${analytics.predicted_next_month_sar || 0} ر.س`} />
            </div>
          )}
        </Card>
      )}
    </Shell>
  );
}

function Shell({ title, onBack, onPreview, busy, children }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, direction: "rtl" }} data-testid="storefront-manager">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px", background: T.primary, color: "#fff" }}>
        <button type="button" onClick={onBack} style={ghost} data-testid="storefront-close-btn"><ArrowRight size={16} /> خروج</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 900 }}>{title}</div>
          {busy ? <div style={{ fontSize: 11, opacity: 0.8 }}>جاري الحفظ…</div> : null}
        </div>
        {onPreview ? <button type="button" onClick={onPreview} style={ghost} data-testid="storefront-preview-btn"><Eye size={16} /> عرض</button> : <span style={{ width: 72 }} />}
      </header>
      <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
function Card({ title, children }) {
  return <section style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}><h3 style={{ margin: 0, textAlign: "right", color: T.primary, fontSize: 14 }}>{title}</h3>{children}</section>;
}
function Field({ label, value, onChange, multiline }) {
  const props = { value, onChange: (e) => onChange(e.target.value), style: { ...mini, width: "100%", minHeight: multiline ? 72 : 40 } };
  return <label style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "right", fontSize: 12, fontWeight: 800, color: T.primary }}>{label}{multiline ? <textarea {...props} /> : <input {...props} />}</label>;
}
function FileLabel({ label, onFile }) {
  return <label style={{ ...primary, display: "inline-flex" }}>{label}<input hidden type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} /></label>;
}
function Stat({ label, value }) {
  return <div style={{ background: T.bg, borderRadius: 12, padding: 10, textAlign: "center" }}><div style={{ fontWeight: 900, color: T.textStrong }}>{value}</div><div style={muted}>{label}</div></div>;
}

const muted = { color: T.textMuted, fontSize: 12, margin: 0, textAlign: "right", lineHeight: 1.6 };
const row = { display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, color: T.textStrong };
const tabsRow = { display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 };
const tabBtn = { border: `1px solid ${T.border}`, background: "#fff", color: T.primary, borderRadius: 999, padding: "7px 12px", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" };
const tabOn = { background: T.primary, color: "#fff", borderColor: T.primary };
const primary = { background: T.primary, color: "#fff", border: 0, borderRadius: 12, padding: "10px 14px", fontWeight: 900, fontFamily: "inherit", cursor: "pointer" };
const danger = { background: "transparent", color: "#8B3A2F", border: 0, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
const ghost = { display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.16)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 999, padding: "8px 12px", fontFamily: "inherit", cursor: "pointer" };
const mini = { background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px", textAlign: "right", fontFamily: "inherit", color: T.textStrong };
