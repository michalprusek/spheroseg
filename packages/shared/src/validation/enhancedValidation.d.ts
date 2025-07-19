/**
 * Enhanced Validation and Sanitization
 *
 * Provides comprehensive validation schemas with built-in sanitization
 * for secure data processing and validation
 */
import { z } from 'zod';
export declare const createTextSchema: (options?: {
    minLength?: number;
    maxLength?: number;
    allowHtml?: boolean;
    required?: boolean;
    pattern?: RegExp;
}) => z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
export declare const createUrlSchema: (options?: {
    allowedProtocols?: string[];
    allowRelative?: boolean;
    required?: boolean;
}) => z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
export declare const emailSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const filenameSchema: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
export declare const phoneSchema: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
export declare const passwordSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const createHtmlSchema: (options?: {
    maxLength?: number;
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
}) => z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
export declare const userRegistrationSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodEffects<z.ZodString, string, string>;
    firstName: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
    lastName: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
    phone: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>> | z.ZodOptional<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>>;
    organization: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    organization?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
}, {
    password: string;
    email: string;
    organization?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
}>;
export declare const projectCreationSchema: z.ZodObject<{
    name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
    description: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>;
    visibility: z.ZodDefault<z.ZodEnum<["public", "private"]>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>> | z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>>>, "many">>;
}, "strip", z.ZodTypeAny, {
    visibility: "public" | "private";
    description?: string | undefined;
    name?: string | undefined;
    tags?: (string | undefined)[] | undefined;
}, {
    description?: string | undefined;
    name?: string | undefined;
    tags?: (string | undefined)[] | undefined;
    visibility?: "public" | "private" | undefined;
}>;
export type ValidationResult<T> = {
    success: boolean;
    data?: T;
    error?: string;
    issues?: string[];
};
export declare const validateBody: <T>(schema: z.ZodSchema<T>, data: unknown, context?: string) => Promise<ValidationResult<T>>;
export declare const validateQuery: <T>(schema: z.ZodSchema<T>, data: unknown, context?: string) => Promise<ValidationResult<T>>;
export type TextSchemaOptions = Parameters<typeof createTextSchema>[0];
export type UrlSchemaOptions = Parameters<typeof createUrlSchema>[0];
export type HtmlSchemaOptions = Parameters<typeof createHtmlSchema>[0];
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type ProjectCreation = z.infer<typeof projectCreationSchema>;
//# sourceMappingURL=enhancedValidation.d.ts.map