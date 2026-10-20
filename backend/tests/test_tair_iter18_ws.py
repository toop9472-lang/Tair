"""WebSocket real-time chat test for Tair /api/chat/ws."""
import asyncio
import json
import os
import uuid
import requests
import pytest
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://saqr-ui-sync.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/chat/ws"


@pytest.mark.asyncio
async def test_websocket_receives_realtime_message():
    tag = uuid.uuid4().hex[:6]
    buyer = f"wsbuyer_{tag}"
    seller = f"wsseller_{tag}"

    # Start a thread first
    r = requests.post(
        f"{API}/chat/start",
        params={"user_id": seller},
        json={"peer_id": buyer, "initial_message": "hi"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    thread_id = r.json()["thread_id"]

    async with websockets.connect(f"{WS_URL}?user_id={buyer}", open_timeout=10) as ws:
        # ping/pong test
        await ws.send(json.dumps({"action": "ping"}))
        pong = await asyncio.wait_for(ws.recv(), timeout=5)
        assert json.loads(pong).get("type") == "pong"

        # Seller sends a message -> buyer WS should receive it
        async def send_msg():
            await asyncio.sleep(0.4)
            requests.post(
                f"{API}/chat/thread/{thread_id}/message",
                params={"user_id": seller},
                json={"body": "realtime hello", "sender_name": "seller"},
                timeout=10,
            )

        send_task = asyncio.create_task(send_msg())
        received = await asyncio.wait_for(ws.recv(), timeout=8)
        await send_task
        payload = json.loads(received)
        assert payload["type"] == "message"
        assert payload["thread_id"] == thread_id
        assert payload["message"]["body"] == "realtime hello"
        print("WS realtime message OK")
