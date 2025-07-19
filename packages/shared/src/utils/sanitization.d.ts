/**
 * Comprehensive Input Sanitization Utilities
 *
 * Provides robust sanitization functions to prevent XSS, SQL injection,
 * and other security vulnerabilities across the application.
 */
import { z } from 'zod';
export declare const SANITIZATION_CONFIG: {
    readonly HTML_ALLOWED_TAGS: readonly ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre"];
    readonly HTML_ALLOWED_ATTRIBUTES: {
        readonly a: readonly ["href", "title"];
        readonly '*': readonly ["class"];
    };
    readonly MAX_TEXT_LENGTH: 10000;
    readonly MAX_HTML_LENGTH: 50000;
    readonly MAX_FILENAME_LENGTH: 255;
    readonly DANGEROUS_PATTERNS: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    readonly SQL_INJECTION_PATTERNS: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
};
/**
 * Sanitize HTML content safely
 */
export declare function sanitizeHtml(input: string, options?: {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    maxLength?: number;
}): string;
/**
 * Sanitize plain text input
 */
export declare function sanitizeText(input: string, options?: {
    maxLength?: number;
    allowHtml?: boolean;
    preserveNewlines?: boolean;
}): string;
/**
 * Sanitize filename for safe storage
 */
export declare function sanitizeFilename(input: string): string;
/**
 * Sanitize email address
 */
export declare function sanitizeEmail(input: string): string;
/**
 * Sanitize URL
 */
export declare function sanitizeUrl(input: string, options?: {
    allowedProtocols?: string[];
    allowRelative?: boolean;
}): string;
/**
 * Sanitize SQL-prone input (for dynamic queries - use parameterized queries instead when possible)
 */
export declare function sanitizeSqlInput(input: string): string;
/**
 * Sanitize JSON input
 */
export declare function sanitizeJson(input: string, maxDepth?: number): unknown;
/**
 * Sanitize phone number
 */
export declare function sanitizePhone(input: string): string;
/**
 * Create Zod transformers with sanitization
 */
export declare const sanitizedString: (options?: {
    maxLength?: number;
    allowHtml?: boolean;
    preserveNewlines?: boolean;
}) => z.ZodEffects<z.ZodString, string, string>;
export declare const sanitizedHtml: (options?: {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    maxLength?: number;
}) => z.ZodEffects<z.ZodString, string, string>;
export declare const sanitizedEmail: () => z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
export declare const sanitizedUrl: (options?: {
    allowedProtocols?: string[];
    allowRelative?: boolean;
}) => z.ZodEffects<z.ZodString, string, string>;
export declare const sanitizedFilename: () => z.ZodEffects<z.ZodString, string, string>;
export declare const sanitizedPhone: () => z.ZodEffects<z.ZodString, string, string>;
/**
 * Sanitize an entire object recursively
 */
export declare function sanitizeObject(obj: Record<string, unknown>, rules?: Record<string, (value: unknown) => unknown>): Record<string, unknown>;
/**
 * Generate Content Security Policy header value
 */
export declare function generateCSP(nonce?: string): string;
declare const _default: {
    sanitizeHtml: typeof sanitizeHtml;
    sanitizeText: typeof sanitizeText;
    sanitizeFilename: typeof sanitizeFilename;
    sanitizeEmail: typeof sanitizeEmail;
    sanitizeUrl: typeof sanitizeUrl;
    sanitizeSqlInput: typeof sanitizeSqlInput;
    sanitizeJson: typeof sanitizeJson;
    sanitizePhone: typeof sanitizePhone;
    sanitizeObject: typeof sanitizeObject;
    sanitizedString: (options?: {
        maxLength?: number;
        allowHtml?: boolean;
        preserveNewlines?: boolean;
    }) => z.ZodEffects<z.ZodString, string, string>;
    sanitizedHtml: (options?: {
        allowedTags?: string[];
        allowedAttributes?: Record<string, string[]>;
        maxLength?: number;
    }) => z.ZodEffects<z.ZodString, string, string>;
    sanitizedEmail: () => z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    sanitizedUrl: (options?: {
        allowedProtocols?: string[];
        allowRelative?: boolean;
    }) => z.ZodEffects<z.ZodString, string, string>;
    sanitizedFilename: () => z.ZodEffects<z.ZodString, string, string>;
    sanitizedPhone: () => z.ZodEffects<z.ZodString, string, string>;
    generateCSP: typeof generateCSP;
    SANITIZATION_CONFIG: {
        readonly HTML_ALLOWED_TAGS: readonly ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre"];
        readonly HTML_ALLOWED_ATTRIBUTES: {
            readonly a: readonly ["href", "title"];
            readonly '*': readonly ["class"];
        };
        readonly MAX_TEXT_LENGTH: 10000;
        readonly MAX_HTML_LENGTH: 50000;
        readonly MAX_FILENAME_LENGTH: 255;
        readonly DANGEROUS_PATTERNS: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
        readonly SQL_INJECTION_PATTERNS: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    };
};
export default _default;
//# sourceMappingURL=sanitization.d.ts.map