// طير — Terms of Service & Privacy Policy (Arabic, KSA PDPL-friendly)
// Simple static content shown from Legal gate or Profile > Legal menu.
import React from "react";
import { ChevronRight, ShieldCheck, FileText } from "lucide-react";
import { T, S } from "./tairTheme";

const LAST_UPDATED = "27 فبراير 2026";

export function TermsPage({ onBack }) {
  return (
    <Legal onBack={onBack} title="شروط الاستخدام" icon={<FileText size={22} color={T.primary} />}>
      <p style={ls.updated}>آخر تحديث: {LAST_UPDATED}</p>

      <Section h="1. مقدّمة">
        منصّة "طير" (يُشار إليها بـ<strong> "المنصّة"</strong>) خدمة تقنية تربط بين محبّي الطيور والحيوانات في المملكة العربية السعودية: بائعون، مشترون، وموصّلون. باستخدامك للمنصّة فأنت توافق على هذه الشروط.
      </Section>

      <Section h="2. طبيعة الخدمة — وسيط تقني فقط">
        <strong>المنصّة وسيط تقني</strong> يتيح النشر والتواصل بين المستخدمين. لا نملك الطيور، لا نبيعها، لا نشحنها، ولا نتحقّق من كل معلومة يُدرجها المستخدم. جميع الصفقات والاتفاقيات تتم مباشرة بين الطرفين، ونحن غير طرف فيها.
      </Section>

      <Section h="3. المستخدم مسؤول عن محتواه">
        كل بائع أو ناقل مسؤول <strong>مسؤولية كاملة</strong> عن:
        <ul style={ls.ul}>
          <li>صحّة معلومات الإعلان والصور المرفوعة.</li>
          <li>ملكية الطائر أو الحيوان المعروض وامتلاك التصاريح اللازمة.</li>
          <li>الالتزام بأنظمة الحياة الفطرية والحيوانات المهدّدة بالانقراض في السعودية.</li>
          <li>سلامة النقل والحفاظ على صحة الحيوان أثناء الرحلة.</li>
        </ul>
      </Section>

      <Section h="4. المستخدمون غير الموثّقين">
        نُوفّر نظام توثيق (KYC) اختياري. المستخدم غير الموثّق قد يعرض معلومات غير دقيقة، ولا تتحمّل المنصّة أي تبعات عن تعاملك معه. <strong>ننصح بشدّة</strong> بالتعامل مع الحسابات ذات الشارة الزرقاء فقط.
      </Section>

      <Section h="5. المحتوى الممنوع">
        يُمنع منعاً باتاً نشر أو تداول:
        <ul style={ls.ul}>
          <li>الحيوانات المهدّدة بالانقراض المدرجة في اتفاقية سايتس (CITES).</li>
          <li>الحيوانات المهرّبة أو التي تفتقر لتصاريح جلب/تربية.</li>
          <li>محتوى مسيء، عنيف، أو مخالف للآداب العامة.</li>
          <li>معلومات مضلّلة أو صور مسروقة من مصادر أخرى.</li>
        </ul>
        نحتفظ بحق حذف الإعلانات وحظر الحسابات المخالفة دون إشعار مسبق.
      </Section>

      <Section h="6. الرسائل والاتصال">
        كل رسائل الشات محفوظة لأغراض الأمان ومنع الاحتيال. لا نقرأها بشكل روتيني، لكنّنا قد نراجعها عند وجود بلاغ. لا تُشارك بيانات دفع أو معلومات حسّاسة عبر الشات.
      </Section>

      <Section h="7. المدفوعات">
        <strong>المنصّة لا تعالج المدفوعات حالياً</strong>. أي مبلغ يُدفع بين الطرفين يتم خارج المنصّة، وأنت تتحمّل مسؤوليته كاملاً. ننصح باستلام الطائر ومعاينته قبل الدفع.
      </Section>

      <Section h="8. حذف الحساب">
        يمكنك حذف حسابك في أي وقت من صفحة "حسابي". بعد الحذف نحتفظ ببعض السجلّات (مثل المحادثات المُبلَغ عنها) لمدة قد تصل إلى 90 يوماً لأغراض قانونية.
      </Section>

      <Section h="9. إخلاء المسؤولية">
        المنصّة تُقدَّم "كما هي" (AS IS). لا نضمن الوصول المتواصل، خلوّها من الأخطاء، أو الحصول على نتائج معيّنة. <strong>لا نتحمّل مسؤولية</strong> أي خسائر مباشرة أو غير مباشرة ناتجة عن استخدامها.
      </Section>

      <Section h="10. التعديلات">
        قد نُعدّل هذه الشروط في أي وقت. الاستخدام المستمر بعد التعديل يُعدّ موافقة على الشروط الجديدة.
      </Section>

      <Section h="11. القانون المعمول به">
        تخضع هذه الشروط لأنظمة المملكة العربية السعودية. أي نزاع يُحلّ ودّياً أوّلاً، وإن تعذّر فأمام الجهات القضائية المختصّة بمدينة الرياض.
      </Section>

      <Section h="12. التواصل">
        للاستفسارات القانونية: <strong>legal@saqr4u.com</strong>
      </Section>
    </Legal>
  );
}

