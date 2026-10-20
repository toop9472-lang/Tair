"""طير — Species catalog: families + reference species list."""
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


# Family metadata (ordered for display; icon name references lucide-react)
FAMILIES: List[dict] = [
    {"family_id": "livestock",       "name_ar": "مواشي",                          "icon": "milk"},
    {"family_id": "songbirds",       "name_ar": "طيور مغردة",                     "icon": "music-2"},
    {"family_id": "poultry",         "name_ar": "دواجن",                          "icon": "drumstick"},
    {"family_id": "pigeons",         "name_ar": "حمام",                            "icon": "feather"},
    {"family_id": "parrots",         "name_ar": "ببغاوات",                         "icon": "bird"},
    {"family_id": "fish",            "name_ar": "أسماك",                           "icon": "fish"},
    {"family_id": "small_mammals",   "name_ar": "ثدييات صغيرة",                    "icon": "rabbit"},
    {"family_id": "pets",            "name_ar": "حيوانات أليفة",                   "icon": "heart"},
    {"family_id": "reptiles",        "name_ar": "زواحف",                           "icon": "shell"},
    {"family_id": "insects",         "name_ar": "حشرات",                           "icon": "bug"},
    {"family_id": "cats",            "name_ar": "قطط",                             "icon": "cat"},
    {"family_id": "dogs",            "name_ar": "كلاب",                            "icon": "dog"},
    {"family_id": "feed",            "name_ar": "أعلاف",                           "icon": "wheat"},
    {"family_id": "bird_supplies",   "name_ar": "مستلزمات الطيور",                  "icon": "package"},
    {"family_id": "animal_supplies", "name_ar": "مستلزمات الحيوانات",              "icon": "shopping-bag"},
    {"family_id": "reserves",        "name_ar": "المحميات",                        "icon": "trees"},
    {"family_id": "services",        "name_ar": "خدمات تركيب الأقفاص والمحميات",   "icon": "wrench"},
]


