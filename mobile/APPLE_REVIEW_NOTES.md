# Apple Review Notes

## English:

```
This app requires an internet connection to:
- Load and run in-app games
- Match online players and sync leaderboards
- Sync account balances (Saqr Gems and Diamonds)

Please ensure Wi-Fi or Cellular Data is enabled during testing.

Demo Account:
Email: demo@saqr.app
Password: Demo123456

Support URL:
https://saqr-ui-sync.emergent.host/support

ATT Location:
- On first launch (iOS), the ATT prompt is requested automatically on the Login screen before ad-tracking related flows.
- Explicit location in UI: Login screen -> "App Tracking Transparency (ATT)" card -> "Request Permission Now".
- Additional manual location: Profile -> "Ad Tracking Permission (ATT)".
- If the device already has a saved ATT decision for this bundle, iOS will not show the system popup again (expected behavior).
- Ad SDK initialization on iOS is gated behind ATT check/request flow.

Social Login Test:
- Open app login screen.
- Tap "Sign in with Apple" or "Sign in with Google".
- Complete provider flow and return to app.
- User session is created and app enters Home screen.

Account Deletion Location:
- Profile -> "Delete Account Permanently"
- User confirms with DELETE (or Arabic: حذف), then account is removed.

Purchases / Guideline 3.1.1:
- On iOS, digital purchase flow is restricted to Apple In-App Purchase policy path (no external web checkout in app UI).

Third-party consent popup removal:
- The game source that showed the "KBHGames consent" page has been removed from external loading.
- That game now runs in internal in-app mode (no third-party consent wall).
- On iOS, imported web game sessions are forced to internal in-app mode to avoid third-party consent walls.

Notes:
- The app is a games-first experience (solo and online games).
- Ads are optional and secondary to gameplay progression.
```

## Arabic:

```
يتطلب التطبيق اتصال بالإنترنت لـ:
- تشغيل الألعاب داخل التطبيق
- المطابقة في الألعاب الأونلاين وتحديث المتصدرين
- مزامنة أرصدة جواهر صقر والألماس

يرجى التأكد من تفعيل Wi-Fi أو بيانات الجوال أثناء الاختبار.

حساب تجريبي:
Email: demo@saqr.app
Password: Demo123456

رابط الدعم:
https://saqr-ui-sync.emergent.host/support

مكان ظهور ATT:
- عند أول تشغيل على iOS يتم طلب إذن ATT تلقائيًا من شاشة الدخول قبل أي تدفق متعلق بتتبع الإعلانات.
- مكان واضح داخل الواجهة: شاشة الدخول -> بطاقة "شفافية تتبع التطبيقات (ATT)" -> زر "طلب الإذن الآن".
- مكان إضافي يدوي: حسابي -> إذن تتبع الإعلانات (ATT).
- إذا كان الجهاز لديه قرار ATT محفوظ مسبقًا لهذا التطبيق فلن يظهر Popup النظام مرة أخرى (سلوك iOS طبيعي).

خطوات اختبار تسجيل Apple/Google:
- افتح شاشة تسجيل الدخول.
- اضغط "الدخول بحساب Apple" أو "الدخول بحساب Google".
- أكمل المصادقة ثم العودة للتطبيق.
- يتم إنشاء الجلسة والدخول للواجهة الرئيسية.

مكان حذف الحساب:
- حسابي -> حذف الحساب نهائياً
- يكتب المستخدم DELETE أو "حذف" للتأكيد ثم يتم الحذف النهائي.

المشتريات / Guideline 3.1.1:
- على iOS تم تقييد الشراء الرقمي لمسار In-App Purchase المتوافق مع Apple (بدون دفع خارجي من داخل التطبيق).

إزالة نافذة موافقة KBHGames:
- تم إلغاء المصدر الخارجي للعبة التي كانت تعرض نافذة موافقة KBHGames.
- اللعبة أصبحت تعمل بوضع داخلي داخل التطبيق بدون جدار موافقة خارجي.

ملاحظات:
- التطبيق موجّه أساسًا للألعاب (فردي + أونلاين).
- الإعلانات ميزة ثانوية اختيارية وليست الهدف الأساسي.
```
