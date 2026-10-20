"""
Redis Caching System - نظام التخزين المؤقت
- تخزين مؤقت للوحات المتصدرين
- تخزين مؤقت لبيانات المستخدم
- تخزين مؤقت للجلسات
"""
from fastapi import APIRouter, HTTPException
from typing import Optional, Any
from datetime import datetime, timezone, timedelta
import json
import os

router = APIRouter(prefix='/cache', tags=['Cache Management'])

# ============ SIMPLE IN-MEMORY CACHE ============
# Using simple dict-based cache since Redis is not always available
# In production, replace with Redis

class SimpleCache:
    def __init__(self):
        self._cache = {}
        self._expiry = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if key not in self._cache:
            return None
        
        # Check expiry
        if key in self._expiry:
            if datetime.now(timezone.utc) > self._expiry[key]:
                del self._cache[key]
                del self._expiry[key]
                return None
        
        return self._cache[key]
    
    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """Set value in cache with TTL"""
        self._cache[key] = value
        self._expiry[key] = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    
    def delete(self, key: str):
        """Delete key from cache"""
        if key in self._cache:
            del self._cache[key]
        if key in self._expiry:
            del self._expiry[key]
    
    def clear(self):
        """Clear all cache"""
        self._cache = {}
        self._expiry = {}
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        # Clean expired entries
        now = datetime.now(timezone.utc)
        expired_keys = [k for k, v in self._expiry.items() if v < now]
        for k in expired_keys:
            self.delete(k)
        
        return {
            "total_keys": len(self._cache),
            "memory_usage_approx": len(json.dumps(self._cache, default=str))
        }


# Global cache instance
cache = SimpleCache()


# ============ CACHE KEYS ============

class CacheKeys:
    """Cache key patterns"""
    
    @staticmethod
    def leaderboard(game_id: str, period: str) -> str:
        return f"leaderboard:{game_id}:{period}"
    
    @staticmethod
    def user_stats(user_id: str) -> str:
        return f"user_stats:{user_id}"
    
    @staticmethod
    def user_balance(user_id: str) -> str:
        return f"user_balance:{user_id}"
    
    @staticmethod
    def daily_challenges(user_id: str, date: str) -> str:
        return f"daily_challenges:{user_id}:{date}"
    
    @staticmethod
    def achievements(user_id: str) -> str:
        return f"achievements:{user_id}"
    
    @staticmethod
    def game_config(game_id: str) -> str:
        return f"game_config:{game_id}"
    
    @staticmethod
    def session(session_id: str) -> str:
        return f"session:{session_id}"


# ============ TTL VALUES ============

class CacheTTL:
    """Cache TTL values in seconds"""
    LEADERBOARD = 60  # 1 minute
    USER_STATS = 30  # 30 seconds
    USER_BALANCE = 10  # 10 seconds
    DAILY_CHALLENGES = 120  # 2 minutes
    ACHIEVEMENTS = 300  # 5 minutes
    GAME_CONFIG = 3600  # 1 hour
    SESSION = 86400  # 24 hours


# ============ CACHE SERVICE ============

class CacheService:
    """Cache service for the application"""
    
    @staticmethod
    def get_leaderboard(game_id: str, period: str) -> Optional[dict]:
        key = CacheKeys.leaderboard(game_id, period)
        return cache.get(key)
    
    @staticmethod
    def set_leaderboard(game_id: str, period: str, data: dict):
        key = CacheKeys.leaderboard(game_id, period)
        cache.set(key, data, CacheTTL.LEADERBOARD)
    
    @staticmethod
    def get_user_stats(user_id: str) -> Optional[dict]:
        key = CacheKeys.user_stats(user_id)
        return cache.get(key)
    
    @staticmethod
    def set_user_stats(user_id: str, data: dict):
        key = CacheKeys.user_stats(user_id)
        cache.set(key, data, CacheTTL.USER_STATS)
    
    @staticmethod
    def invalidate_user_stats(user_id: str):
        key = CacheKeys.user_stats(user_id)
        cache.delete(key)
    
    @staticmethod
    def get_user_balance(user_id: str) -> Optional[dict]:
        key = CacheKeys.user_balance(user_id)
        return cache.get(key)
    
    @staticmethod
    def set_user_balance(user_id: str, data: dict):
        key = CacheKeys.user_balance(user_id)
        cache.set(key, data, CacheTTL.USER_BALANCE)
    
    @staticmethod
    def invalidate_user_balance(user_id: str):
        key = CacheKeys.user_balance(user_id)
        cache.delete(key)
    
    @staticmethod
    def get_achievements(user_id: str) -> Optional[dict]:
        key = CacheKeys.achievements(user_id)
        return cache.get(key)
    
    @staticmethod
    def set_achievements(user_id: str, data: dict):
        key = CacheKeys.achievements(user_id)
        cache.set(key, data, CacheTTL.ACHIEVEMENTS)
    
    @staticmethod
    def invalidate_achievements(user_id: str):
        key = CacheKeys.achievements(user_id)
        cache.delete(key)


# ============ ENDPOINTS ============

@router.get('/stats')
async def get_cache_stats():
    """الحصول على إحصائيات التخزين المؤقت"""
    return {
        "status": "active",
        "backend": "in-memory",
        **cache.get_stats()
    }


@router.post('/clear')
async def clear_cache():
    """مسح التخزين المؤقت (للمشرفين)"""
    cache.clear()
    return {
        "success": True,
        "message": "تم مسح التخزين المؤقت"
    }


@router.delete('/{key}')
async def delete_cache_key(key: str):
    """حذف مفتاح محدد من التخزين المؤقت"""
    cache.delete(key)
    return {
        "success": True,
        "key": key
    }


# ============ DECORATOR FOR CACHING ============

def cached(key_func, ttl: int = 300):
    """Decorator for caching function results"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = key_func(*args, **kwargs)
            
            # Check cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Call function
            result = await func(*args, **kwargs)
            
            # Store in cache
            cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator
