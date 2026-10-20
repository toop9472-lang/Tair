/** رفوف السوق — نفس معرفات الخادم، مع أيقونة وأقسام للعرض دون اتصال. */

export const GROUP_ORDER = ["birds", "animals", "care"];

export const GROUP_LABEL = {
  birds: "طيور",
  animals: "حيوانات",
  care: "عناية وخدمات",
};

export const FAMILY_ICONS = {
  parrots: "flower-outline",
  songbirds: "musical-notes-outline",
  pigeons: "paper-plane-outline",
  poultry: "egg-outline",
  falcons: "eye-outline",
  livestock: "paw-outline",
  horses: "walk-outline",
  cats: "paw",
  dogs: "paw-outline",
  small_mammals: "bonfire-outline",
  pets: "heart-outline",
  reptiles: "bug-outline",
  fish: "fish-outline",
  insects: "prism-outline",
  feed: "leaf-outline",
  bird_supplies: "basket-outline",
  animal_supplies: "cube-outline",
  hotel_services: "bed-outline",
  training: "school-outline",
  services: "construct-outline",
  reserves: "earth-outline",
};

export const FALLBACK_FAMILIES = [
  { family_id: "parrots", name_ar: "ببغاوات", group: "birds" },
  { family_id: "songbirds", name_ar: "طيور صغيرة", group: "birds" },
  { family_id: "pigeons", name_ar: "حمام", group: "birds" },
  { family_id: "poultry", name_ar: "دواجن", group: "birds" },
  { family_id: "falcons", name_ar: "صقور", group: "birds" },
  { family_id: "livestock", name_ar: "مواشي", group: "animals" },
  { family_id: "horses", name_ar: "خيل", group: "animals" },
  { family_id: "cats", name_ar: "قطط", group: "animals" },
  { family_id: "dogs", name_ar: "كلاب", group: "animals" },
  { family_id: "small_mammals", name_ar: "حيوانات صغيرة", group: "animals" },
  { family_id: "pets", name_ar: "أليفة أخرى", group: "animals" },
  { family_id: "reptiles", name_ar: "زواحف", group: "animals" },
  { family_id: "fish", name_ar: "أسماك", group: "animals" },
  { family_id: "insects", name_ar: "نحل وحشرات", group: "animals" },
  { family_id: "feed", name_ar: "أعلاف وأكل", group: "care" },
  { family_id: "bird_supplies", name_ar: "مستلزمات الطيور", group: "care" },
  { family_id: "animal_supplies", name_ar: "مستلزمات الحيوانات", group: "care" },
  { family_id: "hotel_services", name_ar: "فندقة الطيور", group: "care" },
  { family_id: "training", name_ar: "تدريب", group: "care" },
  { family_id: "services", name_ar: "تركيب وتجهيز", group: "care" },
  { family_id: "reserves", name_ar: "محميات", group: "care" },
];

const GROUP_BY_ID = Object.fromEntries(FALLBACK_FAMILIES.map((f) => [f.family_id, f.group]));

export function familyIcon(id) {
  return FAMILY_ICONS[id] || "grid-outline";
}

export function decorateFamilies(items) {
  const source = items?.length ? items : FALLBACK_FAMILIES;
  return source.map((f) => {
    const group = f.group || GROUP_BY_ID[f.family_id] || "care";
    return {
      ...f,
      group,
      group_ar: f.group_ar || GROUP_LABEL[group] || GROUP_LABEL.care,
    };
  });
}

const SERVICE_FAMILIES = new Set(["hotel_services", "training", "services", "reserves"]);
const SUPPLY_FAMILIES = new Set(["feed", "bird_supplies", "animal_supplies"]);
const LIVESTOCK_FAMILIES = new Set(["livestock", "horses"]);
const MAMMAL_FAMILIES = new Set(["cats", "dogs", "small_mammals", "pets"]);

export function categoryForFamily(id) {
  if (SERVICE_FAMILIES.has(id)) return "services";
  if (SUPPLY_FAMILIES.has(id)) return "supplies";
  if (LIVESTOCK_FAMILIES.has(id)) return "livestock";
  if (MAMMAL_FAMILIES.has(id)) return "mammals";
  if (id === "fish") return "fish";
  if (id === "reptiles") return "reptiles";
  if (id === "insects") return "insects";
  return "birds";
}

export function groupFamilies(items) {
  const decorated = decorateFamilies(items);
  return GROUP_ORDER.map((id) => ({
    id,
    label: decorated.find((f) => f.group === id)?.group_ar || GROUP_LABEL[id],
    items: decorated.filter((f) => f.group === id),
  })).filter((g) => g.items.length);
}
