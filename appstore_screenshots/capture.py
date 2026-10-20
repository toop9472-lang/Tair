"""
App Store Screenshot capture for طير (Tair).
Captures both iPhone 6.7" (@3x = 1290×2796) and iPad 13" (@2x = 2048×2732) sizes.
High quality PNG with proper device scaling for crisp Arabic fonts.
"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

URL = "https://saqr-ui-sync.preview.emergentagent.com"
OUT = Path("/app/appstore_screenshots")

# Target device profiles (CSS px viewport, device_scale_factor)
DEVICES = {
    "iphone_67": {
        "viewport": {"width": 428, "height": 926},   # iPhone 14 Pro Max CSS
        "dsf": 3,   # → 1284 × 2778 PNG (Apple spec)
        "outdir": OUT / "iphone_67",
    },
    "ipad_13": {
        "viewport": {"width": 1024, "height": 1366},  # iPad Pro 12.9" CSS
        "dsf": 2,   # → 2048 × 2732 PNG (Apple spec)
        "outdir": OUT / "ipad_13",
    },
}


async def accept_disclaimer(page):
    """Tick both checkboxes and click 'موافق' button."""
    try:
        await page.wait_for_timeout(2500)
        checkboxes = await page.locator('input[type="checkbox"]').all()
        for cb in checkboxes:
            try:
                if not await cb.is_checked():
                    await cb.check(force=True, timeout=1500)
            except Exception:
                pass
        await page.wait_for_timeout(400)
        try:
            btn = page.locator("button:has-text('موافق')").first
            await btn.click(force=True, timeout=3000)
            await page.wait_for_timeout(2500)
            print("  ✓ disclaimer accepted")
        except Exception as e:
            print(f"  ! disclaimer button: {e}")
    except Exception as e:
        print(f"  ! disclaimer skipped: {e}")


async def skip_onboarding(page):
    """Skip onboarding by clicking 'تخطّي' or advancing 'التالي'."""
    try:
        for _ in range(5):
            skip = page.locator("button:has-text('تخطّي'), button:has-text('تخطي')")
            if await skip.count() > 0:
                await skip.first.click(force=True, timeout=2000)
                await page.wait_for_timeout(2500)
                print("  ✓ onboarding skipped")
                return True
            nxt = page.locator("button:has-text('التالي')")
            if await nxt.count() > 0:
                await nxt.first.click(force=True, timeout=2000)
                await page.wait_for_timeout(1500)
                continue
            break
    except Exception as e:
        print(f"  ! skip onboarding: {e}")
    return False


async def guest_login(page):
    """Click guest login button — try several selectors."""
    try:
        candidates = [
            "button:has-text('كزائر')",
            "button:has-text('زائر')",
            "button:has-text('الدخول كزائر')",
            "button:has-text('تصفح كزائر')",
            "button:has-text('تصفّح')",
            "[data-testid='guest-login']",
            "[data-testid='guest-btn']",
        ]
        for sel in candidates:
            loc = page.locator(sel)
            if await loc.count() > 0:
                await loc.first.click(force=True, timeout=3000)
                await page.wait_for_timeout(4000)
                print(f"  ✓ guest login via {sel}")
                return True
        print("  ! no guest button found — dumping visible buttons")
        buttons = await page.locator("button").all_text_contents()
        print(f"  visible buttons: {buttons[:15]}")
    except Exception as e:
        print(f"  ! guest login: {e}")
    return False


async def click_tab(page, testid):
    """Click a bottom tab by data-testid."""
    try:
        loc = page.locator(f"[data-testid='{testid}']")
        cnt = await loc.count()
        if cnt > 0:
            await loc.first.click(force=True, timeout=3000)
            await page.wait_for_timeout(3000)
            print(f"  ✓ tab {testid} clicked")
            return True
        else:
            print(f"  ! tab {testid} not found (count=0)")
    except Exception as e:
        print(f"  ! tab {testid}: {e}")
    return False


async def shot(page, outdir, name):
    p = outdir / f"{name}.png"
    await page.screenshot(path=str(p), full_page=False, type="png")
    print(f"  ✓ saved {p}")


async def capture_device(playwright, device_key):
    cfg = DEVICES[device_key]
    outdir = cfg["outdir"]
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"\n=== {device_key} ({cfg['viewport']['width']}×{cfg['viewport']['height']} @{cfg['dsf']}x) ===")
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context(
        viewport=cfg["viewport"],
        device_scale_factor=cfg["dsf"],
        is_mobile=True,
        has_touch=True,
        locale="ar-SA",
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ) if "iphone" in device_key else (
            "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ),
    )
    page = await context.new_page()

    try:
        await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3500)

        # Auth page (before disclaimer accept)
        await shot(page, outdir, "01_welcome")

        await accept_disclaimer(page)

        # After disclaimer — onboarding likely visible
        await shot(page, outdir, "02_onboarding")
        await skip_onboarding(page)

        # Now the auth page
        await page.wait_for_timeout(2000)
        await shot(page, outdir, "03_auth")
        await guest_login(page)

        # ============= SHOT 4: MARKET =============
        await page.wait_for_timeout(2500)
        await shot(page, outdir, "04_market")

        # ============= SHOT 5: COMMUNITY =============
        if await click_tab(page, "tab-community"):
            await shot(page, outdir, "05_community")

        # ============= SHOT 6: TRIPS =============
        if await click_tab(page, "tab-trips"):
            await shot(page, outdir, "06_trips")

        # ============= SHOT 7: MESSAGES =============
        if await click_tab(page, "tab-messages"):
            await shot(page, outdir, "07_messages")

        # ============= SHOT 8: ACCOUNT =============
        if await click_tab(page, "tab-account"):
            await shot(page, outdir, "08_account")

        # ============= SHOT 9: BACK TO MARKET → LISTING DETAILS =============
        if await click_tab(page, "tab-market"):
            try:
                first = page.locator("[data-testid^='listing-']").first
                if await first.count() > 0:
                    await first.click(force=True, timeout=3000)
                    await page.wait_for_timeout(3500)
                    await shot(page, outdir, "09_listing_details")
                    # Navigate back
                    try:
                        back = page.locator("[data-testid='listing-back'], button:has-text('عودة')").first
                        await back.click(force=True, timeout=2000)
                    except Exception:
                        await page.go_back()
                    await page.wait_for_timeout(2000)
            except Exception as e:
                print(f"  ! listing details: {e}")

        # ============= SHOT 10: AUCTION (fresh reload, tap auction banner) =============
        try:
            await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(3000)
            await accept_disclaimer(page)
            await skip_onboarding(page)
            await page.wait_for_timeout(2500)
            auc = page.locator("[data-testid='market-auction-banner']")
            if await auc.count() > 0:
                await auc.first.click(force=True, timeout=3000)
                await page.wait_for_timeout(3500)
                await shot(page, outdir, "10_auction")
        except Exception as e:
            print(f"  ! auction: {e}")

    finally:
        await context.close()
        await browser.close()


async def main():
    async with async_playwright() as p:
        for k in DEVICES.keys():
            await capture_device(p, k)


if __name__ == "__main__":
    asyncio.run(main())
