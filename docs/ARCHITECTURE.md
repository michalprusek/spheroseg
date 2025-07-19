# SpherosegV4 Architecture Documentation

This document provides a comprehensive overview of the SpherosegV4 system architecture, design decisions, and technical implementation details.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [System Components](#system-components)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Security Architecture](#security-architecture)
7. [Performance Architecture](#performance-architecture)
8. [Deployment Architecture](#deployment-architecture)
9. [Monitoring Architecture](#monitoring-architecture)
10. [Future Considerations](#future-considerations)

## System Overview

SpherosegV4 is a microservices-based cell segmentation application designed for analyzing microscopic images using deep learning. The system follows a modern cloud-native architecture with containerized services, horizontal scalability, and comprehensive monitoring.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │   Nginx    │ (Load Balancer, SSL Termination)
                    │  Reverse   │
                    │   Proxy    │
                    └─────┬─────┘
                          │
        ┌─────────────────┼─────────────────┬────────────────┐
        │                 │                 │                │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐     ┌─────▼────┐
   │Frontend │      │ Backend │      │   ML    │     │  Assets  │
   │ (React) │      │ (Node)  │      │(Python) │     │ (Static) │
   └─────────┘      └────┬────┘      └────┬────┘     └──────────┘
                         │                 │
                    ┌────▼────┐            │
                    │   DB    │◄───────────┘
                    │(Postgres)│
                    └─────────┘
                         │
                    ┌────▼────┐
                    │  Redis  │ (Cache, Sessions)
                    └─────────┘
```

### Core Design Principles

1. **Microservices Architecture**: Services are loosely coupled and independently deployable
2. **Container-First**: All components run in Docker containers for consistency
3. **API-First Design**: RESTful APIs with clear contracts between services
4. **Scalability**: Horizontal scaling capabilities for all stateless services
5. **Observability**: Comprehensive monitoring, logging, and tracing
6. **Security by Default**: Defense in depth with multiple security layers

## Architecture Principles

### Separation of Concerns

Each service has a single, well-defined responsibility:

- **Frontend**: User interface and user experience
- **Backend**: Business logic, authentication, and API gateway
- **ML Service**: Machine learning inference and image processing
- **Database**: Data persistence and integrity
- **Cache**: Performance optimization and session storage
- **Monitoring**: System observability and alerting

### Stateless Services

All application services (Frontend, Backend, ML) are stateless:
- No local file storage (uses shared volumes)
- Session data stored in Redis
- Enables horizontal scaling
- Simplifies deployment and recovery

### Event-Driven Communication

Real-time updates use WebSocket (Socket.IO):
- Image processing status updates
- Collaborative features
- System notifications
- Reduces polling overhead

### Data Consistency

- **ACID compliance**: PostgreSQL for transactional data
- **Eventual consistency**: Redis for cache and sessions
- **Idempotent operations**: Safe retry mechanisms
- **Optimistic locking**: Prevent race conditions

## System Components

### Frontend Service

**Technology**: React 18, TypeScript, Vite, Material-UI

**Responsibilities**:
- User interface rendering
- Client-side routing (React Router v6)
- State management (React Context)
- API communication
- Real-time WebSocket handling

**Key Features**:
- Lazy loading with code splitting
- Progressive Web App (PWA) capabilities
- Responsive design for all devices
- Accessibility (WCAG 2.1 AA compliant)
- Internationalization (i18n)

**Architecture Patterns**:
```typescript
// Centralized service pattern
services/
├── api.ts           // Base API configuration
├── auth.ts          // Authentication service
├── images.ts        // Image management
├── segmentation.ts  // ML integration
└── websocket.ts     // Real-time updates

// Component organization
components/
├── common/          // Shared components
├── features/        // Feature-specific components
└── layouts/         // Page layouts
```

### Backend Service

**Technology**: Node.js, Express, TypeScript, PostgreSQL

**Responsibilities**:
- REST API endpoints
- Authentication & authorization (JWT)
- Business logic implementation
- Database operations
- File upload handling
- WebSocket server
- Integration with ML service

**Key Features**:
- JWT with refresh tokens
- Request validation (express-validator)
- Rate limiting per endpoint
- Database connection pooling
- Structured logging (Winston)
- Performance monitoring

**Architecture Patterns**:
```typescript
// Modular route structure
routes/
├── auth.ts          // Authentication endpoints
├── users.ts         // User management
├── images.ts        // Image operations
├── segmentation.ts  // ML pipeline
└── admin.ts         // Admin operations

// Middleware pipeline
middleware/
├── auth.ts          // JWT validation
├── validation.ts    // Request validation
├── rateLimiter.ts   // Rate limiting
├── errorHandler.ts  // Global error handling
└── performance.ts   // Performance tracking
```

### ML Service

**Technology**: Python, Flask, PyTorch, OpenCV

**Responsibilities**:
- Deep learning model inference
- Image preprocessing
- Cell segmentation (ResUNet)
- Feature extraction
- Polygon generation
- Batch processing

**Model Architecture**:
```python
# ResUNet Architecture
class ResUNet(nn.Module):
    - Encoder: ResNet backbone
    - Decoder: U-Net style upsampling
    - Skip connections
    - Output: Segmentation masks
```

**Processing Pipeline**:
1. Image upload → Preprocessing
2. Model inference → Segmentation mask
3. Post-processing → Polygon extraction
4. Feature calculation → Results storage

### Database Schema

**PostgreSQL 15** with optimized indexes and partitioning

**Core Tables**:
```sql
-- Users table with auth
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Images with status tracking
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    segmentation_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Segmentation results
CREATE TABLE segmentation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id),
    mask_path VARCHAR(255),
    features JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_images_user_status ON images(user_id, segmentation_status);
CREATE INDEX idx_segmentation_image ON segmentation_results(image_id);
```

### Caching Layer

**Redis 7** for high-performance caching

**Cache Strategy**:
```javascript
// Cache categories
1. Session Storage (TTL: 24h)
   - User sessions
   - Authentication tokens

2. API Response Cache (TTL: 5-60min)
   - User statistics
   - Project listings
   - Search results

3. Static Asset Cache (TTL: 1 year)
   - Processed images
   - Thumbnails
   - ML model outputs

// Cache invalidation
- Time-based expiration
- Event-based invalidation
- Manual cache purge
```

## Data Flow

### Image Processing Flow

```
1. User uploads image
   └─> Frontend validates file
       └─> Backend receives upload
           └─> Store original image
               └─> Generate thumbnail
                   └─> Queue for processing
                       └─> ML service processes
                           └─> Store results
                               └─> Notify via WebSocket
                                   └─> Update UI
```

### Authentication Flow

```
1. User login request
   └─> Backend validates credentials
       └─> Generate JWT + Refresh token
           └─> Store session in Redis
               └─> Return tokens to client
                   └─> Client stores in memory/localStorage
                       └─> Include JWT in API requests
                           └─> Middleware validates token
                               └─> Process authenticated request
```

### Real-time Update Flow

```
1. WebSocket connection established
   └─> Client subscribes to events
       └─> Server processes image
           └─> Emit progress updates
               └─> Client receives updates
                   └─> UI updates in real-time
```

## Technology Stack

### Frontend Stack
- **Framework**: React 18.2
- **Language**: TypeScript 5.0
- **Build Tool**: Vite 4.3
- **UI Library**: Material-UI 5.13
- **State Management**: React Context + Hooks
- **Routing**: React Router 6.11
- **HTTP Client**: Axios 1.4
- **WebSocket**: Socket.IO Client 4.6
- **Testing**: Vitest + React Testing Library

### Backend Stack
- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4.18
- **Language**: TypeScript 5.0
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Logging**: Winston + Daily Rotate
- **Testing**: Jest + Supertest

### ML Stack
- **Language**: Python 3.11
- **Framework**: Flask 2.3
- **ML Library**: PyTorch 2.0
- **Image Processing**: OpenCV 4.7
- **Numerical**: NumPy, SciPy
- **Data**: Pandas
- **Testing**: Pytest

### Infrastructure Stack
- **Containerization**: Docker 24
- **Orchestration**: Docker Compose 2.20
- **Reverse Proxy**: Nginx 1.24
- **SSL**: Let's Encrypt
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (optional)
- **Backup**: AWS S3 + pg_dump

## Security Architecture

### Defense in Depth

```
Layer 1: Network Security
├── SSL/TLS encryption (Let's Encrypt)
├── Rate limiting (Nginx + Express)
├── DDoS protection (Cloudflare optional)
└── Firewall rules (UFW)

Layer 2: Application Security
├── Input validation (express-validator)
├── SQL injection prevention (Parameterized queries)
├── XSS protection (React escaping + CSP)
├── CSRF tokens
└── Security headers (Helmet.js)

Layer 3: Authentication & Authorization
├── JWT with short expiration
├── Refresh token rotation
├── Role-based access control (RBAC)
├── Session management (Redis)
└── Password hashing (bcrypt)

Layer 4: Data Security
├── Encryption at rest (PostgreSQL)
├── Encryption in transit (TLS)
├── Sensitive data masking
├── Audit logging
└── Backup encryption

Layer 5: Infrastructure Security
├── Docker secrets management
├── Non-root container execution
├── Network isolation
├── Regular security updates
└── Vulnerability scanning
```

### Security Best Practices

1. **Principle of Least Privilege**: Each service has minimal required permissions
2. **Secret Management**: All secrets stored in Docker Secrets
3. **Input Validation**: Validate all inputs at multiple layers
4. **Output Encoding**: Properly encode all outputs
5. **Regular Updates**: Automated dependency updates with testing
6. **Security Monitoring**: Log analysis and anomaly detection

## Performance Architecture

### Optimization Strategies

```
Frontend Optimizations:
├── Code splitting with lazy loading
├── React.memo for expensive components
├── Virtual scrolling for large lists
├── Image lazy loading
├── Service Worker caching
└── Bundle size optimization

Backend Optimizations:
├── Database query optimization (CTEs)
├── Connection pooling
├── Response caching (Redis)
├── Async operations
├── Request deduplication
└── Memory management

ML Service Optimizations:
├── Model quantization
├── Batch processing
├── GPU acceleration (CUDA)
├── Result caching
├── Queue management
└── Memory pooling
```

### Performance Metrics

**Target SLAs**:
- API Response Time: p95 < 200ms
- Image Processing: < 30s per image
- Page Load Time: < 3s on 3G
- Availability: 99.9% uptime

**Monitoring Metrics**:
```javascript
// Application metrics
- Request rate (req/s)
- Response time (ms)
- Error rate (%)
- Active users
- Processing queue depth

// Infrastructure metrics
- CPU usage (%)
- Memory usage (%)
- Disk I/O (MB/s)
- Network traffic (MB/s)
- Container health
```

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────┐
│           Load Balancer (Nginx)         │
│         ┌──────────┬──────────┐         │
│         │  SSL/TLS │ Rate Limit│        │
│         └──────────┴──────────┘         │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐    ┌───▼───┐    ┌───▼───┐
│Backend│    │Backend│    │Backend│  (Scaled instances)
│   1   │    │   2   │    │   3   │
└───┬───┘    └───┬───┘    └───┬───┘
    │            │            │
    └────────────┼────────────┘
                 │
         ┌───────▼───────┐
         │   Database    │
         │  (Primary)    │
         └───────┬───────┘
                 │
         ┌───────▼───────┐
         │   Database    │
         │  (Replica)    │
         └───────────────┘
```

### Container Orchestration

**Docker Compose Configuration**:
```yaml
version: '3.8'

services:
  backend:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  ml:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### Blue-Green Deployment

```bash
# Deployment strategy
1. Build new version (Green)
2. Run health checks
3. Switch traffic gradually
4. Monitor metrics
5. Complete switch or rollback
```

## Monitoring Architecture

### Observability Stack

```
┌─────────────────────────────────────────┐
│             Applications                 │
│  ┌────────┬────────┬────────┬────────┐  │
│  │Frontend│Backend │   ML   │Database│  │
│  └───┬────┴───┬────┴───┬────┴───┬────┘  │
│      │        │        │        │       │
│  ┌───▼────────▼────────▼────────▼────┐  │
│  │         Prometheus Scraper        │  │
│  └──────────────┬────────────────────┘  │
│                 │                       │
│  ┌──────────────▼────────────────────┐  │
│  │         Prometheus Server         │  │
│  └──────────────┬────────────────────┘  │
│                 │                       │
│      ┌──────────┴──────────┐           │
│      │                     │           │
│  ┌───▼────┐          ┌────▼────┐      │
│  │Grafana │          │  Alert  │      │
│  │        │          │ Manager │      │
│  └────────┘          └─────────┘      │
└─────────────────────────────────────────┘
```

### Logging Architecture

```
Application Logs:
├── Structured JSON format
├── Correlation IDs
├── Log levels (ERROR, WARN, INFO, DEBUG)
├── Automatic rotation
└── Centralized aggregation

Log Categories:
├── Access logs (Nginx)
├── Application logs (Winston)
├── Error logs (Sentry optional)
├── Audit logs (Database)
└── Security logs (Auth events)
```

## Future Considerations

### Scalability Roadmap

1. **Kubernetes Migration**
   - Container orchestration
   - Auto-scaling
   - Self-healing
   - Service mesh (Istio)

2. **Microservices Expansion**
   - Separate auth service
   - Notification service
   - Report generation service
   - API gateway (Kong/Traefik)

3. **Data Pipeline**
   - Stream processing (Kafka)
   - Data warehouse (ClickHouse)
   - ML pipeline (Kubeflow)
   - Real-time analytics

### Technology Upgrades

1. **GraphQL API**
   - Efficient data fetching
   - Real-time subscriptions
   - Schema evolution
   - Better mobile support

2. **Edge Computing**
   - CDN integration
   - Edge processing
   - Reduced latency
   - Global distribution

3. **AI/ML Enhancements**
   - Model versioning
   - A/B testing
   - AutoML integration
   - Federated learning

### Architectural Improvements

1. **Event Sourcing**
   - Complete audit trail
   - Time travel debugging
   - Event replay
   - CQRS pattern

2. **Service Mesh**
   - Traffic management
   - Security policies
   - Observability
   - Circuit breaking

3. **Multi-tenancy**
   - Tenant isolation
   - Resource quotas
   - Custom domains
   - White-labeling

---

Last Updated: 2025-07-19
Version: 1.0.0