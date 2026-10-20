import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(rel):
    path = ROOT / rel
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


names = load("services/display_names.py")
species = load("models/species.py")


def test_placeholder_and_clean_name():
    assert names.is_placeholder_name("ضيف طير")
    assert names.is_placeholder_name("صديق صقر ١٢")
    assert names.clean_display_name("  أبو   فهد ") == "أبو فهد"
    try:
        names.clean_display_name("ضيف")
        raise AssertionError("placeholder should fail")
    except ValueError as exc:
        assert "ضيف" in str(exc)


def test_family_match_includes_arabic_and_species():
    aliases, species_ids = species.family_match("parrots")
    assert "parrots" in aliases
    assert "ببغاوات" in aliases
    assert species_ids
