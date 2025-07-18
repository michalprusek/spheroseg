# Enhanced Validation System Migration Guide

## Overview

This guide explains how to migrate existing API routes from the basic validation system to the comprehensive enhanced validation and sanitization system.

## Key Benefits

### Security Improvements
- **XSS Prevention**: All text inputs automatically sanitized
- **SQL Injection Protection**: Input sanitization prevents SQL injection
- **Path Traversal Prevention**: Filename sanitization prevents directory traversal
- **CSRF Protection**: Optional CSRF token validation
- **Rate Limiting**: Configurable per-IP rate limiting
- **Content Type Validation**: Ensures only allowed content types

### Enhanced Validation
- **Comprehensive Schemas**: Pre-built schemas for common use cases
- **File Upload Validation**: Size, type, and extension validation
- **HTML Content Sanitization**: Safe HTML with configurable allowed tags
- **Phone Number Formatting**: International phone number validation
- **URL Validation**: Protocol and domain validation
- **JSON Schema Validation**: Deep object validation with security

### Developer Experience
- **Better Error Messages**: Detailed validation errors with field context
- **Type Safety**: Full TypeScript integration with validated types
- **Logging Integration**: Comprehensive validation logging
- **Performance Optimized**: Efficient validation with minimal overhead

## Migration Steps

### 1. Import Enhanced Validation Middleware

**Before (basic validation):**
```typescript
import { validate } from '../middleware/validationMiddleware';
import { registerSchema } from '../validators/authValidators';
```

**After (enhanced validation):**
```typescript
import {
  validateRequestBody,
  validateRequestQuery,
  validateRequestParams,
  rateLimitByIP,
  sanitizeRequest,
  validateContentType
} from '../middleware/enhancedValidation';
import {
  userRegistrationSchema,
  emailSchema,
  passwordSchema
} from '@spheroseg/shared/src/validation/enhancedValidation';
```

### 2. Update Route Definitions

**Before:**
```typescript
router.post('/register', validate(registerSchema), async (req, res) => {
  const { email, password, name } = req.body;
  // ... rest of handler
});
```

**After:**
```typescript
router.post('/register', 
  validateRequestBody(userRegistrationSchema),
  async (req, res) => {
    const { email, password, name } = req.validatedBody; // ✅ Sanitized and validated
    // ... rest of handler
  }
);
```

### 3. Add Security Middleware

Add these middleware functions to routes that need enhanced security:

```typescript
// Apply to all routes in router
router.use(rateLimitByIP(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
router.use(sanitizeRequest()); // Sanitize all inputs

// Apply to specific routes
router.post('/api/endpoint',
  validateContentType(['application/json']),
  validateRequestBody(schema),
  handler
);
```

### 4. Update Schema Definitions

**Before (basic Zod schemas):**
```typescript
const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().optional()
  })
});
```

**After (enhanced schemas with sanitization):**
```typescript
const registerSchema = z.object({
  email: emailSchema,           // ✅ Auto-sanitized and validated
  password: passwordSchema,     // ✅ Strength requirements
  name: createTextSchema({      // ✅ XSS prevention + length validation
    minLength: 2,
    maxLength: 100,
    allowHtml: false
  })
});
```

### 5. Handle Validated Data

**Before:**
```typescript
router.post('/endpoint', validate(schema), (req, res) => {
  const { field } = req.body; // ⚠️ Not sanitized
});
```

**After:**
```typescript
router.post('/endpoint', validateRequestBody(schema), (req, res) => {
  const { field } = req.validatedBody; // ✅ Sanitized and validated
});
```

## Enhanced Schema Examples

### User Registration with Comprehensive Validation
```typescript
const enhancedRegistrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  name: createTextSchema({
    minLength: 2,
    maxLength: 100,
    allowHtml: false
  }),
  phone: phoneSchema.optional(),
  website: createUrlSchema({
    allowedProtocols: ['https:'],
    required: false
  }),
  bio: createHtmlSchema({
    allowedTags: ['p', 'strong', 'em', 'br'],
    maxLength: 1000
  }),
  terms: z.boolean().refine(val => val === true, 'Must accept terms')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
```

### File Upload with Security Validation
```typescript
const fileUploadSchema = z.object({
  file: createFileSchema({
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf']
  }),
  description: createTextSchema({
    maxLength: 500,
    allowHtml: false,
    required: false
  })
});
```

### Search and Pagination
```typescript
const searchSchema = z.object({
  query: createTextSchema({
    minLength: 1,
    maxLength: 200,
    allowHtml: false,
    required: false
  }),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: createTextSchema({
    maxLength: 50,
    allowHtml: false,
    required: false
  }),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});
```

## Security Middleware Configuration

