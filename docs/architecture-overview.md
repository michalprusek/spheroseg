# SpherosegV4 Architecture Overview

## Introduction

SpherosegV4 is a comprehensive cell segmentation application that uses computer vision and deep learning to identify and analyze cells in microscopic images. This document provides a high-level overview of the application's architecture after consolidation efforts.

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX Proxy                          │
│                    (SSL, Routing, WebSocket)                 │
└─────────────────┬───────────────┬───────────────┬──────────┘
                  │               │               │
       ┌──────────┴───────┐ ┌────┴──────┐ ┌─────┴──────┐
       │   Frontend (React)│ │ Backend   │ │ ML Service │
       │   Port: 3000      │ │ (Node.js) │ │ (Python)   │
       │                   │ │ Port: 5001│ │ Port: 5002 │
       └───────────────────┘ └─────┬─────┘ └────────────┘
                                   │
                            ┌──────┴──────┐
                            │ PostgreSQL  │
                            │ Port: 5432  │
                            └─────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Libraries**: Material UI + Radix UI + TailwindCSS
- **State Management**: React Query + Context API
- **Form Handling**: React Hook Form + Zod
- **Real-time**: Socket.IO client
- **Routing**: React Router v6

#### Backend
- **Runtime**: Node.js 18
- **Framework**: Express with TypeScript
- **Authentication**: JWT with refresh tokens
- **Database**: PostgreSQL 14
- **Real-time**: Socket.IO server
- **File Processing**: Multer + Sharp
- **Security**: Helmet, CORS, rate limiting

#### ML Service
- **Language**: Python 3.9
- **Framework**: Flask
- **ML Library**: PyTorch
- **Architecture**: ResUNet for segmentation
- **Image Processing**: OpenCV, scikit-image

## Frontend Architecture

### Directory Structure

```
packages/frontend/src/
├── components/          # Reusable UI components
├── contexts/           # React contexts (Auth, Socket, Language)
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── services/           # API and business logic services
├── utils/              # Utility functions
├── lib/                # Third-party integrations
└── types/              # TypeScript type definitions
```

### Core Systems (After Consolidation)

#### 1. Unified Error Handling
```typescript
// Location: /utils/error/unifiedErrorHandler.ts
- Centralized error processing
- Consistent error types and severity levels
- Automatic error logging and reporting
- User-friendly error messages
```

#### 2. Unified Logging System
```typescript
// Location: /utils/logging/unifiedLogger.ts
- Namespace-based logging
- Configurable log levels
- Memory storage for debugging
- Server log shipping capability
```

#### 3. Unified Toast Notifications
```typescript
// Using: sonner library
- Consistent notification styling
- Promise-based notifications
- Auto-dismiss and manual control
- Success/error/warning/info variants
```

#### 4. Unified Form Validation
```typescript
// Location: /utils/validation/
- Centralized Zod schemas
- Reusable form components
- Type-safe form handling
- Consistent validation messages
```

#### 5. Unified Export Service
```typescript
// Location: /services/unifiedExportService.ts
- All export formats in one service
- Progress tracking
- Error handling
- Multiple format support (Excel, CSV, JSON, COCO, YOLO, ZIP, HTML)
```

#### 6. Unified WebSocket Management
```typescript
// Location: /services/unifiedWebSocketService.ts
- Centralized connection management
- Room-based subscriptions
- Event handling with cleanup
- Automatic reconnection
```

### State Management

#### Global State
- **Authentication**: AuthContext with JWT management
- **WebSocket**: UnifiedSocketContext for real-time updates
- **Language**: LanguageContext for i18n

#### Server State
- **React Query**: For API data caching and synchronization
- **Optimistic Updates**: For better UX
- **Background Refetching**: To keep data fresh

#### Local State
- **Component State**: Using useState for UI state
- **Form State**: React Hook Form for form management
- **URL State**: React Router for navigation state

### API Integration

```typescript
// Centralized API client
apiClient.ts
├── Axios instance with interceptors
├── Token management
├── Error handling
└── Request/response logging

// Specialized API modules
api/
├── auth.api.ts         # Authentication endpoints
├── projects.api.ts     # Project management
├── images.api.ts       # Image operations
├── segmentation.api.ts # ML processing
└── users.api.ts        # User management
```

## Backend Architecture

### Directory Structure

