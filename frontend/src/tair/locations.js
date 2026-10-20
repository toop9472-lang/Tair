/** نفس قائمة الجوال: مدن المملكة ثم مدن الخليج، مع بحث داخل المناطق. */
import React, { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { villagesFor } from "./villages";

export const LOCATION_GROUPS = [
  { id: "riyadh", label: "منطقة الرياض", cities: ["الرياض", "الدرعية", "الخرج", "الدلم", "المجمعة", "الدوادمي", "القويعية", "وادي الدواسر", "الأفلاج", "الزلفي", "شقراء", "حوطة بني تميم", "عفيف", "السليل", "ضرما", "الحريق", "رماح", "ثادق", "الغاط", "حريملاء", "المزاحمية", "مرات", "الرين"] },
  { id: "makkah", label: "منطقة مكة المكرمة", cities: ["مكة المكرمة", "جدة", "الطائف", "رابغ", "خليص", "القنفذة", "الليث", "الجموم", "بحرة", "الكامل", "تربة", "الخرمة", "رنية", "المويه", "ميسان", "أضم", "العرضيات"] },
  { id: "madinah", label: "منطقة المدينة المنورة", cities: ["المدينة المنورة", "ينبع", "العلا", "بدر", "المهد", "الحناكية", "خيبر", "العيص", "وادي الفرع"] },
  { id: "qassim", label: "منطقة القصيم", cities: ["بريدة", "عنيزة", "الرس", "المذنب", "البكيرية", "البدائع", "الأسياح", "النبهانية", "عيون الجواء", "رياض الخبراء", "الشماسية", "ضرية", "عقلة الصقور"] },
  { id: "eastern", label: "المنطقة الشرقية", cities: ["الدمام", "الخبر", "الظهران", "الأحساء", "الهفوف", "الجبيل", "القطيف", "حفر الباطن", "رأس تنورة", "بقيق", "النعيرية", "الخفجي", "قرية العليا", "العديد"] },
  { id: "asir", label: "منطقة عسير", cities: ["أبها", "خميس مشيط", "بيشة", "النماص", "محايل عسير", "تنومة", "رجال ألمع", "بلقرن", "ظهران الجنوب", "سراة عبيدة", "أحد رفيدة", "المجاردة", "بارق", "البرك", "طريب", "تثليث"] },
  { id: "jazan", label: "منطقة جازان", cities: ["جازان", "صبيا", "أبو عريش", "صامطة", "بيش", "أحد المسارحة", "الحرث", "ضمد", "فيفا", "الدرب", "الريث", "الطوال", "العارضة", "فرسان", "العيدابي", "هروب", "الدائر"] },
  { id: "najran", label: "منطقة نجران", cities: ["نجران", "شرورة", "حبونا", "بدر الجنوب", "يدمة", "خباش", "ثار", "الخرخير"] },
  { id: "baha", label: "منطقة الباحة", cities: ["الباحة", "بلجرشي", "المندق", "المخواة", "قلوة", "العقيق", "القرى", "بني حسن", "الحجرة", "غامد الزناد"] },
  { id: "tabuk", label: "منطقة تبوك", cities: ["تبوك", "أملج", "الوجه", "ضباء", "تيماء", "حقل", "البدع"] },
  { id: "hail", label: "منطقة حائل", cities: ["حائل", "بقعاء", "الشنان", "الغزالة", "الحائط", "موقق", "السليمي", "الشملي", "سميراء"] },
  { id: "northern", label: "منطقة الحدود الشمالية", cities: ["عرعر", "رفحاء", "طريف", "العويقيلة"] },
  { id: "jouf", label: "منطقة الجوف", cities: ["سكاكا", "القريات", "دومة الجندل", "طبرجل"] },
  { id: "uae", label: "الإمارات", cities: ["دبي", "أبوظبي", "الشارقة", "عجمان", "أم القيوين", "رأس الخيمة", "الفجيرة", "العين", "الإمارات العربية المتحدة"] },
  { id: "bahrain", label: "البحرين", cities: ["المنامة", "المحرق", "الرفاع", "مدينة عيسى", "سترة", "البحرين"] },
  { id: "qatar", label: "قطر", cities: ["الدوحة", "الريان", "الوكرة", "الخور", "أم صلال", "قطر"] },
  { id: "kuwait", label: "الكويت", cities: ["مدينة الكويت", "حولي", "الفروانية", "الأحمدي", "الجهراء", "مبارك الكبير", "الكويت"] },
  { id: "oman", label: "سلطنة عمان", cities: ["مسقط", "صلالة", "صحار", "نزوى", "صور", "البريمي", "سلطنة عمان"] },
];

const SAUDI_IDS = new Set(["riyadh", "makkah", "madinah", "qassim", "eastern", "asir", "jazan", "najran", "baha", "tabuk", "hail", "northern", "jouf"]);

export const SAUDI_CITIES = LOCATION_GROUPS.filter((g) => SAUDI_IDS.has(g.id)).flatMap((g) => g.cities);
export const GULF_COUNTRIES = ["الإمارات العربية المتحدة", "البحرين", "قطر", "الكويت", "سلطنة عمان"];
export const ALL_LOCATIONS = LOCATION_GROUPS.flatMap((g) => g.cities);

function norm(value) {
  return String(value || "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
}

export function VillagePicker({ city, selected, onSelect }) {
  const [query, setQuery] = useState("");
  const q = norm(query);
  const places = useMemo(
    () => villagesFor(city).filter((name) => !q || norm(name).includes(q)),
    [city, q],
  );
  if (!city) {
    return <div style={{ textAlign: "center", color: "#8A7B66", padding: 24, fontWeight: 700 }}>اختر المدينة أولاً</div>;
  }
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, margin: "4px 8px 10px", padding: "8px 12px", borderRadius: 12, background: "#F7F1E8", border: "1px solid #E6DCC8" }}>
        <Search size={16} color="#8A6A2E" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن قرية…"
          data-testid="village-search"
          style={{ flex: 1, border: "none", background: "transparent", textAlign: "right", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0F241C" }}
        />
      </div>
      {!q ? (
        <button type="button" onClick={() => onSelect(null)} data-testid="village-item-clear" style={rowStyle(!selected)}>
          <MapPin size={16} color="#1B3D2F" />
          <span>بدون تحديد</span>
        </button>
      ) : null}
      {places.map((name) => (
        <button key={name} type="button" onClick={() => onSelect(name)} data-testid={`village-item-${name}`} style={rowStyle(selected === name)}>
          <MapPin size={16} color={selected === name ? "#1B3D2F" : "#8A7B66"} />
          <span>{name}</span>
        </button>
      ))}
      {places.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8A7B66", padding: 24, fontWeight: 700 }}>لا توجد قرى مطابقة لهذه المدينة</div>
      ) : null}
    </div>
  );
}

