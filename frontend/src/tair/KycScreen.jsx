// طير — KYC (identity verification) for carriers and shops
import React, { useEffect, useState } from "react";
import {
  Fingerprint, Truck, Store, Upload, User, Phone, MapPin,
  Check, Clock, X as XIcon, ImagePlus, ShieldCheck,
} from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi, SAUDI_CITIES } from "./tairApi";
import { TopBar, BottomSheet, SelectorItem, StatusPill } from "./TairUI";

const STATUS_LABEL = {
  not_submitted: "لم تُقدَّم بعد",
  pending: "قيد المراجعة",
  approved: "معتمَد",
  rejected: "مرفوض",
};
const STATUS_COLOR = {
  not_submitted: T.textMuted,
  pending: "#f59e0b",
  approved: "#059669",
  rejected: T.danger,
};

export default function KycScreen({ user, onBack }) {
  const uid = user.id || user.user_id;
  const [existing, setExisting] = useState(null);
  const [role, setRole] = useState("carrier");
  const [fullName, setFullName] = useState(user.name && user.name !== "زائر" ? user.name : "");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState(user.phone || "");
  const [city, setCity] = useState("");
  const [citySheet, setCitySheet] = useState(false);
  const [notes, setNotes] = useState("");
  const [commercialReg, setCommercialReg] = useState("");

  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [businessDoc, setBusinessDoc] = useState(null);

  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    tairApi.getKyc(uid).then((d) => {
      if (d && d.status && d.status !== "not_submitted") {
        setExisting(d);
      }
    }).catch(() => {});
  }, [uid]);

  const uploadFile = async (file, docType, setter) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [docType]: true }));
    try {
      const url = await tairApi.uploadKycDoc(file, uid, docType);
      setter(url);
    } catch (e) {
      setError("فشل رفع الملف");
    } finally {
      setUploading((u) => ({ ...u, [docType]: false }));
    }
  };

  const submit = async () => {
    setError("");
    if (!fullName.trim() || fullName.trim().length < 3) return setError("الاسم الكامل مطلوب");
    if (!/^\d{10,}$/.test(idNumber.trim())) return setError("رقم الهوية يجب أن يكون 10 أرقام أو أكثر");
    if (!/^[\d+]{9,}$/.test(phone.trim())) return setError("رقم الجوال غير صالح");
    if (!idFront || !selfie) return setError("الرجاء رفع الهوية والصورة الشخصية");
    if (role === "shop" && !businessDoc) return setError("السجل التجاري مطلوب للمتاجر");

    setSaving(true);
    try {
      const payload = {
        role, full_name: fullName.trim(), id_number: idNumber.trim(),
        phone: phone.trim(), city: city || null, notes: notes || null,
        id_front_url: idFront, id_back_url: idBack, selfie_url: selfie,
        commercial_reg: commercialReg || null,
        business_license_url: businessDoc,
      };
      const res = await tairApi.submitKyc(payload, uid);
      setExisting(res);
      setSuccess(true);
    } catch (e) {
      setError(e.response?.data?.detail || "فشل إرسال الطلب");
    } finally {
      setSaving(false);
    }
  };

  if (existing) {
    return (
      <div style={S.screen} data-testid="kyc-status-screen">
        <TopBar title="التحقق من الهوية" onBack={onBack} />
        <div style={{ ...S.container, paddingTop: 24 }}>
          <div style={styles.statusCard}>
            <div style={{
              ...styles.statusIcon,
              background: STATUS_COLOR[existing.status] + "22",
              color: STATUS_COLOR[existing.status],
            }}>
              {existing.status === "approved" ? <ShieldCheck size={32} /> :
               existing.status === "rejected" ? <XIcon size={32} /> : <Clock size={32} />}
            </div>
            <div style={styles.statusTitle}>{STATUS_LABEL[existing.status]}</div>
            <StatusPill label={existing.role === "carrier" ? "ناقل" : "متجر"} color={T.primary} />
            {existing.review_note && (
              <p style={styles.statusNote}>{existing.review_note}</p>
            )}
            {existing.status === "rejected" && (
              <button
                onClick={() => setExisting(null)}
                style={{ ...S.primaryBtn, marginTop: 16 }}
                data-testid="kyc-resubmit"
              >إعادة الإرسال</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.screen} data-testid="kyc-screen">
      <TopBar title="التحقق من الهوية" subtitle="مطلوب للناقلين والمتاجر" onBack={onBack} />
      <div style={{ ...S.container, paddingBottom: 120 }}>
        {success && (
          <div style={styles.successCard}>
            <Check size={18} strokeWidth={2.6} color="#059669" />
            <span>تم إرسال طلبك بنجاح — سيصلك إشعار بالنتيجة.</span>
          </div>
        )}

        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>نوع الحساب</div>
          <div style={styles.roleRow}>
            <RoleTile
              Icon={Truck} label="ناقل" active={role === "carrier"}
              onClick={() => setRole("carrier")} testId="role-carrier"
            />
            <RoleTile
              Icon={Store} label="متجر" active={role === "shop"}
              onClick={() => setRole("shop")} testId="role-shop"
            />
          </div>
        </div>

        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>البيانات الشخصية</div>
          <Field icon={User} label="الاسم الكامل">
            <input style={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="الاسم الرباعي كما في الهوية" data-testid="kyc-fullname" />
          </Field>
          <Field icon={Fingerprint} label="رقم الهوية / الإقامة">
            <input style={styles.input} value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="1xxxxxxxxx" inputMode="numeric" data-testid="kyc-id-number" />
          </Field>
          <Field icon={Phone} label="رقم الجوال">
            <input style={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+966xxxxxxxxx" data-testid="kyc-phone" />
          </Field>
          <Field icon={MapPin} label="المدينة">
            <button style={styles.pickerBtn} onClick={() => setCitySheet(true)} data-testid="kyc-city-btn">
              {city || "اختر المدينة"}
            </button>
          </Field>
        </div>

        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>الوثائق</div>
          <UploadTile label="صورة الهوية (الأمامية)" url={idFront} loading={uploading.id_front}
            onFile={(f) => uploadFile(f, "id_front", setIdFront)} required testId="upload-id-front" />
          <UploadTile label="صورة الهوية (الخلفية) — اختياري" url={idBack} loading={uploading.id_back}
            onFile={(f) => uploadFile(f, "id_back", setIdBack)} testId="upload-id-back" />
          <UploadTile label="صورة شخصية (سيلفي)" url={selfie} loading={uploading.selfie}
            onFile={(f) => uploadFile(f, "selfie", setSelfie)} required testId="upload-selfie" />
          {role === "shop" && (
            <>
              <Field icon={Store} label="رقم السجل التجاري">
                <input style={styles.input} value={commercialReg}
                  onChange={(e) => setCommercialReg(e.target.value)}
                  placeholder="1010xxxxxx" data-testid="kyc-cr-number" />
              </Field>
              <UploadTile label="صورة السجل التجاري / الرخصة" url={businessDoc}
                loading={uploading.business_license}
                onFile={(f) => uploadFile(f, "business_license", setBusinessDoc)}
                required testId="upload-business-doc" />
            </>
          )}
        </div>

        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>ملاحظات (اختياري)</div>
          <textarea
            style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="أي معلومة تريد إضافتها لطلبك…"
            data-testid="kyc-notes"
          />
        </div>

        {error && <div style={styles.errorCard}>{error}</div>}

        <button onClick={submit} disabled={saving}
          style={{ ...S.primaryBtn, opacity: saving ? 0.6 : 1, marginTop: 6 }}
          data-testid="kyc-submit">
          {saving ? "جاري الإرسال…" : "إرسال الطلب"}
        </button>
      </div>

      <BottomSheet open={citySheet} onClose={() => setCitySheet(false)} title="اختر المدينة">
        {SAUDI_CITIES.map((c) => (
          <SelectorItem
            key={c}
            icon={<MapPin size={16} strokeWidth={2.2} />}
            label={c}
            active={city === c}
            onClick={() => { setCity(c); setCitySheet(false); }}
            testId={`kyc-city-item-${c}`}
          />
        ))}
      </BottomSheet>
    </div>
  );
}

function RoleTile({ Icon, label, active, onClick, testId }) {
  return (
    <button onClick={onClick} data-testid={testId} style={{
      ...styles.roleTile,
      background: active ? T.primary : T.surface,
      borderColor: active ? T.primary : T.border,
      color: active ? "#fff" : T.text,
    }}>
      <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
      <span style={{ fontSize: 13, fontWeight: 800 }}>{label}</span>
    </button>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>
        {Icon && <Icon size={14} strokeWidth={2} color={T.textMuted} />}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function UploadTile({ label, url, onFile, loading, required, testId }) {
  const inputRef = React.useRef(null);
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>
        <span>{label} {required && <span style={{ color: T.danger }}>*</span>}</span>
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          ...styles.uploadTile,
          borderColor: url ? T.primary : T.border,
          background: url ? "#f0fdfa" : T.bgAlt,
        }}
        data-testid={testId}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textMuted }}>
            <span>جاري الرفع…</span>
          </div>
        ) : url ? (
          <>
            {url.endsWith(".pdf") ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={18} color="#059669" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>تم الرفع</span>
              </div>
            ) : (
              <img src={url} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textMuted }}>
            <ImagePlus size={18} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>اضغط للرفع</span>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </div>
    </div>
  );
}

