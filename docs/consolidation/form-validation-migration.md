# Form Validation Migration Guide

This guide helps you migrate to the unified validation module that standardizes on Zod across both frontend and backend.

## Overview

The new unified validation module provides:
- **Single validation library**: Zod for both frontend and backend
- **Shared schemas**: Write once, use everywhere
- **Type safety**: Full TypeScript integration
- **Better DX**: Consistent APIs and error handling
- **Performance**: Optimized validation with caching

## Key Changes

### 1. Backend Migration: express-validator → Zod
- **Old**: express-validator middleware
- **New**: Zod-based middleware with better type inference

### 2. Centralized Schemas
- **Old**: Scattered validation logic
- **New**: Centralized in `@spheroseg/shared/validation`

### 3. Consistent Error Format
- **Old**: Different error formats for frontend/backend
- **New**: Unified `FormError` type

## Migration Steps

### Frontend Migration

#### Update Imports

```typescript
// Old - local schemas
import { emailSchema, passwordSchema } from '@/utils/validation/schemas';
import { TextField, PasswordField } from '@/utils/validation/components';

// New - shared schemas
import { emailSchema, passwordSchema } from '@spheroseg/shared/validation';
import { TextField, PasswordField } from '@/components/form'; // UI components stay local
```

#### Update Form Usage

```typescript
// Old
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema } from '@/utils/validation/schemas';

// New
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpFormData } from '@spheroseg/shared/validation';

function SignUpForm() {
  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });
  
  // Same usage as before
}
```

#### Custom Validation

```typescript
// Old - local custom validators
const customSchema = z.object({
  email: z.string().email().refine(
    async (email) => await checkEmailExists(email),
    'Email already exists'
  ),
});

// New - use utilities
import { validateAsync, emailSchema } from '@spheroseg/shared/validation';

const customSchema = z.object({
  email: emailSchema.refine(
    async (email) => await checkEmailExists(email),
    'Email already exists'
  ),
});
```

### Backend Migration

#### Replace express-validator Middleware

```typescript
// Old - express-validator
import { body, validationResult } from 'express-validator';
import { handleValidationErrors } from '@/middleware/validation';

router.post('/users',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  handleValidationErrors,
  createUser
);

// New - Zod middleware
import { validateBody, signUpSchema } from '@spheroseg/shared/validation';

router.post('/users',
  validateBody(signUpSchema),
  createUser
);
```

#### Update Route Handlers

```typescript
// Old
export async function createUser(req: Request, res: Response) {
  const { email, password } = req.body;
  // ...
}

// New - with type safety
import { SignUpFormData } from '@spheroseg/shared/validation';

export async function createUser(req: Request, res: Response) {
  // req.validated.body is fully typed!
  const userData: SignUpFormData = req.validated!.body;
  // ...
}
```

#### Complex Validation

```typescript
// Old - multiple validators
router.put('/projects/:id',
  param('id').isUUID(),
  body('title').optional().isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  handleValidationErrors,
  updateProject
);

// New - single schema
import { validateRequest, idSchema, updateProjectSchema } from '@spheroseg/shared/validation';

router.put('/projects/:id',
  validateRequest({
    params: z.object({ id: idSchema }),
    body: updateProjectSchema,
  }),
  updateProject
);
```

### Shared Schema Examples

#### Authentication

```typescript
// Shared schema (packages/shared/src/validation/commonSchemas.ts)
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

// Frontend usage
const form = useForm<SignInFormData>({
  resolver: zodResolver(signInSchema),
});

// Backend usage
router.post('/auth/login',
  validateBody(signInSchema),
  async (req, res) => {
    const { email, password, rememberMe } = req.validated!.body;
    // ...
  }
);
```

#### File Upload

```typescript
// Old - different validation for frontend/backend
// Frontend: custom file validation
// Backend: multer + express-validator

// New - unified approach
import { imageFileSchema, createFileSchema } from '@spheroseg/shared/validation';

// Frontend
const uploadSchema = z.object({
  files: z.array(imageFileSchema).min(1).max(10),
});

// Backend
const fileValidation = createFileSchema({
  maxSize: 50 * 1024 * 1024, // 50MB
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
});

router.post('/upload',
  upload.single('file'),
  validateRequest({ files: fileValidation }),
  handleUpload
);
```

## Pattern Reference

### Common Validation Patterns

#### Optional Fields

```typescript
// Old
body('bio').optional().isLength({ max: 500 })

// New
import { optional } from '@spheroseg/shared/validation';
const schema = z.object({
  bio: optional(z.string().max(500)),
});
```

