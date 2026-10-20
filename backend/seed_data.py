"""
Seed script - DEPRECATED
Dummy/sample ads have been removed to keep the ads feed clean for real advertisers.
If you need to add real advertiser campaigns, create them through the
advertiser dashboard API (/api/advertisers/campaigns/create).
"""
import asyncio


async def seed_ads():
    """No-op: dummy ads are no longer seeded."""
    print("ℹ️  Seed skipped - dummy ads are disabled.")


if __name__ == "__main__":
    asyncio.run(seed_ads())
