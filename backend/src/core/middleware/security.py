from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
from ..config import settings
import time
import hashlib

class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Rate limiting
        client_ip = request.client.host
        if not self._check_rate_limit(client_ip):
            return Response(
                content="Rate limit exceeded",
                status_code=429
            )

        # Add security headers
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = self._get_csp_policy()

        return response

    def _check_rate_limit(self, client_ip: str) -> bool:
        """Kontrola rate limitu"""
        cache = RedisCache()
        key = f"ratelimit:{client_ip}"
        
        # Get current count
        count = cache.get(key) or 0
        
        if count > settings.RATE_LIMIT_MAX:
            return False
            
        # Increment count
        cache.set(
            key,
            count + 1,
            expire=timedelta(minutes=1)
        )
        return True

    def _get_csp_policy(self) -> str:
        """Generuje Content Security Policy"""
        return "; ".join([
            "default-src 'self'",
            "img-src 'self' data: blob:",
            "style-src 'self' 'unsafe-inline'",
            f"connect-src 'self' {settings.API_URL} {settings.WS_URL}",
            "script-src 'self'",
            "frame-ancestors 'none'"
        ])