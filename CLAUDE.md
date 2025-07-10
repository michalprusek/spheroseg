# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpherosegV4 is a cell segmentation application that uses computer vision and deep learning to identify and analyze cells in microscopic images. This is a monorepo managed by Turborepo with microservices architecture deployed via Docker Compose.

## Repository Structure

```
spheroseg/
├── packages/
│   ├── frontend/         # React + TypeScript + Vite + Material UI
│   ├── backend/          # Node.js + Express + TypeScript + PostgreSQL
│   ├── ml/               # Python + Flask + PyTorch (ResUNet model)
│   ├── shared/           # Shared utilities between packages
│   ├── types/            # TypeScript type definitions
│   └── frontend-static/  # Static assets
├── docs/                 # Architecture and consolidation documentation
├── docker-compose.yml    # Container orchestration
└── turbo.json           # Turborepo pipeline configuration
```

## Essential Commands

### Development Workflow

```bash
# Start development with hot reload
docker-compose --profile dev up -d

# Start production mode
docker-compose --profile prod up -d

# View logs
docker-compose logs -f [frontend-dev|backend|ml|db]

# Access containers
docker-compose exec [service-name] sh
docker-compose exec db psql -U postgres -d spheroseg
```

### Monorepo Commands

```bash
# Development
npm run dev              # Run all services in dev mode
npm run dev:frontend     # Run only frontend
npm run dev:backend      # Run only backend

# Code Quality (ALWAYS run before committing)
npm run lint             # Check linting
npm run lint:fix         # Fix linting issues
npm run format           # Format code
npm run code:check       # Run all checks
npm run code:fix         # Fix all issues

# Testing
npm run test             # Run all tests
npm run test:frontend    # Test frontend only
npm run test:backend     # Test backend only
npm run test:ml          # Test ML service
npm run test:coverage    # Generate coverage reports

# Build & Deploy
npm run build            # Build all packages
npm run preview          # Preview production build

# Database
npm run init:db          # Initialize database
npm run db:migrate       # Run migrations
npm run db:create-test-user  # Create test user (dev only)
```

### Running Individual Tests

```bash
# Frontend (Vitest)
cd packages/frontend
npm run test -- path/to/test.spec.ts
npm run test -- --watch  # Watch mode

# Backend (Jest)
cd packages/backend
npm run test -- path/to/test.spec.ts
npm run test -- --watch  # Watch mode
```

## Architecture & Key Patterns

### Frontend Architecture
- **Unified Services Pattern**: All API calls go through centralized services in `packages/frontend/src/services/`
- **State Management**: React Context for global state, local state for components
- **Routing**: React Router v6 with protected routes
- **Real-time Updates**: Socket.IO integration for live notifications
- **Error Handling**: Unified error boundary and toast notifications

### Backend Architecture
- **Modular Routes**: Routes organized by feature in `packages/backend/src/routes/`
- **Authentication**: JWT with refresh tokens, middleware in `packages/backend/src/middleware/auth.ts`
- **Database**: PostgreSQL with raw SQL queries (no ORM)
- **File Processing**: Integration with ML service via HTTP calls
- **WebSocket**: Socket.IO for real-time events

### ML Service Architecture
- **Model**: ResUNet for cell segmentation in `packages/ml/app/model/`
- **API**: Flask endpoints for segmentation and feature extraction
- **Processing Pipeline**: Image → Preprocessing → Model → Polygon Extraction → Features
- **Model Checkpoint**: `packages/ml/checkpoint_epoch_9.pth.tar`

### Cross-Service Communication
```
Frontend <-> NGINX <-> Backend <-> ML Service
                   \-> Assets Server
```

## Service URLs

- **Frontend Dev**: http://localhost:3000
- **Frontend Prod**: http://localhost
- **Backend API**: http://localhost:5001
- **ML Service**: http://localhost:5002
- **Database**: localhost:5432
- **Adminer**: http://localhost:8081

## Critical Configuration

### Environment Variables
```bash
# Frontend (.env)
VITE_API_URL=http://localhost:5001
VITE_API_BASE_URL=/api
VITE_ASSETS_URL=http://localhost:8080
# Logging (optional - defaults shown)
VITE_LOG_LEVEL=INFO               # DEBUG, INFO, WARN, ERROR, NONE
VITE_ENABLE_CONSOLE_LOGS=true     # Enable/disable console output
VITE_ENABLE_LOG_SHIPPING=false    # Ship logs to backend

# Backend (.env)
DATABASE_URL=postgresql://postgres:postgres@db:5432/spheroseg
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost
# Logging (optional - defaults shown)
LOG_LEVEL=info                    # error, warn, info, http, verbose, debug, silly
LOG_TO_FILE=false                 # Enable file logging
LOG_DIR=./logs                    # Directory for log files

# ML Service
MODEL_PATH=/app/checkpoint_epoch_9.pth.tar
```

### TypeScript Configuration
- Strict mode enabled
- Path aliases configured in tsconfig.json
- Shared types in `packages/types/`

### Testing Setup
- Frontend: Vitest + React Testing Library
- Backend: Jest + Supertest
- ML: Pytest
- E2E: Cypress (configuration in root)

## Database Schema

Key tables:
- `users`: User authentication and profile
- `images`: Uploaded image metadata
  - `status`: General image lifecycle state ('pending', 'queued', 'completed') - tracks upload/processing
  - `segmentation_status`: ML segmentation state ('without_segmentation', 'queued', 'processing', 'completed', 'failed') - tracks AI analysis
