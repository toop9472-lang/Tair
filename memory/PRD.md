# Tair — PRD (محدَّث)

## نظرة عامة
"طير (Tair)" — سوق متخصص وملتقى طيور/حيوانات في السعودية مع لوجستيات.
الأدوار: مشتري، بائع، ناقل، مشرف/إدمن.

## تصدير الكود (20 Oct 2026)
- Save to Github يفشل (did not receive expected object fcc782…) حتى مع مستودع فاضي → مشكلة من المنصة (shallow repo). تم توجيه المستخدم للدعم.
- ZIP كامل في /tmp/tair_export/Tair_full_source.zip (مؤقت، يضيع عند إعادة تشغيل الحاوية) عبر GET /api/admin/source-download?key=SOURCE_DOWNLOAD_KEY.

## تنظيف مخلفات صقر (20 Oct 2026) — بدون بناء
- حذف راوترات صقر غير المستخدمة: challenges, gifts, invitations, leaderboards, referrals, unity_ads, websocket(games), withdrawal_methods, games, diamonds, security (+ اختباراتها).
- حذف 18 ملف ميت في mobile و70 في frontend (غير مستوردة) + ملفات ثقيلة قديمة (aab صقر، فيديوهات clips، PDFs صقر، build_logs، أيقونات صقر).
- حجم المشروع 148MB → 77.5MB. اختبار iteration_28: 58/58 نجاح.
- أُبقيت لوحة المدير على الويب (/admin/dashboard) وما تعتمد عليه (reports, ads, withdrawal, clips, economy...) لأنها ما زالت قابلة للوصول.
- البث وإشعار التحديث يرسلان Push في الخلفية (BackgroundTasks).

## آخر تحديث (20 Oct 2026) — بدون بناء
- الرسالة الجماعية: صارت ترسل Push لكل الأجهزة (دفعات من 100) + شاشة إشعارات حقيقية NotificationsScreen (كانت placeholder). توحيد هوية المستخدم (user_id/id/email/admin id).
- إشعار التحديث: POST /api/admin/app-update + GET /api/app/latest-update → نافذة منبثقة مرة لكل تحديث (UpdateNoticeModal) + Push.
- بوت العيادة: GET /api/clinic/bot/status + POST /api/clinic/bot/toggle — تبويب "بوت العيادة" في لوحة المدير (يظهر لمشرفي العيادة أيضاً).
- حذف ردود العيادة للمدير/المشرفين (زر سلة على كل رد).
- فتح البروفايل/المتجر من الدردشة العامة وردود العيادة وصاحب الموضوع (seller_profile مع returnTo).
- إصلاح التحميل اللانهائي للبروفايل من الرسائل الخاصة (كان يمرر userId لشاشة تتوقع targetUserId) → يفتح SellerStorefrontScreen.

## تحديث سابق (3 Oct 2026)
- زر الرسائل العائم (MessagesFab) أسفل يسار الشاشة، فوق شريط التنقل، في كل الصفحات.
- إزالة أيقونة الرسائل من رأس الصفحة (TairHeader).
- إزالة شريط الكتابة من الدردشة العامة في CommunityScreen (للعرض فقط).
- Build 211 / v8.6.0 — iOS + Android (EAS queued).

## المميزات الحالية
- السوق + الإعلانات + التواصل عبر الدردشة.
- الرحلات والطلبات (Carriers).
- المجتمع: قصص 24h + دردشة عامة (للعرض فقط حالياً) + "عرض طيوركم".
- العيادة (Clinic) كمنتدى طبي: مواضيع + مكتبة PDF + مساعد Gemini للمشرفين.
- المزاد (Submit → Admin approval → auto sequence).
- Admin Panel: Scopes (Clinic/Market/Community/General) + pagination + broadcast + verification.
- Deep Linking (`/share/{type}/{id}`) + Web fallback.

## المعلّقات
- P1: تطابق الفلاتر مع 17 تصنيف السوق في listings_routes.
- P1: Google Play Service Account Key (للسبمت التلقائي).
- P2: تحسين CDN لصور Cloudflare R2.
- Future: حذف الحساب End-to-End داخل التطبيق.

## التكامل
- Gemini / Nano Banana — Emergent LLM Key.
- Cloudflare R2 — User Keys.
- Resend — User Keys.
- Expo EAS — User Account (ziyad333).

## اللغة
عربي صارم RTL.
