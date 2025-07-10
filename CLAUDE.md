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

# ML Service (Pytest)
cd packages/ml
python -m pytest              # Run all tests
python -m pytest -v           # Verbose output
python -m pytest --cov=app    # Coverage report
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

# Backend (.env)
DATABASE_URL=postgresql://postgres:postgres@db:5432/spheroseg
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost

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
- `images`: Uploaded image metadata (uses segmentation_status: 'without_segmentation', 'queued', 'processing', 'completed', 'failed')
- `segmentation_results`: ML processing results
- `cells`: Individual cell data and features
- `segmentation_queue`: Queue for segmentation tasks (status: 'queued', 'processing', 'completed', 'failed')
- `segmentation_tasks`: Task tracking with task_status enum ('queued', 'processing', 'completed', 'failed')

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
- **Test User**: testuser@test.com / testuser123

## Testing Methodology & Best Practices

### Testing Philosophy
Testing is a critical part of the development process. Every feature, fix, or significant change should include appropriate tests. The goal is to maintain high code quality, prevent regressions, and ensure the application works reliably.

### When to Test

#### ALWAYS write tests when:
1. **Adding new features** - Test the happy path and edge cases
2. **Fixing bugs** - Add tests that would have caught the bug
3. **Refactoring code** - Ensure behavior remains unchanged
4. **Creating utilities** - Test all functions with various inputs
5. **Adding API endpoints** - Test success, error, and validation cases
6. **Creating React components** - Test rendering, interactions, and state changes

#### Test BEFORE committing when:
1. You've made changes to existing functionality
2. You've modified shared utilities or services
3. You're unsure if your changes might break something
4. You're working on critical paths (auth, payments, data processing)

### Testing Strategy by Layer

#### Frontend Testing (Vitest + React Testing Library)
```bash
cd packages/frontend
npm run test                  # Run all tests
npm run test -- --watch       # Watch mode during development
npm run test -- --coverage    # Generate coverage report
```

**What to test:**
- Component rendering with different props
- User interactions (clicks, form submissions)
- State changes and effects
- Error states and loading states
- Accessibility attributes
- Integration with services/API calls (using mocks)

**Example test structure:**
```typescript
describe('ComponentName', () => {
  it('should render with required props', () => {
    // Test basic rendering
  });
  
  it('should handle user interactions', () => {
    // Test clicks, inputs, etc.
  });
  
  it('should display error state', () => {
    // Test error handling
  });
});
```

#### Backend Testing (Jest + Supertest)
```bash
cd packages/backend
npm run test                  # Run all tests
npm run test -- --watch       # Watch mode
npm run test -- --coverage    # Coverage report
```

**What to test:**
- API endpoints (success/error responses)
- Middleware functionality
- Service layer logic
- Database queries (using test database or mocks)
- Authentication and authorization
- Input validation
- Error handling

**Example test structure:**
```typescript
describe('GET /api/resource', () => {
  it('should return 200 with valid data', async () => {
    // Test successful request
  });
  
  it('should return 401 without auth', async () => {
    // Test authentication requirement
  });
  
  it('should validate input parameters', async () => {
    // Test validation
  });
});
```

#### ML Service Testing (Pytest)
```bash
cd packages/ml
python -m pytest              # Run all tests
python -m pytest -v           # Verbose output
python -m pytest --cov=app    # Coverage report
```

**What to test:**
- Model loading and initialization
- Image preprocessing pipeline
- Prediction output format
- API endpoints
- Error handling for invalid inputs
- Performance benchmarks (optional)

### Test Organization

```
packages/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Button.tsx
│       │   └── __tests__/
│       │       └── Button.test.tsx
│       ├── utils/
│       │   ├── validation.ts
│       │   └── __tests__/
│       │       └── validation.test.ts
│       └── services/
│           ├── api.ts
│           └── __tests__/
│               └── api.test.ts
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── users.ts
│       │   └── __tests__/
│       │       └── users.test.ts
│       └── utils/
│           ├── auth.ts
│           └── __tests__/
│               └── auth.test.ts
└── ml/
    ├── app/
    │   └── model.py
    └── tests/
        └── test_model.py
```

### Test Quality Guidelines

1. **Test Names**: Use descriptive names that explain what is being tested
   - ✅ Good: `should return 404 when user not found`
   - ❌ Bad: `test user endpoint`

2. **Test Independence**: Each test should be independent
   - Use `beforeEach`/`afterEach` for setup/teardown
   - Don't rely on test execution order
   - Clean up any created data

3. **Test Coverage**: Aim for >80% coverage but focus on quality
   - Cover critical paths 100%
   - Test edge cases and error conditions
   - Don't write tests just for coverage numbers

4. **Mock External Dependencies**:
   - Mock API calls in frontend tests
   - Mock database calls when testing business logic
   - Mock file system operations
   - Use test databases for integration tests

5. **Performance**: Keep tests fast
   - Mock heavy operations
   - Use test data fixtures
   - Parallelize where possible

