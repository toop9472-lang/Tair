#!/usr/bin/env python3
"""Generate App Store screenshots for طير — iPhone 6.5" and iPad 12.9"."""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

BASE_URL = "https://saqr-ui-sync.preview.emergentagent.com/tair"

# Screens to capture: (label, action_script)
SCREENS = [
    ("01_home", None),  # Landing/Market
    ("02_forum", "forum"),
    ("03_forum_scroll", "forum_scroll"),
    ("04_trips", "trips"),
    ("05_messages", "messages"),
    ("06_profile", "profile"),
]


async def capture(page, label):
    await page.wait_for_timeout(1500)
    return


async def navigate(page, target):
    if target is None:
        return
    if target == "forum":
        await page.evaluate("window.scrollTo(0, 0)")
        for sel in ["text=المنتدى"]:
            try:
                await page.click(sel, timeout=3000)
                break
            except Exception:
                pass
        await page.wait_for_timeout(2500)
    elif target == "forum_scroll":
        await page.evaluate("window.scrollTo({top: 900, behavior: 'instant'})")
        await page.wait_for_timeout(800)
    elif target == "trips":
        await page.evaluate("window.scrollTo(0, 0)")
        for sel in ["text=الرحلات"]:
            try:
                await page.click(sel, timeout=3000)
                break
            except Exception:
                pass
        await page.wait_for_timeout(1800)
    elif target == "messages":
        await page.evaluate("window.scrollTo(0, 0)")
        for sel in ["text=الرسائل"]:
            try:
                await page.click(sel, timeout=3000)
                break
            except Exception:
                pass
        await page.wait_for_timeout(1500)
    elif target == "profile":
        await page.evaluate("window.scrollTo(0, 0)")
        for sel in ["text=حسابي"]:
            try:
                await page.click(sel, timeout=3000)
                break
            except Exception:
                pass
        await page.wait_for_timeout(1800)


async def make_screenshots(device_label, viewport, device_scale, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport=viewport,
            device_scale_factor=device_scale,
            locale="ar-SA",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        )
        page = await context.new_page()
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
        await page.evaluate(
            """() => {
            localStorage.setItem('tair_onboarding_done', '1');
            localStorage.setItem('tair_legal_ack_v1', new Date().toISOString());
            localStorage.setItem('tair_user', JSON.stringify({user_id:'guest_ss', id:'guest_ss', name:'مستخدم طير', isGuest: true}));
        }"""
        )
        await page.reload(wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2500)

        for label, action in SCREENS:
            try:
                await navigate(page, action)
                path = os.path.join(out_dir, f"{label}.png")
                await page.screenshot(path=path, full_page=False)
                print(f"[{device_label}] {label} → {path}")
            except Exception as e:
                print(f"[{device_label}] {label} FAILED: {e}")

        await browser.close()


async def main():
    # iPhone 6.5" — 1284 × 2778 (CSS 428×926 @ 3x DPR)
    await make_screenshots(
        "iPhone 6.5",
        {"width": 428, "height": 926},
        3.0,
        "/app/appstore_screenshots/iphone_6_5",
    )

    # iPad 12.9" — 2048 × 2732 (CSS 1024×1366 @ 2x DPR)
    await make_screenshots(
        "iPad 12.9",
        {"width": 1024, "height": 1366},
        2.0,
        "/app/appstore_screenshots/ipad_12_9",
    )


if __name__ == "__main__":
    asyncio.run(main())
