// أرقام التواصل: المربي يكتب الرقم المحلي، والتطبيق يفتح واتساب بالصيغة الدولية.
const AR = "٠١٢٣٤٥٦٧٨٩";
const FA = "۰۱۲۳۴۵۶۷۸۹";

export function latinDigits(raw) {
  return String(raw || "")
    .replace(/[٠-٩۰-۹]/g, (ch) => {
      const i = AR.indexOf(ch);
      if (i >= 0) return String(i);
      const j = FA.indexOf(ch);
      return j >= 0 ? String(j) : "";
    })
    .replace(/\D/g, "");
}

/**
 * 0534737373 و 534737373 يصبحان 966534737373.
 * الرقم الذي يبدأ بمفتاح دولة يبقى كما هو، بلا إضافة 966 فوقه.
 */
export function toWhatsAppPhone(raw) {
  let d = latinDigits(raw);
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("966")) return d;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 9 && d.startsWith("5")) return `966${d}`;
  return d;
}

export function displayLocalPhone(raw) {
  const d = toWhatsAppPhone(raw);
  if (d.startsWith("966") && d.length === 12) return `0${d.slice(3)}`;
  return latinDigits(raw);
}

export function toStoredPhone(raw) {
  const d = toWhatsAppPhone(raw);
  return d ? `+${d}` : "";
}

export function toTel(raw) {
  const d = toWhatsAppPhone(raw);
  if (!d) return "";
  return d.startsWith("966") ? `+${d}` : d;
}

export function savedContactPhone(user) {
  if (!user) return "";
  const sf = user.storefront_settings || {};
  return String(user.whatsapp || user.phone || sf.whatsapp || sf.phone || "").trim();
}

export async function openWhatsApp(raw, message) {
  const phone = toWhatsAppPhone(raw);
  if (!phone || phone.length < 9) return false;
  const { Linking, Alert } = require("react-native");
  const msg = encodeURIComponent(message || "");
  const nativeUrl = `whatsapp://send?phone=${phone}&text=${msg}`;
  const webUrl = `https://wa.me/${phone}?text=${msg}`;
  try {
    const canNative = await Linking.canOpenURL(nativeUrl);
    if (canNative) {
      await Linking.openURL(nativeUrl).catch(() => Linking.openURL(webUrl));
      return true;
    }
  } catch {
    // إن تعذّر فحص التطبيق نكمل برابط الويب
  }
  try {
    await Linking.openURL(webUrl);
    return true;
  } catch {
    Alert.alert(
      "تعذّر فتح واتساب",
      "قد يكون الرقم لا يستخدم واتساب أو أن التطبيق غير مثبّت على جهازك.",
    );
    return false;
  }
}
