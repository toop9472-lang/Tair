# دليل بناء تطبيق طير للموبايل 📱

## المتطلبات
- Node.js (الإصدار 18 أو أعلى)
- حساب Expo (expo.dev)
- EAS CLI

## خطوات البناء

### 1. تثبيت الأدوات
```bash
npm install -g eas-cli
npx expo login
```

### 2. الانتقال إلى مجلد الموبايل
```bash
cd mobile
```

### 3. تثبيت المكتبات
```bash
npm install
# أو
yarn install
```

### 4. بناء ملف APK
```bash
eas build --platform android --profile preview
```

### 5. تحميل الملف
بعد اكتمال البناء، ستحصل على رابط لتحميل ملف APK

---

## إعدادات البناء (eas.json)

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

---

## الميزات المتوفرة في التطبيق

### ✅ الصفحة الرئيسية
- بطاقة الرصيد الحالي
- إحصائياتك (اليوم، المتبقي، إجمالي النقاط)
- التحدي اليومي
- نصائح متحركة
- زر تبديل الوضع (داكن/فاتح)

### ✅ عارض الإعلانات
- شاشة كاملة بدون عناصر مشتتة
- سحب للأعلى/الأسفل = التنقل بين الإعلانات
- سحب لليمين/اليسار = الخروج
- بيانات المعلن تظهر عند اللمس
- نظام النقاط (5 نقاط لكل 30 ثانية)

### ✅ الوضع الداكن/الفاتح
- يتم حفظ الاختيار تلقائياً
- تصميم متناسق في كلا الوضعين

---

## ملاحظات هامة

1. **الرابط الخلفي:** تأكد من أن ملف `.env` يحتوي على:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com
   ```

2. **للنشر على Google Play:** استخدم `production` profile بدلاً من `preview`

3. **لـ iOS:** استخدم:
   ```bash
   eas build --platform ios --profile preview
   ```

---

## استكشاف الأخطاء

### خطأ في البناء
```bash
eas build:configure
```

### مسح الكاش
```bash
npx expo start -c
```

### تحديث EAS CLI
```bash
npm install -g eas-cli@latest
```
