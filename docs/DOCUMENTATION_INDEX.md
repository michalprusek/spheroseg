# SpheroSeg Documentation Index

A comprehensive index of all documentation for the SpheroSeg cell segmentation application.

## 📖 Quick Navigation

### Core Documentation
- [Project Overview](../CLAUDE.md) - Essential project information and developer guidance
- [System Architecture](./architecture/system-overview.md) - High-level system design and components
- [API Developer Guide](./api/api-developer-guide.md) - Complete API reference with examples
- [Getting Started](./README.md) - Documentation overview and quick links

### 🏗️ Architecture & Design

#### System Architecture
- **[System Overview](./architecture/system-overview.md)** - Complete system architecture with performance metrics
- **[Technology Stack](./architecture/tech-stack.md)** - Technologies, frameworks, and tools used
- **[Database Schema](./architecture/database-schema.md)** - Database design and relationships
- **[Security Architecture](./architecture/security.md)** - Security measures and authentication systems

#### Performance & Optimization
- **Performance Achievements**: 84% faster queries, 93% faster rendering, 76% memory reduction
- **Caching Strategy**: Redis implementation with 85% cache hit rates
- **Database Optimization**: CTE-based queries reducing 15+ queries to 2-3
- **Frontend Optimization**: React.memo, virtual scrolling, lazy loading

### 🛠️ Development & Operations

