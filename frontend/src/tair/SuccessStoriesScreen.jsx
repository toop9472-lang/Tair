// طير — Success Stories page. Builds trust for new visitors.
// Content is a curated static list — later can be moved to CMS/admin.
import React from "react";
import { ChevronRight, Quote, Star, ShieldCheck } from "lucide-react";
import { T, S } from "./tairTheme";

const STORIES = [
  {
    name: "أبو عبدالعزيز",
    city: "الرياض",
    role: "بائع كناري",
    stars: 5,
    story: "بعت أكثر من 30 كناري خلال شهرَين عن طريق طير. المشترون جادّون والتواصل عن طريق الشات آمن ومريح. أفضل من مواقع الإعلانات العامة بمراحل.",
    outcome: "30+ عملية بيع في شهرَين",
    verified: true,
  },
  {
    name: "منى العتيبي",
    city: "جدة",
    role: "مشتري ببغاء كوكاتيل",
    stars: 5,
    story: "كنت أبحث عن كوكاتيل مدرّب لفترة طويلة. لقيت البائع في طير، شاهدت الطائر عبر فيديو، وأرسله لي موصّل معتمد من الرياض بأمان تام.",
    outcome: "توصيل آمن بين المدن",
    verified: true,
  },
  {
    name: "خالد الشمري",
    city: "الدمام",
    role: "موصّل معتمد",
    stars: 5,
    story: "بدأت أستخدم طير كموصّل قبل شهر. الآن عندي 5-6 طلبات نقل أسبوعياً بين الشرقية والرياض. الدخل ممتاز والعملاء يقدّرون الالتزام بالمواعيد.",
    outcome: "5-6 رحلات أسبوعياً",
    verified: true,
  },
  {
    name: "سلطان الغامدي",
    city: "أبها",
    role: "مربّي حمام زاجل",
    stars: 4,
    story: "المنتدى مفيد جداً — تعرّفت على مربّين من كل السعودية وتبادلنا نصائح التغذية والسلالات. الحمد لله أصبح لديّ فريق حمام قوي.",
    outcome: "مجتمع متعاون",
    verified: false,
  },
  {
    name: "أم فيصل",
    city: "المدينة",
    role: "بائعة أعلاف",
    stars: 5,
    story: "افتتحت متجر أعلاف قبل 6 أشهر وطير ساعدني أوصل لآلاف الزبائن. الشارة الزرقاء (التوثيق) رفعت ثقة الناس بشكل كبير.",
    outcome: "توثيق يبني الثقة",
    verified: true,
  },
];

export default function SuccessStoriesScreen({ onBack }) {
  return (
    <div style={{ ...S.screen, background: T.bg }} data-testid="success-stories-page">
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn} data-testid="stories-back-btn">
          <ChevronRight size={22} strokeWidth={2.4} />
        </button>
        <h1 style={styles.title}>قصص نجاح من مجتمع طير</h1>
        <span style={{ width: 34 }} />
      </div>

      <div style={styles.body}>
        <div style={styles.hero}>
          <Quote size={36} strokeWidth={1.5} color={T.primary} style={{ opacity: 0.35 }} />
          <p style={styles.heroText}>
            آلاف البائعين والمشترين والموصّلين يعتمدون على طير يومياً — إليك بعض تجاربهم الحقيقية.
          </p>
        </div>

        {STORIES.map((s, i) => (
          <article key={i} style={styles.card} data-testid={`story-${i}`}>
            <div style={styles.cardHead}>
              <div style={styles.avatar}>{s.name.charAt(0)}</div>
              <div style={styles.cardTitle}>
                <div style={styles.name}>
                  {s.name}
                  {s.verified && <ShieldCheck size={14} strokeWidth={2.4} color={T.primary} style={{ marginInlineStart: 4 }} />}
                </div>
                <div style={styles.role}>{s.role} — {s.city}</div>
              </div>
              <div style={styles.stars}>
                {[...Array(s.stars)].map((_, j) => (
                  <Star key={j} size={14} fill="#facc15" color="#facc15" strokeWidth={0} />
                ))}
              </div>
            </div>
            <blockquote style={styles.quote}>
              «{s.story}»
            </blockquote>
            <div style={styles.outcome}>
              <span style={styles.outcomeChip}>✓ {s.outcome}</span>
            </div>
          </article>
        ))}

        <div style={styles.cta}>
          <div style={styles.ctaTitle}>هل عندك قصة لتحكيها؟</div>
          <div style={styles.ctaText}>شاركنا تجربتك على <strong>stories@saqr4u.com</strong> وقد ننشرها هنا!</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", padding: "16px", background: "#fff",
    borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    border: `1px solid ${T.border}`, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: T.textStrong,
  },
  title: { fontSize: 17, fontWeight: 900, color: T.textStrong, margin: 0 },
  body: { padding: "20px 16px 60px", maxWidth: 640, margin: "0 auto" },
  hero: {
    background: "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)",
    border: `1px solid ${T.border}`, borderRadius: 18,
    padding: "22px 20px", marginBottom: 20, textAlign: "right",
    display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
  },
  heroText: { fontSize: 15, color: T.text, fontWeight: 600, lineHeight: 1.75, margin: 0 },
  card: {
    background: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 14, border: `1px solid ${T.border}`,
    boxShadow: T.shadowXs,
  },
  cardHead: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 10, marginBottom: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 900, fontSize: 18, flexShrink: 0,
  },
  cardTitle: { flex: 1, textAlign: "right" },
  name: {
    fontSize: 14, fontWeight: 900, color: T.textStrong,
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
  },
  role: { fontSize: 11, fontWeight: 600, color: T.textMuted, marginTop: 2 },
  stars: { display: "flex", flexDirection: "row-reverse", gap: 2, flexShrink: 0 },
  quote: {
    margin: 0, padding: 0, fontSize: 13.5, color: T.text,
    lineHeight: 1.8, fontWeight: 500, textAlign: "right",
    fontStyle: "italic",
  },
  outcome: { display: "flex", flexDirection: "row-reverse", marginTop: 10 },
  outcomeChip: {
    background: "#dcfce7", color: "#166534",
    fontSize: 11, fontWeight: 800,
    padding: "4px 10px", borderRadius: 999,
  },
  cta: {
    background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    color: "#fff", padding: "18px", borderRadius: 16,
    textAlign: "center", marginTop: 20,
  },
  ctaTitle: { fontSize: 16, fontWeight: 900, marginBottom: 6 },
  ctaText: { fontSize: 12.5, opacity: 0.95, lineHeight: 1.7 },
};
