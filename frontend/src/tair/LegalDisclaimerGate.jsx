// طير — قرار الإخلاء القانوني الأول (يظهر عند فتح التطبيق أول مرة)
// يُلزم المستخدم بقبوله قبل استخدام التطبيق
import React, { useEffect, useState } from "react";
import { ShieldAlert, AlertTriangle, Check } from "lucide-react";
import { T } from "./tairTheme";

const KEY = "tair_legal_ack_v1";

export default function LegalDisclaimerGate({ children, onNavigate }) {
  const [accepted, setAccepted] = useState(true); // optimistic
  const [checked, setChecked] = useState(false);
  const [checkTerms, setCheckTerms] = useState(false);
  const [checkResp, setCheckResp] = useState(false);

  useEffect(() => {
    try {
      const ok = localStorage.getItem(KEY);
      setAccepted(!!ok);
      setChecked(true);
    } catch (e) {
      setAccepted(false);
      setChecked(true);
    }
  }, []);

  if (!checked) return null;
  if (accepted) return children;

  const canAccept = checkTerms && checkResp;

  const accept = () => {
    try { localStorage.setItem(KEY, new Date().toISOString()); } catch (e) {}
    setAccepted(true);
  };

  return (
    <div style={styles.overlay} data-testid="legal-gate">
      <div style={styles.card}>
        <div style={styles.iconRing}>
          <ShieldAlert size={44} strokeWidth={1.8} color={T.warning} />
        </div>

        <h2 style={styles.title}>تنويه هام قبل البدء</h2>
        <p style={styles.subtitle}>يرجى قراءة النقاط التالية بعناية قبل استخدام منصة طير</p>

        <div style={styles.warnBox}>
          <AlertTriangle size={18} strokeWidth={2.2} color={T.warning} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={styles.warnText}>
            <strong>منصة طير وسيط تقني فقط</strong> بين البائعين والمشترين والناقلين، ولا تتحمّل أي مسؤولية عن جودة الطيور،
            صحة المعلومات، أو تقصير المُعلنين أو الموصّلين <strong>غير الموثّقين</strong>.
          </div>
        </div>

        <ul style={styles.list}>
          <li style={styles.li}>
            <span style={styles.dot} />
            <span>تعامل فقط مع المستخدمين ذوي الشارة الزرقاء الموثّقة (KYC) للحصول على أعلى مستوى أمان.</span>
          </li>
          <li style={styles.li}>
            <span style={styles.dot} />
            <span>لا ترسل أي مبالغ مالية قبل التأكّد من هوية البائع/الناقل ورؤية الطائر مباشرة أو عبر فيديو حيّ.</span>
          </li>
          <li style={styles.li}>
            <span style={styles.dot} />
            <span>الاتفاق على السعر، طريقة الدفع، وشروط النقل يتم مباشرة بين الطرفين. طير لا تتدخل في تنفيذها.</span>
          </li>
          <li style={styles.li}>
            <span style={styles.dot} />
            <span>عند أي خلاف أو احتيال، أبلغنا فوراً من داخل الإعلان أو من صفحة الحساب. ولا تُنسّق التسليم في أماكن معزولة.</span>
          </li>
          <li style={styles.li}>
            <span style={styles.dot} />
            <span>يُمنع بيع الحيوانات المهدّدة بالانقراض أو المخالفة لأنظمة الحياة الفطرية بالسعودية.</span>
          </li>
        </ul>

        <div style={styles.checks}>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={checkTerms}
              onChange={(e) => setCheckTerms(e.target.checked)}
              data-testid="ack-terms"
            />
            <span>لقد قرأت وأوافق على <button type="button" style={styles.linkBtn} onClick={() => onNavigate?.("terms")} data-testid="open-terms">شروط الاستخدام</button> و<button type="button" style={styles.linkBtn} onClick={() => onNavigate?.("privacy")} data-testid="open-privacy">سياسة الخصوصية</button>.</span>
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={checkResp}
              onChange={(e) => setCheckResp(e.target.checked)}
              data-testid="ack-responsibility"
            />
            <span>أُدرك أنّ منصة طير <strong>ليست مسؤولة</strong> عن أي خسائر أو تقصير من المستخدمين غير الموثّقين، وأنّ التعامل يتمّ على مسؤوليتي الشخصية.</span>
          </label>
        </div>

        <button
          onClick={accept}
          disabled={!canAccept}
          style={{ ...styles.acceptBtn, opacity: canAccept ? 1 : 0.5, cursor: canAccept ? "pointer" : "not-allowed" }}
          data-testid="accept-legal-btn"
        >
          <Check size={18} strokeWidth={2.6} />
          <span>موافق — ابدأ استخدام طير</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(15,36,28,0.72)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16, overflowY: "auto",
  },
  card: {
    background: "#FFFDF8", borderRadius: 24, padding: "28px 22px 22px",
    width: "100%", maxWidth: 460,
    boxShadow: "0 30px 80px rgba(15,36,28,0.35)",
    border: "1px solid #E6DCC8",
    maxHeight: "92vh", overflowY: "auto",
  },
  iconRing: {
    width: 82, height: 82, borderRadius: 41,
    background: "#F0EAD8",
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 16px",
    border: "3px solid #C6A15B",
  },
  title: {
    fontSize: 22, fontWeight: 900, color: "#0F241C",
    textAlign: "center", margin: "0 0 6px", letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 13, color: "#6B5E4A", textAlign: "center",
    margin: "0 0 20px", fontWeight: 600,
  },
  warnBox: {
    display: "flex", flexDirection: "row-reverse", gap: 10,
    background: "linear-gradient(135deg, #F0EAD8 0%, #E6DCC8 100%)",
    border: "1px solid #C6A15B",
    borderRadius: 14, padding: "14px 14px",
    marginBottom: 16,
    textAlign: "right",
  },
  warnText: { fontSize: 13, lineHeight: 1.7, color: "#8A6A2E", fontWeight: 600 },
  list: {
    listStyle: "none", padding: 0, margin: "0 0 18px",
    textAlign: "right",
  },
  li: {
    display: "flex", flexDirection: "row-reverse", gap: 10,
    padding: "9px 0",
    borderBottom: "1px dashed #E6DCC8",
    fontSize: 13, lineHeight: 1.65, color: "#1B3D2F",
    fontWeight: 500,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    background: "#C6A15B", flexShrink: 0,
    marginTop: 8,
  },
  checks: {
    display: "flex", flexDirection: "column", gap: 12,
    background: "#F7F1E8", borderRadius: 12,
    padding: 14, marginBottom: 16, textAlign: "right",
    border: "1px solid #E6DCC8",
  },
  check: {
    display: "flex", flexDirection: "row-reverse", alignItems: "flex-start", gap: 10,
    fontSize: 12.5, lineHeight: 1.65, color: "#1B3D2F",
    cursor: "pointer", fontWeight: 600,
  },
  linkBtn: {
    background: "transparent", border: "none", padding: 0,
    color: "#C6A15B", fontWeight: 800, cursor: "pointer",
    textDecoration: "underline", fontFamily: "inherit", fontSize: "inherit",
  },
  acceptBtn: {
    width: "100%",
    display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 8,
    background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    color: "#fff", border: "none",
    padding: "14px 20px", borderRadius: 14,
    fontSize: 15, fontWeight: 900, fontFamily: "inherit",
    boxShadow: "0 8px 24px rgba(15,118,110,0.35)",
  },
};
