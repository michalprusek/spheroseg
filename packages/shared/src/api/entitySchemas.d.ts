import { z } from 'zod';
/**
 * Entity-specific validation schemas
 *
 * These schemas define the structure of core entities in the application
 * and can be used for validation and type generation.
 */
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    email: z.ZodString;
    name: z.ZodString;
    preferredLanguage: z.ZodDefault<z.ZodEnum<["en", "cs", "de", "es", "fr", "zh"]>>;
    emailVerified: z.ZodDefault<z.ZodBoolean>;
    role: z.ZodDefault<z.ZodEnum<["user", "admin"]>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    lastLoginAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    preferredLanguage: "en" | "cs" | "de" | "es" | "fr" | "zh";
    emailVerified: boolean;
    role: "user" | "admin";
    isActive: boolean;
    lastLoginAt?: string | null | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    preferredLanguage?: "en" | "cs" | "de" | "es" | "fr" | "zh" | undefined;
    emailVerified?: boolean | undefined;
    role?: "user" | "admin" | undefined;
    isActive?: boolean | undefined;
    lastLoginAt?: string | null | undefined;
}>;
export declare const UserProfileSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    email: z.ZodString;
    name: z.ZodString;
    preferredLanguage: z.ZodDefault<z.ZodEnum<["en", "cs", "de", "es", "fr", "zh"]>>;
    emailVerified: z.ZodDefault<z.ZodBoolean>;
    role: z.ZodDefault<z.ZodEnum<["user", "admin"]>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    lastLoginAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
} & {
    avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    bio: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    organization: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    preferredLanguage: "en" | "cs" | "de" | "es" | "fr" | "zh";
    emailVerified: boolean;
    role: "user" | "admin";
    isActive: boolean;
    organization?: string | null | undefined;
    bio?: string | null | undefined;
    location?: string | null | undefined;
    lastLoginAt?: string | null | undefined;
    avatar?: string | null | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    organization?: string | null | undefined;
    bio?: string | null | undefined;
    location?: string | null | undefined;
    preferredLanguage?: "en" | "cs" | "de" | "es" | "fr" | "zh" | undefined;
    emailVerified?: boolean | undefined;
    role?: "user" | "admin" | undefined;
    isActive?: boolean | undefined;
    lastLoginAt?: string | null | undefined;
    avatar?: string | null | undefined;
}>;
export declare const UserLoginResponseSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    } & {
        email: z.ZodString;
        name: z.ZodString;
        preferredLanguage: z.ZodDefault<z.ZodEnum<["en", "cs", "de", "es", "fr", "zh"]>>;
        emailVerified: z.ZodDefault<z.ZodBoolean>;
        role: z.ZodDefault<z.ZodEnum<["user", "admin"]>>;
        isActive: z.ZodDefault<z.ZodBoolean>;
        lastLoginAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        email: string;
        preferredLanguage: "en" | "cs" | "de" | "es" | "fr" | "zh";
        emailVerified: boolean;
        role: "user" | "admin";
        isActive: boolean;
        lastLoginAt?: string | null | undefined;
    }, {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        email: string;
        preferredLanguage?: "en" | "cs" | "de" | "es" | "fr" | "zh" | undefined;
        emailVerified?: boolean | undefined;
        role?: "user" | "admin" | undefined;
        isActive?: boolean | undefined;
        lastLoginAt?: string | null | undefined;
    }>;
    tokens: z.ZodObject<{
        accessToken: z.ZodString;
        refreshToken: z.ZodString;
        expiresIn: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }, {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        email: string;
        preferredLanguage: "en" | "cs" | "de" | "es" | "fr" | "zh";
        emailVerified: boolean;
        role: "user" | "admin";
        isActive: boolean;
        lastLoginAt?: string | null | undefined;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    };
}, {
    user: {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        email: string;
        preferredLanguage?: "en" | "cs" | "de" | "es" | "fr" | "zh" | undefined;
        emailVerified?: boolean | undefined;
        role?: "user" | "admin" | undefined;
        isActive?: boolean | undefined;
        lastLoginAt?: string | null | undefined;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    };
}>;
export declare const ProjectSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    userId: z.ZodString;
    imageCount: z.ZodDefault<z.ZodNumber>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    settings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    imageCount: number;
    isPublic: boolean;
    tags: string[];
    settings: Record<string, unknown>;
    description?: string | null | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    description?: string | null | undefined;
    imageCount?: number | undefined;
    isPublic?: boolean | undefined;
    tags?: string[] | undefined;
    settings?: Record<string, unknown> | undefined;
}>;
export declare const ProjectStatsSchema: z.ZodObject<{
    totalImages: z.ZodNumber;
    segmentedImages: z.ZodNumber;
    totalCells: z.ZodNumber;
    averageCellsPerImage: z.ZodNumber;
    lastActivityAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    totalImages: number;
    segmentedImages: number;
    totalCells: number;
    averageCellsPerImage: number;
    lastActivityAt?: string | null | undefined;
}, {
    totalImages: number;
    segmentedImages: number;
    totalCells: number;
    averageCellsPerImage: number;
    lastActivityAt?: string | null | undefined;
}>;
export declare const ImageSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    projectId: z.ZodString;
    name: z.ZodString;
    filename: z.ZodString;
    originalName: z.ZodString;
    mimetype: z.ZodString;
    size: z.ZodNumber;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    segmentationStatus: z.ZodDefault<z.ZodEnum<["without_segmentation", "queued", "processing", "completed", "failed"]>>;
    url: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
    segmentationStatus: "queued" | "processing" | "completed" | "failed" | "without_segmentation";
    width?: number | null | undefined;
    height?: number | null | undefined;
    thumbnailUrl?: string | null | undefined;
}, {
    id: string;
    name: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
    width?: number | null | undefined;
    height?: number | null | undefined;
    segmentationStatus?: "queued" | "processing" | "completed" | "failed" | "without_segmentation" | undefined;
    thumbnailUrl?: string | null | undefined;
}>;
export declare const SegmentationResultSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    imageId: z.ZodString;
    status: z.ZodEnum<["pending", "processing", "completed", "failed"]>;
    cellCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    processingTime: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "processing" | "completed" | "failed" | "pending";
    id: string;
    imageId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    error?: string | null | undefined;
    cellCount?: number | null | undefined;
    processingTime?: number | null | undefined;
}, {
    status: "processing" | "completed" | "failed" | "pending";
    id: string;
    imageId: string;
    createdAt: string;
    updatedAt: string;
    error?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    cellCount?: number | null | undefined;
    processingTime?: number | null | undefined;
}>;
export declare const CellSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    segmentationResultId: z.ZodString;
    cellNumber: z.ZodNumber;
    area: z.ZodNumber;
    perimeter: z.ZodNumber;
    centroidX: z.ZodNumber;
    centroidY: z.ZodNumber;
    eccentricity: z.ZodNumber;
    solidity: z.ZodNumber;
    circularity: z.ZodNumber;
    polygon: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, "many">;
    features: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    segmentationResultId: string;
    cellNumber: number;
    area: number;
    perimeter: number;
    centroidX: number;
    centroidY: number;
    eccentricity: number;
    solidity: number;
    circularity: number;
    polygon: [number, number][];
    features: Record<string, number>;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    segmentationResultId: string;
    cellNumber: number;
    area: number;
    perimeter: number;
    centroidX: number;
    centroidY: number;
    eccentricity: number;
    solidity: number;
    circularity: number;
    polygon: [number, number][];
    features?: Record<string, number> | undefined;
}>;
export declare const SegmentationTaskSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    imageId: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
    taskStatus: z.ZodEnum<["queued", "processing", "completed", "failed"]>;
    startedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    retryCount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    imageId: string;
    createdAt: string;
    updatedAt: string;
    priority: number;
    taskStatus: "queued" | "processing" | "completed" | "failed";
    retryCount: number;
    error?: string | null | undefined;
    startedAt?: string | null | undefined;
    completedAt?: string | null | undefined;
}, {
    id: string;
    imageId: string;
    createdAt: string;
    updatedAt: string;
    taskStatus: "queued" | "processing" | "completed" | "failed";
    error?: string | null | undefined;
    priority?: number | undefined;
    startedAt?: string | null | undefined;
    completedAt?: string | null | undefined;
    retryCount?: number | undefined;
}>;
export declare const UserSettingSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>]>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string | number | boolean | Record<string, unknown>;
    key: string;
    updatedAt: string;
    category?: string | null | undefined;
}, {
    value: string | number | boolean | Record<string, unknown>;
    key: string;
    updatedAt: string;
    category?: string | null | undefined;
}>;
export declare const ExportRequestSchema: z.ZodObject<{
    projectId: z.ZodString;
    format: z.ZodEnum<["csv", "json", "excel"]>;
    includeImages: z.ZodDefault<z.ZodBoolean>;
    includeFeatures: z.ZodDefault<z.ZodBoolean>;
    imageIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    projectId: string;
    format: "csv" | "json" | "excel";
    includeImages: boolean;
    includeFeatures: boolean;
    imageIds?: string[] | undefined;
}, {
    projectId: string;
    format: "csv" | "json" | "excel";
    includeImages?: boolean | undefined;
    includeFeatures?: boolean | undefined;
    imageIds?: string[] | undefined;
}>;
export declare const BatchDeleteRequestSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
    type: z.ZodEnum<["images", "projects", "cells"]>;
}, "strip", z.ZodTypeAny, {
    type: "images" | "projects" | "cells";
    ids: string[];
}, {
    type: "images" | "projects" | "cells";
    ids: string[];
}>;
export declare const BatchDeleteResponseSchema: z.ZodObject<{
    successful: z.ZodNumber;
    failed: z.ZodNumber;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        error: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        error: string;
        id: string;
    }, {
        error: string;
        id: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    failed: number;
    successful: number;
    errors?: {
        error: string;
        id: string;
    }[] | undefined;
}, {
    failed: number;
    successful: number;
    errors?: {
        error: string;
        id: string;
    }[] | undefined;
}>;
export declare const ProjectShareSchema: z.ZodObject<{
    projectId: z.ZodString;
    sharedWithUserId: z.ZodString;
    permission: z.ZodEnum<["view", "edit", "admin"]>;
    sharedAt: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    projectId: string;
    sharedWithUserId: string;
    permission: "admin" | "view" | "edit";
    sharedAt: string;
    expiresAt?: string | null | undefined;
}, {
    projectId: string;
    sharedWithUserId: string;
    permission: "admin" | "view" | "edit";
    sharedAt: string;
    expiresAt?: string | null | undefined;
}>;
export declare const SearchQuerySchema: z.ZodObject<{
    query: z.ZodString;
    filters: z.ZodOptional<z.ZodObject<{
        projectId: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
        dateFrom: z.ZodOptional<z.ZodString>;
        dateTo: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        status?: string | undefined;
        projectId?: string | undefined;
        tags?: string[] | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    }, {
        status?: string | undefined;
        projectId?: string | undefined;
        tags?: string[] | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    }>>;
    pagination: z.ZodOptional<z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        pageSize: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        pageSize: number;
    }, {
        page?: number | undefined;
        pageSize?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    filters?: {
        status?: string | undefined;
        projectId?: string | undefined;
        tags?: string[] | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    } | undefined;
    pagination?: {
        page: number;
        pageSize: number;
    } | undefined;
}, {
    query: string;
    filters?: {
        status?: string | undefined;
        projectId?: string | undefined;
        tags?: string[] | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    } | undefined;
    pagination?: {
        page?: number | undefined;
        pageSize?: number | undefined;
    } | undefined;
}>;
export type User = z.infer<typeof UserSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserLoginResponse = z.infer<typeof UserLoginResponseSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStats = z.infer<typeof ProjectStatsSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type SegmentationResult = z.infer<typeof SegmentationResultSchema>;
export type Cell = z.infer<typeof CellSchema>;
export type SegmentationTask = z.infer<typeof SegmentationTaskSchema>;
export type UserSetting = z.infer<typeof UserSettingSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type BatchDeleteRequest = z.infer<typeof BatchDeleteRequestSchema>;
export type BatchDeleteResponse = z.infer<typeof BatchDeleteResponseSchema>;
export type ProjectShare = z.infer<typeof ProjectShareSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
//# sourceMappingURL=entitySchemas.d.ts.map