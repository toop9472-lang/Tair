# 🚀 دليل رفع التحديثات على MacBook

## المتطلبات الأساسية
- MacBook مع macOS
- Node.js مثبت
- حساب Expo (ziyad333)

---

## الخطوة 1: تحميل المشروع من GitHub

```bash
# افتح Terminal على MacBook
# انتقل لسطح المكتب
cd ~/Desktop

# حمّل المشروع من GitHub
git clone https://github.com/toop9472-lang/Sgr2040.git

# ادخل مجلد التطبيق المحمول
cd Sgr2040/mobile
```

---

## الخطوة 2: تثبيت الأدوات

```bash
# تثبيت EAS CLI عالمياً
npm install -g eas-cli

# أو إذا واجهت مشاكل صلاحيات:
sudo npm install -g eas-cli

# تثبيت مكتبات المشروع
npm install
```

---

## الخطوة 3: تسجيل الدخول لـ Expo

```bash
# تسجيل الدخول
eas login

# أدخل البيانات:
# Username: ziyad333
# Password: Edcxswqaz123
```

---

## الخطوة 4: بناء التطبيقات

### بناء iOS و Android معاً:
```bash
eas build --platform all --profile production
```

### أو بناء كل منصة منفصلة:
```bash
# بناء iOS فقط
eas build --platform ios --profile production

# بناء Android فقط
eas build --platform android --profile production
```

⏱️ **الوقت المتوقع:** 15-30 دقيقة لكل منصة

---

## الخطوة 5: رفع iOS لـ App Store

```bash
# رفع آخر بناء iOS تلقائياً
eas submit --platform ios --latest
```

### إذا طُلبت بيانات Apple:
- **Apple ID:** sky-321@hotmail.com
- **App-Specific Password:** jvst-jcce-rdcx-yhhf

---

## الخطوة 6: تحميل Android للرفع يدوياً

بعد انتهاء البناء:
1. افتح الرابط الذي يظهر في Terminal
2. حمّل ملف `.aab`
3. ارفعه على Google Play Console

---

## 🔧 حل المشاكل الشائعة

### مشكلة: Permission denied أو EACCES
```bash
# استخدم sudo
sudo npm install -g eas-cli

# أو استخدم npx بدون تثبيت عالمي
npx eas-cli login
npx eas-cli build --platform all
```

### مشكلة: git authentication failed
```bash
# تأكد أن الريبو عام (public)
# أو أدخل كلمة مرور GitHub عند الطلب
```

### مشكلة: Command not found
```bash
# استخدم npx بدلاً من eas مباشرة
npx eas-cli build --platform all
```

### مشكلة: CocoaPods
```bash
# تثبيت CocoaPods
sudo gem install cocoapods
```

---

## 📊 معلومات الإصدار الحالي

| الحقل | القيمة |
|-------|--------|
| **الإصدار** | 4.7.0 |
| **iOS Build Number** | 6 |
| **Android Version Code** | 32 |
| **Bundle ID** | com.saqr.rewards |

---

## 🔗 روابط مهمة

- **Expo Dashboard:** https://expo.dev/accounts/ziyad333/projects/saqr-app/builds
- **GitHub:** https://github.com/toop9472-lang/Sgr2040
- **App Store Connect:** https://appstoreconnect.apple.com
- **Google Play Console:** https://play.google.com/console

---

## ✅ بعد النجاح

1. ✔️ تحقق من حالة البناء على Expo Dashboard
2. ✔️ راجع التطبيق على TestFlight (iOS)
3. ✔️ ارفع AAB على Google Play Console (Android)
4. ✔️ أرسل لي رابط البناء للتأكد

---

## 📞 للمساعدة

إذا واجهت أي مشكلة:
1. انسخ رسالة الخطأ كاملة
2. أرسلها لي
3. سأساعدك في حلها فوراً
