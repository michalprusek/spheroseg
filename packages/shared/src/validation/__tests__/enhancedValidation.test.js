"use strict";
/**
 * Enhanced Validation Tests
 *
 * Tests for the comprehensive validation and sanitization system
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const zod_1 = require("zod");
const enhancedValidation_1 = require("../enhancedValidation");
(0, vitest_1.describe)('Enhanced Validation', () => {
    (0, vitest_1.describe)('createTextSchema', () => {
        (0, vitest_1.it)('should sanitize and validate text input', async () => {
            const schema = (0, enhancedValidation_1.createTextSchema)({ minLength: 3, maxLength: 20 });
            // Valid input
            const result1 = await schema.parseAsync('Hello World');
            (0, vitest_1.expect)(result1).toBe('Hello World');
            // Input with HTML (should be stripped)
            const result2 = await schema.parseAsync('<script>alert("xss")</script>Hello');
            (0, vitest_1.expect)(result2).toBe('Hello');
            // Too short
            await (0, vitest_1.expect)(schema.parseAsync('Hi')).rejects.toThrow();
            // Too long
            await (0, vitest_1.expect)(schema.parseAsync('This is a very long text that exceeds the limit')).rejects.toThrow();
        });
        (0, vitest_1.it)('should handle HTML when allowed', async () => {
            const schema = (0, enhancedValidation_1.createTextSchema)({ allowHtml: true, maxLength: 100 });
            const result = await schema.parseAsync('<p>Hello <strong>World</strong></p>');
            (0, vitest_1.expect)(result).toContain('<p>');
            (0, vitest_1.expect)(result).toContain('<strong>');
            (0, vitest_1.expect)(result).not.toContain('<script>');
        });
    });
    (0, vitest_1.describe)('emailSchema', () => {
        (0, vitest_1.it)('should validate and sanitize email addresses', async () => {
            // Valid email
            const result1 = await enhancedValidation_1.emailSchema.parseAsync('USER@EXAMPLE.COM');
            (0, vitest_1.expect)(result1).toBe('user@example.com');
            // Email with spaces
            const result2 = await enhancedValidation_1.emailSchema.parseAsync('  user@example.com  ');
            (0, vitest_1.expect)(result2).toBe('user@example.com');
            // Invalid email
            await (0, vitest_1.expect)(enhancedValidation_1.emailSchema.parseAsync('invalid-email')).rejects.toThrow();
            await (0, vitest_1.expect)(enhancedValidation_1.emailSchema.parseAsync('user@')).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)('createUrlSchema', () => {
        (0, vitest_1.it)('should validate and sanitize URLs', async () => {
            const schema = (0, enhancedValidation_1.createUrlSchema)();
            // Valid HTTPS URL
            const result1 = await schema.parseAsync('https://example.com');
            (0, vitest_1.expect)(result1).toBe('https://example.com/');
            // Valid HTTP URL
            const result2 = await schema.parseAsync('http://example.com/path');
            (0, vitest_1.expect)(result2).toBe('http://example.com/path');
            // Invalid protocol
            await (0, vitest_1.expect)(schema.parseAsync('javascript:alert("xss")')).rejects.toThrow();
            await (0, vitest_1.expect)(schema.parseAsync('ftp://example.com')).rejects.toThrow();
        });
        (0, vitest_1.it)('should handle relative URLs when allowed', async () => {
            const schema = (0, enhancedValidation_1.createUrlSchema)({ allowRelative: true });
            const result = await schema.parseAsync('/path/to/resource');
            (0, vitest_1.expect)(result).toBe('/path/to/resource');
        });
    });
    (0, vitest_1.describe)('filenameSchema', () => {
        (0, vitest_1.it)('should sanitize filenames', async () => {
            // Valid filename
            const result1 = await enhancedValidation_1.filenameSchema.parseAsync('document.pdf');
            (0, vitest_1.expect)(result1).toBe('document.pdf');
            // Filename with dangerous characters
            const result2 = await enhancedValidation_1.filenameSchema.parseAsync('my<file>name.txt');
            (0, vitest_1.expect)(result2).toBe('my_file_name.txt');
            // Filename with path separators
            const result3 = await enhancedValidation_1.filenameSchema.parseAsync('../../../etc/passwd');
            (0, vitest_1.expect)(result3).toBe('_.._.._.._etc_passwd');
            // Reserved filename
            const result4 = await enhancedValidation_1.filenameSchema.parseAsync('CON');
            (0, vitest_1.expect)(result4).toBe('file');
        });
        (0, vitest_1.it)('should reject empty filenames', async () => {
            await (0, vitest_1.expect)(enhancedValidation_1.filenameSchema.parseAsync('')).rejects.toThrow();
            await (0, vitest_1.expect)(enhancedValidation_1.filenameSchema.parseAsync('...')).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)('phoneSchema', () => {
        (0, vitest_1.it)('should validate phone numbers', async () => {
            // Valid phone numbers
            const result1 = await enhancedValidation_1.phoneSchema.parseAsync('+1234567890');
            (0, vitest_1.expect)(result1).toBe('+1234567890');
            const result2 = await enhancedValidation_1.phoneSchema.parseAsync('(555) 123-4567');
            (0, vitest_1.expect)(result2).toBe('(555) 123-4567');
            // Remove invalid characters
            const result3 = await enhancedValidation_1.phoneSchema.parseAsync('+1-555-123-4567#ext123');
            (0, vitest_1.expect)(result3).toBe('+1-555-123-4567');
            // Invalid phone
            await (0, vitest_1.expect)(enhancedValidation_1.phoneSchema.parseAsync('123')).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)('passwordSchema', () => {
        (0, vitest_1.it)('should validate password strength', async () => {
            // Valid strong password
            const result = await enhancedValidation_1.passwordSchema.parseAsync('MyStr0ng!Pass');
            (0, vitest_1.expect)(result).toBe('MyStr0ng!Pass');
            // Too short
            await (0, vitest_1.expect)(enhancedValidation_1.passwordSchema.parseAsync('Sh0rt!')).rejects.toThrow();
            // No uppercase
            await (0, vitest_1.expect)(enhancedValidation_1.passwordSchema.parseAsync('mystr0ng!pass')).rejects.toThrow();
            // No lowercase
            await (0, vitest_1.expect)(enhancedValidation_1.passwordSchema.parseAsync('MYSTR0NG!PASS')).rejects.toThrow();
            // No number
            await (0, vitest_1.expect)(enhancedValidation_1.passwordSchema.parseAsync('MyStrong!Pass')).rejects.toThrow();
            // No special character
            await (0, vitest_1.expect)(enhancedValidation_1.passwordSchema.parseAsync('MyStr0ngPass')).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)('createHtmlSchema', () => {
        (0, vitest_1.it)('should sanitize HTML content', async () => {
            const schema = (0, enhancedValidation_1.createHtmlSchema)();
            // Safe HTML
            const result1 = await schema.parseAsync('<p>Hello <strong>World</strong></p>');
            (0, vitest_1.expect)(result1).toContain('<p>');
            (0, vitest_1.expect)(result1).toContain('<strong>');
            // Dangerous HTML (should be removed)
            const result2 = await schema.parseAsync('<script>alert("xss")</script><p>Safe content</p>');
            (0, vitest_1.expect)(result2).not.toContain('<script>');
            (0, vitest_1.expect)(result2).toContain('<p>Safe content</p>');
            // Event handlers (should be removed)
            const result3 = await schema.parseAsync('<p onclick="alert()">Click me</p>');
            (0, vitest_1.expect)(result3).not.toContain('onclick');
            (0, vitest_1.expect)(result3).toContain('<p>Click me</p>');
        });
    });
    (0, vitest_1.describe)('userRegistrationSchema', () => {
        (0, vitest_1.it)('should validate user registration data', async () => {
            const validData = {
                email: 'user@example.com',
                password: 'MyStr0ng!Pass',
                firstName: 'John',
                lastName: 'Doe',
                phone: '+1234567890',
                organization: 'Test Corp'
            };
            const result = await enhancedValidation_1.userRegistrationSchema.parseAsync(validData);
            (0, vitest_1.expect)(result.email).toBe('user@example.com');
            (0, vitest_1.expect)(result.firstName).toBe('John');
            (0, vitest_1.expect)(result.lastName).toBe('Doe');
        });
        (0, vitest_1.it)('should reject mismatched passwords', async () => {
            const invalidData = {
                email: 'user@example.com',
                password: 'MyStr0ng!Pass',
                confirmPassword: 'DifferentPass',
                name: 'John Doe',
                terms: true,
            };
            await (0, vitest_1.expect)(enhancedValidation_1.userRegistrationSchema.parseAsync(invalidData)).rejects.toThrow();
        });
        (0, vitest_1.it)('should reject without terms acceptance', async () => {
            const invalidData = {
                email: 'user@example.com',
                password: 'MyStr0ng!Pass',
                confirmPassword: 'MyStr0ng!Pass',
                name: 'John Doe',
                terms: false,
            };
            await (0, vitest_1.expect)(enhancedValidation_1.userRegistrationSchema.parseAsync(invalidData)).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)('projectCreationSchema', () => {
        (0, vitest_1.it)('should validate project creation data', async () => {
            const validData = {
                name: 'My Project',
                description: '<p>This is a <strong>great</strong> project!</p>',
                isPublic: false,
                tags: ['research', 'biology'],
            };
            const result = await enhancedValidation_1.projectCreationSchema.parseAsync(validData);
            (0, vitest_1.expect)(result.name).toBe('My Project');
            (0, vitest_1.expect)(result.description).toContain('<p>');
            (0, vitest_1.expect)(result.tags).toEqual(['research', 'biology']);
        });
        (0, vitest_1.it)('should sanitize dangerous content in description', async () => {
            const dataWithDangerousHtml = {
                name: 'My Project',
                description: '<script>alert("xss")</script><p>Safe description</p>',
                isPublic: false,
            };
            const result = await enhancedValidation_1.projectCreationSchema.parseAsync(dataWithDangerousHtml);
            (0, vitest_1.expect)(result.description).not.toContain('<script>');
            (0, vitest_1.expect)(result.description).toContain('<p>Safe description</p>');
        });
    });
    (0, vitest_1.describe)('validateBody', () => {
        (0, vitest_1.it)('should return validation results', async () => {
            const schema = (0, enhancedValidation_1.createTextSchema)({ minLength: 3 });
            // Valid data
            const result1 = await (0, enhancedValidation_1.validateBody)(schema, 'Hello', 'test');
            (0, vitest_1.expect)(result1.success).toBe(true);
            if (result1.success) {
                (0, vitest_1.expect)(result1.data).toBe('Hello');
            }
            // Invalid data
            const result2 = await (0, enhancedValidation_1.validateBody)(schema, 'Hi', 'test');
            (0, vitest_1.expect)(result2.success).toBe(false);
            if (!result2.success) {
                (0, vitest_1.expect)(result2.issues).toBeDefined();
            }
        });
    });
    (0, vitest_1.describe)('validateQuery', () => {
        (0, vitest_1.it)('should process and validate query parameters', async () => {
            const _schema = (0, enhancedValidation_1.createTextSchema)().and(zod_1.z.number());
            // String number should be converted
            const result = await (0, enhancedValidation_1.validateQuery)(zod_1.z.number(), { page: '5' }, 'pagination');
            (0, vitest_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, vitest_1.expect)(typeof result.data).toBe('number');
                (0, vitest_1.expect)(result.data).toBe(5);
            }
        });
    });
});
(0, vitest_1.describe)('Security Tests', () => {
    (0, vitest_1.describe)('XSS Prevention', () => {
        (0, vitest_1.it)('should prevent XSS in text fields', async () => {
            const schema = (0, enhancedValidation_1.createTextSchema)();
            const xssPayloads = [
                '<script>alert("xss")</script>',
                'javascript:alert("xss")',
                '<img src="x" onerror="alert(1)">',
                '<svg onload="alert(1)">',
                '"><script>alert(1)</script>',
            ];
            for (const payload of xssPayloads) {
                const result = await schema.parseAsync(payload);
                (0, vitest_1.expect)(result).not.toContain('<script>');
                (0, vitest_1.expect)(result).not.toContain('javascript:');
                (0, vitest_1.expect)(result).not.toContain('onerror');
                (0, vitest_1.expect)(result).not.toContain('onload');
            }
        });
    });
    (0, vitest_1.describe)('SQL Injection Prevention', () => {
        (0, vitest_1.it)('should sanitize SQL-prone inputs', async () => {
            const { sanitizeSqlInput } = await Promise.resolve().then(() => __importStar(require('../../utils/sanitization')));
            const sqlPayloads = [
                "'; DROP TABLE users; --",
                "' OR '1'='1",
                "UNION SELECT * FROM users",
                "'; EXEC xp_cmdshell('cmd'); --",
            ];
            for (const payload of sqlPayloads) {
                const result = sanitizeSqlInput(payload);
                (0, vitest_1.expect)(result).not.toContain("'");
                (0, vitest_1.expect)(result).not.toContain(';');
                (0, vitest_1.expect)(result).not.toContain('--');
                (0, vitest_1.expect)(result).not.toContain('UNION');
                (0, vitest_1.expect)(result).not.toContain('DROP');
            }
        });
    });
    (0, vitest_1.describe)('Path Traversal Prevention', () => {
        (0, vitest_1.it)('should prevent path traversal in filenames', async () => {
            const pathTraversalPayloads = [
                '../../../etc/passwd',
                '..\\..\\windows\\system32\\config\\sam',
                '/etc/passwd',
                'C:\\Windows\\System32\\config\\SAM',
            ];
            for (const payload of pathTraversalPayloads) {
                const result = await enhancedValidation_1.filenameSchema.parseAsync(payload);
                (0, vitest_1.expect)(result).not.toContain('../');
                (0, vitest_1.expect)(result).not.toContain('..\\');
                (0, vitest_1.expect)(result).not.toContain('/etc/');
                (0, vitest_1.expect)(result).not.toContain('C:\\');
            }
        });
    });
});
//# sourceMappingURL=enhancedValidation.test.js.map