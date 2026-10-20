# دليل بناء التطبيق للمتطلبات الجديدة (2026)
# App Store & Google Play Requirements Guide

## متطلبات Apple App Store (2026)

### ITMS-90725: iOS SDK Version Issue
**المشكلة:** يجب بناء التطبيق باستخدام iOS 26 SDK (Xcode 26) ابتداءً من 28 أبريل 2026

**الحل:**
1. قم بتحديث Xcode إلى الإصدار 26 أو أحدث على جهاز Mac
2. تأكد من أن `eas.json` يستخدم أحدث Xcode
3. أضف في `eas.json`:
```json
{
  "build": {
    "production": {
      "ios": {
        "image": "macos-ventura-14.5-xcode-26.0"
      }
    }
  }
}
```

### Privacy Manifest (PrivacyInfo.xcprivacy)
**تم إنشاؤه في:** `/app/mobile/ios/PrivacyInfo.xcprivacy`

يحتوي على:
- NSPrivacyAccessedAPICategoryUserDefaults (CA92.1)
- NSPrivacyAccessedAPICategorySystemBootTime (35F9.1)
- NSPrivacyAccessedAPICategoryFileTimestamp (C617.1)
- NSPrivacyAccessedAPICategoryDiskSpace (E174.1)

---

## متطلبات Google Play (2026)

### 1. Android 15 (SDK 35) Target
**تم التحديث في:** `app.json`
```json
{
  "android": {
    "compileSdkVersion": 35,
    "targetSdkVersion": 35,
    "minSdkVersion": 24
  }
}
```

### 2. Edge-to-Edge Display
**المشكلة:** ميزة العرض حتى حافة الشاشة مفعلة تلقائياً في Android 15

**الحل:**
تم إضافة `react-native-edge-to-edge` plugin في `app.json`:
```json
{
  "plugins": [
    [
      "react-native-edge-to-edge",
      {
        "android": {
          "parentTheme": "EdgeToEdge"
        }
      }
    ]
  ]
}
```

### 3. Deprecated APIs
**المشكلة:** واجهات برمجة التطبيقات المتوقفة:
- android.view.Window.getStatusBarColor
- android.view.Window.setStatusBarColor
- android.view.Window.setNavigationBarColor

**الحل:**
تم التعامل معها عبر `react-native-edge-to-edge` الذي يستخدم APIs الجديدة

### 4. Screen Orientation Restrictions
**المشكلة:** يجب إزالة قيود الاتجاه للأجهزة الكبيرة

**تم التحديث في:** `app.json`
```json
{
  "orientation": "default"  // بدلاً من "portrait"
}
```

و في iOS infoPlist:
```json
{
  "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"],
  "UISupportedInterfaceOrientations~ipad": ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"]
}
```

---

## خطوات البناء

### لـ iOS:
```bash
# تأكد من تثبيت Xcode 26
# ثم قم بالبناء
eas build --platform ios --profile production
```

### لـ Android:
```bash
# البناء للإنتاج
eas build --platform android --profile production
```

---

## ملاحظات مهمة

1. **قبل رفع التطبيق:**
   - تأكد من اختبار Edge-to-Edge على أجهزة Android 15
   - تأكد من عمل التطبيق بالوضع الأفقي والعمودي
   - تأكد من عدم وجود عناصر UI مخفية خلف status bar أو navigation bar

2. **للاختبار:**
   ```bash
   # بناء نسخة معاينة
   eas build --platform android --profile preview
   eas build --platform ios --profile preview
   ```

3. **إرسال للمتاجر:**
   ```bash
   # إرسال لـ App Store
   eas submit --platform ios
   
   # إرسال لـ Google Play
   eas submit --platform android
   ```

---

## التحديثات المطبقة (الإصدار 6.0.0)

| الميزة | الحالة |
|--------|--------|
| Android SDK 35 Target | ✅ |
| iOS Privacy Manifest | ✅ |
| Edge-to-Edge Support | ✅ |
| Orientation Support | ✅ |
| Deprecated APIs Fix | ✅ |

---

آخر تحديث: مارس 2026