### Testing Commands Quick Reference

```bash
# Run all tests in the monorepo
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (frontend)
cd packages/frontend && npm run test -- --watch

# Run tests in watch mode (backend)
cd packages/backend && npm run test -- --watch

# Run specific test file
npm run test -- path/to/test.spec.ts

# Run tests matching pattern
npm run test -- --grep "user authentication"

# Update snapshots (frontend)
cd packages/frontend && npm run test -- -u

# Debug tests (backend)
cd packages/backend && npm run test -- --detectOpenHandles
```

### Continuous Integration

Tests are automatically run on:
1. Every push to the repository
2. Every pull request
3. Before deployment to production

Failed tests will block merging and deployment.

### Test Data Management

1. **Fixtures**: Store test data in `__fixtures__` directories
2. **Factories**: Create factory functions for generating test data
3. **Seeds**: Use database seeds for integration tests
4. **Cleanup**: Always clean up test data after tests

### Common Testing Patterns

#### Testing Async Operations
```typescript
// Using async/await
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// Testing rejected promises
it('should handle errors', async () => {
  await expect(fetchDataWithError()).rejects.toThrow('Error message');
});
```

#### Testing React Hooks
```typescript
import { renderHook, act } from '@testing-library/react';

it('should update state', () => {
  const { result } = renderHook(() => useCustomHook());
  
  act(() => {
    result.current.updateValue('new value');
  });
  
  expect(result.current.value).toBe('new value');
});
```

#### Testing with Mocks
```typescript
// Mock a module
jest.mock('../api');

// Mock a function
const mockFn = jest.fn();
mockFn.mockResolvedValue({ data: 'test' });

// Verify mock calls
expect(mockFn).toHaveBeenCalledWith('expected', 'args');
```

### Debugging Tests

1. **Use focused tests**: `it.only()` or `describe.only()`
2. **Add console.logs**: Temporarily add logging
3. **Use debugger**: Add `debugger` statements
4. **Increase timeout**: For slow operations
5. **Check test environment**: Ensure proper setup

### Test Maintenance

1. **Update tests when code changes**: Keep tests in sync
2. **Remove obsolete tests**: Delete tests for removed features
3. **Refactor test code**: Apply same quality standards as production code
4. **Review test failures**: Don't just fix, understand why they failed
5. **Document complex tests**: Add comments for non-obvious test logic

## Git Workflow & Checkpointing

- **ALWAYS work in the `dev` branch** - never commit directly to `main`
- **Commit to `dev` after EVERY completed action** - use the dev branch as a checkpointing system
- **Commit frequently** - after each feature, fix, or significant change
- **Pull requests** - create PR from `dev` to `main` only when ready for production
- **Commit message format**: Use clear, descriptive messages for each checkpoint

## Recent Updates & Improvements

### Code Quality Improvements (2025-07-08)
1. **TypeScript Type Safety**: Removed all 'as any' casts
   - Created type-safe lazy loading helper in `lazyComponents.ts`
   - Fixed import type issues across the codebase
   - Added proper type definitions for all components

2. **Performance Optimizations**: 
   - Created centralized performance configuration in `config/performance.ts`
   - Implemented dynamic container memory limit detection
   - Added performance monitoring utilities
   - Created React performance optimization hooks (debounce, throttle, virtual lists)
   - Added database indexes for frequently queried columns

3. **Testing Infrastructure**: 
   - Added comprehensive test coverage for new utilities
   - Created tests for polygon operations, container info, static cache, and performance optimizations
   - Established testing methodology and best practices documentation
   - Set up proper test organization structure

4. **Configuration Management**:
   - Moved all magic numbers to centralized configuration files
   - Added environment variable support for all configurable values
   - Created proper defaults with documentation

### Recently Fixed Issues (2025-07-08)
1. **Segmentation Queue Enum Mismatch**: Fixed issue where code used 'pending' but database expected 'queued' status
   - Updated `segmentationQueueService.ts` and `segmentation.ts` routes
   - Added database migration with rollback strategy

2. **Image Status System Overhaul**: Complete refactor of image status system
   - Changed from 'pending' to: 'queued', 'processing', 'completed', 'without_segmentation'
   - Fixed TIFF/BMP thumbnail generation using Sharp
   - Implemented real-time status updates via WebSocket
   - Fixed progress bar updates during image upload

3. **Internationalization**: Replaced Czech hardcoded messages with English
   - Fixed messages in polygon slicing, image actions, and status displays
   - Updated all user-facing text to use i18n translations

4. **Polygon Slicing**: Fixed functionality that was stuck at step 3
   - Created complete `polygonOperations.ts` module with splitPolygon functionality
   - Fixed polygon splitting algorithm implementation
   - Replaced Czech error messages with English

5. **Memory Management**: Fixed incorrect memory usage reporting
   - Now correctly detects container memory limits from cgroup
   - Calculates usage against actual container limits, not heap size
   - Added optional manual garbage collection with performance tracking