const styles = {
  sectionCard: {
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd, padding: 16, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 800, color: T.primary,
    textAlign: "right", marginBottom: 12,
  },
  roleRow: { display: "flex", flexDirection: "row-reverse", gap: 8 },
  roleTile: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    gap: 8, padding: "16px 8px", borderRadius: T.radius,
    borderWidth: 1.5, borderStyle: "solid", cursor: "pointer",
    fontFamily: "inherit",
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: T.textMuted,
  },
  input: {
    width: "100%", padding: "11px 14px",
    border: `1.5px solid ${T.border}`, borderRadius: T.radius,
    fontSize: 14, background: T.bgAlt, color: T.text,
    fontFamily: "inherit", textAlign: "right", outline: "none",
    boxSizing: "border-box",
  },
  pickerBtn: {
    width: "100%", padding: "11px 14px",
    border: `1.5px solid ${T.border}`, borderRadius: T.radius,
    fontSize: 14, background: T.bgAlt, color: T.text,
    fontFamily: "inherit", textAlign: "right", cursor: "pointer",
  },
  uploadTile: {
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: 80, padding: 12,
    borderWidth: 1.5, borderStyle: "dashed",
    borderRadius: T.radius, cursor: "pointer",
  },
  errorCard: {
    background: "#fef2f2", color: T.danger,
    padding: "10px 14px", borderRadius: T.radius,
    fontSize: 13, fontWeight: 700, marginBottom: 10,
    border: `1px solid ${T.danger}44`,
  },
  successCard: {
    background: "#f0fdf4", color: "#059669",
    padding: "10px 14px", borderRadius: T.radius,
    fontSize: 13, fontWeight: 700, marginBottom: 12,
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 8, border: "1px solid #05966944",
  },
  statusCard: {
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd, padding: 24, textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
  },
  statusIcon: {
    width: 80, height: 80, borderRadius: 40,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  statusTitle: { fontSize: 20, fontWeight: 900, color: T.text },
  statusNote: {
    fontSize: 13, color: T.textMuted, textAlign: "center",
    background: T.bgAlt, padding: 12, borderRadius: T.radius,
    width: "100%", margin: 0, lineHeight: 1.6,
  },
};
