import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent


def load(rel):
    path = ROOT / rel
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


stickers = load("services/tair_stickers.py")


def _catalog(path):
    text = path.read_text(encoding="utf-8")
    pairs = re.findall(r'id:\s*"([a-z0-9_]+)"\s*,\s*label:\s*"([^"]+)"', text)
    return pairs


_URL_RE = re.compile(r"(https?://|www\.|[a-z0-9]+\.[a-z]{2,}/)", re.IGNORECASE)
_PHONE_RE = re.compile(r"(\+?\d[\d\s\-\.]{6,}\d)")


def test_preview_replaces_known_tokens_only():
    assert stickers.sticker_preview("[[tair:hello]]") == "ملصق: سلام"
    assert stickers.sticker_preview("أنت: [[tair:deal]]") == "أنت: ملصق: صفقة"
    assert stickers.sticker_preview("[[tair:unknown]]") == "[[tair:unknown]]"
    assert stickers.sticker_preview("") == ""
    assert stickers.sticker_preview(None) == ""
    assert "http" not in stickers.sticker_preview("[[tair:fly]]")
    assert not any(ch.isdigit() for ch in "[[tair:care]]")
    for sid in stickers.STICKERS:
        token = f"[[tair:{sid}]]"
        assert _URL_RE.search(token) is None
        assert _PHONE_RE.search(token) is None


def test_clients_share_the_server_catalog():
    mobile = _catalog(REPO / "mobile/src/components/TairStickers.js")
    web = _catalog(REPO / "frontend/src/tair/TairStickers.jsx")
    expected = list(stickers.STICKERS.items())
    assert mobile == expected
    assert web == expected
    assert len(expected) == 12
