# SpheroSeg API Documentation

This directory contains comprehensive API documentation for the SpheroSeg cell segmentation application.

## Overview

SpheroSeg is a web-based application that uses computer vision and deep learning to identify and analyze cells in microscopic images. The API provides comprehensive endpoints for user management, project organization, image processing, and ML-based segmentation.

## Documentation Files

### OpenAPI Specification
- **[openapi.yaml](./openapi.yaml)** - Complete OpenAPI 3.0.3 specification with all endpoints, schemas, and examples
- **[api-guide.md](./api-guide.md)** - Detailed API usage guide with code examples
- **[authentication.md](./authentication.md)** - Authentication and authorization documentation
- **[error-codes.md](./error-codes.md)** - Complete error codes reference
- **[websocket-events.md](./websocket-events.md)** - Real-time WebSocket event documentation

### API Categories

#### 🔐 Authentication Endpoints
- User registration and login
- JWT token management (access/refresh)
- Password reset and email verification
- Session management and logout

#### 👤 User Management
- Profile management and updates
- User statistics and analytics
- Account settings and preferences
- Avatar upload and management

#### 📂 Project Management
- Create and organize projects
- Project-based image organization
- Project sharing and collaboration
- Project statistics and reporting

#### 🖼️ Image Management
- Upload images (JPEG, PNG, TIFF, BMP)
- Batch upload capabilities
- Image metadata and thumbnails
- File verification and validation

#### 🧬 Segmentation Operations
- ML-based cell segmentation
- Batch processing capabilities
- Queue management and status tracking
- Polygon data management and export

#### 📊 System & Monitoring
- Health checks and system status
- Performance metrics and monitoring
- Administrative dashboard
- Error tracking and analytics

## Quick Start

### Base URLs
- **Production**: `https://spherosegapp.utia.cas.cz/api`
- **Development**: `http://localhost:5001/api`

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Basic Workflow

1. **Register/Login** to get authentication tokens
2. **Create a project** to organize your images
3. **Upload images** to the project
4. **Trigger segmentation** for cell analysis
5. **Monitor progress** via WebSocket or polling
6. **Download results** when processing completes

### Example: Basic API Usage

```bash
# 1. Register a new user
curl -X POST https://spherosegapp.utia.cas.cz/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# 2. Login to get tokens
curl -X POST https://spherosegapp.utia.cas.cz/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'

# 3. Create a project
curl -X POST https://spherosegapp.utia.cas.cz/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cell Analysis Project",
    "description": "Analysis of cancer cell morphology"
  }'

# 4. Upload an image
curl -X POST https://spherosegapp.utia.cas.cz/api/projects/PROJECT_ID/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "images=@cell_sample.tiff"

# 5. Trigger segmentation
curl -X POST https://spherosegapp.utia.cas.cz/api/images/IMAGE_ID/segmentation \
  -H "Authorization: Bearer YOUR_TOKEN"

# 6. Check segmentation status
curl -X GET https://spherosegapp.utia.cas.cz/api/images/IMAGE_ID/segmentation \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rate Limiting

API requests are rate limited to prevent abuse:
- **Authenticated users**: 100 requests per minute
- **Unauthenticated users**: 20 requests per minute
- **File uploads**: 10 uploads per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Error Handling

The API uses standard HTTP status codes and returns consistent error responses:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  },
  "timestamp": "2023-01-01T00:00:00Z"
}
```

Common status codes:
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `422` - Unprocessable Entity (business logic error)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## WebSocket Real-time Updates

Connect to `/socket.io/` for real-time updates:

```javascript
const socket = io('https://spherosegapp.utia.cas.cz', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Listen for segmentation progress
socket.on('segmentation-progress', (data) => {
  console.log(`Image ${data.imageId}: ${data.progress}% complete`);
});

// Listen for completion
socket.on('segmentation-complete', (data) => {
  console.log(`Segmentation completed for image ${data.imageId}`);
});
```

## File Formats and Limits

