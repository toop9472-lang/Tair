"""طير — كتالوج الأنواع: فئات رئيسية وأسماء السوق الخليجية."""
from typing import List, Optional

from pydantic import BaseModel


class Species(BaseModel):
    species_id: str
    name_ar: str
    name_en: str
    category: str = "birds"
    family: str = "other"
    is_prohibited: bool = False
    requires_cites_permit: bool = False
    requires_health_cert: bool = False
    common_breeds: List[str] = []
    icon: Optional[str] = None


# ترتيب العرض. group يجمع الرفوف في السوق وصفحة النشر.
# category هي خانة الإعلان العريضة (birds / mammals / supplies / services ...).
FAMILIES: List[dict] = [
    # طيور
    {"family_id": "parrots", "name_ar": "ببغاوات", "icon": "bird", "group": "birds", "group_ar": "طيور", "category": "birds"},
    {"family_id": "songbirds", "name_ar": "طيور صغيرة", "icon": "music-2", "group": "birds", "group_ar": "طيور", "category": "birds"},
    {"family_id": "pigeons", "name_ar": "حمام", "icon": "feather", "group": "birds", "group_ar": "طيور", "category": "birds"},
    {"family_id": "poultry", "name_ar": "دواجن", "icon": "drumstick", "group": "birds", "group_ar": "طيور", "category": "birds"},
    {"family_id": "falcons", "name_ar": "صقور", "icon": "zap", "group": "birds", "group_ar": "طيور", "category": "birds"},
    # حيوانات
    {"family_id": "livestock", "name_ar": "مواشي", "icon": "milk", "group": "animals", "group_ar": "حيوانات", "category": "livestock"},
    {"family_id": "horses", "name_ar": "خيل", "icon": "footprints", "group": "animals", "group_ar": "حيوانات", "category": "livestock"},
    {"family_id": "cats", "name_ar": "قطط", "icon": "cat", "group": "animals", "group_ar": "حيوانات", "category": "mammals"},
    {"family_id": "dogs", "name_ar": "كلاب", "icon": "dog", "group": "animals", "group_ar": "حيوانات", "category": "mammals"},
    {"family_id": "small_mammals", "name_ar": "حيوانات صغيرة", "icon": "rabbit", "group": "animals", "group_ar": "حيوانات", "category": "mammals"},
    {"family_id": "pets", "name_ar": "أليفة أخرى", "icon": "heart", "group": "animals", "group_ar": "حيوانات", "category": "mammals"},
    {"family_id": "reptiles", "name_ar": "زواحف", "icon": "shell", "group": "animals", "group_ar": "حيوانات", "category": "reptiles"},
    {"family_id": "fish", "name_ar": "أسماك", "icon": "fish", "group": "animals", "group_ar": "حيوانات", "category": "fish"},
    {"family_id": "insects", "name_ar": "نحل وحشرات", "icon": "bug", "group": "animals", "group_ar": "حيوانات", "category": "insects"},
    # عناية وخدمات
    {"family_id": "feed", "name_ar": "أعلاف وأكل", "icon": "wheat", "group": "care", "group_ar": "عناية وخدمات", "category": "supplies"},
    {"family_id": "bird_supplies", "name_ar": "مستلزمات الطيور", "icon": "package", "group": "care", "group_ar": "عناية وخدمات", "category": "supplies"},
    {"family_id": "animal_supplies", "name_ar": "مستلزمات الحيوانات", "icon": "shopping-bag", "group": "care", "group_ar": "عناية وخدمات", "category": "supplies"},
    {"family_id": "hotel_services", "name_ar": "فندقة الطيور", "icon": "bed", "group": "care", "group_ar": "عناية وخدمات", "category": "services"},
    {"family_id": "training", "name_ar": "تدريب", "icon": "graduation-cap", "group": "care", "group_ar": "عناية وخدمات", "category": "services"},
    {"family_id": "services", "name_ar": "تركيب وتجهيز", "icon": "wrench", "group": "care", "group_ar": "عناية وخدمات", "category": "services"},
    {"family_id": "reserves", "name_ar": "محميات", "icon": "trees", "group": "care", "group_ar": "عناية وخدمات", "category": "services"},
]

CATEGORY_BY_FAMILY = {f["family_id"]: f["category"] for f in FAMILIES}

# معرفات قديمة كانت تظهر في النشر فقط وما لها رف في السوق.
FAMILY_QUERY_ALIASES = {
    "bird_supplies": ["supplies"],
    "feed": ["food"],
}