export function LocationPicker({ selected, onSelect, allowAll = false, exclude = [] }) {
  const [query, setQuery] = useState("");
  const excluded = useMemo(() => new Set(exclude), [exclude]);
  const q = norm(query);
  const groups = LOCATION_GROUPS.map((g) => ({
    ...g,
    cities: g.cities.filter((c) => !excluded.has(c) && (!q || norm(c).includes(q) || norm(g.label).includes(q))),
  })).filter((g) => g.cities.length);

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, margin: "4px 8px 10px", padding: "8px 12px", borderRadius: 12, background: "#F7F1E8", border: "1px solid #E6DCC8" }}>
        <Search size={16} color="#8A6A2E" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن مدينة…"
          data-testid="location-search"
          style={{ flex: 1, border: "none", background: "transparent", textAlign: "right", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0F241C" }}
        />
      </div>
      {allowAll && !q ? (
        <button type="button" onClick={() => onSelect(null)} data-testid="city-item-all" style={rowStyle(selected == null)}>
          <MapPin size={16} color="#1B3D2F" />
          <span>كل المدن</span>
        </button>
      ) : null}
      {groups.map((g) => (
        <div key={g.id}>
          <div style={{ padding: "10px 12px 4px", color: "#8A6A2E", fontSize: 12, fontWeight: 800, textAlign: "right" }}>{g.label}</div>
          {g.cities.map((c) => (
            <button key={c} type="button" onClick={() => onSelect(c)} data-testid={`city-item-${c}`} style={rowStyle(selected === c)}>
              <MapPin size={16} color={selected === c ? "#1B3D2F" : "#8A7B66"} />
              <span>{c}</span>
            </button>
          ))}
        </div>
      ))}
      {groups.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8A7B66", padding: 24, fontWeight: 700 }}>لا توجد مدن مطابقة</div>
      ) : null}
    </div>
  );
}

function rowStyle(active) {
  return {
    width: "100%",
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: "11px 12px",
    border: "none",
    borderRadius: 10,
    background: active ? "#F3EDE1" : "transparent",
    color: active ? "#1B3D2F" : "#334155",
    fontWeight: active ? 800 : 600,
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "right",
  };
}
