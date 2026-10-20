# Social Routes - Friends, Private Messages, Reports System
# نظام الأصدقاء والرسائل الخاصة والبلاغات

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

router = APIRouter(prefix="/social", tags=["Social"])

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'saqr_db')]

# ==================== CONSTANTS ====================
INVITE_TO_CHAT_COST = 25  # تكلفة دعوة للدردشة العامة
FRIEND_INVITE_COST = 0    # دعوة الصديق مجانية

# ==================== MODELS ====================

class FriendRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    from_user_name: str

class AcceptFriendRequest(BaseModel):
    request_id: str
    user_id: str

class PrivateMessageRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    from_user_name: str
    message: str

class GameInviteRequest(BaseModel):
    from_user_id: str
    to_user_id: Optional[str] = None  # None = invite to public chat
    from_user_name: str
    game_id: str
    game_name: str
    challenge_amount: int = 0  # مبلغ التحدي (جواهر صقر)
    invite_type: str  # "friend" or "public"

class ReportRequest(BaseModel):
    reporter_id: str
    reported_user_id: str
    report_type: str  # "spam", "harassment", "inappropriate", "other"
    content_type: str  # "chat_message", "private_message", "user_profile"
    content_id: Optional[str] = None
    reason: str


# ==================== FRIENDS SYSTEM ====================

