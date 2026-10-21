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


card = load("services/share_card.py")


def test_share_page_has_image_sentence_and_word_links():
    html = card.render_share_page(
        kind="store",
        item_id="seller1",
        title="متجر النخيل",
        lines=["الرياض", "طيور الزينة"],
        image="/media/store.jpg",
    )
    assert 'property="og:title" content="انظر لهذا المتجر، أعجبني"' in html
    assert 'property="og:image" content="https://saqr-ui-sync.emergent.host/media/store.jpg"' in html
    assert 'property="og:url" content="https://saqr-ui-sync.emergent.host/api/share/store/seller1"' in html
    assert 'href="saqr://store/seller1"' in html
    assert f'href="{card.APPLE_URL}">ايفون</a>' in html
    assert 'href="https://play.google.com/store/apps/details?id=com.saqr.rewards&amp;pcampaignid=web_share">اندرويد</a>' in html
    assert "com.saqr.rewards" in html
    assert "id6758868843" in html
    assert 'href="https://apps.apple.com"' not in html
    assert 'href="https://play.google.com"' not in html
    assert "متجر النخيل" in html
    assert "الرياض" in html


def test_missing_image_still_uses_the_app_logo():
    html = card.render_share_page(kind="app", item_id="download", title="طير — سوق الطيور والحيوانات")
    assert card.LOGO_URL in html
    assert "أعجبني هذا التطبيق" in html
    assert "اضغط" not in html or "ايفون" in html


def test_clients_use_the_same_hooks_and_store_links():
    expected = list(card.HOOKS.items())
    for path in (
        REPO / "mobile/src/services/shareContent.js",
        REPO / "frontend/src/tair/shareContent.js",
    ):
        text = path.read_text(encoding="utf-8")
        pairs = re.findall(r'(listing|store|trip|clinic|auction|story|app):\s*"([^"]+)"', text)
        assert pairs == expected
        assert "/api/share/" in text
        assert card.PLAY_URL in text
        assert card.APPLE_URL in text


def test_web_share_and_mobile_heroes_cover_the_leftovers():
    trips = (REPO / "frontend/src/tair/TripsScreen.jsx").read_text(encoding="utf-8")
    store = (REPO / "frontend/src/tair/SellerStorefrontScreen.jsx").read_text(encoding="utf-8")
    auction = (REPO / "frontend/src/tair/AuctionScreen.jsx").read_text(encoding="utf-8")
    assert 'kind: "trip"' in trips and "share-trip-" in trips
    assert 'kind: "store"' in store and "storefront-share" in store
    assert 'kind: "auction"' in auction and "auction-details-share" in auction
    profile = (REPO / "mobile/src/screens/ProfileScreen.js").read_text(encoding="utf-8")
    orders = (REPO / "mobile/src/screens/OrdersScreen.js").read_text(encoding="utf-8")
    assert "HeaderSheen" in profile and "goldRule" in profile
    assert "HeaderSheen" in orders and "goldRule" in orders
