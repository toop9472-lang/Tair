"""Public share pages — HTML landing pages for shared Tair content.
Served at /share and /api/share so the public host that proxies /api still
returns the image, the sentence, and a link that opens the app.
"""
import os
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient

from services.share_card import first_image, render_share_page

router = APIRouter(tags=["Share"], include_in_schema=False)

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]


def _missing(kind: str, item_id: str, title: str) -> HTMLResponse:
    page = render_share_page(kind=kind, item_id=item_id, title=title, lines=["المحتوى غير متاح الآن"])
    return HTMLResponse(page, status_code=404)


def _both(path: str):
    """Register the page on /share and /api/share."""
    slug = path.split("/")[0]

    def decorate(fn):
        router.add_api_route(
            f"/share/{path}", fn, methods=["GET"], response_class=HTMLResponse,
            operation_id=f"share_{slug}",
        )
        router.add_api_route(
            f"/api/share/{path}", fn, methods=["GET"], response_class=HTMLResponse,
            operation_id=f"api_share_{slug}",
        )
        return fn
    return decorate


@_both("listing/{listing_id}")
async def share_listing(listing_id: str):
    listing = await db.listings.find_one({"$or": [{"listing_id": listing_id}, {"id": listing_id}]})
    if not listing:
        return _missing("listing", listing_id, "إعلان غير متاح")
    image = first_image(listing.get("cover_image"), listing.get("images"))
    city = listing.get("city") or ""
    district = listing.get("district") or ""
    place = " · ".join(part for part in (city, district) if part)
    price = listing.get("price_sar")
    lines = []
    if price not in (None, ""):
        lines.append(f"{price} ر.س")
    if place:
        lines.append(place)
    description = (listing.get("description") or "").strip()
    if description:
        lines.append(description[:160])
    return HTMLResponse(render_share_page(
        kind="listing",
        item_id=listing_id,
        title=listing.get("title") or "إعلان طير",
        lines=lines,
        image=image,
    ))


@_both("trip/{trip_id}")
async def share_trip(trip_id: str):
    trip = await db.trips.find_one({"$or": [{"trip_id": trip_id}, {"id": trip_id}]})
    if not trip:
        return _missing("trip", trip_id, "رحلة غير متاحة")
    title = f'{trip.get("from_city") or ""} ← {trip.get("to_city") or ""}'.strip()
    lines = []
    if trip.get("depart_at"):
        lines.append(str(trip.get("depart_at")))
    if trip.get("carrier_name"):
        lines.append(f'الموصل: {trip.get("carrier_name")}')
    return HTMLResponse(render_share_page(
        kind="trip",
        item_id=trip_id,
        title=title or "رحلة على طير",
        lines=lines,
        image=first_image(trip.get("carrier_avatar")),
    ))


@_both("store/{user_id}")
async def share_store(user_id: str):
    user = await db.users.find_one({"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]})
    if not user:
        return _missing("store", user_id, "متجر غير متاح")
    settings = user.get("storefront_settings") or {}
    image = first_image(
        settings.get("banner_slides"),
        settings.get("logo_url"),
        user.get("profile_bg_url"),
        user.get("avatar"),
    )
    lines = []
    city = settings.get("city") or user.get("city") or ""
    if city:
        lines.append(city)
    bio = (settings.get("bio") or user.get("bio") or "").strip()
    if bio:
        lines.append(bio[:160])
    return HTMLResponse(render_share_page(
        kind="store",
        item_id=user_id,
        title=user.get("name") or "متجر طير",
        lines=lines,
        image=image,
    ))


@_both("auction/{auction_id}")
async def share_auction(auction_id: str):
    auction = await db.tair_auctions.find_one({"auction_id": auction_id})
    if not auction:
        return _missing("auction", auction_id, "مزاد غير متاح")
    price = auction.get("current_bid_sar") or auction.get("starting_price_sar")
    lines = []
    if price not in (None, ""):
        lines.append(f"{price} ر.س")
    if auction.get("city"):
        lines.append(auction.get("city"))
    return HTMLResponse(render_share_page(
        kind="auction",
        item_id=auction_id,
        title=auction.get("title") or "مزاد طير",
        lines=lines,
        image=first_image(auction.get("images"), auction.get("cover_image")),
    ))


@_both("story/{story_id}")
async def share_story(story_id: str):
    story = await db.tair_stories.find_one({"story_id": story_id})
    if not story:
        return _missing("story", story_id, "قصة غير متاحة")
    caption = (story.get("caption") or "").strip()
    return HTMLResponse(render_share_page(
        kind="story",
        item_id=story_id,
        title=story.get("user_name") or "قصة على طير",
        lines=[caption[:160]] if caption else [],
        image=first_image(story.get("image_url")),
    ))


@_both("clinic/{topic_id}")
async def share_clinic(topic_id: str):
    topic = await db.tair_clinic_topics.find_one({"topic_id": topic_id, "status": {"$ne": "deleted"}})
    if not topic:
        return _missing("clinic", topic_id, "موضوع غير متاح")
    lines = []
    if topic.get("user_name"):
        lines.append(f'من {topic.get("user_name")}')
    description = (topic.get("description") or "").strip()
    if description:
        lines.append(description[:160])
    return HTMLResponse(render_share_page(
        kind="clinic",
        item_id=topic_id,
        title=topic.get("title") or "موضوع في العيادة",
        lines=lines,
        image=first_image(topic.get("images")),
    ))


@_both("app/{item_id}")
async def share_app(item_id: str = "download"):
    return HTMLResponse(render_share_page(
        kind="app",
        item_id=item_id or "download",
        title="طير — سوق الطيور والحيوانات",
        lines=["اضغط ايفون أو اندرويد للتحميل"],
        image="",
    ))