export function PrivacyPage({ onBack }) {
  return (
    <Legal onBack={onBack} title="سياسة الخصوصية" icon={<ShieldCheck size={22} color={T.primary} />}>
      <p style={ls.updated}>آخر تحديث: {LAST_UPDATED} — متوافقة مع نظام حماية البيانات الشخصية (PDPL) بالسعودية</p>

      <Section h="1. ما البيانات التي نجمعها؟">
        <ul style={ls.ul}>
          <li><strong>معلومات الحساب</strong>: البريد الإلكتروني، الاسم، الجوال، المدينة، الصورة الشخصية.</li>
          <li><strong>محتوى الإعلانات والرحلات</strong>: الصور، الأوصاف، الأسعار.</li>
          <li><strong>الرسائل</strong>: محادثات الشات بين المستخدمين.</li>
          <li><strong>وثائق التوثيق (KYC)</strong>: صور الهوية والسِلفي — تُخزّن مُشفّرة ولا تُشارك.</li>
          <li><strong>بيانات تقنية</strong>: عنوان IP، نوع الجهاز، لغة المتصفح، سجلّات الاستخدام لأغراض الأمان.</li>
        </ul>
      </Section>

      <Section h="2. لماذا نجمعها؟">
        <ul style={ls.ul}>
          <li>تشغيل خدمات المنصّة وربطك بالبائعين/الناقلين.</li>
          <li>الأمان ومنع الاحتيال (كشف المحاولات المشبوهة).</li>
          <li>إرسال الإشعارات (رسائل، طلبات، توثيق).</li>
          <li>تحسين المنتج بناءً على إحصائيات مجهولة الهوية.</li>
        </ul>
      </Section>

      <Section h="3. مع من نُشارك بياناتك؟">
        <ul style={ls.ul}>
          <li><strong>لا نبيع بياناتك</strong> لأي طرف ثالث، ولا نُشاركها لأغراض تسويقية.</li>
          <li>مزوّدو خدمات تقنية موثوقون: Cloudflare R2 (تخزين الصور)، Resend (البريد الإلكتروني) — بموجب اتفاقيات سرّية.</li>
          <li>الجهات الحكومية عند طلب قانوني رسمي فقط.</li>
        </ul>
      </Section>

      <Section h="4. مدة الاحتفاظ">
        <ul style={ls.ul}>
          <li>الحساب والإعلانات: طالما حسابك نشِط.</li>
          <li>محادثات الشات: 12 شهراً بعد آخر رسالة.</li>
          <li>سجلّات الأمان والاحتيال: 24 شهراً.</li>
          <li>وثائق KYC: 5 سنوات بعد التحقّق، ثم تُحذف نهائياً.</li>
        </ul>
      </Section>

      <Section h="5. حقوقك">
        وفقاً لنظام حماية البيانات الشخصية (PDPL) لديك الحق في:
        <ul style={ls.ul}>
          <li>الاطلاع على بياناتك.</li>
          <li>تصحيح أي معلومة غير دقيقة.</li>
          <li>حذف حسابك وبياناتك.</li>
          <li>سحب موافقتك على المعالجة في أي وقت.</li>
        </ul>
        للتنفيذ: أرسل طلباً إلى <strong>privacy@saqr4u.com</strong> ونستجيب خلال 30 يوماً.
      </Section>

      <Section h="6. ملفات تعريف الارتباط (Cookies)">
        نستخدم Cookies تقنية أساسية لتذكّر تسجيل الدخول وتفضيلاتك، ولا نستخدم Cookies تتبّع خارجية.
      </Section>

      <Section h="7. أمان البيانات">
        نُشفّر جميع الاتصالات (HTTPS)، ونُشفّر كلمات المرور (bcrypt)، ونحمي خوادمنا بجدران نارية. لا يوجد نظام مثالي، ونُبلغك خلال 72 ساعة من أي اختراق يمسّ بياناتك.
      </Section>

      <Section h="8. الأطفال">
        الخدمة مخصّصة لمن هم بعمر 18 سنة فأكثر. إذا اكتشفنا حساباً لقاصر نحذفه فوراً.
      </Section>

      <Section h="9. التواصل">
        <strong>privacy@saqr4u.com</strong>
      </Section>
    </Legal>
  );
}

function Legal({ title, icon, onBack, children }) {
  return (
    <div style={{ ...S.screen, background: T.bg }} data-testid={`legal-page-${title}`}>
      <div style={ls.header}>
        <button onClick={onBack} style={ls.backBtn} data-testid="legal-back-btn">
          <ChevronRight size={22} strokeWidth={2.4} />
        </button>
        <div style={ls.headerCenter}>
          <div style={ls.headerIcon}>{icon}</div>
          <h1 style={ls.headerTitle}>{title}</h1>
        </div>
        <span style={{ width: 34 }} />
      </div>
      <div style={ls.body}>{children}</div>
    </div>
  );
}

function Section({ h, children }) {
  return (
    <div style={ls.section}>
      <h2 style={ls.h}>{h}</h2>
      <div style={ls.p}>{children}</div>
    </div>
  );
}

const ls = {
  header: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between",
    padding: "16px", background: "#fff",
    borderBottom: `1px solid ${T.border}`,
    position: "sticky", top: 0, zIndex: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    border: `1px solid ${T.border}`, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: T.textStrong,
  },
  headerCenter: { display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  headerIcon: { width: 32, height: 32, borderRadius: 10, background: "#f0fdfa", display: "flex", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: 900, color: T.textStrong, margin: 0 },
  body: {
    padding: "18px 18px 60px",
    maxWidth: 640, margin: "0 auto",
    textAlign: "right",
    lineHeight: 1.85,
  },
  updated: {
    fontSize: 12, color: T.textMuted, fontWeight: 700,
    background: "#f8fafc",
    padding: "8px 12px", borderRadius: 8,
    marginBottom: 20,
  },
  section: { marginBottom: 22 },
  h: {
    fontSize: 15, fontWeight: 900, color: T.textStrong,
    margin: "0 0 8px", letterSpacing: "-0.01em",
  },
  p: { fontSize: 13.5, color: T.text, fontWeight: 500 },
  ul: { paddingInlineStart: 20, margin: "8px 0 0", listStyle: "square" },
};
