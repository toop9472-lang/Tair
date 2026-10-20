# 📱 دليل بناء تطبيق صقر للموبايل (APK)

## ⚠️ ملاحظة مهمة
بناء APK يتطلب بيئة تفاعلية مع صلاحيات كاملة. لذلك، يجب بناء التطبيق على جهازك المحلي.

---

## 🛠️ المتطلبات الأساسية

### 1. تثبيت Node.js
- قم بتحميل وتثبيت [Node.js](https://nodejs.org/) (الإصدار 18 أو أحدث)
- للتحقق: `node --version`

### 2. تثبيت Expo CLI و EAS CLI
```bash
npm install -g expo-cli eas-cli
```

### 3. إنشاء حساب Expo
- اذهب إلى [expo.dev](https://expo.dev) وأنشئ حساب مجاني
- أو استخدم حسابك الحالي: `ziyad333`

---

## 📦 خطوات بناء APK

### الخطوة 1: تحميل ملفات المشروع
1. قم بتحميل مجلد `/app/mobile` بالكامل إلى جهازك
2. يمكنك تحميله من خلال الضغط على "Download Code" في Emergent

### الخطوة 2: فتح Terminal في مجلد المشروع
```bash
cd path/to/mobile
```

### الخطوة 3: تثبيت المتطلبات
```bash
npm install
# أو
yarn install
```

### الخطوة 4: تسجيل الدخول لـ Expo
```bash
eas login
```
- أدخل اسم المستخدم: `ziyad333`
- أدخل كلمة المرور الخاصة بك

### الخطوة 5: بناء APK
```bash
eas build --platform android --profile preview
```

#### ماذا سيحدث:
1. سيسألك عن إنشاء keystore جديد - اختر **Yes**
2. سيتم رفع المشروع لخوادم Expo
3. البناء يستغرق 10-15 دقيقة تقريباً
4. ستحصل على رابط لتحميل APK

---

## 📺 إعداد Google AdMob

### معرّف الناشر الخاص بك:
```
pub-5132559433385403
```

### خطوات تفعيل الإعلانات:

1. **اذهب إلى** [admob.google.com](https://admob.google.com)

2. **أكمل التوثيق** (يتطلب التحقق من الهوية)

3. **أضف تطبيقك:**
   - اضغط على "Apps" → "Add App"
   - اختر Android أو iOS
   - أدخل اسم التطبيق: `صقر - Saqr`
   - Package: `com.saqr.app`

4. **أنشئ Ad Unit:**
   - اختر تطبيقك
   - اضغط "Ad units" → "Add ad unit"
   - اختر **"Rewarded"**
   - أدخل اسم: `rewarded_video`
   - احفظ وانسخ الـ Ad Unit ID

5. **أضف المعرّفات في لوحة التحكم:**
   - افتح لوحة تحكم صقر
   - اذهب للإعدادات → AdMob
   - أدخل App ID و Ad Unit ID

### معرّفات الاختبار (للتطوير):
```
Android: ca-app-pub-3940256099942544/5224354917
iOS: ca-app-pub-3940256099942544/1712485313
```

---

## 🔑 إعدادات الـ Keystore

### خيار 1: إنشاء keystore تلقائياً (موصى به)
- عند سؤالك، اختر "Generate new keystore"
- Expo سيحفظ المفاتيح في حسابك

### خيار 2: استخدام keystore موجود
إذا كان لديك keystore بالفعل:

```bash
# نسخ الملفات للمشروع
cp your-keystore.jks ./credentials/android/keystore.jks

# إنشاء ملف credentials.json
```

محتوى `credentials/android/credentials.json`:
```json
{
  "keystore": {
    "keystorePath": "./keystore.jks",
    "keystorePassword": "YOUR_KEYSTORE_PASSWORD",
    "keyAlias": "YOUR_KEY_ALIAS",
    "keyPassword": "YOUR_KEY_PASSWORD"
  }
}
```

---

## 📱 تثبيت APK على الجهاز

### طريقة 1: رابط التحميل
- بعد انتهاء البناء، ستحصل على رابط مباشر
- افتح الرابط على جهاز Android وقم بتثبيت التطبيق

### طريقة 2: QR Code
- يمكنك مسح QR Code من موقع Expo

### طريقة 3: ADB (للمطورين)
```bash
adb install path/to/saqr-app.apk
```

---

## 🍎 بناء تطبيق iOS

### المتطلبات:
- جهاز Mac
- حساب Apple Developer ($99/سنة)
- Xcode مثبت

### الخطوات:
```bash
# بناء للـ Simulator
eas build --platform ios --profile preview

# بناء للإنتاج
eas build --platform ios --profile production
```

---

## ⚙️ الإعدادات الحالية

### معلومات التطبيق:
| الإعداد | القيمة |
|---------|--------|
| اسم التطبيق | صقر - Saqr |
| Package Name | com.saqr.app |
| الإصدار | 1.0.0 |
| Expo Owner | ziyad333 |
| Project ID | 2a08ac90-1772-4377-bf99-af5d2357db30 |
| AdMob Publisher | pub-5132559433385403 |

### API URL:
```
https://quality-restore-1.preview.emergentagent.com
```

---

## 🔧 حل المشاكل الشائعة

### مشكلة: "EAS project not found"
```bash
eas build:configure
```

### مشكلة: "Keystore password incorrect"
- تأكد من كلمة المرور الصحيحة
- أو احذف الـ keystore وأنشئ جديد

### مشكلة: "Build failed - gradle error"
```bash
# تنظيف المشروع
cd android
./gradlew clean
cd ..
eas build --platform android --profile preview --clear-cache
```

### مشكلة: "Expo account not found"
```bash
# تسجيل خروج وإعادة تسجيل
eas logout
eas login
```

### مشكلة: "AdMob ads not showing"
- تأكد من اكتمال توثيق حساب AdMob
- استخدم معرّفات الاختبار أولاً
- تحقق من App ID و Ad Unit ID

---

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من [وثائق Expo](https://docs.expo.dev)
2. ابحث في [Expo Forums](https://forums.expo.dev)
3. راجع [EAS Build Docs](https://docs.expo.dev/build/introduction/)
4. [AdMob Documentation](https://developers.google.com/admob)

---

## ✅ قائمة التحقق

- [ ] Node.js مثبت (v18+)
- [ ] eas-cli مثبت
- [ ] حساب Expo جاهز
- [ ] مجلد mobile محمّل
- [ ] npm install تم تنفيذه
- [ ] eas login تم بنجاح
- [ ] eas build بدأ
- [ ] APK تم تحميله
- [ ] التطبيق مثبت على الجهاز
- [ ] حساب AdMob موثق
- [ ] Ad Unit IDs تم إنشاؤها

---

**تم إنشاء هذا الدليل في يناير 2025**
**تطبيق صقر - منصة الإعلانات والمكافآت**
