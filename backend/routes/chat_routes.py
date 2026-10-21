"""طير — Chat / Direct Messages API routes + WebSocket for real-time."""
import os
import uuid
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Set

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient

from models.chat import ChatThread, ChatMessage, ChatStartRequest, ChatSendRequest
from services.tair_stickers import sticker_preview

router = APIRouter(prefix="/chat", tags=["Tair-Chat"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "saqr_db")]


# ==================== Real-time WebSocket Manager ====================
class ChatConnectionManager:
    """Tracks live WebSocket connections per user_id."""

    def __init__(self):
        self._conns: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._conns.setdefault(user_id, set()).add(ws)

    async def disconnect(self, user_id: str, ws: WebSocket):
        async with self._lock:
            conns = self._conns.get(user_id)
            if conns and ws in conns:
                conns.discard(ws)
                if not conns:
                    self._conns.pop(user_id, None)

    async def send_to_user(self, user_id: str, payload: dict):
        conns = list(self._conns.get(user_id, set()))
        dead = []
        for ws in conns:
            try:
                await ws.send_text(json.dumps(payload, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(user_id, ws)


chat_ws_manager = ChatConnectionManager()


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    for key in ("created_at", "updated_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    return doc


def _now():
    return datetime.now(timezone.utc)


@router.post("/start")
async def start_thread(payload: ChatStartRequest, user_id: str = Query(...)):
    if payload.peer_id == user_id:
        raise HTTPException(400, "Cannot chat with yourself")

    # Reuse existing thread between same 2 users (+ same listing context)
    query = {
        "participants": {"$all": [user_id, payload.peer_id]},
    }
    if payload.listing_id:
        query["listing_id"] = payload.listing_id

    existing = await db.chat_threads.find_one(query)
    if existing:
        # Optionally send initial message
        if payload.initial_message:
            await _send_message(existing["thread_id"], user_id, payload.initial_message, None)
            existing = await db.chat_threads.find_one({"thread_id": existing["thread_id"]})
        return _serialize(existing)

    thread_id = f"ct_{uuid.uuid4().hex[:12]}"
    thread = ChatThread(
        thread_id=thread_id,
        participants=[user_id, payload.peer_id],
        listing_id=payload.listing_id,
        listing_title=payload.listing_title,
        listing_image=payload.listing_image,
    )
    doc = thread.model_dump()
    await db.chat_threads.insert_one(doc)

    if payload.initial_message:
        await _send_message(thread_id, user_id, payload.initial_message, None)
        doc = await db.chat_threads.find_one({"thread_id": thread_id})

    # Increment contacts_count on the listing so seller sees engagement metrics
    if payload.listing_id:
        try:
            await db.tair_listings.update_one(
                {"listing_id": payload.listing_id},
                {"$inc": {"contacts_count": 1}},
            )
        except Exception:
            pass

    return _serialize(doc)


async def _send_message(thread_id: str, sender_id: str, body: str, sender_name: Optional[str], skip_auto: bool = False) -> dict:
    thread = await db.chat_threads.find_one({"thread_id": thread_id})
    if not thread:
        raise HTTPException(404, "Thread not found")
    if sender_id not in thread["participants"]:
        raise HTTPException(403, "Not a participant")

    msg_id = f"cm_{uuid.uuid4().hex[:12]}"
    msg = ChatMessage(msg_id=msg_id, thread_id=thread_id, sender_id=sender_id,
                      sender_name=sender_name, body=body)
    msg_doc = msg.model_dump()
    await db.chat_messages.insert_one(msg_doc)

    others = [p for p in thread["participants"] if p != sender_id]
    await db.chat_threads.update_one(
        {"thread_id": thread_id},
        {
            "$set": {
                "last_message": body[:200],
                "last_sender_id": sender_id,
                "updated_at": _now(),
            },
            "$addToSet": {"unread_by": {"$each": others}},
        },
    )

    serialized_msg = _serialize({**msg_doc})

    # Fanout: WebSocket push + in-app notification for each recipient
    for peer_id in others:
        # Real-time push if online
        await chat_ws_manager.send_to_user(peer_id, {
            "type": "message",
            "thread_id": thread_id,
            "message": serialized_msg,
        })
        # In-app notification (persist)
        try:
            from routes.tair_notifications_routes import create_tair_notification
            preview = sticker_preview(body)
            preview = preview if len(preview) <= 80 else preview[:77] + "..."
            title = sender_name or f"مستخدم {sender_id[-4:]}"
            if thread.get("listing_title"):
                title = f"{title} — {thread['listing_title']}"
            await create_tair_notification(
                user_id=peer_id,
                title=title,
                body=preview,
                notif_type="chat",
                data={"thread_id": thread_id, "sender_id": sender_id},
            )
        except Exception as exc:  # pragma: no cover
            print(f"[chat notif] failed: {exc}")

    if not skip_auto:
        try:
            from services.store_auto_reply import maybe_store_auto_reply
            await maybe_store_auto_reply(db, thread, sender_id, _send_message)
        except Exception as exc:  # pragma: no cover
            print(f"[store auto reply] failed: {exc}")

    return serialized_msg


@router.get("/threads")
async def list_threads(user_id: str = Query(...), limit: int = 50):
    cursor = db.chat_threads.find({"participants": user_id}).sort("updated_at", -1).limit(min(limit, 100))
    raw = [_serialize(d) async for d in cursor]

    # Enrich each thread with peer name/avatar/identity_color for parity with mobile PrivateMessagesScreen.
    # Collect all peer ids to batch-fetch users.
    peer_ids = []
    for t in raw:
        for p in (t.get("participants") or []):
            if p and p != user_id:
                peer_ids.append(p)
    peer_ids = list(set(peer_ids))
    users_by_id: dict = {}
    if peer_ids:
        cur = db.users.find(
            {"$or": [{"user_id": {"$in": peer_ids}}, {"id": {"$in": peer_ids}}]},
            {
                "_id": 0, "user_id": 1, "id": 1, "name": 1, "avatar": 1,
                "storefront_settings": 1, "is_verified_shop": 1, "is_verified_carrier": 1,
            },
        )
        async for u in cur:
            key = u.get("user_id") or u.get("id")
            if key:
                users_by_id[key] = u

    items = []
    for t in raw:
        peer_id = next((p for p in (t.get("participants") or []) if p and p != user_id), None)
        u = users_by_id.get(peer_id) if peer_id else None
        sf = (u or {}).get("storefront_settings") or {}
        peer_name = (u or {}).get("name") or (peer_id and f"مستخدم {peer_id[-4:]}") or "مستخدم"
        peer_avatar = sf.get("logo_url") or (u or {}).get("avatar")
        peer_identity_color = sf.get("identity_color") or "#0f766e"
        peer_verified = bool((u or {}).get("is_verified_shop") or (u or {}).get("is_verified_carrier"))
        t["peer_id"] = peer_id
        t["peer_name"] = peer_name
        t["peer_avatar"] = peer_avatar
        t["peer_identity_color"] = peer_identity_color
        t["peer_verified"] = peer_verified
        t["last_message"] = sticker_preview(t.get("last_message") or "")
        items.append(t)

    return {"items": items, "total": len(items)}


@router.get("/thread/{thread_id}")
async def get_thread(thread_id: str, user_id: str = Query(...)):
    doc = await db.chat_threads.find_one({"thread_id": thread_id})
    if not doc:
        raise HTTPException(404, "Thread not found")
    if user_id not in doc["participants"]:
        raise HTTPException(403, "Not a participant")
    return _serialize(doc)


@router.get("/thread/{thread_id}/messages")
async def list_messages(thread_id: str, user_id: str = Query(...), limit: int = 200):
    thread = await db.chat_threads.find_one({"thread_id": thread_id})
    if not thread:
        raise HTTPException(404, "Thread not found")
    if user_id not in thread["participants"]:
        raise HTTPException(403, "Not a participant")
    cursor = db.chat_messages.find({"thread_id": thread_id}).sort("created_at", 1).limit(min(limit, 500))
    items = [_serialize(d) async for d in cursor]
    return {"items": items, "total": len(items)}


@router.post("/thread/{thread_id}/message")
async def send_message(thread_id: str, payload: ChatSendRequest, user_id: str = Query(...)):
    body = payload.body.strip()
    if not body:
        raise HTTPException(400, "Empty message")
    return await _send_message(thread_id, user_id, body, payload.sender_name)


@router.post("/thread/{thread_id}/read")
async def mark_read(thread_id: str, user_id: str = Query(...)):
    await db.chat_threads.update_one(
        {"thread_id": thread_id, "participants": user_id},
        {"$pull": {"unread_by": user_id}},
    )
    return {"success": True}


@router.get("/unread-count")
async def unread_count(user_id: str = Query(...)):
    n = await db.chat_threads.count_documents({"unread_by": user_id})
    return {"count": n}


# ==================== WebSocket ====================
@router.websocket("/ws")
async def chat_websocket(ws: WebSocket, user_id: str = Query(...)):
    """
    Real-time chat websocket. Client connects with ?user_id=xxx.
    Messages pushed as JSON: {type: 'message', thread_id, message: {...}}
    Client can send: {"action": "ping"} to keep alive; {"action": "typing", "thread_id": ...}
    """
    await chat_ws_manager.connect(user_id, ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            action = data.get("action")
            if action == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
            elif action == "typing":
                thread_id = data.get("thread_id")
                if not thread_id:
                    continue
                thread = await db.chat_threads.find_one({"thread_id": thread_id})
                if thread and user_id in thread["participants"]:
                    for peer_id in thread["participants"]:
                        if peer_id != user_id:
                            await chat_ws_manager.send_to_user(peer_id, {
                                "type": "typing",
                                "thread_id": thread_id,
                                "user_id": user_id,
                            })
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover
        print(f"[chat ws] error: {exc}")
    finally:
        await chat_ws_manager.disconnect(user_id, ws)
