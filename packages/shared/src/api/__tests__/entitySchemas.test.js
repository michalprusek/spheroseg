"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const entitySchemas_1 = require("../entitySchemas");
(0, vitest_1.describe)('Entity Schemas', () => {
    (0, vitest_1.describe)('UserSchema', () => {
        (0, vitest_1.it)('should validate a valid user', () => {
            const validUser = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                email: 'test@example.com',
                name: 'Test User',
                preferredLanguage: 'en',
                emailVerified: true,
                role: 'user',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.UserSchema.safeParse(validUser);
            (0, vitest_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, vitest_1.expect)(result.data.email).toBe('test@example.com');
            }
        });
        (0, vitest_1.it)('should reject invalid email', () => {
            const invalidUser = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                email: 'not-an-email',
                name: 'Test User',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.UserSchema.safeParse(invalidUser);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
        (0, vitest_1.it)('should apply default values', () => {
            const minimalUser = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                email: 'test@example.com',
                name: 'Test User',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.UserSchema.safeParse(minimalUser);
            (0, vitest_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, vitest_1.expect)(result.data.preferredLanguage).toBe('en');
                (0, vitest_1.expect)(result.data.emailVerified).toBe(false);
                (0, vitest_1.expect)(result.data.role).toBe('user');
                (0, vitest_1.expect)(result.data.isActive).toBe(true);
            }
        });
    });
    (0, vitest_1.describe)('ProjectSchema', () => {
        (0, vitest_1.it)('should validate a valid project', () => {
            const validProject = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Test Project',
                description: 'A test project',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                imageCount: 10,
                isPublic: false,
                tags: ['test', 'sample'],
                settings: { key: 'value' },
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.ProjectSchema.safeParse(validProject);
            (0, vitest_1.expect)(result.success).toBe(true);
        });
        (0, vitest_1.it)('should enforce name constraints', () => {
            const invalidProject = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: '', // Empty name
                userId: '550e8400-e29b-41d4-a716-446655440001',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.ProjectSchema.safeParse(invalidProject);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)('ImageSchema', () => {
        (0, vitest_1.it)('should validate a valid image', () => {
            const validImage = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                projectId: '550e8400-e29b-41d4-a716-446655440001',
                name: 'test-image',
                filename: 'test-image.jpg',
                originalName: 'Test Image.jpg',
                mimetype: 'image/jpeg',
                size: 1024000,
                width: 1920,
                height: 1080,
                segmentationStatus: 'completed',
                url: 'https://example.com/images/test-image.jpg',
                thumbnailUrl: 'https://example.com/images/thumb-test-image.jpg',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.ImageSchema.safeParse(validImage);
            (0, vitest_1.expect)(result.success).toBe(true);
        });
        (0, vitest_1.it)('should validate segmentation status enum', () => {
            const imageWithInvalidStatus = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                projectId: '550e8400-e29b-41d4-a716-446655440001',
                name: 'test-image',
                filename: 'test-image.jpg',
                originalName: 'Test Image.jpg',
                mimetype: 'image/jpeg',
                size: 1024000,
                segmentationStatus: 'invalid_status', // Invalid
                url: 'https://example.com/images/test-image.jpg',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.ImageSchema.safeParse(imageWithInvalidStatus);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)('CellSchema', () => {
        (0, vitest_1.it)('should validate a valid cell', () => {
            const validCell = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                segmentationResultId: '550e8400-e29b-41d4-a716-446655440001',
                cellNumber: 1,
                area: 125.5,
                perimeter: 45.2,
                centroidX: 100.5,
                centroidY: 200.5,
                eccentricity: 0.85,
                solidity: 0.92,
                circularity: 0.78,
                polygon: [
                    [100, 200],
                    [110, 210],
                    [120, 200],
                    [110, 190],
                ],
                features: {
                    meanIntensity: 150.5,
                    stdIntensity: 25.3,
                },
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.CellSchema.safeParse(validCell);
            (0, vitest_1.expect)(result.success).toBe(true);
        });
        (0, vitest_1.it)('should validate numeric constraints', () => {
            const invalidCell = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                segmentationResultId: '550e8400-e29b-41d4-a716-446655440001',
                cellNumber: 0, // Should be positive
                area: -10, // Should be positive
                perimeter: 45.2,
                centroidX: 100.5,
                centroidY: 200.5,
                eccentricity: 1.5, // Should be 0-1
                solidity: -0.5, // Should be 0-1
                circularity: 2.0, // Should be 0-1
                polygon: [[100, 200]],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = entitySchemas_1.CellSchema.safeParse(invalidCell);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)('BatchDeleteRequestSchema', () => {
        (0, vitest_1.it)('should validate a valid batch delete request', () => {
            const validRequest = {
                ids: [
                    '550e8400-e29b-41d4-a716-446655440000',
                    '550e8400-e29b-41d4-a716-446655440001',
                ],
                type: 'images',
            };
            const result = entitySchemas_1.BatchDeleteRequestSchema.safeParse(validRequest);
            (0, vitest_1.expect)(result.success).toBe(true);
        });
        (0, vitest_1.it)('should reject empty ids array', () => {
            const invalidRequest = {
                ids: [],
                type: 'images',
            };
            const result = entitySchemas_1.BatchDeleteRequestSchema.safeParse(invalidRequest);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
        (0, vitest_1.it)('should validate type enum', () => {
            const invalidRequest = {
                ids: ['550e8400-e29b-41d4-a716-446655440000'],
                type: 'invalid_type',
            };
            const result = entitySchemas_1.BatchDeleteRequestSchema.safeParse(invalidRequest);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)('SearchQuerySchema', () => {
        (0, vitest_1.it)('should validate a valid search query', () => {
            const validQuery = {
                query: 'test search',
                filters: {
                    projectId: '550e8400-e29b-41d4-a716-446655440000',
                    status: 'completed',
                    tags: ['tag1', 'tag2'],
                },
                pagination: {
                    page: 2,
                    pageSize: 50,
                },
            };
            const result = entitySchemas_1.SearchQuerySchema.safeParse(validQuery);
            (0, vitest_1.expect)(result.success).toBe(true);
        });
        (0, vitest_1.it)('should apply default pagination', () => {
            const minimalQuery = {
                query: 'test search',
            };
            const result = entitySchemas_1.SearchQuerySchema.safeParse(minimalQuery);
            (0, vitest_1.expect)(result.success).toBe(true);
            if (result.success && result.data.pagination) {
                (0, vitest_1.expect)(result.data.pagination.page).toBe(1);
                (0, vitest_1.expect)(result.data.pagination.pageSize).toBe(20);
            }
        });
        (0, vitest_1.it)('should enforce pagination limits', () => {
            const queryWithLargePageSize = {
                query: 'test search',
                pagination: {
                    page: 1,
                    pageSize: 200, // Max is 100
                },
            };
            const result = entitySchemas_1.SearchQuerySchema.safeParse(queryWithLargePageSize);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=entitySchemas.test.js.map