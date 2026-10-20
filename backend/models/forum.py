"""طير — Forum / Community discussions model."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


ForumCategory = Literal[
    "general",
    "tips",
    "experience",
    "health",
    "food",
    "breeding",
    "questions",
    "market",
    "import",
    # Animals section (قسم الحيوانات)
    "animals_cats_dogs",
    "animals_reptiles_rodents",
    "animals_exotic",
    # Fish section (قسم الأسماك)
    "fish_water",
    "fish_aquarium",
    "fish_breeding",
    # Insects section (قسم الحشرات)
    "insects_ornamental",
    "insects_bees",
    "insects_food",
    "insects_projects",
    # Outdoor breeding section (قسم التربية الخارجية والتكاثر)
    "outdoor_breeding",
    "outdoor_solutions",
]


class ForumPost(BaseModel):
    post_id: str
    author_id: str
    author_name: Optional[str] = None
    title: str
    body: str
    category: ForumCategory = "general"
    tags: List[str] = []
    images: List[str] = []

    likes_count: int = 0
    liked_by: List[str] = []
    replies_count: int = 0
    views_count: int = 0

    is_pinned: bool = False
    is_locked: bool = False
    is_flagged: bool = False

    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class ForumReply(BaseModel):
    reply_id: str
    post_id: str
    author_id: str
    author_name: Optional[str] = None
    body: str
    likes_count: int = 0
    liked_by: List[str] = []
    created_at: datetime = Field(default_factory=_now)


class ForumPostCreate(BaseModel):
    title: str
    body: str
    category: ForumCategory = "general"
    tags: List[str] = []
    images: List[str] = []
    author_name: Optional[str] = None


class ForumReplyCreate(BaseModel):
    body: str
    author_name: Optional[str] = None


FORUM_CATEGORIES: List[dict] = [
    {"id": "general",    "name_ar": "عام",                     "desc_ar": "نقاشات عامة حول تربية الطيور وعالمها",                                              "icon": "message-square", "color": "#0f766e"},
    {"id": "tips",       "name_ar": "نصائح وخبرات",             "desc_ar": "شارك نصائحك وخبراتك مع مربّي الطيور",                                              "icon": "lightbulb",      "color": "#f97316"},
    {"id": "experience", "name_ar": "تجربتي",                  "desc_ar": "قصص وتجارب شخصية مع الطيور",                                                       "icon": "star",           "color": "#facc15"},
    {"id": "health",     "name_ar": "صحة الطيور",              "desc_ar": "أمراض الطيور، الوقاية، والعلاج",                                                    "icon": "heart-pulse",    "color": "#dc2626"},
    {"id": "food",       "name_ar": "التغذية",                 "desc_ar": "أنواع الأعلاف والتغذية السليمة",                                                    "icon": "wheat",          "color": "#65a30d"},
    {"id": "breeding",   "name_ar": "التزاوج والتفريخ",         "desc_ar": "كل ما يتعلق بتفريخ الطيور والعناية بالفراخ",                                       "icon": "egg",            "color": "#eab308"},
    {"id": "questions",  "name_ar": "أسئلة",                   "desc_ar": "اطرح سؤالك واحصل على إجابة من المجتمع",                                             "icon": "help-circle",    "color": "#6366f1"},
    {"id": "market",     "name_ar": "سوق ونقاشات",             "desc_ar": "نقاشات السوق والأسعار والصفقات",                                                    "icon": "shopping-bag",   "color": "#ec4899"},
    {"id": "import",     "name_ar": "مشاكل واستفسارات الاستيراد", "desc_ar": "استفسارات وحلول مشاكل استيراد الطيور والمستلزمات من الخارج",                    "icon": "package",        "color": "#8b5cf6"},

    # ============ قسم الحيوانات ============
    {"id": "animals_cats_dogs",        "name_ar": "القطط والكلاب",         "desc_ar": "تربية القطط والكلاب، أنواعها، وكل ما يتعلق بها",              "icon": "paw",         "color": "#f59e0b"},
    {"id": "animals_reptiles_rodents", "name_ar": "الزواحف والقوارض",       "desc_ar": "السلاحف والسحالي والأرانب والهامستر وغيرها",                  "icon": "worm",        "color": "#84cc16"},
    {"id": "animals_exotic",           "name_ar": "الحيوانات غير التقليدية", "desc_ar": "حيوانات نادرة وغريبة، القرود، الثعالب، الميركات وغيرها",     "icon": "sparkles",    "color": "#a855f7"},

    # ============ قسم الأسماك ============
    {"id": "fish_water",     "name_ar": "أسماك المياه العذبة والمالحة", "desc_ar": "أنواع الأسماك وأحواض المياه العذبة والمالحة",              "icon": "fish",       "color": "#0ea5e9"},
    {"id": "fish_aquarium",  "name_ar": "تجهيز الأحواض",              "desc_ar": "تجهيز أحواض السمك، الفلاتر، الإضاءة، الديكور",              "icon": "droplet",    "color": "#06b6d4"},
    {"id": "fish_breeding",  "name_ar": "التكاثر والإنتاج",           "desc_ar": "تكاثر وإنتاج الأسماك والزرع المائي",                        "icon": "egg",        "color": "#22d3ee"},

    # ============ قسم الحشرات ============
    {"id": "insects_ornamental", "name_ar": "حشرات الزينة",       "desc_ar": "الفراشات والخنافس وحشرات الزينة",                              "icon": "bug",         "color": "#10b981"},
    {"id": "insects_bees",       "name_ar": "النحل وتربيته",      "desc_ar": "تربية النحل، إنتاج العسل، تجهيز الخلايا",                       "icon": "hexagon",     "color": "#eab308"},
    {"id": "insects_food",       "name_ar": "الحشرات كغذاء حي",   "desc_ar": "تربية الصراصير والديدان والحشرات لتغذية الطيور والزواحف",       "icon": "drumstick",   "color": "#c2410c"},
    {"id": "insects_projects",   "name_ar": "مشاريع التربية",     "desc_ar": "مشاريع تربية الحشرات التجارية وأفكار الأعمال",                  "icon": "briefcase",   "color": "#7c3aed"},

    # ============ قسم التربية الخارجية والتكاثر ============
    {"id": "outdoor_breeding",  "name_ar": "التربية في الأماكن المفتوحة", "desc_ar": "تربية الطيور والحيوانات في المزارع والأماكن المفتوحة", "icon": "trees",       "color": "#16a34a"},
    {"id": "outdoor_solutions", "name_ar": "التكاثر وحلول المشاكل",       "desc_ar": "مشاكل التكاثر وحلولها للتربية الخارجية",                "icon": "wrench",      "color": "#0f766e"},
]
