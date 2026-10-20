# 🚀 دليل بناء التطبيق مع AdMob على MacBook

## الخطوة 1: تحميل وتثبيت الأدوات

```bash
# تثبيت Node.js (إذا لم يكن مثبتاً)
# حمّل من: https://nodejs.org

# تثبيت EAS CLI
npm install -g eas-cli

# التحقق من التثبيت
eas --version
```

## الخطوة 2: تسجيل الدخول

```bash
# تسجيل الدخول لـ Expo
eas login

# أدخل:
# Username: ziyad333
# Password: Edcxswqaz123
```

## الخطوة 3: تحميل المشروع

```bash
# تحميل ملف المشروع
curl -o mobile-project.zip https://quality-restore-1.preview.emergentagent.com/mobile-project.zip

# فك الضغط
unzip mobile-project.zip -d mobile-project

# الدخول للمجلد
cd mobile-project
```

## الخطوة 4: تثبيت المكتبات

```bash
# تثبيت المكتبات الأساسية
npm install

# تثبيت مكتبة AdMob
npm install react-native-google-mobile-ads
```

## الخطوة 5: بناء iOS

```bash
# بناء iOS للإنتاج
eas build --platform ios --profile production

# انتظر حتى ينتهي البناء (10-15 دقيقة)
# سيُطلب منك تسجيل الدخول لـ Apple إذا لزم الأمر
```

## الخطوة 6: بناء Android

```bash
# بناء Android للإنتاج
eas build --platform android --profile production

# انتظر حتى ينتهي البناء (10-15 دقيقة)
```

## الخطوة 7: رفع iOS لـ App Store

```bash
# رفع البناء الأخير لـ App Store Connect
eas submit --platform ios --latest
```

---

## 🔧 في حالة حدوث أخطاء:

### خطأ: CocoaPods
```bash
# تثبيت CocoaPods
sudo gem install cocoapods

# تحديث الـ pods
cd ios && pod install && cd ..
```

### خطأ: Xcode
```bash
# تحديد مسار Xcode
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### خطأ: تسجيل الدخول لـ Apple
```bash
# استخدم بيانات Apple Developer
# Apple ID: sky-321@hotmail.com
# App-Specific Password: jvst-jcce-rdcx-yhhf
```

---

## 📱 بيانات AdMob:

- **iOS App ID:** ca-app-pub-5132559433385403~6910358704
- **Android App ID:** ca-app-pub-5132559433385403~6910358704
- **Rewarded Ad Unit ID:** ca-app-pub-5132559433385403/2999033852

---

## ✅ بعد النجاح:

1. انسخ رابط البناء الجديد
2. أرسله لي
3. سأتحقق من أن AdMob يعمل بشكل صحيح
