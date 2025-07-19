"use strict";
/**
 * Enhanced Validation and Sanitization
 *
 * Provides comprehensive validation schemas with built-in sanitization
 * for secure data processing and validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateBody = exports.projectCreationSchema = exports.userRegistrationSchema = exports.createHtmlSchema = exports.passwordSchema = exports.phoneSchema = exports.filenameSchema = exports.emailSchema = exports.createUrlSchema = exports.createTextSchema = void 0;
const zod_1 = require("zod");
const sanitization_1 = require("../utils/sanitization");
// Text validation schema factory
const createTextSchema = (options) => {
    const { minLength = 1, maxLength = 1000, allowHtml = false, required = true, pattern } = options || {};
    const baseSchema = zod_1.z.string()
        .transform(val => {
        if (!val)
            return val;
        return allowHtml
            ? (0, sanitization_1.sanitizeHtml)(val, { maxLength })
            : (0, sanitization_1.sanitizeText)(val, { maxLength, allowHtml: false });
    })
        .pipe(zod_1.z.string()
        .min(minLength, `Must be at least ${minLength} characters`)
        .max(maxLength, `Must not exceed ${maxLength} characters`)
        .refine(val => !pattern || pattern.test(val), {
        message: 'Invalid format'
    }));
    return required ? baseSchema : baseSchema.optional();
};
exports.createTextSchema = createTextSchema;
// URL validation schema factory
const createUrlSchema = (options) => {
    const { allowedProtocols = ['http:', 'https:'], allowRelative = false, required = true } = options || {};
    const baseSchema = zod_1.z.string()
        .transform(val => {
        if (!val)
            return val;
        return (0, sanitization_1.sanitizeUrl)(val, { allowedProtocols, allowRelative });
    })
        .pipe(zod_1.z.string()
        .refine(val => {
        if (!val)
            return !required;
        try {
            if (allowRelative && !val.includes('://')) {
                return true;
            }
            const url = new URL(val);
            return allowedProtocols.includes(url.protocol);
        }
        catch {
            return false;
        }
    }, {
        message: 'Invalid URL format'
    }));
    return required ? baseSchema : baseSchema.optional();
};
exports.createUrlSchema = createUrlSchema;
// Email validation schema
exports.emailSchema = zod_1.z.string()
    .email('Invalid email address')
    .transform(val => (0, sanitization_1.sanitizeText)(val, { maxLength: 254 }));
// Filename validation schema
exports.filenameSchema = (0, exports.createTextSchema)({
    minLength: 1,
    maxLength: 255,
    pattern: /^[a-zA-Z0-9._-]+$/
});
// Phone validation schema
exports.phoneSchema = (0, exports.createTextSchema)({
    minLength: 10,
    maxLength: 20,
    pattern: /^[+]?[()]?[\d\s\-()]+$/
});
// Password validation schema
exports.passwordSchema = zod_1.z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .refine(val => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val), {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
});
// HTML content validation schema
const createHtmlSchema = (options) => {
    const { maxLength = 10000, allowedTags, allowedAttributes } = options || {};
    const sanitizeOptions = { maxLength };
    if (allowedTags !== undefined) {
        sanitizeOptions.allowedTags = allowedTags;
    }
    if (allowedAttributes !== undefined) {
        sanitizeOptions.allowedAttributes = allowedAttributes;
    }
    return zod_1.z.string()
        .transform(val => (0, sanitization_1.sanitizeHtml)(val, sanitizeOptions))
        .pipe(zod_1.z.string().max(maxLength, `Content must not exceed ${maxLength} characters`));
};
exports.createHtmlSchema = createHtmlSchema;
// User registration schema
exports.userRegistrationSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
    firstName: (0, exports.createTextSchema)({ minLength: 1, maxLength: 50 }),
    lastName: (0, exports.createTextSchema)({ minLength: 1, maxLength: 50 }),
    phone: exports.phoneSchema.optional(),
    organization: (0, exports.createTextSchema)({ minLength: 1, maxLength: 100, required: false })
});
// Project creation schema
exports.projectCreationSchema = zod_1.z.object({
    name: (0, exports.createTextSchema)({ minLength: 1, maxLength: 100 }),
    description: (0, exports.createTextSchema)({ minLength: 1, maxLength: 1000, required: false }),
    visibility: zod_1.z.enum(['public', 'private']).default('private'),
    tags: zod_1.z.array((0, exports.createTextSchema)({ minLength: 1, maxLength: 50 })).optional()
});
// Body validation middleware
const validateBody = async (schema, data, context) => {
    try {
        const result = await schema.parseAsync(data);
        return {
            success: true,
            data: result
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: `Validation failed${context ? ` for ${context}` : ''}`,
                issues: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
            };
        }
        return {
            success: false,
            error: 'Unknown validation error'
        };
    }
};
exports.validateBody = validateBody;
// Query validation middleware
const validateQuery = async (schema, data, context) => {
    try {
        // Pre-process query parameters (convert strings to appropriate types)
        const processedData = preprocessQueryParams(data);
        const result = await schema.parseAsync(processedData);
        return {
            success: true,
            data: result
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: `Query validation failed${context ? ` for ${context}` : ''}`,
                issues: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
            };
        }
        return {
            success: false,
            error: 'Unknown validation error'
        };
    }
};
exports.validateQuery = validateQuery;
// Helper function to preprocess query parameters
const preprocessQueryParams = (data) => {
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    const processed = {};
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            // Try to convert string numbers to numbers
            const numValue = Number(value);
            if (!isNaN(numValue) && isFinite(numValue)) {
                processed[key] = numValue;
            }
            else if (value === 'true') {
                processed[key] = true;
            }
            else if (value === 'false') {
                processed[key] = false;
            }
            else {
                processed[key] = value;
            }
        }
        else {
            processed[key] = value;
        }
    }
    return processed;
};
//# sourceMappingURL=enhancedValidation.js.map