# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpherosegV4 is a cell segmentation application that uses computer vision and deep learning to identify and analyze cells in microscopic images. The application consists of:

- **Frontend**: React application with TypeScript, Vite, and Material UI components
- **Backend**: Node.js API server with Express and TypeScript, with PostgreSQL database
- **ML Service**: Python-based machine learning service using PyTorch for cell segmentation
- **Assets Server**: Static file server for images and resources
- **NGINX**: Reverse proxy for routing requests and handling SSL

## Repository Structure

This project uses a monorepo structure with Turborepo:

- `packages/frontend`: React frontend application 
- `packages/backend`: Node.js/Express backend API
- `packages/ml`: Python ML service with PyTorch model for cell segmentation
- `packages/shared`: Shared utilities and code between packages
- `packages/types`: TypeScript type definitions
- `packages/frontend-static`: Static assets for the frontend

## Development Environment

### Running the Application

**Standard Mode:**
```bash
docker-compose up -d
```
The application will be available at http://localhost

**Development Mode with Hot Reload:**
```bash
docker-compose up -d frontend-dev
```
The development server will be available at http://localhost:3000

### Viewing Container Logs

```bash
docker-compose logs -f frontend-dev  # Frontend development logs
docker-compose logs -f backend       # Backend logs
docker-compose logs -f ml            # ML service logs
docker-compose logs -f db            # Database logs
```

### Accessing Containers

```bash
docker-compose exec frontend-dev sh  # Access frontend dev container
docker-compose exec backend sh       # Access backend container
docker-compose exec ml sh            # Access ML service container
docker-compose exec db psql -U postgres -d spheroseg  # Access database
```

## Common Development Commands

### Turborepo Commands

```bash
npm run dev              # Run development servers for all packages
npm run dev:frontend     # Run only frontend development server
npm run dev:backend      # Run only backend development server
npm run build            # Build all packages
npm run preview          # Preview built applications
npm run lint             # Lint all packages
npm run lint:fix         # Fix linting issues in all packages
npm run format           # Format code in all packages
npm run format:check     # Check code formatting in all packages
npm run test             # Run tests for all packages
npm run test:coverage    # Run tests with coverage reports
npm run test:ci          # Run tests in CI mode
npm run test:frontend    # Run only frontend tests
npm run test:backend     # Run only backend tests
npm run test:ml          # Run ML service tests
npm run code:check       # Run all code quality checks
npm run code:fix         # Fix all code quality issues
npm run clean            # Clean build artifacts
npm run duplicates       # Check for duplicate code with jscpd
```

### Database Commands

```bash
npm run init:db          # Initialize the database
npm run init:db:docker   # Initialize the database in Docker
npm run db:migrate       # Run database migrations
npm run db:create-test-user  # Create a test user for development
```

### ML Service Commands

```bash
npm run ml:segmentation  # Run cell segmentation algorithm
npm run ml:extract       # Extract features from segmented cells
```

### End-to-End Testing

```bash
npm run cypress:open     # Open Cypress test runner
npm run cypress:run      # Run Cypress tests in headless mode
npm run e2e              # Run all end-to-end tests
npm run e2e:open         # Open end-to-end test runner
```

## Services Architecture

### Frontend

- React application with TypeScript
- Material UI for components
- Vite for build and development
- Socket.IO for real-time updates
- i18next for internationalization

### Backend

- Node.js with Express and TypeScript
- JWT authentication
- PostgreSQL database
- RESTful API endpoints
- Python integration for ML processing

### ML Service

- Python Flask application
- PyTorch for deep learning
- ResUNet architecture for segmentation
- Cell polygon extraction algorithm
- Pre-trained model in `checkpoint_epoch_9.pth.tar`

### Database

- PostgreSQL 14
- User authentication tables
- Image metadata storage
- Cell analysis results

## Key Environment Variables

Frontend:
- `VITE_API_URL`: Backend API URL
- `VITE_API_BASE_URL`: Base URL for API requests
- `VITE_API_AUTH_PREFIX`: Auth API path prefix
- `VITE_API_USERS_PREFIX`: Users API path prefix
- `VITE_ASSETS_URL`: URL for the assets server

Backend:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT tokens
- `ALLOWED_ORIGINS`: CORS allowed origins
- `MAX_UPLOAD_SIZE`: Maximum file upload size

ML Service:
- `MODEL_PATH`: Path to the ML model checkpoint
- `DEBUG`: Enable debug mode for development

## Authentication

The application uses JWT-based authentication with tokens stored in localStorage. The backend provides `/auth/login` and `/auth/register` endpoints for authentication.

## Database Access

The PostgreSQL database runs in a Docker container and is accessible at localhost:5432 with:
- Database: spheroseg
- Username: postgres
- Password: postgres

You can also use Adminer at http://localhost:8081 for database management.

## Troubleshooting

If you encounter issues, try restarting the Docker environment:

```bash
docker-compose down && docker-compose up -d
```

For more detailed logs:

```bash
docker-compose logs -f
```