### Rate Limiting Configuration
```typescript
// Basic rate limiting
router.use(rateLimitByIP(100, 15 * 60 * 1000)); // 100 requests per 15 min

// Strict rate limiting for sensitive endpoints
router.use('/auth/login', rateLimitByIP(10, 15 * 60 * 1000)); // 10 attempts per 15 min
```

### Content Type Validation
```typescript
// JSON only
router.use(validateContentType(['application/json']));

// Multiple content types
router.use(validateContentType([
  'application/json',
  'multipart/form-data',
  'application/x-www-form-urlencoded'
]));
```

### Request Sanitization
```typescript
// Global sanitization
router.use(sanitizeRequest());

// The sanitization automatically handles:
// - XSS script tag removal
// - JavaScript protocol removal
// - Event handler attribute removal
// - Recursive object sanitization
```

## Error Handling

### Enhanced Error Responses
```typescript
// Validation errors now include:
{
  "message": "Validation failed",
  "field": "body",
  "errors": [
    {
      "path": "email",
      "message": "Invalid email format",
      "code": "invalid_string",
      "received": "not-an-email"
    },
    {
      "path": "password",
      "message": "Must contain uppercase letter",
      "code": "custom",
      "received": "weak"
    }
  ]
}
```

### Security Error Responses
```typescript
// Rate limiting exceeded
{
  "message": "Rate limit exceeded",
  "statusCode": 429
}

// Invalid content type
{
  "message": "Invalid Content-Type. Allowed: application/json",
  "statusCode": 400
}

// CSRF token missing
{
  "message": "CSRF token missing",
  "statusCode": 403
}
```

## Testing Enhanced Routes

### Unit Test Example
```typescript
describe('Enhanced Route', () => {
  it('should sanitize XSS attempts', async () => {
    const maliciousData = {
      name: '<script>alert("xss")</script>John Doe',
      email: 'test@example.com'
    };

    const response = await request(app)
      .post('/api/route')
      .send(maliciousData)
      .expect(200);

    // Verify script tag was removed
    expect(mockService.call).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Doe', // ✅ Script tag removed
        email: 'test@example.com'
      })
    );
  });

  it('should enforce rate limiting', async () => {
    // Make requests up to limit
    for (let i = 0; i < 100; i++) {
      await request(app).post('/api/route').send(validData).expect(200);
    }

    // 101st request should be rate limited
    await request(app).post('/api/route').send(validData).expect(429);
  });
});
```

## Performance Considerations

### Optimization Tips
1. **Schema Caching**: Schemas are automatically cached for performance
2. **Selective Sanitization**: Only sanitize fields that need it using `allowHtml: false`
3. **Rate Limit Memory**: Rate limiting uses in-memory storage - consider Redis for production
4. **Validation Logging**: Set `logValidation: false` for high-traffic endpoints

### Monitoring
```typescript
// Enable detailed validation logging
const validationMiddleware = createValidationMiddleware({
  body: schema,
  logValidation: true, // ✅ Logs all validation attempts
  onError: (error, req) => {
    // Custom error handling
    logger.warn('Validation failed', {
      path: req.path,
      errors: error.errors
    });
  }
});
```

## Migration Checklist

- [ ] Import enhanced validation middleware
- [ ] Replace basic `validate()` with `validateRequestBody/Query/Params()`
- [ ] Update schemas to use enhanced validation functions
- [ ] Add security middleware (rate limiting, sanitization, content type validation)
- [ ] Update route handlers to use `req.validatedBody/Query/Params`
- [ ] Add comprehensive tests for validation and security features
- [ ] Update error handling to use enhanced error responses
- [ ] Configure logging and monitoring for validation events
- [ ] Test XSS prevention, rate limiting, and other security features

## Common Migration Patterns

### Pattern 1: Simple Route Conversion
```typescript
// Before
router.post('/simple', validate(simpleSchema), handler);

// After  
router.post('/simple', validateRequestBody(enhancedSimpleSchema), handler);
```

### Pattern 2: Route with Multiple Validations
```typescript
// Before
router.get('/complex/:id', validate(paramsSchema), validate(querySchema), handler);

// After
router.get('/complex/:id',
  validateRequestParams(z.object({ id: z.string().uuid() })),
  validateRequestQuery(paginationSchema),
  handler
);
```

### Pattern 3: Secure Route with All Features
```typescript
router.post('/secure-endpoint',
  rateLimitByIP(20, 15 * 60 * 1000),
  validateContentType(['application/json']),
  sanitizeRequest(),
  validateRequestBody(secureSchema),
  csrfProtection(), // Optional
  handler
);
```

This enhanced validation system provides comprehensive security and validation while maintaining excellent developer experience and performance.