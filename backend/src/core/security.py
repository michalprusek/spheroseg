from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from datetime import datetime, timedelta
import time
from typing import Optional, Dict
import re
import hashlib
from ratelimit import RateLimitException, RateLimit

security = HTTPBearer()

class SecurityMiddleware:
    def __init__(self):
        self.rate_limit = RateLimit(requests_per_second=10)
        self.jwt_secret = "your-secret-key"
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 30
        self.refresh_token_expire_days = 7
        
    async def verify_token(self, token: str) -> Dict:
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.algorithm])
            if payload["exp"] < time.time():
                raise HTTPException(status_code=401, detail="Token has expired")
            return payload
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")

    def create_token(self, user_id: str, is_refresh: bool = False) -> str:
        expires_delta = (
            timedelta(days=self.refresh_token_expire_days)
            if is_refresh
            else timedelta(minutes=self.access_token_expire_minutes)
        )
        
        expire = datetime.utcnow() + expires_delta
        payload = {
            "sub": user_id,
            "exp": expire.timestamp(),
            "iat": datetime.utcnow().timestamp(),
            "type": "refresh" if is_refresh else "access"
        }
        return jwt.encode(payload, self.jwt_secret, algorithm=self.algorithm)

    async def validate_request(self, request: Request):
        # Rate limiting
        try:
            await self.rate_limit.check(request.client.host)
        except RateLimitException:
            raise HTTPException(status_code=429, detail="Too many requests")

        # Security headers
        headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Content-Security-Policy": "default-src 'self'",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
        }
        
        for key, value in headers.items():
            request.headers[key] = value

        # Input validation
        await self.validate_input(request)

    async def validate_input(self, request: Request):
        body = await request.body()
        if body:
            # Check for common injection patterns
            patterns = [
                r"<script.*?>.*?</script>",  # XSS
                r"(?i)(?:union|select|insert|update|delete|drop)\s+",  # SQL Injection
                r"\.\.\/",  # Path Traversal
            ]
            
            content = body.decode()
            for pattern in patterns:
                if re.search(pattern, content):
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid input detected"
                    )

    def hash_password(self, password: str) -> str:
        return hashlib.argon2.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return hashlib.argon2.verify(plain_password, hashed_password)