### Supported Image Formats
- **JPEG** (.jpg, .jpeg) - Standard photographs
- **PNG** (.png) - Lossless images with transparency
- **TIFF** (.tiff, .tif) - High-quality scientific images
- **BMP** (.bmp) - Windows bitmap format

### File Size Limits
- **Single file**: 50MB maximum
- **Batch upload**: 500MB total per request
- **Storage per user**: 10GB default (configurable)

### Image Requirements
- **Minimum dimensions**: 100x100 pixels
- **Maximum dimensions**: 10,000x10,000 pixels
- **Supported bit depths**: 8-bit, 16-bit, 24-bit, 32-bit
- **Color modes**: Grayscale, RGB, RGBA

## Performance and Optimization

### Response Times
- **Authentication**: < 200ms
- **File upload**: Depends on file size and network
- **Segmentation**: 30-120 seconds per image (depends on complexity)
- **API calls**: < 100ms for cached responses

### Caching
- **Static assets**: 1 year cache
- **API responses**: 5 minutes for listing endpoints
- **User profiles**: 1 hour cache
- **Project data**: 30 minutes cache

### Pagination
List endpoints support pagination:
- `limit`: Maximum items per page (1-100, default 20)
- `offset`: Number of items to skip (default 0)
- `page`: Page number (alternative to offset)

Example:
```
GET /api/projects?limit=50&offset=100
GET /api/projects?limit=50&page=3
```

## SDKs and Libraries

### Official SDKs
- **JavaScript/TypeScript**: `@spheroseg/js-sdk`
- **Python**: `spheroseg-python`
- **R**: `spherosegR` (community maintained)

### Community Tools
- **MATLAB integration**: Available in File Exchange
- **ImageJ plugin**: Available for download
- **Python notebooks**: Example workflows available

## Support and Resources

### Documentation
- **API Reference**: Complete endpoint documentation
- **Tutorials**: Step-by-step guides and examples
- **Best Practices**: Performance and usage recommendations
- **Migration Guides**: Version upgrade instructions

### Community
- **GitHub Issues**: Bug reports and feature requests
- **Discussion Forum**: Community support and discussions
- **Stack Overflow**: Tag questions with `spheroseg`

### Support Channels
- **Email**: spheroseg@utia.cas.cz
- **Documentation**: https://docs.spherosegapp.utia.cas.cz
- **Status Page**: https://status.spherosegapp.utia.cas.cz

## Changelog and Versioning

The API follows semantic versioning (SemVer):
- **Major**: Breaking changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

Current version: **v1.0.0**

### Version Support
- **v1.x**: Active development and support
- **v0.x**: Legacy, security updates only

### Deprecation Policy
- **6 months notice** for breaking changes
- **1 year support** for deprecated endpoints
- **Migration guides** provided for all changes

## Testing

### Test Environment
- **Base URL**: `https://test.spherosegapp.utia.cas.cz/api`
- **Test credentials**: Available in developer documentation
- **Sample data**: Provided for testing integrations

### API Testing Tools
- **Postman Collection**: Available for download
- **OpenAPI Spec**: Import into any OpenAPI-compatible tool
- **cURL examples**: Provided for all endpoints

## Security

### Authentication Security
- **JWT tokens**: RS256 signed with key rotation
- **Refresh tokens**: Secure, HTTP-only cookies available
- **Session management**: Automatic token refresh
- **Two-factor authentication**: Available for enhanced security

### Data Security
- **Encryption in transit**: TLS 1.3 for all communications
- **Encryption at rest**: AES-256 for stored data
- **GDPR compliance**: Data protection and privacy controls
- **Security headers**: Comprehensive CSP and security headers

### Responsible Disclosure
Security issues should be reported to: security@utia.cas.cz

## Terms of Service

By using the SpheroSeg API, you agree to:
- **Acceptable use**: No abuse, spam, or malicious activity
- **Rate limits**: Respect API limits and guidelines
- **Data retention**: Understand data storage and deletion policies
- **Privacy policy**: Review and accept privacy terms

Full terms available at: https://spherosegapp.utia.cas.cz/terms