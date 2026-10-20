// طير — Onboarding: platform intro → buyer/seller CTA → carrier
import React, { useState } from "react";
import { Sparkles, ShoppingBag, Store, Truck, ArrowLeft, ShieldCheck, MessagesSquare, MapPin } from "lucide-react";
import { T, S } from "./tairTheme";

const STEPS = [
  {
    // Screen 1 — Platform introduction (professional pitch)
    Icon: Sparkles,
    kicker: "أهلاً بك في",
    title: "منصة طير",
    desc: "أول منصة سعودية تجمع محبّي الطيور والحيوانات في مكان واحد: سوق موثوق، مجتمع نشِط، ومُوصّلون معتمدون بين المدن.",
    highlights: [
      { Icon: ShieldCheck, label: "بائعون موثّقون" },
      { Icon: MessagesSquare, label: "مجتمع ونقاشات" },
      { Icon: MapPin, label: "توصيل بين المدن" },
    ],
  },
  {
    // Screen 2 — Buyer or Seller CTA
    Icon: ShoppingBag,
    kicker: "اختر ما يناسبك",
    title: "متسوّق أم بائع؟",
    desc: "سواء كنت تبحث عن طائرك المفضّل، أو تريد بيع طيورك ومستلزماتها لمجتمع مهتم — طير هي وجهتك.",
    dual: [
      { Icon: ShoppingBag, title: "متسوّق", text: "تصفّح آلاف الإعلانات من بائعين موثوقين مع صور وشهادات صحية." },
      { Icon: Store, title: "بائع", text: "انشر إعلانك مجاناً وابنِ تقييمك مع كل عملية بيع ناجحة." },
    ],
  },
  {
    // Screen 3 — Carrier (unchanged)
    Icon: Truck,
    title: "تسافر بين المدن؟",
    desc: "كن مُوصّلاً معتمداً. سجّل رحلاتك واحصل على طلبات نقل الطيور بأمان وثقة.",
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const { Icon } = s;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <img src="/tair_logo.png" alt="طير" style={styles.logo} />
        <button
          onClick={onComplete}
          style={styles.skip}
          data-testid="onboarding-skip"
        >
          تخطّي
        </button>
      </div>

      <div style={styles.body}>
        <div style={styles.iconWrap}>
          <Icon size={64} strokeWidth={1.5} color={T.primary} />
        </div>
        {s.kicker && <div style={styles.kicker}>{s.kicker}</div>}
        <h1 style={styles.title}>{s.title}</h1>
        <p style={styles.desc}>{s.desc}</p>

        {/* Feature highlights (screen 1) */}
        {s.highlights && (
          <div style={styles.highlightsRow}>
            {s.highlights.map((h, i) => (
              <div key={i} style={styles.highlightItem}>
                <div style={styles.highlightIcon}>
                  <h.Icon size={18} strokeWidth={2.2} color={T.primary} />
                </div>
                <span style={styles.highlightLabel}>{h.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dual persona cards (screen 2) */}
        {s.dual && (
          <div style={styles.dualGrid}>
            {s.dual.map((d, i) => (
              <div key={i} style={styles.dualCard}>
                <div style={styles.dualIconWrap}>
                  <d.Icon size={26} strokeWidth={1.8} color={T.primary} />
                </div>
                <div style={styles.dualTitle}>{d.title}</div>
                <div style={styles.dualText}>{d.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <div style={styles.dots}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{ ...styles.dot, ...(i === step ? styles.dotActive : {}) }}
            />
          ))}
        </div>
        <button
          onClick={() => (last ? onComplete() : setStep(step + 1))}
          style={styles.next}
          data-testid="onboarding-next"
        >
          <span>{last ? "ابدأ الآن" : "التالي"}</span>
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: T.surface,
    direction: "rtl",
    fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "20px 20px 0",
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 640,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  logo: { width: 44, height: 44, borderRadius: 12 },
  skip: {
    background: "transparent",
    border: "none",
    color: T.textMuted,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    padding: "8px 12px",
    fontFamily: "inherit",
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 32px",
    maxWidth: 500,
    margin: "0 auto",
    textAlign: "center",
    boxSizing: "border-box",
  },
  iconWrap: {
    width: 128,
    height: 128,
    borderRadius: 32,
    background: "#F0EAD8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  kicker: {
    fontSize: 12,
    fontWeight: 800,
    color: T.primary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: 900,
    color: T.textStrong,
    margin: "0 0 12px",
    letterSpacing: "-0.02em",
  },
  desc: {
    fontSize: 15,
    color: T.textMuted,
    lineHeight: 1.75,
    margin: 0,
    maxWidth: 380,
  },
  highlightsRow: {
    display: "flex",
    flexDirection: "row-reverse",
    gap: 12,
    marginTop: 28,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  highlightItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    minWidth: 84,
  },
  highlightIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#F0EAD8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid rgba(15, 118, 110, 0.15)`,
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: T.text,
    textAlign: "center",
  },
  dualGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 28,
    width: "100%",
    maxWidth: 400,
  },
  dualCard: {
    background: "#F7F1E8",
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    textAlign: "center",
  },
  dualIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "#F0EAD8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dualTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: T.textStrong,
  },
  dualText: {
    fontSize: 11,
    color: T.textMuted,
    lineHeight: 1.55,
  },
  footer: {
    padding: "24px 24px 40px",
    maxWidth: 500,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  dots: {
    display: "flex",
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    background: T.border,
    transition: "all 0.2s",
  },
  dotActive: {
    width: 28,
    background: T.primary,
  },
  next: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    background: T.primary,
    color: T.textInverse,
    border: "none",
    borderRadius: T.radius,
    padding: "15px 28px",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: T.shadowSm,
  },
};
