# Authentication & Authorization

This document provides comprehensive information about authentication and authorization in the SpheroSeg API.

## Overview

SpheroSeg uses JWT (JSON Web Tokens) for authentication with access and refresh token patterns. The system supports user registration, login, password reset, email verification, and secure session management.

## Authentication Flow

### 1. User Registration

Create a new user account:

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isEmailVerified": false,
    "createdAt": "2023-01-01T00:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

### 2. User Login

Authenticate existing user:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isEmailVerified": true
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

### 3. Token Refresh

Obtain new access token using refresh token:

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

### 4. Using Access Tokens

Include the access token in the Authorization header for all authenticated requests:

```http
GET /api/users/me
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Token Management

### Token Types

#### Access Token
- **Purpose**: Authenticate API requests
- **Lifetime**: 15 minutes (configurable)
- **Algorithm**: RS256 (RSA with SHA-256)
- **Claims**: User ID, email, role, permissions

#### Refresh Token
- **Purpose**: Obtain new access tokens
- **Lifetime**: 7 days (configurable)
- **Algorithm**: RS256 (RSA with SHA-256)
- **Claims**: User ID, session ID, token family

### Token Security Features

#### Key Rotation
- **Automatic rotation**: Keys rotated every 24 hours
- **Graceful transition**: Multiple keys supported during rotation
- **JWKS endpoint**: Public keys available at `/.well-known/jwks.json`

#### Security Headers
- **Secure cookies**: Refresh tokens can be stored in HTTP-only cookies
- **CSRF protection**: Built-in CSRF token validation
- **Domain validation**: Tokens validated against issued domain

### Token Payload Example

```json
{
  "sub": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "role": "user",
  "permissions": ["read:projects", "write:projects", "read:images", "write:images"],
  "iat": 1672531200,
  "exp": 1672532100,
  "iss": "spheroseg-api",
  "aud": "spheroseg-client"
}
```

## Session Management

### Session Creation
- **Login**: Creates new session with refresh token
- **Token refresh**: Extends existing session
- **Multiple sessions**: Users can have multiple active sessions

### Session Invalidation
- **Logout**: Invalidates current session
- **Revoke all**: Invalidates all user sessions
- **Automatic expiry**: Sessions expire after 7 days of inactivity

### Logout

Invalidate current session:

```http
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### Revoke All Sessions

Invalidate all user sessions:

```http
POST /api/auth/revoke
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "All sessions revoked"
}
```

## Password Management

### Password Requirements
- **Minimum length**: 8 characters
- **Character types**: Must include letters and numbers
- **Strength validation**: Weak passwords rejected
- **Common passwords**: Dictionary check against common passwords

### Password Reset Flow

#### 1. Request Password Reset

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

#### 2. Reset Password with Token

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "newPassword": "newSecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

### Change Password (Authenticated)

```http
PUT /api/auth/change-password
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

## Email Verification

### Send Verification Email

```http
POST /api/auth/send-verification-email
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

### Verify Email