```
packages/backend/src/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── middleware/     # Express middleware
├── routes/         # API routes
├── services/       # Business logic
├── db/             # Database operations
├── utils/          # Helper functions
└── server.ts       # Entry point
```

### API Design

#### RESTful Endpoints
```
/api/auth/*         # Authentication
/api/projects/*     # Project CRUD
/api/images/*       # Image management
/api/segmentation/* # ML operations
/api/users/*        # User management
```

#### WebSocket Events
```
Connection Events:
- connect/disconnect
- authentication

Project Events:
- image_added/updated/deleted
- segmentation_started/completed/failed

Queue Events:
- queue_updated
- task_started/completed/failed
```

### Security Implementation

1. **Authentication**
   - JWT with short-lived access tokens
   - Refresh tokens for session management
   - Secure HTTP-only cookies

2. **Authorization**
   - Role-based access control (User, Admin)
   - Resource-level permissions
   - API rate limiting

3. **Data Protection**
   - Input validation with express-validator
   - SQL injection prevention
   - XSS protection with helmet

## Database Schema

### Core Tables

```sql
-- Users and Authentication
users (id, email, password_hash, role, created_at)
refresh_tokens (id, user_id, token, expires_at)

-- Projects and Images
projects (id, user_id, title, description, created_at)
project_images (id, project_id, filename, url, status)

-- Segmentation Results
segmentations (id, image_id, polygons, metrics, created_at)
segmentation_queue (id, image_id, status, priority)

-- Access Control
project_access (user_id, project_id, permission_level)
access_requests (id, email, status, purpose)
```

## ML Service Architecture

### Processing Pipeline

```
1. Image Upload → 2. Preprocessing → 3. Segmentation
       ↓                ↓                    ↓
   Validation      Normalization      ResUNet Model
       ↓                ↓                    ↓
   Storage         Augmentation      Polygon Extraction
                                            ↓
                                    4. Post-processing
                                            ↓
                                     Metric Calculation
                                            ↓
                                     5. Result Storage
```

### Model Architecture

- **Model**: ResUNet (Residual U-Net)
- **Input**: 512x512 RGB images
- **Output**: Binary segmentation masks
- **Post-processing**: Polygon extraction with contour detection

## Deployment Architecture

### Docker Containers

```yaml
services:
  nginx:          # Reverse proxy
  frontend:       # React app (production)
  frontend-dev:   # React app (development)
  backend:        # Node.js API
  ml:             # Python ML service
  db:             # PostgreSQL
  adminer:        # Database admin UI
```

### Environment Configuration

- **Development**: Hot reload, debug logging, local storage
- **Production**: Optimized builds, error tracking, cloud storage
- **Testing**: In-memory database, mocked services

## Performance Optimizations

### Frontend
- Code splitting with React.lazy
- Image lazy loading
- API response caching
- Debounced search inputs
- Virtual scrolling for large lists

### Backend
- Database query optimization
- Redis caching for sessions
- Image processing queue
- Connection pooling
- Gzip compression

### ML Service
- Model caching in memory
- Batch processing support
- GPU acceleration (when available)
- Efficient polygon algorithms

## Monitoring and Logging

### Application Monitoring
- Structured logging with Winston
- Error tracking and alerting
- Performance metrics collection
- Health check endpoints

### Infrastructure Monitoring
- Docker container health checks
- Database connection monitoring
- Disk usage alerts
- Memory usage tracking

## Future Enhancements

### Planned Features
1. Multi-model support for different cell types
2. Real-time collaborative editing
3. Advanced analytics dashboard
4. Mobile application
5. Cloud deployment options

### Technical Improvements
1. Microservices architecture
2. GraphQL API option
3. Kubernetes deployment
4. Automated testing pipeline
5. CI/CD integration

## Development Workflow

### Local Development
```bash
# Start all services
docker-compose up -d

# Frontend development
npm run dev:frontend

# Backend development
npm run dev:backend

# Run tests
npm run test
```

### Code Quality
- ESLint for code linting
- Prettier for formatting
- TypeScript for type safety
- Jest for unit testing
- Cypress for E2E testing

## Conclusion

SpherosegV4's architecture is designed for scalability, maintainability, and performance. The recent consolidation efforts have significantly improved code organization and reduced duplication, making the system more robust and easier to develop.

The modular architecture allows for independent scaling of components and easy addition of new features. The comprehensive type system and testing infrastructure ensure code quality and reliability.