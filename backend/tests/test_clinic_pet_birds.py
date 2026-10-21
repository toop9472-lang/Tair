import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(rel):
    path = ROOT / rel
    spec = importlib.util.spec_from_file_location("clinic_bot_pet", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


bot = load("services/clinic_bot.py")


def ids(text):
    bot._KB = None
    return [entry.get("entry_id") for _, entry in bot.match_entries(text)]


def test_scream_pluck_and_egg_binding_match_cage_birds():
    assert ids("كاسكو يصرخ طول اليوم وازعاج وما يسكت")[0] == "pet_scream"
    assert "feather" in ids("ببغاء ينتف ريشه وصدره صار عاري")
    assert "pet_hardlay" in ids("أنثى كوكاتيل بيضة عالقة وتضغط وما تقدر تبيض") or "egg" in ids("أنثى كوكاتيل بيضة عالقة وتضغط وما تقدر تبيض")


def test_new_cards_do_not_carry_doses():
    kb = bot.load_kb()
    banned = ("بيئة استنبات", "عزل الفيروس", "حقن البيض")
    for entry in kb["entries"]:
        if not str(entry.get("entry_id", "")).startswith("pet_"):
            continue
        blob = " ".join(str(entry.get(k) or "") for k in ("definition", "treatment", "diagnosis_line", "summary"))
        for word in banned:
            assert word not in blob, entry["entry_id"]
        assert "لا مليغرام" in (entry.get("treatment") or "")
