from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
import logging
import time
import json
from typing import Callable

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("spheroseg-api")

# Add the parent directory to the path so that we can import from parent modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import modules
try:
    # Try importing normally (for development)
    from api import auth, projects, images, segmentation, users
    from db.database import engine
    from models.models import Base
except ImportError:
    # Fall back to absolute imports (for Docker)
    import api.auth as auth
    import api.projects as projects
    import api.images as images
    import api.segmentation as segmentation
    import api.users as users
    from db.database import engine
    from models.models import Base

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="SpherosegAPI",
    description="API for the Spheroseg image segmentation platform",
    version="0.1.0",
    debug=True,  # Enable debug mode
)

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:3000",  # Next.js frontend
    "http://localhost:3001",  # Next.js frontend on alternate port
    "http://localhost:8000",  # FastAPI backend
    "http://minio:9000",      # Minio server
    "http://minio",           # Minio server alternative
]

# Add CORS middleware with specific allowed origins and credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Process-Time", "X-Request-ID"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next: Callable) -> Response:
    request_id = f"{time.time():.7f}"
    logger.info(f"Request {request_id} - {request.method} {request.url.path}")
    
    # Log request headers
    logger.debug(f"Request {request_id} headers: {dict(request.headers)}")
    
    # Try to log request body for specific endpoints
    if request.url.path in ["/auth/token", "/auth/register"]:
        try:
            body = await request.body()
            logger.debug(f"Request {request_id} body: {body}")
            # Reset the request body
            request._body = body
        except Exception as e:
            logger.error(f"Error reading request body: {e}")
    
    # Process the request
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # Log response
    logger.info(f"Response {request_id} - Status: {response.status_code} - Time: {process_time:.4f}s")
    
    # Add custom headers for debugging
    response.headers["X-Process-Time"] = str(process_time)
    response.headers["X-Request-ID"] = request_id
    
    return response

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(images.router)
app.include_router(segmentation.router)

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to the Spheroseg API"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    return {"status": "healthy", "environment": os.environ.get("ENV", "development")}