### Recently Fixed Issues (2025-07-10 - Latest)
1. **Batch Image Deletion UI Sync**: Fixed issue where images remained visible after batch deletion
   - Modified `handleBatchDelete` in `ProjectDetail.tsx` to only update UI after successful API calls
   - Added proper cache cleanup for deleted images using `cleanImageFromAllStorages`
   - Dispatches `image-deleted` events for each successfully deleted image
   - Only removes successfully deleted images from UI, keeps failed ones

2. **Rate Limiting (429 Errors) Prevention**: Fixed excessive API calls causing rate limit errors
   - Created centralized `pollingManager.ts` to coordinate all API polling
   - Implemented exponential backoff with maximum intervals
   - Added global rate limit cooldown (1 minute after 429 error)
   - Changed polling intervals: initial 10s → max 60s with exponential increase
   - Limited polling to 30 attempts per image to prevent infinite polling
   - Added random initial delay (2-5s) to prevent request bursts on page load
   - Only polls for images in 'processing' or 'queued' status

3. **WebSocket Optimization**: Reduced reliance on polling by improving WebSocket integration
   - WebSocket remains primary method for real-time updates
   - Polling now serves as fallback mechanism only
   - Proper cleanup of WebSocket listeners on component unmount

### Recently Implemented (2025-07-10)
1. **E2E Testing Infrastructure**: Comprehensive Playwright tests for routing
   - Created `e2e/routing/public-routes.spec.ts` with full navigation tests
   - Added Playwright configuration with multiple browser support
   - Tests cover all public pages and verify content loads correctly
   - Added WCAG accessibility compliance tests
   - Implemented performance benchmarks with baselines
   - Added test result caching for faster development cycles

2. **ESLint Import Validation**: Comprehensive import checking rules
   - Created custom ESLint rule for enforcing lazy imports in App.tsx
   - Added pre-commit hooks for import validation
   - Created documentation in `docs/eslint-import-rules.md`
   - Converted check-imports script to async for better performance

3. **Centralized Configuration with Validation**: All app settings in one place
   - Created `config/app.config.validated.ts` with Zod schema validation
   - Runtime validation ensures configuration integrity
   - Updated all components to use centralized configuration
   - Added comprehensive tests for configuration
   - Type-safe configuration with helper functions

### Current Architecture Patterns

#### Performance Patterns
- **Lazy Loading**: Type-safe component lazy loading with fallbacks
- **Memoization**: React.memo with custom comparison for expensive components
- **Virtual Lists**: For rendering large datasets efficiently
- **Debouncing/Throttling**: For search inputs and scroll handlers
- **Static Asset Caching**: Aggressive caching for images, fonts, and scripts
- **Test Caching**: MD5-based test result caching for faster test runs

#### Error Handling Patterns
- **Graceful Degradation**: Fallback components for lazy loading failures
- **Rollback Strategies**: All database migrations include rollback scripts
- **Error Boundaries**: Global error catching with user-friendly messages
- **Retry Logic**: Automatic retry for transient failures

#### Testing Patterns
- **Co-location**: Tests live next to the code they test in `__tests__` directories
- **Mock First**: External dependencies are mocked by default
- **Integration Tests**: Critical paths have full integration tests
- **Performance Tests**: Memory leak detection and performance benchmarks
- **Accessibility Tests**: WCAG compliance testing for all public pages

### Development Environment Setup

#### Required ESLint Dependencies (Backend)
If you encounter ESLint configuration errors, install:
```bash
cd packages/backend
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

#### Memory Settings
The application dynamically detects container memory limits. You can override with:
```bash
# Backend container memory limit (default: 512MB)
CONTAINER_MEMORY_LIMIT_MB=1024

# Enable manual garbage collection (use sparingly)
ENABLE_MANUAL_GC=true
NODE_OPTIONS="--expose-gc"
```

### Database Migrations

All migrations now include rollback scripts. To rollback a migration:
```bash
# Connect to database
docker-compose exec db psql -U postgres -d spheroseg

# Run rollback script (example)
\i /rollback/009_add_performance_indexes_rollback.sql
```

### Performance Monitoring

The application includes built-in performance monitoring:
- Memory usage tracking with container awareness
- Database query performance logging
- API endpoint response time tracking
- WebSocket connection monitoring
- Test performance tracking with caching metrics

Enable detailed monitoring:
```bash
# In backend .env
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_LOG_LEVEL=debug
```

### Current Issues Resolved
1. **High Memory Usage**: Backend memory optimization implemented
   - Container-aware memory tracking
   - Optional manual garbage collection
   - Performance configuration centralized

2. **TypeScript Errors**: All type errors fixed
   - Removed all 'as any' casts
   - Created type-safe utilities
   - Updated test files with proper types

3. **ESLint Configuration**: All dependencies properly configured
   - Custom ESLint rules for import validation
   - Pre-commit hooks ensure code quality
   - Comprehensive documentation provided
