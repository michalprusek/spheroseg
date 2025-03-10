from redis import Redis
from typing import Any, Optional
import json
import logging
import os
from functools import wraps
from datetime import timedelta

logger = logging.getLogger(__name__)

class CacheManager:
    def __init__(self):
        self.redis = Redis(
            host=os.getenv("REDIS_HOST", "redis"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            db=0,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True
        )
        self.default_ttl = timedelta(minutes=15)

    def get(self, key: str) -> Optional[Any]:
        try:
            data = self.redis.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Cache get error: {str(e)}")
            return None

    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[timedelta] = None
    ) -> bool:
        try:
            return self.redis.set(
                key,
                json.dumps(value),
                ex=(ttl or self.default_ttl).total_seconds()
            )
        except Exception as e:
            logger.error(f"Cache set error: {str(e)}")
            return False

    def delete(self, key: str) -> bool:
        try:
            return bool(self.redis.delete(key))
        except Exception as e:
            logger.error(f"Cache delete error: {str(e)}")
            return False

    def clear_all(self) -> bool:
        try:
            return self.redis.flushdb()
        except Exception as e:
            logger.error(f"Cache clear error: {str(e)}")
            return False

    def cached(self, ttl: Optional[timedelta] = None):
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Vytvoření klíče z funkce a argumentů
                key = f"{func.__name__}:{hash(str(args))}{hash(str(kwargs))}"
                
                # Pokus o získání z cache
                cached_value = self.get(key)
                if cached_value is not None:
                    return cached_value
                
                # Pokud není v cache, spustit funkci
                result = await func(*args, **kwargs)
                
                # Uložit výsledek do cache
                self.set(key, result, ttl)
                
                return result
            return wrapper
        return decorator

cache_manager = CacheManager()