- `segmentation_results`: ML processing results
- `cells`: Individual cell data and features

**Important**: When checking for completed segmentations, use `segmentation_status = 'completed'`, not `status = 'completed'`
- `segmentation_queue`: Queue for segmentation tasks (uses 'queued' status, not 'pending')
- `segmentation_tasks`: Task tracking (uses 'queued' status, not 'pending')

## Unified Systems

The codebase has undergone consolidation efforts documented in `/docs/consolidation/`:

1. **Toast Notifications**: Centralized in `ToastService`
2. **API Clients**: Unified service pattern
3. **Error Handling**: Global error boundaries and handlers
4. **Logging**: Centralized logger utility
5. **Form Validation**: Consistent validation patterns
6. **Date Utilities**: Unified date formatting
7. **Export Functions**: Centralized export logic
8. **WebSocket Management**: Single connection manager
9. **Application Configuration**: Centralized in `packages/frontend/src/config/app.config.ts`
   - All contact information, URLs, and organization details
   - Feature flags and environment-specific settings
   - Type-safe configuration with helper functions

## Code Quality Patterns

### Import Management
- **Lazy Loading**: All page components use React.lazy() with error boundaries
- **Import Validation**: Pre-commit hooks validate all imports
- **Path Aliases**: Use `@/` for src imports, avoid relative paths
- **Import Order**: External deps → Internal modules → Local files → Types

### Testing Patterns
- **E2E Tests**: Playwright for user flows and navigation
- **Unit Tests**: Vitest for components, utilities, and services
- **Test Organization**: Tests in `__tests__` folders next to source
- **Test Coverage**: Aim for >80% on critical paths
- **Mock Strategy**: Mock external dependencies, use real implementations when possible

### Configuration Management
- **Centralized Config**: All app settings in `app.config.ts`
- **Environment Variables**: Use for secrets and environment-specific values
- **Type Safety**: Configuration object is fully typed with const assertion
- **Helper Functions**: Provide getters for common config values

## Development Tips

1. **Before Making Changes**: Run `npm run code:check` to ensure clean baseline
2. **After Changes**: Always run `npm run code:fix` before committing
3. **Testing**: Write tests for new features, run existing tests before pushing
4. **Database Changes**: Create migration files, don't modify schema directly
5. **API Changes**: Update both backend routes and frontend services
6. **ML Model Updates**: Test with sample images before deploying
7. **Using Context7**: Frequently use the Context7 MCP tool to get up-to-date documentation for libraries and frameworks
8. **Pre-commit Hooks**: Automatically run import checks, linting, and tests
9. **Configuration Changes**: Update `app.config.ts` for any contact info or URLs

## System Credentials

- **Sudo Password**: Cinoykty
- **Test User**: testuser3@test.com / password123

## Git Workflow & Checkpointing

- **ALWAYS work in the `dev` branch** - never commit directly to `main`
- **Commit to `dev` after EVERY completed action** - use the dev branch as a checkpointing system
- **Commit frequently** - after each feature, fix, or significant change
- **Pull requests** - create PR from `dev` to `main` only when ready for production
- **Commit message format**: Use clear, descriptive messages for each checkpoint

## Known Issues & Recent Fixes

### Recently Fixed (2025-07-08)
1. **Segmentation Queue Enum Mismatch**: Fixed issue where code used 'pending' but database expected 'queued' status
   - Updated `segmentationQueueService.ts` and `segmentation.ts` routes
2. **Image Status System Overhaul**: Complete refactor of image status system
   - Changed from 'pending' to: 'queued', 'processing', 'completed', 'without_segmentation'
   - Fixed TIFF/BMP thumbnail generation using Sharp
   - Implemented real-time status updates via WebSocket
   - Fixed progress bar updates during image upload
3. **Internationalization**: Replaced Czech hardcoded messages with English
   - Fixed messages in polygon slicing, image actions, and status displays
   - Updated all user-facing text to use i18n translations
4. **Polygon Slicing**: Fixed functionality that was stuck at step 3
   - Created missing `polygonOperations.ts` module
   - Fixed polygon splitting algorithm implementation
   - Replaced Czech error messages with English

### Recently Implemented (2025-07-10)
1. **E2E Testing Infrastructure**: Comprehensive Playwright tests for routing
   - Created `e2e/routing/public-routes.spec.ts` with full navigation tests
   - Added Playwright configuration with multiple browser support
   - Tests cover all public pages and verify content loads correctly
2. **ESLint Import Validation**: Comprehensive import checking rules
   - Created custom ESLint rule for enforcing lazy imports in App.tsx
   - Added pre-commit hooks for import validation
   - Created documentation in `docs/eslint-import-rules.md`
3. **Centralized Configuration**: All app settings in one place
   - Created `config/app.config.ts` with all contact info, URLs, and settings
   - Updated all components to use centralized configuration
   - Added comprehensive tests for configuration
   - Type-safe configuration with helper functions

### Current Issues
1. **High Memory Usage**: Backend showing 92.5% memory utilization
   - May need container memory limit increase or optimization
2. **TypeScript Errors**: Multiple type errors in test files and some components
   - `toastService.ts` had to be renamed to `.tsx` due to JSX usage
   - Various test files have outdated type definitions
3. **ESLint Configuration**: Backend ESLint config missing dependencies
   - `@typescript-eslint/recommended` config not found