# Reference species catalog (grouped by family). Users can add free-text species too.
SEED_SPECIES: List[dict] = [
    # Livestock
    {"species_id": "sheep", "name_ar": "أغنام", "name_en": "Sheep", "category": "livestock", "family": "livestock",
     "common_breeds": ["نجدي", "حري", "نعيمي", "سواكني"]},
    {"species_id": "goat", "name_ar": "ماعز", "name_en": "Goat", "category": "livestock", "family": "livestock",
     "common_breeds": ["عارضي", "شامي", "بلدي"]},
    {"species_id": "camel", "name_ar": "إبل", "name_en": "Camel", "category": "livestock", "family": "livestock",
     "common_breeds": ["مجاهيم", "مغاتير", "شعل", "صفر"]},
    {"species_id": "cattle", "name_ar": "أبقار", "name_en": "Cattle", "category": "livestock", "family": "livestock"},

    # Songbirds
    {"species_id": "canary", "name_ar": "كناري", "name_en": "Canary", "category": "birds", "family": "songbirds",
     "common_breeds": ["Malinois", "Roller", "Fife", "Border"]},
    {"species_id": "goldfinch_european", "name_ar": "حسون أوروبي", "name_en": "European Goldfinch",
     "category": "birds", "family": "songbirds"},
    {"species_id": "finch_zebra", "name_ar": "حسون زيبرا", "name_en": "Zebra Finch", "category": "birds",
     "family": "songbirds"},
    {"species_id": "finch_gouldian", "name_ar": "حسون جولديان", "name_en": "Gouldian Finch",
     "category": "birds", "family": "songbirds"},
    {"species_id": "songbird_bulbul", "name_ar": "بلبل", "name_en": "Bulbul", "category": "birds", "family": "songbirds"},
    {"species_id": "songbird_mynah", "name_ar": "مينا", "name_en": "Mynah", "category": "birds", "family": "songbirds"},

    # Poultry
    {"species_id": "chicken", "name_ar": "دجاج", "name_en": "Chicken", "category": "birds", "family": "poultry",
     "common_breeds": ["Silkie", "Brahma", "Baladi", "بلدي", "براهما"]},
    {"species_id": "duck", "name_ar": "بط", "name_en": "Duck", "category": "birds", "family": "poultry"},
    {"species_id": "turkey", "name_ar": "ديك رومي", "name_en": "Turkey", "category": "birds", "family": "poultry"},
    {"species_id": "quail", "name_ar": "سمان", "name_en": "Quail", "category": "birds", "family": "poultry"},

    # Pigeons
    {"species_id": "pigeon", "name_ar": "حمام", "name_en": "Pigeon", "category": "birds", "family": "pigeons",
     "common_breeds": ["Fantail", "Homer", "Roller", "Jacobin", "كنج", "زاجل", "شقلباز"]},

    # Parrots
    {"species_id": "budgie", "name_ar": "بادجي", "name_en": "Budgerigar", "category": "birds", "family": "parrots"},
    {"species_id": "cockatiel", "name_ar": "كوكتيل", "name_en": "Cockatiel", "category": "birds", "family": "parrots",
     "common_breeds": ["Normal Grey", "Lutino", "Pied", "Pearl"]},
    {"species_id": "lovebird", "name_ar": "طيور الحب (روزيلا)", "name_en": "Lovebird", "category": "birds", "family": "parrots"},
    {"species_id": "parrot_african_grey", "name_ar": "الببغاء الرمادي الأفريقي", "name_en": "African Grey Parrot",
     "category": "birds", "family": "parrots", "requires_cites_permit": True},
    {"species_id": "parrot_macaw", "name_ar": "ببغاء المكاو", "name_en": "Macaw", "category": "birds",
     "family": "parrots", "requires_cites_permit": True},
    {"species_id": "parrot_amazon", "name_ar": "ببغاء الأمازون", "name_en": "Amazon Parrot", "category": "birds",
     "family": "parrots", "requires_cites_permit": True},
    {"species_id": "cockatoo", "name_ar": "كوكاتو", "name_en": "Cockatoo", "category": "birds", "family": "parrots",
     "requires_cites_permit": True},

    # Fish
    {"species_id": "aquarium_fish", "name_ar": "أسماك زينة", "name_en": "Aquarium Fish", "category": "fish", "family": "fish"},
    {"species_id": "guppy", "name_ar": "غابي", "name_en": "Guppy", "category": "fish", "family": "fish"},
    {"species_id": "arowana", "name_ar": "أروانا", "name_en": "Arowana", "category": "fish", "family": "fish"},

    # Small mammals
    {"species_id": "rabbit", "name_ar": "أرانب", "name_en": "Rabbit", "category": "mammals", "family": "small_mammals"},
    {"species_id": "hamster", "name_ar": "هامستر", "name_en": "Hamster", "category": "mammals", "family": "small_mammals"},
    {"species_id": "guinea_pig", "name_ar": "خنزير غينيا", "name_en": "Guinea Pig", "category": "mammals", "family": "small_mammals"},

    # Reptiles
    {"species_id": "turtle", "name_ar": "سلاحف", "name_en": "Turtle", "category": "reptiles", "family": "reptiles"},
    {"species_id": "lizard", "name_ar": "سحالي / إغوانا", "name_en": "Lizard / Iguana", "category": "reptiles", "family": "reptiles"},
    {"species_id": "gecko", "name_ar": "أبراص وسحالي منزلية", "name_en": "Gecko", "category": "reptiles", "family": "reptiles"},

    # Insects
    {"species_id": "bees", "name_ar": "نحل", "name_en": "Bees", "category": "insects", "family": "insects"},
    {"species_id": "ants", "name_ar": "نمل (مستعمرات)", "name_en": "Ants Colony", "category": "insects", "family": "insects"},

    # Cats
    {"species_id": "cat_persian", "name_ar": "قط شيرازي / فارسي", "name_en": "Persian Cat", "category": "mammals", "family": "cats"},
    {"species_id": "cat_scottish", "name_ar": "قط سكوتش فولد", "name_en": "Scottish Fold", "category": "mammals", "family": "cats"},
    {"species_id": "cat_british", "name_ar": "قط بريطاني", "name_en": "British Shorthair", "category": "mammals", "family": "cats"},
    {"species_id": "cat_maine_coon", "name_ar": "قط مين كون", "name_en": "Maine Coon", "category": "mammals", "family": "cats"},
    {"species_id": "cat_other", "name_ar": "قط (نوع آخر)", "name_en": "Cat (other)", "category": "mammals", "family": "cats"},

    # Dogs
    {"species_id": "dog_husky", "name_ar": "هاسكي", "name_en": "Husky", "category": "mammals", "family": "dogs"},
    {"species_id": "dog_german_shepherd", "name_ar": "جيرمان شيبرد", "name_en": "German Shepherd", "category": "mammals", "family": "dogs"},
    {"species_id": "dog_golden", "name_ar": "جولدن ريتريفر", "name_en": "Golden Retriever", "category": "mammals", "family": "dogs"},
    {"species_id": "dog_other", "name_ar": "كلب (نوع آخر)", "name_en": "Dog (other)", "category": "mammals", "family": "dogs"},

    # Pets (other exotic pets)
    {"species_id": "hedgehog", "name_ar": "قنفذ", "name_en": "Hedgehog", "category": "mammals", "family": "pets"},
    {"species_id": "ferret", "name_ar": "نمس (فرت)", "name_en": "Ferret", "category": "mammals", "family": "pets"},

    # Feed
    {"species_id": "feed_bird_seeds", "name_ar": "بذور طيور", "name_en": "Bird Seeds", "category": "supplies", "family": "feed"},
    {"species_id": "feed_dog", "name_ar": "طعام كلاب", "name_en": "Dog Food", "category": "supplies", "family": "feed"},
    {"species_id": "feed_cat", "name_ar": "طعام قطط", "name_en": "Cat Food", "category": "supplies", "family": "feed"},
    {"species_id": "feed_livestock", "name_ar": "أعلاف مواشي", "name_en": "Livestock Feed", "category": "supplies", "family": "feed"},

    # Bird supplies
    {"species_id": "cage_bird", "name_ar": "أقفاص طيور", "name_en": "Bird Cage", "category": "supplies", "family": "bird_supplies"},
    {"species_id": "nest_bird", "name_ar": "أعشاش وبيوت طيور", "name_en": "Bird Nest", "category": "supplies", "family": "bird_supplies"},
    {"species_id": "toys_bird", "name_ar": "ألعاب طيور", "name_en": "Bird Toys", "category": "supplies", "family": "bird_supplies"},

    # Animal supplies
    {"species_id": "aquarium", "name_ar": "أحواض أسماك", "name_en": "Aquarium", "category": "supplies", "family": "animal_supplies"},
    {"species_id": "leash", "name_ar": "أطواق وقلائد", "name_en": "Leash & Collar", "category": "supplies", "family": "animal_supplies"},
    {"species_id": "pet_bed", "name_ar": "أسرّة وبيوت حيوانات", "name_en": "Pet Bed", "category": "supplies", "family": "animal_supplies"},

    # Reserves
    {"species_id": "reserve_land", "name_ar": "أرض/محمية للبيع أو الإيجار", "name_en": "Reserve Land", "category": "services", "family": "reserves"},

    # Services
    {"species_id": "svc_cage_install", "name_ar": "خدمة تركيب أقفاص", "name_en": "Cage Installation Service", "category": "services", "family": "services"},
    {"species_id": "svc_reserve_setup", "name_ar": "خدمة تجهيز محميات", "name_en": "Reserve Setup Service", "category": "services", "family": "services"},

    # Prohibited (example)
    {"species_id": "wild_falcon", "name_ar": "صقور برية غير مرخصة", "name_en": "Unlicensed Wild Falcon",
     "category": "birds", "family": "pets", "is_prohibited": True},
]
