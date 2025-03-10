from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import httpx
import jwt
from ..config import settings
from ..core.middleware.rate_limit import RateLimiter

class APIGateway:
    def __init__(self):
        self.app = FastAPI(title="SpheroSeg API Gateway")
        self.rate_limiter = RateLimiter()
        self._setup_middleware()
        self._setup_routes()

    def _setup_middleware(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.ALLOWED_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"]
        )

    async def _proxy_request(
        self,
        request: Request,
        service: str,
        path: str
    ) -> Response:
        """Proxy request to appropriate service"""
        async with httpx.AsyncClient() as client:
            url = f"{settings.SERVICES[service]}{path}"
            
            # Forward headers and query params
            headers = dict(request.headers)
            params = dict(request.query_params)
            
            # Forward request body
            body = await request.body()
            
            response = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=params,
                content=body
            )
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers)
            )

    def _setup_routes(self):
        @self.app.get("/health")
        async def health_check():
            return {"status": "healthy"}

        @self.app.api_route("/{service}/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
        async def gateway_route(
            request: Request,
            service: str,
            path: str
        ):
            # Rate limiting check
            if not await self.rate_limiter.check_rate_limit(request):
                return Response(
                    content="Rate limit exceeded",
                    status_code=429
                )

            # Service routing
            if service not in settings.SERVICES:
                return Response(
                    content="Service not found",
                    status_code=404
                )

            return await self._proxy_request(request, service, path)

gateway = APIGateway()
app = gateway.app