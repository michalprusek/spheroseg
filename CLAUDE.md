# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpherosegV4 is a cell segmentation application using a microservices architecture:
- **Frontend**: React application with TypeScript, Vite, and Material UI
- **Backend**: Node.js with Express and TypeScript, connected to PostgreSQL
- **ML Service**: Python-based machine learning service for cell segmentation using PyTorch
- **Assets Server**: Static file server for images and resources

## Repository Structure

The project uses a monorepo structure with Turborepo:
- `packages/frontend`: React frontend application
- `packages/backend`: Node.js/Express backend
- `packages/ml`: Python-based machine learning service
- `packages/shared`: Shared code and utilities
- `packages/types`: TypeScript type definitions

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

### Viewing Logs

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
npm run ml:segmentation  # Run cell segmentation
npm run ml:extract       # Extract features from segmented cells
```

### End-to-End Testing

```bash
npm run cypress:open     # Open Cypress test runner
npm run cypress:run      # Run Cypress tests in headless mode
npm run e2e              # Run all end-to-end tests
npm run e2e:open         # Open end-to-end test runner
```

## Troubleshooting

If you encounter issues, try restarting the Docker environment:

```bash
docker-compose down && docker-compose down -v # Remove volumes if needed
docker-compose up -d
```

## Database Access

The PostgreSQL database is accessible at localhost:5432 with:
- Database: spheroseg
- Username: postgres
- Password: postgres

You can also use Adminer at http://localhost:8081 for database management.

## ML Service

The ML service uses a PyTorch model for cell segmentation. The model checkpoint is stored in the `/ML/checkpoint_epoch_9.pth.tar` path inside the ML container.

## Environment Variables

Key environment variables to be aware of:
- `VITE_API_URL`: Backend API URL (http://backend:5001 inside Docker)
- `VITE_API_BASE_URL`: Base URL for API requests
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT authentication
- `MODEL_PATH`: Path to the ML model checkpoint