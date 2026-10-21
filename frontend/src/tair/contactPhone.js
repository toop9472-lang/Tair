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

export function toWhatsAppPhone(raw) {
  let d = latinDigits(raw);
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("966")) return d;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 9 && d.startsWith("5")) return `966${d}`;
  return d;
}

export function whatsAppUrl(raw, message) {
  const phone = toWhatsAppPhone(raw);
  if (!phone) return "";
  const msg = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${phone}${msg}`;
}