def listing_category(family_id: Optional[str]) -> Optional[str]:
    if not family_id:
        return None
    return CATEGORY_BY_FAMILY.get(family_id)


def _sp(
    species_id: str,
    name_ar: str,
    name_en: str,
    family: str,
    breeds: Optional[List[str]] = None,
    prohibited: bool = False,
    cites: bool = False,
    health: bool = False,
) -> dict:
    return {
        "species_id": species_id,
        "name_ar": name_ar,
        "name_en": name_en,
        "category": CATEGORY_BY_FAMILY[family],
        "family": family,
        "is_prohibited": prohibited,
        "requires_cites_permit": cites,
        "requires_health_cert": health,
        "common_breeds": breeds or [],
    }


# الأنواع التي يبحث عنها المربي بالاسم الدارج. السلالات خيارات داخل النوع.
SEED_SPECIES: List[dict] = [
    # ببغاوات
    _sp("budgie", "بادجي", "Budgerigar", "parrots", ["أخضر", "أزرق", "أصفر", "أبيض", "لوتينو", "ألبينو", "رمادي", "سبونج"]),
    _sp("cockatiel", "كوكتيل", "Cockatiel", "parrots", ["رمادي", "لوتينو", "بيرل", "أبيض الوجه", "رصاصي"]),
    _sp("lovebird", "روز", "Lovebird", "parrots", ["فيشر", "خوخي", "ماسك", "أزرق", "أخضر"]),
    _sp("parrot_ringneck", "درة", "Ringneck", "parrots", ["خضراء", "زرقاء", "لاتينو", "ألبينو", "بنفسجية"]),
    _sp("parrot_alexandrine", "درة إسكندر", "Alexandrine", "parrots", ["خضراء", "زرقاء"]),
    _sp("parrot_african_grey", "كاسكو", "African Grey", "parrots", ["كنغولي", "تيمنيه"], cites=True),
    _sp("parrot_macaw", "مكاو", "Macaw", "parrots", ["أزرق وأصفر", "سكارلت", "أخضر الجناح"], cites=True),
    _sp("parrot_amazon", "أمازون", "Amazon", "parrots", ["أزرق الجبهة", "أصفر التاج"], cites=True),
    _sp("cockatoo", "كوكاتو", "Cockatoo", "parrots", ["أمبريلا", "مولكان", "جوفين"], cites=True),
    _sp("parrot_senegal", "سنغال", "Senegal", "parrots"),
    _sp("parrot_caique", "كاييك", "Caique", "parrots", ["أبيض البطن", "أسود الرأس"]),
    _sp("parrot_conure", "كونور", "Conure", "parrots", ["صن", "جرين تشيك", "نانداي"]),
    _sp("parrot_monk", "مونك (كويكر)", "Monk", "parrots"),
    _sp("parrot_lory", "لوري", "Lory", "parrots"),
    _sp("parrot_lorikeet", "لوريكيت", "Lorikeet", "parrots"),
    _sp("parrot_rosella", "روزيلا", "Rosella", "parrots"),
    _sp("parrot_eclectus", "إكليكتوس", "Eclectus", "parrots", cites=True),
    _sp("parrotlet", "باروتلت", "Parrotlet", "parrots"),
    _sp("parrot_pionus", "بيونوس", "Pionus", "parrots"),
    _sp("parrot_other", "ببغاء آخر", "Other parrot", "parrots"),

    # طيور صغيرة
    _sp("canary", "كناري", "Canary", "songbirds", ["مالينوا", "رولر", "جلوسر", "فيفا", "بوردر", "يوركشاير", "أحمر", "أصفر"]),
    _sp("goldfinch_european", "حسون", "Goldfinch", "songbirds", ["بلدي", "أوروبي", "أمريكي"]),
    _sp("finch_zebra", "زيبرا", "Zebra Finch", "songbirds"),
    _sp("finch_gouldian", "جولديان", "Gouldian", "songbirds"),
    _sp("finch_society", "سوساتي", "Society Finch", "songbirds"),
    _sp("finch_java", "جاوا", "Java Sparrow", "songbirds"),
    _sp("songbird_bulbul", "بلبل", "Bulbul", "songbirds", ["أحمر العجز", "أبيض الخد"]),
    _sp("songbird_mynah", "مينا", "Mynah", "songbirds", ["هندي", "بالي"]),
    _sp("dove_diamond", "يمام", "Diamond Dove", "songbirds"),
    _sp("songbird_starling", "زرزور", "Starling", "songbirds"),
    _sp("songbird_nightingale", "عندليب", "Nightingale", "songbirds"),
    _sp("songbird_other", "طير صغير آخر", "Other small bird", "songbirds"),

    # حمام
    _sp("pigeon", "حمام", "Pigeon", "pigeons", ["أبلق", "كشك", "باكستاني"]),
    _sp("pigeon_homer", "زاجل", "Homing Pigeon", "pigeons"),
    _sp("pigeon_king", "كنج", "King Pigeon", "pigeons"),
    _sp("pigeon_tumbler", "شقلباز", "Tumbler", "pigeons"),
    _sp("pigeon_fancy", "حمام زينة", "Fancy Pigeon", "pigeons", ["هلالي", "مروحي", "جاكوبين"]),

    # دواجن
    _sp("chicken", "دجاج", "Chicken", "poultry", ["بلدي", "براهما", "سيلكي", "أسترالورب", "فيومي"]),
    _sp("broiler", "فروج", "Broiler", "poultry"),
    _sp("duck", "بط", "Duck", "poultry", ["بلدي", "بكين", "مسكوفي"]),
    _sp("turkey", "ديك رومي", "Turkey", "poultry"),
    _sp("quail", "سمان", "Quail", "poultry"),
    _sp("goose", "إوز", "Goose", "poultry"),
    _sp("guinea_fowl", "دجاج حبشي", "Guinea Fowl", "poultry"),
    _sp("pheasant", "تدرج", "Pheasant", "poultry"),

    # صقور — الرف للطيور المرخّصة. البرّي غير المرخّص يُعلَّم ويمنع.
    _sp("falcon_hurr", "حر", "Saker", "falcons", cites=True, health=True),
    _sp("falcon_shaheen", "شاهين", "Shaheen", "falcons", cites=True, health=True),
    _sp("falcon_wakri", "وكري", "Lanner", "falcons", health=True),
    _sp("falcon_gyr", "جير", "Gyr", "falcons", cites=True, health=True),
    _sp("falcon_hybrid", "هجين صقور", "Falcon hybrid", "falcons", health=True),
    _sp("wild_falcon", "صقر برّي غير مرخّص", "Unlicensed wild falcon", "falcons", prohibited=True),

    # مواشي وخيل
    _sp("sheep", "غنم", "Sheep", "livestock", ["نجدي", "حري", "نعيمي", "سواكني"]),
    _sp("goat", "ماعز", "Goat", "livestock", ["عارضي", "شامي", "بلدي", "حجازي"]),
    _sp("camel", "إبل", "Camel", "livestock", ["مجاهيم", "مغاتير", "شعل", "صفر", "وضح"]),
    _sp("cattle", "بقر", "Cattle", "livestock", ["بلدي", "هولشتاين", "جيرسي"]),
    _sp("horse_arabian", "خيل عربي", "Arabian Horse", "horses", ["وضح", "كحيلة", "صقلاوية", "عبية", "دهمة"]),
    _sp("horse_other", "خيل أخرى", "Other horse", "horses"),

    # قطط وكلاب
    _sp("cat_persian", "قط شيرازي", "Persian", "cats"),
    _sp("cat_scottish", "سكوتش فولد", "Scottish Fold", "cats"),
    _sp("cat_british", "بريتش", "British Shorthair", "cats"),
    _sp("cat_maine_coon", "مين كون", "Maine Coon", "cats"),
    _sp("cat_siamese", "سيامي", "Siamese", "cats"),
    _sp("cat_ragdoll", "راقدول", "Ragdoll", "cats"),
    _sp("cat_bengal", "بنغال", "Bengal", "cats"),
    _sp("cat_other", "قط بلدي", "Domestic cat", "cats"),
    _sp("dog_husky", "هاسكي", "Husky", "dogs"),
    _sp("dog_german_shepherd", "جيرمن", "German Shepherd", "dogs"),
    _sp("dog_golden", "جولدن", "Golden Retriever", "dogs"),
    _sp("dog_labrador", "لابرادور", "Labrador", "dogs"),
    _sp("dog_maltese", "مالتيز", "Maltese", "dogs"),
    _sp("dog_poodle", "بودل", "Poodle", "dogs"),
    _sp("dog_other", "كلب آخر", "Other dog", "dogs"),

    # حيوانات صغيرة وأليفة
    _sp("rabbit", "أرانب", "Rabbit", "small_mammals", ["هولندي", "أنقرة", "بلدي"]),
    _sp("hamster", "هامستر", "Hamster", "small_mammals"),
    _sp("guinea_pig", "غيني بيغ", "Guinea Pig", "small_mammals"),
    _sp("chinchilla", "شنشيلا", "Chinchilla", "small_mammals"),
    _sp("sugar_glider", "شوقر قلايدر", "Sugar Glider", "small_mammals"),
    _sp("hedgehog", "قنفذ", "Hedgehog", "pets"),
    _sp("ferret", "فرت", "Ferret", "pets"),

    # زواحف وأسماك ونحل
    _sp("turtle", "سلاحف", "Turtle", "reptiles"),
    _sp("lizard", "إغوانا", "Iguana", "reptiles"),
    _sp("gecko", "أبو بريص", "Gecko", "reptiles"),
    _sp("aquarium_fish", "أسماك زينة", "Aquarium fish", "fish"),
    _sp("guppy", "غوبي", "Guppy", "fish"),
    _sp("goldfish", "سمك ذهبي", "Goldfish", "fish"),
    _sp("betta", "فايتر", "Betta", "fish"),
    _sp("arowana", "أروانا", "Arowana", "fish"),
    _sp("koi", "كوي", "Koi", "fish"),
    _sp("cichlid", "سيكليد", "Cichlid", "fish"),
    _sp("bees", "نحل", "Bees", "insects"),
    _sp("ants", "نمل", "Ants", "insects"),

    # أكل ومستلزمات
    _sp("feed_bird_seeds", "حب طيور", "Bird seed", "feed"),
    _sp("feed_parrot", "أكل ببغاوات", "Parrot mix", "feed"),
    _sp("feed_egg_food", "عجينة بيض", "Egg food", "feed"),
    _sp("feed_dog", "أكل كلاب", "Dog food", "feed"),
    _sp("feed_cat", "أكل قطط", "Cat food", "feed"),
    _sp("feed_livestock", "أعلاف مواشي", "Livestock feed", "feed"),
    _sp("cage_bird", "أقفاص", "Cage", "bird_supplies"),
    _sp("nest_bird", "أعشاش", "Nest box", "bird_supplies"),
    _sp("perch", "مجاثم", "Perch", "bird_supplies"),
    _sp("toys_bird", "ألعاب طيور", "Bird toys", "bird_supplies"),
    _sp("incubator", "فقاسة", "Incubator", "bird_supplies"),
    _sp("aquarium", "أحواض سمك", "Aquarium", "animal_supplies"),
    _sp("leash", "أطواق", "Collar", "animal_supplies"),
    _sp("pet_bed", "بيوت وفرش", "Pet bed", "animal_supplies"),

    # فندقة وتدريب وتجهيز
    _sp("hotel_daily", "إيواء يومي", "Daily boarding", "hotel_services"),
    _sp("hotel_monthly", "إيواء شهري", "Monthly boarding", "hotel_services"),
    _sp("hotel_isolation", "عزل صحي", "Quarantine boarding", "hotel_services"),
    _sp("hotel_travel", "فندقة وقت السفر", "Travel boarding", "hotel_services"),
    _sp("train_falcon", "تدريب صقور", "Falcon training", "training"),
    _sp("train_birds", "ترويض طيور", "Bird taming", "training"),
    _sp("train_dogs", "تدريب كلاب", "Dog training", "training"),
    _sp("svc_cage_install", "تركيب أقفاص", "Cage installation", "services"),
    _sp("svc_aviary", "تفصيل فوليير", "Aviary build", "services"),
    _sp("svc_reserve_setup", "تجهيز محمية", "Reserve setup", "services"),
    _sp("reserve_land", "محمية للبيع أو الإيجار", "Reserve land", "reserves"),
]


def family_match(family: str):
    """أسماء العائلة ومعرّفات الأنواع التي يجب أن يطابقها فلتر السوق."""
    aliases = [family, *FAMILY_QUERY_ALIASES.get(family, [])]
    arabic = next((f["name_ar"] for f in FAMILIES if f["family_id"] == family), None)
    if arabic and arabic not in aliases:
        aliases.append(arabic)
    species_ids = [s["species_id"] for s in SEED_SPECIES if s.get("family") == family]
    return aliases, species_ids
