from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from redis import Redis

from src.core.deps import get_db, get_redis
from src.core.minio import get_minio_client

router = APIRouter()

@router.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    health_status = {
        "status": "healthy",
        "services": {
            "database": "healthy",
            "redis": "healthy",
            "minio": "healthy"
        }
    }
    
    try:
        # Check database
        await db.execute("SELECT 1")
    except Exception as e:
        health_status["services"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    try:
        # Check Redis
        redis.ping()
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    try:
        # Check MinIO
        minio_client = get_minio_client()
        minio_client.list_buckets()
    except Exception as e:
        health_status["services"]["minio"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    return health_status