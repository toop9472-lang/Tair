import json
from pathlib import Path

APP = json.loads((Path(__file__).resolve().parents[2] / "mobile" / "app.json").read_text(encoding="utf-8"))


def test_store_build_declares_lock_screen_notifications():
    expo = APP["expo"]
    names = [item if isinstance(item, str) else item[0] for item in expo["plugins"]]
    assert "expo-notifications" in names
    plugin = next(item for item in expo["plugins"] if isinstance(item, list) and item[0] == "expo-notifications")
    assert plugin[1]["defaultChannel"] == "default"
    assert "POST_NOTIFICATIONS" in expo["android"]["permissions"]
    assert expo["android"]["versionCode"] >= 217
    assert int(expo["ios"]["buildNumber"]) >= 217
