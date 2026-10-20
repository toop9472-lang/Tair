// طير — Privacy Policy (professional, matches app design)
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { T, S } from "../tair/tairTheme";
import { TopBar } from "../tair/TairUI";

const SECTIONS = [
  {
    title: "1. المعلومات التي نجمعها",
    body: `عندما تستخدم تطبيق طير، نجمع الحد الأدنى الضروري من المعلومات: الاسم، رقم الجوال، البريد الإلكتروني، والموقع (المدينة والحي فقط)، بالإضافة إلى صور ومعلومات الإعلانات التي تنشرها بنفسك. لا نطلب معلومات مالية لأن التطبيق مجاني بالكامل حالياً.`,
  },
  {
    title: "2. كيف نستخدم معلوماتك",
    body: `نستخدم معلوماتك لعرض إعلاناتك، مطابقتك مع مشترين أو موصّلين مناسبين، ولحماية المجتمع من الاحتيال. لن نبيع بياناتك لأي طرف ثالث تحت أي ظرف.`,
  },
  {
    title: "3. مشاركة البيانات",
    body: `المعلومات العامة (الاسم الأول، المدينة، التقييمات) تظهر للمستخدمين الآخرين لبناء الثقة. رقم الجوال يبقى مخفياً ولا يُشارك إلا عند تأكيد طلب مع طرف آخر.`,
  },
  {
    title: "4. الأمان",
    body: `نستخدم تشفير TLS في جميع الاتصالات، وتخزين آمن على خوادم موثوقة، وحماية بكلمة مرور مشفّرة (bcrypt).`,
  },
  {
    title: "5. الطيور المحظورة (سايتس CITES)",
    body: `يمنع منعاً باتاً بيع أي نوع مدرج في اتفاقية سايتس دون الحصول على تصاريح رسمية. يقوم النظام تلقائياً بحجب أي إعلان يخالف ذلك.`,
  },
  {
    title: "6. حقوقك",
    body: `يحق لك في أي وقت: تعديل بياناتك، تحميل نسخة منها، أو حذف حسابك بالكامل. اطلب ذلك من صفحة "حذف الحساب".`,
  },
  {
    title: "7. الأطفال",
    body: `التطبيق مخصص لمن عمرهم 18 سنة فأكثر. لا نجمع بيانات القاصرين عن قصد.`,
  },
  {
    title: "8. التواصل معنا",
    body: `لأي استفسار متعلق بالخصوصية، تواصل معنا عبر: privacy@tair.app`,
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  React.useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
    document.title = "سياسة الخصوصية — طير";
  }, []);

  return (
    <div style={S.screen}>
      <TopBar title="سياسة الخصوصية" onBack={() => navigate(-1)} />

      <div style={{ ...S.container, maxWidth: 720 }}>
        <div style={styles.heroCard}>
          <div style={styles.heroIcon}>
            <ShieldCheck size={36} strokeWidth={1.8} color={T.primary} />
          </div>
          <h2 style={styles.heroTitle}>خصوصيتك تهمّنا</h2>
          <p style={styles.heroDesc}>
            في طير، نأخذ خصوصيتك بجدية. هذه السياسة تشرح ما نجمعه وكيف نستخدمه.
          </p>
          <div style={styles.lastUpdated}>آخر تحديث: فبراير 2026</div>
        </div>

        {SECTIONS.map((s, i) => (
          <div key={i} style={S.card}>
            <h3 style={styles.sectionTitle}>{s.title}</h3>
            <p style={styles.sectionBody}>{s.body}</p>
          </div>
        ))}

        <p style={styles.footer}>© 2026 طير · نحن وسيط تجاري فقط.</p>
      </div>
    </div>
  );
}

const styles = {
  heroCard: {
    background: "#f0fdfa",
    border: `1px solid ${T.primary}22`,
    borderRadius: T.radiusLg,
    padding: "24px 22px",
    textAlign: "center",
    marginBottom: 20,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: T.surface,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    border: `2px solid ${T.primary}22`,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: T.textStrong,
    margin: "0 0 8px",
    letterSpacing: "-0.01em",
  },
  heroDesc: {
    fontSize: 14,
    color: T.textMuted,
    lineHeight: 1.6,
    margin: 0,
  },
  lastUpdated: {
    display: "inline-block",
    marginTop: 12,
    padding: "4px 12px",
    background: T.surface,
    borderRadius: T.radiusPill,
    fontSize: 11,
    color: T.textMuted,
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: T.textStrong,
    margin: "0 0 10px",
    textAlign: "right",
    letterSpacing: "-0.005em",
  },
  sectionBody: {
    fontSize: 14,
    color: T.text,
    lineHeight: 1.85,
    margin: 0,
    textAlign: "right",
  },
  footer: {
    textAlign: "center",
    color: T.textFaint,
    fontSize: 12,
    marginTop: 24,
    marginBottom: 40,
  },
};
