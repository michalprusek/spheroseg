# Spheroseg Backend

Backend for the Spheroseg image segmentation platform. This service provides API endpoints for authenticating users, managing projects, uploading images, and running segmentation tasks.

## Stack

- FastAPI: Modern, high-performance web framework for building APIs
- PostgreSQL: Relational database for storing user data, projects, and metadata
- MinIO: Object storage for images and segmentation masks
- Celery: Distributed task queue for running segmentation tasks
- Redis: Message broker for Celery
- Docker: Containerization for all components

## Setup

### Running with Docker

The easiest way to start the backend is using Docker Compose:

```bash
cd backend
docker-compose up -d
```

This will start all the necessary services:
- PostgreSQL database
- MinIO object storage
- Redis message broker
- FastAPI backend
- Celery worker for segmentation tasks

### Without Docker

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run PostgreSQL, MinIO and Redis separately

3. Set environment variables:
```bash
export DATABASE_URL=postgresql://username:password@localhost:5432/spheroseg
export MINIO_ENDPOINT=localhost:9000
export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
export REDIS_URL=redis://localhost:6379/0
```

4. Start the FastAPI server:
```bash
cd backend
uvicorn app.main:app --reload
```

5. Start the Celery worker:
```bash
cd backend
celery -A worker.celery worker --loglevel=info
```

## API Documentation

Once the server is running, you can access the interactive API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database Migrations

The project uses Alembic for database migrations:

```bash
cd backend
alembic revision --autogenerate -m "Description of the changes"
alembic upgrade head
```