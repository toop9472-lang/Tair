"""طير — Species catalog API (reference list)."""
import os
from typing import Optional

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient

from pymongo import UpdateOne

from models.species import SEED_SPECIES, FAMILIES

router = APIRouter(prefix="/species", tags=["Tair-Species"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]

_catalog_synced = False


async def sync_species_catalog():
    """يكمّل الأنواع الناقصة ويحدّث الأسماء دون مسح ما أضافه المشرف."""
    global _catalog_synced
    if _catalog_synced:
        return
    ops = [
        UpdateOne({"species_id": sp["species_id"]}, {"$set": dict(sp)}, upsert=True)
        for sp in SEED_SPECIES
    ]
    if ops:
        await db.species_catalog.bulk_write(ops, ordered=False)
    _catalog_synced = True


async def seed_species_if_empty():
    await sync_species_catalog()


@router.get("/families")
async def list_families():
    """List all species families (used by UI to group species by taxonomy)."""
    return {"items": FAMILIES, "total": len(FAMILIES)}


@router.get("/list")
async def list_species(category: Optional[str] = None, family: Optional[str] = None):
    await sync_species_catalog()
    query: dict = {}
    if category:
        query["category"] = category
    if family:
        query["family"] = family
    cursor = db.species_catalog.find(query, {"_id": 0})
    items = await cursor.to_list(1000)
    return {"items": items, "total": len(items)}


@router.get("/{species_id}")
async def get_species(species_id: str):
    doc = await db.species_catalog.find_one({"species_id": species_id}, {"_id": 0})
    return doc or {}


@router.post("/reseed")
async def reseed_species():
    """Admin: wipe and reseed the catalog."""
    global _catalog_synced
    await db.species_catalog.delete_many({})
    await db.species_catalog.insert_many(SEED_SPECIES)
    _catalog_synced = True
    return {"seeded": len(SEED_SPECIES)}