#### Conditional Validation

```typescript
// New - conditional required
import { requiredIf } from '@spheroseg/shared/validation';

const schema = z.object({
  hasPhone: z.boolean(),
  phone: requiredIf(phoneSchema, 'hasPhone', true),
});
```

#### Cross-field Validation

```typescript
// Password confirmation
const schema = z.object({
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

#### Async Validation

```typescript
// Email uniqueness check
const schema = z.object({
  email: emailSchema.refine(
    async (email) => {
      const exists = await checkEmailInDatabase(email);
      return !exists;
    },
    { message: 'Email already registered' }
  ),
});
```

### Error Handling

#### Frontend Error Display

```typescript
import { setServerErrors } from '@spheroseg/shared/validation';

// Handle server validation errors
try {
  await api.createProject([
  
catch (error) {
  if (error.response?.status === 400) {
    setServerErrors(form, error.response.data.errors);
  }
}
```

#### Backend Error Response

```typescript
// Automatic with validateRequest middleware
// Returns:
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "invalid_string"
    }
  ]
}
```

## Advanced Features

### Custom Validators

```typescript
// Create reusable custom validators
import { z } from '@spheroseg/shared/validation';

export const uniqueEmailSchema = emailSchema.refine(
  async (email) => {
    const response = await api.checkEmail(email);
    return response.data.available;
  },
  { message: 'Email already taken' }
);
```

### Schema Composition

```typescript
import { mergeSchemas, pickSchema, partialSchema } from '@spheroseg/shared/validation';

// Merge multiple schemas
const fullSchema = mergeSchemas(userSchema, addressSchema, preferencesSchema);

// Pick specific fields
const minimalSchema = pickSchema(userSchema, ['email', 'name']);

// Make fields optional
const updateSchema = partialSchema(userSchema);
```

### Transform and Sanitization

```typescript
import { trimString, normalizeWhitespace, emptyStringToUndefined } from '@spheroseg/shared/validation';

const schema = z.object({
  title: trimString(z.string().min(1)),
  description: emptyStringToUndefined(z.string()),
  content: normalizeWhitespace(z.string()),
});
```

## Testing

### Frontend Tests

```typescript
import { validate } from '@spheroseg/shared/validation';

describe('Form validation', () => {
  it('should validate sign up data', () => {
    const result = validate(signUpSchema, {
      email: 'test@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      acceptTerms: true,
    });
    
    expect(result.success).toBe(true);
  });
});
```

### Backend Tests

```typescript
import request from 'supertest';
import app from '../app';

describe('POST /auth/register', () => {
  it('should validate request body', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'invalid-email',
        password: '123', // too short
      });
    
    expect(response.status).toBe(400);
    expect(response.body.errors).toHaveLength(2);
  });
});
```

## Performance Considerations

1. **Schema Caching**: Schemas are parsed once and cached
2. **Lazy Validation**: Use `safeParse` for non-critical validation
3. **Debounced Validation**: Use `createDebouncedValidator` for real-time validation

```typescript
import { createDebouncedValidator } from '@spheroseg/shared/validation';

const validateEmail = createDebouncedValidator(emailSchema, 300);

// In component
const handleEmailChange = async (email: string) => {
  const result = await validateEmail(email);
  if (!result.success) {
    setEmailError(result.errors[0].message);
  }
};
```

## Troubleshooting

### Common Issues

1. **Type Errors**
   ```typescript
   // Ensure you import types
   import type { SignUpFormData } from '@spheroseg/shared/validation';
   ```

2. **Async Validation**
   ```typescript
   // Remember to use async resolvers
   const form = useForm({
     resolver: async (data) => {
       // Async validation here
     },
   });
   ```

3. **File Validation**
   ```typescript
   // Files require special handling
   const fileSchema = z.instanceof(File).refine(
     (file) => file.size <= 5 * 1024 * 1024,
     'File too large'
   );
   ```

## Migration Checklist

- [ ] Update package.json dependencies
- [ ] Replace express-validator imports
- [ ] Update validation middleware
- [ ] Migrate custom validators to Zod
- [ ] Update form components
- [ ] Test error handling
- [ ] Update API documentation
- [ ] Remove old validation files

## Benefits After Migration

- ✅ Single source of truth for validation
- ✅ Type-safe validation schemas
- ✅ Consistent error handling
- ✅ Better developer experience
- ✅ Reduced bundle size (removed express-validator)
- ✅ Easier testing
- ✅ Better performance