```http
GET /api/auth/verify-email?token=verification-token-from-email
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

## Authorization & Permissions

### User Roles

#### User (Default)
- **Projects**: Create, read, update, delete own projects
- **Images**: Upload, process, download own images
- **Segmentation**: Trigger and access own segmentation results
- **Profile**: Manage own profile and settings

#### Admin
- **All user permissions**: Plus administrative capabilities
- **User management**: View and manage all users
- **System monitoring**: Access monitoring and analytics
- **Configuration**: Modify system settings
- **Maintenance**: Perform system maintenance tasks

### Permission System

Permissions are encoded in JWT tokens and validated on each request:

```json
{
  "permissions": [
    "read:projects",
    "write:projects",
    "read:images",
    "write:images",
    "read:segmentation",
    "write:segmentation",
    "admin:users",
    "admin:system"
  ]
}
```

### Resource Access Control

#### Project-based Access
- **Owner access**: Full control over project and its resources
- **Sharing**: Future feature for project collaboration
- **Isolation**: Users can only access their own resources

#### Admin Access
- **System endpoints**: Require admin role
- **Monitoring**: Admin-only monitoring endpoints
- **User management**: Admin-only user operations

## Error Handling

### Authentication Errors

#### Invalid Credentials (401)
```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "timestamp": "2023-01-01T00:00:00Z"
}
```

#### Token Expired (401)
```json
{
  "success": false,
  "error": "TOKEN_EXPIRED",
  "message": "Access token has expired",
  "timestamp": "2023-01-01T00:00:00Z"
}
```

#### Invalid Token (401)
```json
{
  "success": false,
  "error": "INVALID_TOKEN",
  "message": "Invalid or malformed token",
  "timestamp": "2023-01-01T00:00:00Z"
}
```

#### Insufficient Permissions (403)
```json
{
  "success": false,
  "error": "INSUFFICIENT_PERMISSIONS",
  "message": "You don't have permission to access this resource",
  "timestamp": "2023-01-01T00:00:00Z"
}
```

## Security Best Practices

### Client-side Security

#### Token Storage
- **Access tokens**: Store in memory (avoid localStorage)
- **Refresh tokens**: Use secure HTTP-only cookies when possible
- **HTTPS only**: Never send tokens over insecure connections

#### Token Handling
- **Automatic refresh**: Implement automatic token refresh logic
- **Secure transmission**: Always use HTTPS
- **Token rotation**: Handle key rotation gracefully

### Server-side Security

#### Token Validation
- **Signature verification**: All tokens cryptographically verified
- **Expiry checking**: Expired tokens automatically rejected
- **Audience validation**: Tokens validated against intended audience

#### Rate Limiting
- **Login attempts**: Limited failed login attempts
- **Token requests**: Rate limited token refresh requests
- **API calls**: General API rate limiting

## Implementation Examples

### JavaScript/TypeScript

```typescript
class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (data.success) {
      this.accessToken = data.tokens.accessToken;
      this.refreshToken = data.tokens.refreshToken;
    }
    
    return data;
  }

  async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // Add authorization header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.accessToken}`
    };

    let response = await fetch(url, { ...options, headers });

    // Handle token expiry
    if (response.status === 401) {
      await this.refreshAccessToken();
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      response = await fetch(url, { ...options, headers });
    }

    return response;
  }

  private async refreshAccessToken(): Promise<void> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    const data = await response.json();
    
    if (data.success) {
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
    } else {
      // Redirect to login
      window.location.href = '/login';
    }
  }
}
```

### Python

```python
import requests
import time
from typing import Optional, Dict, Any

class SpheroSegAuth:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expiry: Optional[float] = None

    def login(self, email: str, password: str) -> Dict[str, Any]:
        """Login and store tokens"""
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password}
        )
        
        data = response.json()
        
        if data.get("success"):
            tokens = data["tokens"]
            self.access_token = tokens["accessToken"]
            self.refresh_token = tokens["refreshToken"]
            self.token_expiry = time.time() + tokens["expiresIn"]
        
        return data

    def make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make authenticated request with automatic token refresh"""
        
        # Check if token needs refresh
        if self.token_expiry and time.time() >= self.token_expiry - 60:
            self.refresh_access_token()
        
        headers = kwargs.get("headers", {})
        headers["Authorization"] = f"Bearer {self.access_token}"
        kwargs["headers"] = headers
        
        response = requests.request(method, f"{self.base_url}/{endpoint}", **kwargs)
        
        # Handle token expiry
        if response.status_code == 401:
            self.refresh_access_token()
            headers["Authorization"] = f"Bearer {self.access_token}"
            response = requests.request(method, f"{self.base_url}/{endpoint}", **kwargs)
        
        return response

    def refresh_access_token(self) -> None:
        """Refresh access token using refresh token"""
        response = requests.post(
            f"{self.base_url}/auth/refresh",
            json={"refreshToken": self.refresh_token}
        )
        
        data = response.json()
        
        if data.get("success"):
            self.access_token = data["accessToken"]
            self.refresh_token = data["refreshToken"]
            self.token_expiry = time.time() + data["expiresIn"]
        else:
            raise Exception("Token refresh failed")
```

## Testing Authentication

### Test User Accounts

For development and testing, use these test accounts:

```json
{
  "email": "test@example.com",
  "password": "testPassword123",
  "role": "user"
}
```

```json
{
  "email": "admin@example.com", 
  "password": "adminPassword123",
  "role": "admin"
}
```

### Testing Endpoints

Use these endpoints to test authentication flows:

```bash
# Test registration
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testPassword123","firstName":"Test","lastName":"User"}'

# Test login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testPassword123"}'

# Test authenticated endpoint
curl -X GET http://localhost:5001/api/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

### Common Issues

#### "Token expired" errors
- **Cause**: Access token has expired (15 minute lifetime)
- **Solution**: Implement automatic token refresh logic

#### "Invalid token" errors
- **Cause**: Malformed token or wrong signing key
- **Solution**: Verify token format and key rotation handling

#### "Insufficient permissions" errors
- **Cause**: User doesn't have required role/permissions
- **Solution**: Check user role and required permissions

#### CORS errors in browser
- **Cause**: Cross-origin request without proper CORS setup
- **Solution**: Ensure API server has correct CORS configuration

### Debug Mode

Enable debug logging for authentication issues:

```bash
# Set environment variable
DEBUG=spheroseg:auth

# Or in application
LOG_LEVEL=debug
```

This will log detailed authentication flow information to help troubleshoot issues.