from typing import Any, Optional
import json
import redis
from datetime import timedelta
from ..config import settings

class RedisCache:
    def __init__(self):
        self.redis = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=0,
            decode_responses=True
        )

    async def get(self, key: str) -> Optional[Any]:
        """Získá data z cache"""
        try:
            data = self.redis.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            # Log error but don't crash
            print(f"Cache get error: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        expire: Optional[timedelta] = None
    ) -> bool:
        """Uloží data do cache"""
        try:
            serialized = json.dumps(value)
            return self.redis.set(
                key,
                serialized,
                ex=int(expire.total_seconds()) if expire else None
            )
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Smaže data z cache"""
        try:
            return bool(self.redis.delete(key))
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False

    async def clear_pattern(self, pattern: str) -> int:
        """Smaže všechny klíče odpovídající vzoru"""
        try:
            keys = self.redis.keys(pattern)
            if keys:
                return self.redis.delete(*keys)
            return 0
        except Exception as e:
            print(f"Cache clear pattern error: {e}")
            return 0