@router.post("/friends/request")
async def send_friend_request(request: FriendRequest):
    """إرسال طلب صداقة"""
    
    # التحقق من عدم وجود طلب سابق
    existing = await db.friend_requests.find_one({
        "from_user_id": request.from_user_id,
        "to_user_id": request.to_user_id,
        "status": "pending"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="لديك طلب صداقة معلق بالفعل")
    
    # التحقق من عدم وجود صداقة سابقة
    existing_friendship = await db.friendships.find_one({
        "$or": [
            {"user1_id": request.from_user_id, "user2_id": request.to_user_id},
            {"user1_id": request.to_user_id, "user2_id": request.from_user_id}
        ]
    })
    
    if existing_friendship:
        raise HTTPException(status_code=400, detail="أنتما أصدقاء بالفعل")
    
    # إنشاء طلب الصداقة
    request_id = str(uuid.uuid4())
    friend_request = {
        "id": request_id,
        "from_user_id": request.from_user_id,
        "to_user_id": request.to_user_id,
        "from_user_name": request.from_user_name,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.friend_requests.insert_one(friend_request)
    
    # إضافة إشعار للمستخدم المستهدف
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": request.to_user_id,
        "type": "friend_request",
        "title": "طلب صداقة جديد",
        "message": f"{request.from_user_name} يريد إضافتك كصديق",
        "data": {"request_id": request_id, "from_user_id": request.from_user_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {
        "success": True,
        "request_id": request_id,
        "message": "تم إرسال طلب الصداقة"
    }


@router.post("/friends/accept")
async def accept_friend_request(request: AcceptFriendRequest):
    """قبول طلب صداقة"""
    
    friend_request = await db.friend_requests.find_one({
        "id": request.request_id,
        "to_user_id": request.user_id,
        "status": "pending"
    })
    
    if not friend_request:
        raise HTTPException(status_code=404, detail="طلب الصداقة غير موجود")
    
    # تحديث حالة الطلب
    await db.friend_requests.update_one(
        {"id": request.request_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # إنشاء الصداقة
    friendship = {
        "id": str(uuid.uuid4()),
        "user1_id": friend_request["from_user_id"],
        "user2_id": friend_request["to_user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.friendships.insert_one(friendship)
    
    # إشعار للمرسل
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": friend_request["from_user_id"],
        "type": "friend_accepted",
        "title": "تم قبول طلب الصداقة",
        "message": "لديك صديق جديد!",
        "data": {"friend_id": request.user_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {
        "success": True,
        "message": "تمت إضافة الصديق بنجاح"
    }


@router.post("/friends/reject")
async def reject_friend_request(request: AcceptFriendRequest):
    """رفض طلب صداقة"""
    
    result = await db.friend_requests.update_one(
        {"id": request.request_id, "to_user_id": request.user_id, "status": "pending"},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="طلب الصداقة غير موجود")
    
    return {"success": True, "message": "تم رفض طلب الصداقة"}


@router.get("/friends/list/{user_id}")
async def get_friends_list(user_id: str):
    """الحصول على قائمة الأصدقاء"""
    
    friendships = await db.friendships.find({
        "$or": [
            {"user1_id": user_id},
            {"user2_id": user_id}
        ]
    }).to_list(1000)
    
    friends = []
    for f in friendships:
        friend_id = f["user2_id"] if f["user1_id"] == user_id else f["user1_id"]
        
        # جلب معلومات الصديق
        friend = await db.users.find_one(
            {"$or": [{"id": friend_id}, {"user_id": friend_id}]},
            {"_id": 0, "id": 1, "user_id": 1, "name": 1, "avatar": 1, "username": 1}
        )
        
        if friend:
            friends.append({
                "id": friend.get("id") or friend.get("user_id"),
                "name": friend.get("name") or friend.get("username", "مستخدم"),
                "avatar": friend.get("avatar"),
                "friendship_date": f["created_at"]
            })
    
    return {
        "friends": friends,
        "count": len(friends)
    }


@router.get("/friends/requests/{user_id}")
async def get_friend_requests(user_id: str):
    """الحصول على طلبات الصداقة المعلقة"""
    
    # طلبات واردة
    incoming = await db.friend_requests.find({
        "to_user_id": user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # طلبات صادرة
    outgoing = await db.friend_requests.find({
        "from_user_id": user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    return {
        "incoming": incoming,
        "outgoing": outgoing
    }


@router.delete("/friends/remove/{user_id}/{friend_id}")
async def remove_friend(user_id: str, friend_id: str):
    """إزالة صديق"""
    
    result = await db.friendships.delete_one({
        "$or": [
            {"user1_id": user_id, "user2_id": friend_id},
            {"user1_id": friend_id, "user2_id": user_id}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="الصداقة غير موجودة")
    
    return {"success": True, "message": "تم إزالة الصديق"}


# ==================== PRIVATE MESSAGES ====================

@router.post("/messages/send")
async def send_private_message(request: PrivateMessageRequest):
    """إرسال رسالة خاصة — بدون شرط صداقة (Tair open messaging)"""

    # إنشاء الرسالة
    message_id = str(uuid.uuid4())
    message = {
        "id": message_id,
        "from_user_id": request.from_user_id,
        "to_user_id": request.to_user_id,
        "from_user_name": request.from_user_name,
        "message": request.message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.private_messages.insert_one(message)
    
    # إشعار
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": request.to_user_id,
        "type": "private_message",
        "title": "رسالة جديدة",
        "message": f"رسالة من {request.from_user_name}",
        "data": {"message_id": message_id, "from_user_id": request.from_user_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {
        "success": True,
        "message_id": message_id,
        "message": "تم إرسال الرسالة"
    }


@router.get("/messages/unread-count/{user_id}")
async def unread_private_messages(user_id: str):
    """عدد الرسائل الخاصة غير المقروءة لمستخدم"""
    n = await db.private_messages.count_documents({
        "to_user_id": user_id,
        "read": {"$ne": True},
    })
    return {"count": n}


@router.get("/messages/conversation/{user_id}/{friend_id}")
async def get_conversation(user_id: str, friend_id: str, limit: int = 50):
    """الحصول على المحادثة مع صديق"""
    
    messages = await db.private_messages.find({
        "$or": [
            {"from_user_id": user_id, "to_user_id": friend_id},
            {"from_user_id": friend_id, "to_user_id": user_id}
        ]
    }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # تحديث الرسائل كمقروءة
    await db.private_messages.update_many(
        {"from_user_id": friend_id, "to_user_id": user_id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    messages.reverse()
    
    return {
        "messages": messages,
        "count": len(messages)
    }


@router.get("/messages/inbox/{user_id}")
async def get_inbox(user_id: str):
    """الحصول على البريد — كل المحادثات (واردة وصادرة)"""
    # يجمع كل الرسائل حيث المستخدم مرسل أو مستقبل، ويجمعها حسب الطرف الآخر
    pipeline = [
        {"$match": {"$or": [{"to_user_id": user_id}, {"from_user_id": user_id}]}},
        {"$addFields": {
            "peer_id": {
                "$cond": [
                    {"$eq": ["$from_user_id", user_id]},
                    "$to_user_id",
                    "$from_user_id",
                ]
            }
        }},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$peer_id",
            "last_message": {"$first": "$$ROOT"}
        }},
        {"$sort": {"last_message.created_at": -1}}
    ]

    conversations = await db.private_messages.aggregate(pipeline).to_list(200)

    inbox = []
    for conv in conversations:
        msg = conv["last_message"]
        peer_id = conv["_id"]

        # جلب معلومات الطرف الآخر (اسم، صورة، توثيق) بغض النظر عن اتجاه الرسالة الأخيرة
        peer_user = await db.users.find_one(
            {"$or": [{"id": peer_id}, {"user_id": peer_id}, {"email": peer_id}]},
            {"_id": 0, "name": 1, "email": 1, "avatar": 1, "is_verified_shop": 1,
             "is_verified_carrier": 1, "is_verified_merchant": 1,
             "storefront_settings": 1}
        ) or {}
        sf = peer_user.get("storefront_settings") or {}
        peer_name = (
            peer_user.get("name")
            or (msg.get("from_user_name") if msg.get("from_user_id") == peer_id else None)
            or peer_user.get("email")
            or "مستخدم"
        )
        peer_avatar = sf.get("logo_url") or peer_user.get("avatar")

        unread_count = await db.private_messages.count_documents({
            "from_user_id": peer_id,
            "to_user_id": user_id,
            "read": False
        })

        preview = msg["message"][:50] + "..." if len(msg["message"]) > 50 else msg["message"]
        # لو كانت الرسالة الأخيرة صادرة، أضف بادئة "أنت: " لتوضيح ذلك
        if msg.get("from_user_id") == user_id:
            preview = f"أنت: {preview}"

        inbox.append({
            "from_user_id": peer_id,
            "from_user_name": peer_name,
            "from_user_avatar": peer_avatar,
            "is_verified": bool(
                peer_user.get("is_verified_shop")
                or peer_user.get("is_verified_merchant")
                or peer_user.get("is_verified_carrier")
            ),
            "identity_color": sf.get("identity_color"),
            "last_message": preview,
            "last_is_own": msg.get("from_user_id") == user_id,
            "unread_count": unread_count,
            "last_time": msg["created_at"]
        })

    return {
        "inbox": inbox,
        "total_unread": sum(c["unread_count"] for c in inbox)
    }


# ==================== GAME INVITES & CHALLENGES ====================

@router.post("/game/invite")
async def send_game_invite(request: GameInviteRequest):
    """إرسال دعوة لعب"""
    
    # التحقق من المستخدم (اختياري للدعوات المجانية)
    user = await db.users.find_one(
        {"$or": [{"id": request.from_user_id}, {"user_id": request.from_user_id}]}
    )
    
    cost = 0
    
    if request.invite_type == "public":
        # دعوة عامة = 25 ألماسة
        if not user:
            raise HTTPException(status_code=404, detail="المستخدم غير موجود")
            
        cost = INVITE_TO_CHAT_COST
        current_diamonds = user.get("diamonds", 0)
        
        if current_diamonds < cost:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "insufficient_diamonds",
                    "message": f"تحتاج {cost} ألماسة لإرسال دعوة للدردشة العامة",
                    "required": cost,
                    "current": current_diamonds
                }
            )
        
        # خصم الألماسات
        await db.users.update_one(
            {"$or": [{"id": request.from_user_id}, {"user_id": request.from_user_id}]},
            {"$inc": {"diamonds": -cost}}
        )
    elif request.invite_type == "friend" and request.to_user_id:
        # التحقق من الصداقة (مجاني)
        friendship = await db.friendships.find_one({
            "$or": [
                {"user1_id": request.from_user_id, "user2_id": request.to_user_id},
                {"user1_id": request.to_user_id, "user2_id": request.from_user_id}
            ]
        })
        
        if not friendship:
            raise HTTPException(status_code=403, detail="يجب أن تكونا أصدقاء")
    
    # إنشاء الدعوة
    invite_id = str(uuid.uuid4())
    invite = {
        "id": invite_id,
        "from_user_id": request.from_user_id,
        "to_user_id": request.to_user_id,
        "from_user_name": request.from_user_name,
        "game_id": request.game_id,
        "game_name": request.game_name,
        "invite_type": request.invite_type,
        "challenge_amount": request.challenge_amount,
        "status": "pending",
        "cost": cost,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": datetime.now(timezone.utc).isoformat()  # TODO: Add expiry
    }
    
    await db.game_invites.insert_one(invite)
    
    # إذا كانت دعوة عامة، أضفها للدردشة
    if request.invite_type == "public":
        chat_message = {
            "id": str(uuid.uuid4()),
            "user_id": request.from_user_id,
            "user_name": request.from_user_name,
            "message": f"🎮 دعوة للعب {request.game_name}! اضغط للانضمام",
            "server_id": "arabic",
            "type": "game_invite",
            "invite_data": {
                "invite_id": invite_id,
                "game_id": request.game_id,
                "game_name": request.game_name,
                "challenge_amount": request.challenge_amount
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.chat_messages.insert_one(chat_message)
    else:
        # إشعار للصديق
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": request.to_user_id,
            "type": "game_invite",
            "title": "دعوة للعب",
            "message": f"{request.from_user_name} يدعوك للعب {request.game_name}",
            "data": {"invite_id": invite_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return {
        "success": True,
        "invite_id": invite_id,
        "cost": cost,
        "message": "تم إرسال الدعوة"
    }


@router.post("/game/accept-invite/{invite_id}/{user_id}")
async def accept_game_invite(invite_id: str, user_id: str):
    """قبول دعوة اللعب"""
    
    invite = await db.game_invites.find_one({"id": invite_id, "status": "pending"})
    
    if not invite:
        raise HTTPException(status_code=404, detail="الدعوة غير موجودة أو منتهية")
    
    # التحقق من التحدي
    if invite.get("challenge_amount", 0) > 0:
        user = await db.users.find_one(
            {"$or": [{"id": user_id}, {"user_id": user_id}]}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="المستخدم غير موجود")
        
        gems = user.get("saqr_gems", 0)
        if gems < invite["challenge_amount"]:
            raise HTTPException(
                status_code=400,
                detail=f"تحتاج {invite['challenge_amount']} جوهرة صقر للمشاركة في التحدي"
            )
        
        # حجز جواهر اللاعب
        await db.users.update_one(
            {"$or": [{"id": user_id}, {"user_id": user_id}]},
            {"$inc": {"saqr_gems": -invite["challenge_amount"]}}
        )
    
    # تحديث الدعوة
    await db.game_invites.update_one(
        {"id": invite_id},
        {
            "$set": {
                "status": "accepted",
                "accepted_by": user_id,
                "accepted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # إنشاء جلسة اللعب
    game_session = {
        "id": str(uuid.uuid4()),
        "invite_id": invite_id,
        "game_id": invite["game_id"],
        "player1_id": invite["from_user_id"],
        "player2_id": user_id,
        "challenge_amount": invite.get("challenge_amount", 0),
        "total_prize": invite.get("challenge_amount", 0) * 2,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.game_sessions.insert_one(game_session)

    game_session.pop("_id", None)
    
    return {
        "success": True,
        "game_session_id": game_session["id"],
        "message": "تم قبول الدعوة! المباراة جاهزة"
    }


@router.post("/game/complete-challenge")
async def complete_challenge(
    session_id: str,
    winner_id: str
):
    """إكمال التحدي وتوزيع الجوائز"""
    
    session = await db.game_sessions.find_one({"id": session_id, "status": "active"})
    
    if not session:
        raise HTTPException(status_code=404, detail="جلسة اللعب غير موجودة")
    
    if winner_id not in [session["player1_id"], session["player2_id"]]:
        raise HTTPException(status_code=400, detail="الفائز غير صالح")
    
    total_prize = session.get("total_prize", 0)
    
    if total_prize > 0:
        # الفائز يحصل على الجائزة المضاعفة
        await db.users.update_one(
            {"$or": [{"id": winner_id}, {"user_id": winner_id}]},
            {"$inc": {"saqr_gems": total_prize}}
        )
    
    # تحديث الجلسة
    await db.game_sessions.update_one(
        {"id": session_id},
        {
            "$set": {
                "status": "completed",
                "winner_id": winner_id,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "winner_id": winner_id,
        "prize_awarded": total_prize,
        "message": f"مبروك! الفائز حصل على {total_prize} جوهرة صقر"
    }


# ==================== REPORTS SYSTEM ====================

@router.post("/report")
async def submit_report(request: ReportRequest):
    """تقديم بلاغ"""
    
    report_id = str(uuid.uuid4())
    report = {
        "id": report_id,
        "reporter_id": request.reporter_id,
        "reported_user_id": request.reported_user_id,
        "report_type": request.report_type,
        "content_type": request.content_type,
        "content_id": request.content_id,
        "reason": request.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reports.insert_one(report)

    
    report.pop("_id", None)
    
    # تحديث عداد البلاغات للمستخدم المبلغ عنه
    await db.users.update_one(
        {"$or": [{"id": request.reported_user_id}, {"user_id": request.reported_user_id}]},
        {"$inc": {"report_count": 1}}
    )
    
    return {
        "success": True,
        "report_id": report_id,
        "message": "تم تقديم البلاغ وسيتم مراجعته"
    }


@router.get("/reports/user/{user_id}")
async def get_user_reports(user_id: str):
    """الحصول على بلاغات المستخدم (للأدمن)"""
    
    reports = await db.reports.find(
        {"reported_user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "reports": reports,
        "count": len(reports)
    }


# ==================== NOTIFICATIONS ====================

@router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, limit: int = 50):
    """الحصول على الإشعارات"""
    
    notifications = await db.notifications.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        "user_id": user_id,
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.post("/notifications/read/{user_id}")
async def mark_notifications_read(user_id: str):
    """تحديد الإشعارات كمقروءة"""
    
    await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "تم تحديث الإشعارات"}


# ==================== USER SEARCH ====================

@router.get("/users/search")
async def search_users(query: str, limit: int = 20):
    """البحث عن مستخدمين"""
    
    users = await db.users.find(
        {
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"username": {"$regex": query, "$options": "i"}}
            ]
        },
        {"_id": 0, "id": 1, "user_id": 1, "name": 1, "username": 1, "avatar": 1}
    ).limit(limit).to_list(limit)
    
    results = []
    for u in users:
        results.append({
            "id": u.get("id") or u.get("user_id"),
            "name": u.get("name") or u.get("username", "مستخدم"),
            "avatar": u.get("avatar")
        })
    
    return {
        "users": results,
        "count": len(results)
    }