#### Setup & Configuration
- **[Development Setup](./development/setup.md)** - Local development environment setup
- **[Docker Configuration](../docker-compose.yml)** - Container orchestration (dev/prod profiles)
- **[Environment Variables](../CLAUDE.md#critical-configuration)** - Essential configuration settings
- **[Pre-commit Hooks](../CLAUDE.md#pre-commit-quality-gates)** - Automated quality gates

#### Code Quality & Standards
- **[Code Standards](./development/code-standards.md)** - Coding conventions and patterns
- **[Testing Strategy](../CLAUDE.md#testing-methodology--best-practices)** - Comprehensive testing approach
- **[Import Management](../CLAUDE.md#import-management)** - Module organization and lazy loading
- **[TypeScript Configuration](../CLAUDE.md#typescript-configuration)** - Type safety and configuration

#### Development Workflow
```bash
# Essential Commands
npm run dev              # Start development environment
npm run code:check       # Validate code quality
npm run test             # Run all tests
npm run build            # Build for production
```

### 🔌 API Documentation

#### API Reference
- **[Complete API Guide](./api/api-developer-guide.md)** - Comprehensive developer guide with examples
- **[API Overview](./api/README.md)** - Quick start and basic usage
- **[OpenAPI Specification](./api/openapi.yaml)** - Machine-readable API specification
- **[Authentication Guide](./api/authentication.md)** - JWT authentication and authorization

#### WebSocket Events
- **[Real-time Events](./api/websocket-events.md)** - WebSocket communication patterns
- **Segmentation Progress**: Real-time ML processing updates
- **Project Updates**: Live project and image notifications

#### Backend Route Documentation
All route files include comprehensive JSDoc documentation:
- **[Authentication Routes](../packages/backend/src/routes/auth.ts)** - User authentication and token management
- **[User Routes](../packages/backend/src/routes/users.ts)** - User profile and statistics
- **[Project Routes](../packages/backend/src/routes/projects.ts)** - Project management operations
- **[Image Routes](../packages/backend/src/routes/images.ts)** - Image upload and management
- **[Segmentation Routes](../packages/backend/src/routes/segmentation.ts)** - ML processing operations

### 🧪 Testing & Quality Assurance

#### Testing Infrastructure
- **[Testing Methodology](../CLAUDE.md#testing-methodology--best-practices)** - Complete testing strategy
- **Frontend Tests**: Vitest + React Testing Library (189 tests)
- **Backend Tests**: Jest + Supertest with integration testing
- **E2E Tests**: Playwright for user workflows and accessibility
- **ML Tests**: Pytest for model validation

#### Test Coverage & Quality
```bash
# Test Commands
npm run test             # All tests
npm run test:coverage    # Coverage reports
npm run test:frontend    # Frontend only
npm run test:backend     # Backend only
npm run test:ml          # ML service tests
```

#### Performance Testing
- **Integration Tests**: `packages/backend/src/__tests__/integration/performance.integration.test.ts`
- **E2E Performance**: `e2e/performance/performance-optimizations.spec.ts`
- **Test Runners**: `run-performance-tests.sh` and `test-performance-demo.js`

### 🔄 System Consolidation

#### Unified Systems
- **[Consolidation Overview](./consolidation/overview.md)** - Summary of unification efforts
- **[Toast Notifications](./consolidation/toast-system.md)** - Centralized notification system
- **[API Clients](./consolidation/api-clients.md)** - Unified service patterns
- **[Error Handling](./consolidation/error-handling.md)** - Global error management
- **[Logging System](./consolidation/logging.md)** - Structured logging approach
- **[Form Validation](./consolidation/form-validation.md)** - Consistent validation patterns

#### Configuration Management
- **[App Configuration](../packages/frontend/src/config/app.config.ts)** - Centralized configuration
- **Type-safe Settings**: All configuration with TypeScript types
- **Feature Flags**: Environment-specific behavior control

### 📊 Performance & Monitoring

#### Performance Metrics (Before → After)
| Metric | Before | After | Improvement |
|--------|---------|--------|-------------|
| User Stats Query | 500ms | 80ms | 84% faster |
| Image Grid (1000 items) | 3s | 200ms | 93% faster |
| Memory Usage | 500MB | 120MB | 76% reduction |
| API Response Time | 250ms | 100ms | 60% faster |
| Static Bandwidth | 100MB | 40MB | 60% reduction |

#### Monitoring & Observability
- **Performance Monitoring**: Custom metrics with response time tracking
- **Error Tracking**: Structured logging with correlation IDs
- **Resource Monitoring**: Memory, CPU, and database performance
- **WebSocket Monitoring**: Connection health and fallback management

### 🐳 Deployment & Infrastructure

#### Production Deployment NEW!
- **[Deployment Guide](./DEPLOYMENT.md)** - Complete production deployment instructions
- **[Operations Runbook](./OPERATIONS.md)** - Daily operations and troubleshooting
- **[Architecture Documentation](./ARCHITECTURE.md)** - System design and technical details
- **[API Documentation](./API.md)** - Comprehensive API reference with examples

#### Container Architecture
```yaml
# Docker Services
services:
  frontend-dev:     # React dev server (hot reload)
  frontend-prod:    # Optimized production build
  backend:          # Node.js API with TypeScript
  ml:              # Python ML service with PyTorch
  db:              # PostgreSQL 14 with optimizations
  redis:           # Cache and session store
  nginx-dev:       # Development proxy
  nginx-prod:      # Production proxy with security
  backup:          # Automated backup service (production)
```

#### Service URLs
- **Frontend Dev**: http://localhost:3000
- **Frontend Prod**: http://localhost
- **Backend API**: http://localhost:5001
- **ML Service**: http://localhost:5002
- **Database**: localhost:5432
- **Redis Cache**: localhost:6379
- **Monitoring**: Prometheus (9090), Grafana (3001), AlertManager (9093)

### 🔒 Security & Authentication

#### Security Architecture
- **JWT Authentication**: RS256 signing with refresh token rotation
- **Session Management**: Redis-backed token storage
- **API Security**: CORS, CSRF protection, rate limiting
- **Infrastructure Security**: HTTPS, security headers, container isolation
- **Data Protection**: Encryption at rest and in transit

#### Authentication Flow
1. User registers/logs in → JWT tokens issued
2. Access token (15min) + Refresh token (7 days)
3. Automatic token refresh on expiration
4. Session invalidation on logout

### 🧬 Machine Learning & Processing

#### ML Architecture
- **Model**: ResUNet for cell segmentation
- **Checkpoint**: `packages/ml/checkpoint_epoch_9.pth.tar`
- **Processing Pipeline**: Image → Preprocessing → Model → Polygon Extraction
- **Supported Formats**: JPEG, PNG, TIFF, BMP
- **Queue System**: Redis-based task management

#### Segmentation Workflow
1. Image upload → Validation → Storage
2. Segmentation trigger → Queue task
3. ML processing → Real-time progress updates
4. Result storage → WebSocket notification
5. Polygon data → Export capabilities

### 📱 Frontend Architecture

#### Technology Stack
- **Framework**: React 18 + TypeScript + Vite
- **UI Components**: Material UI + Radix UI + Tailwind CSS
- **State Management**: React Query + Context API
- **Real-time**: Socket.IO with reconnection logic
- **Performance**: React.memo, virtual scrolling, lazy loading

#### Key Features
- **Interactive Canvas**: Image annotation and visualization
- **Real-time Updates**: Live segmentation progress
- **Multi-language**: i18n with dynamic loading
- **PWA Capabilities**: Offline support and caching
- **Responsive Design**: Mobile-first approach

### 🗄️ Database & Storage

#### Database Schema
```sql
-- Core Tables
users              # User authentication and profiles
projects           # Project organization
images             # Image metadata and storage
segmentation_results # ML processing results
cells              # Individual cell data
segmentation_queue  # Processing queue
```

#### Storage Management
- **File Storage**: Local filesystem with S3 compatibility
- **Image Processing**: Sharp for thumbnails and format conversion
- **Storage Limits**: 10GB per user (configurable)
- **Cleanup**: Automatic cleanup on project deletion

### 🚀 Performance Optimizations

#### Database Performance (84% improvement)
- **CTE Queries**: Reduced 15+ queries to 2-3 for statistics
- **Composite Indexes**: Optimized for common query patterns
- **Connection Pooling**: Efficient database connection management
- **Query Monitoring**: Performance tracking and optimization

#### Frontend Performance (93% improvement)
- **React.memo**: Optimized component re-rendering
- **Virtual Scrolling**: Efficient large list rendering
- **Code Splitting**: Route-based and component-based splitting
- **Asset Optimization**: Aggressive caching and compression

#### Backend Performance (60% improvement)
- **Redis Caching**: API response and session caching
- **Request Deduplication**: Preventing duplicate API calls
- **Async Operations**: Non-blocking file and image operations
- **Memory Management**: Garbage collection and leak prevention

### 🔍 Troubleshooting & Debugging

#### Common Issues
1. **TypeScript Errors**: 271 remaining (import paths, missing types)
2. **Test Failures**: 111/189 frontend tests (i18n mocks, navigation context)
3. **Backend Issues**: Czech messages, API health endpoint
4. **Code Quality**: 497 ESLint warnings

#### Debug Tools
```bash
# Debugging Commands
docker-compose logs -f [service]     # Service logs
npm run test -- --watch              # Test debugging
npm run lint                         # Code quality check
docker-compose exec db psql ...      # Database access
```

#### Performance Debugging
- **Performance Monitoring**: `/api/performance/metrics` endpoint
- **Memory Profiling**: Container memory usage tracking
- **Query Analysis**: Database query performance logging
- **WebSocket Debugging**: Connection and message monitoring

### 📚 Learning Resources

#### Documentation Standards
- **Markdown**: All documentation in Markdown format
- **Code Examples**: Language-specific syntax highlighting
- **API Documentation**: OpenAPI 3.0 compliance
- **Architecture Diagrams**: Mermaid.js syntax

#### Best Practices
- **Development**: Test-driven development, code review process
- **Performance**: Measurement-driven optimization, caching strategies
- **Security**: Defense in depth, zero trust principles
- **Deployment**: Blue-green deployment, rollback strategies

### 📁 Documentation Organization

The documentation has been reorganized into logical categories:

#### Analysis & Research
- **[docs/analysis/](./analysis/)** - System analysis, architecture studies, dependency analysis
- **[docs/fixes/](./fixes/)** - Bug fixes, issue resolutions, and implementation summaries
- **[docs/performance/](./performance/)** - Performance analysis, optimizations, and troubleshooting
- **[docs/testing/](./testing/)** - Test reports, fixes, and quality assurance documentation

#### Deployment & Infrastructure
- **[docs/deployment/](./deployment/)** - SSL setup, CDN integration, bundle optimization
- **[docs/infrastructure/](./infrastructure/)** - Message queues, scaling, monitoring guides
- **[docs/security/](./security/)** - Security audits, dependency management

#### Historical Documentation
- **[docs/historical/](./historical/)** - Legacy documentation and historical summaries

### 🔄 Recent Updates & Changelog

#### Production Documentation Suite (2025-07-19)
1. **Deployment Guide**: Complete production deployment instructions with security
2. **Operations Runbook**: Daily operations, troubleshooting, and incident response
3. **Architecture Documentation**: System design, technology stack, and future roadmap
4. **API Documentation**: Comprehensive API reference with examples and code samples

#### Project Cleanup & Organization (2025-07-15)
1. **Documentation Reorganization**: Moved all analysis, fixes, and reports to organized docs/ structure
2. **Root Directory Cleanup**: Removed temporary files, test scripts, and redundant configurations
3. **README.md Update**: Complete rewrite with modern structure and clear navigation
4. **Script Organization**: Moved utility scripts to scripts/ directory with proper categorization

#### Latest Improvements (2025-07-10)
1. **Performance Optimizations**: 84% faster database queries, 93% faster rendering
2. **Batch Deletion Fix**: UI sync issues resolved for batch image deletion
3. **Rate Limiting Prevention**: Exponential backoff and centralized polling
4. **WebSocket Optimization**: Reduced polling reliance, improved real-time updates

#### Code Quality Improvements (2025-07-08)
1. **TypeScript Safety**: Removed all 'as any' casts, proper type definitions
2. **Memory Management**: Container-aware memory detection and cleanup
3. **Testing Infrastructure**: Comprehensive test coverage for utilities
4. **Configuration Management**: Centralized settings with environment support

### 🎯 Current Status & Roadmap

#### ✅ Completed
- [x] Comprehensive API documentation with JSDoc
- [x] Performance optimizations (84% database, 93% frontend)
- [x] Testing infrastructure with E2E and integration tests
- [x] Code quality improvements and TypeScript safety
- [x] Documentation consolidation and indexing

#### ⚠️ Known Issues
- [ ] TypeScript build errors (271 remaining)
- [ ] Frontend test failures (111/189 tests)
- [ ] ESLint warnings (497 remaining)
- [ ] Czech message translations

#### 🚀 Future Roadmap
- [ ] Complete TypeScript migration
- [ ] Achieve >90% test coverage
- [ ] Kubernetes deployment support
- [ ] Advanced ML model features
- [ ] Multi-tenant architecture

---

## 📞 Support & Contact

### Development Team
- **Email**: spheroseg@utia.cas.cz
- **Documentation**: https://docs.spherosegapp.utia.cas.cz
- **GitHub**: Repository issues and discussions

### System Credentials
- **Test User**: testuser@test.com / testuser123
- **Sudo Password**: Cinoykty
- **Database**: postgres / postgres

---

**Last Updated**: 2025-07-15
**Documentation Version**: v1.2.0
**API Version**: v1.0.0

This index provides comprehensive navigation to all SpheroSeg documentation. For specific technical details, refer to the linked documents or contact the development team.