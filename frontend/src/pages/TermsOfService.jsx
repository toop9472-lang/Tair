// طير — Terms of Service (professional, matches app design)
import React from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { T, S } from "../tair/tairTheme";
import { TopBar } from "../tair/TairUI";

const SECTIONS = [
  {
    title: "1. مقدمة",
    body: `مرحباً بك في تطبيق طير. باستخدامك التطبيق، فإنك توافق على الشروط أدناه. طير منصة وساطة بين المشترين والبائعين والموصّلين — نحن لا نبيع ولا نشتري الحيوانات مباشرة.`,
  },
  {
    title: "2. الأدوار",
    body: `يمكنك التسجيل كمشتري، بائع، موصّل، أو الأدوار الثلاثة معاً. كل دور يحمل مسؤوليات محددة نحو الأطراف الأخرى.`,
  },
  {
    title: "3. مسؤولية البائع",
    body: `يجب أن تكون معلومات الإعلان دقيقة (الصور، السلالة، العمر، الحالة الصحية). ممنوع بيع أي طائر مريض دون إفصاح صريح. الإعلانات المخالفة تُحذف تلقائياً.`,
  },
  {
    title: "4. مسؤولية الموصّل",
    body: `يلتزم الموصّل بالمعاملة الآمنة والرحيمة مع الطيور طوال الرحلة، ويسلم في الوقت المتفق عليه. يمكن للمشتري والبائع تقييم الموصّل بعد كل رحلة.`,
  },
  {
    title: "5. الأنواع المحظورة (سايتس)",
    body: `يمنع منعاً باتاً بيع الأنواع المدرجة في اتفاقية سايتس (CITES) بدون تصاريح رسمية من وزارة البيئة. المخالفة تؤدي إلى حذف الحساب وإبلاغ الجهات المختصة.`,
  },
  {
    title: "6. المدفوعات",
    body: `التطبيق مجاني بالكامل حالياً — لا توجد عمولات ولا رسوم. جميع المعاملات المالية تتم مباشرة بين المشتري والبائع خارج التطبيق.`,
  },
  {
    title: "7. المحتوى",
    body: `تحتفظ بحقوق ملكية الصور والمحتوى الذي تنشره، وتمنحنا ترخيصاً لعرضه داخل التطبيق فقط. المحتوى المخل بالآداب يُحذف تلقائياً.`,
  },
  {
    title: "8. المسؤولية",
    body: `طير غير مسؤول عن جودة الحيوانات أو صحتها بعد إتمام الصفقة. ننصح دائماً بمعاينة الطائر شخصياً أو طلب فيديو مباشر قبل الشراء.`,
  },
  {
    title: "9. إنهاء الحساب",
    body: `يحق لنا إنهاء أو تعليق أي حساب يخالف هذه الشروط أو يسيء إلى المجتمع. يحق لك في أي وقت حذف حسابك من صفحة الإعدادات.`,
  },
  {
    title: "10. التعديلات",
    body: `قد نحدّث هذه الشروط بمرور الوقت. سنُعلمك بأي تعديلات جوهرية عبر التطبيق أو البريد.`,
  },
];

export default function TermsOfService() {
  const navigate = useNavigate();

  React.useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
    document.title = "الشروط والأحكام — طير";
  }, []);

  return (
    <div style={S.screen}>
      <TopBar title="الشروط والأحكام" onBack={() => navigate(-1)} />

      <div style={{ ...S.container, maxWidth: 720 }}>
        <div style={styles.heroCard}>
          <div style={styles.heroIcon}>
            <FileText size={36} strokeWidth={1.8} color={T.primary} />
          </div>
          <h2 style={styles.heroTitle}>الشروط والأحكام</h2>
          <p style={styles.heroDesc}>
            باستخدامك تطبيق طير فإنك توافق على البنود أدناه. اقرأها بعناية.
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
