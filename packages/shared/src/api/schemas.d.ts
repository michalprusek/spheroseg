import { z } from 'zod';
/**
 * Common validation schemas for API responses
 *
 * These schemas can be used with the UnifiedResponseHandler to validate
 * API responses and ensure type safety.
 */
export declare const ValidationErrorSchema: z.ZodObject<{
    field: z.ZodString;
    message: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    field: string;
    code?: string | undefined;
}, {
    message: string;
    field: string;
    code?: string | undefined;
}>;
export declare const ApiErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    path?: string | undefined;
    timestamp?: string | undefined;
    details?: Record<string, unknown> | undefined;
}, {
    code: string;
    message: string;
    path?: string | undefined;
    timestamp?: string | undefined;
    details?: Record<string, unknown> | undefined;
}>;
export declare const ResponseMetadataSchema: z.ZodObject<{
    timestamp: z.ZodString;
    duration: z.ZodOptional<z.ZodNumber>;
    pagination: z.ZodOptional<z.ZodObject<{
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
        totalPages: z.ZodNumber;
        totalItems: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    }, {
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    }>>;
    version: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    duration?: number | undefined;
    pagination?: {
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    } | undefined;
    version?: string | undefined;
}, {
    timestamp: string;
    duration?: number | undefined;
    pagination?: {
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    } | undefined;
    version?: string | undefined;
}>;
export declare const ApiResponseSchema: <T extends z.ZodType>(dataSchema: T) => z.ZodObject<{
    data: T;
    success: z.ZodLiteral<true>;
    message: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        pagination: z.ZodOptional<z.ZodObject<{
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            totalItems: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }>>;
        version: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    data: T;
    success: z.ZodLiteral<true>;
    message: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        pagination: z.ZodOptional<z.ZodObject<{
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            totalItems: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }>>;
        version: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }>>;
}>, any> extends infer T_1 ? { [k in keyof T_1]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    data: T;
    success: z.ZodLiteral<true>;
    message: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        pagination: z.ZodOptional<z.ZodObject<{
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            totalItems: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }>>;
        version: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }>>;
}>, any>[k]; } : never, z.baseObjectInputType<{
    data: T;
    success: z.ZodLiteral<true>;
    message: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        pagination: z.ZodOptional<z.ZodObject<{
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            totalItems: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }>>;
        version: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }>>;
}> extends infer T_2 ? { [k_1 in keyof T_2]: z.baseObjectInputType<{
    data: T;
    success: z.ZodLiteral<true>;
    message: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        pagination: z.ZodOptional<z.ZodObject<{
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            totalItems: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }>>;
        version: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }>>;
}>[k_1]; } : never>;
export declare const ApiErrorResponseSchema: z.ZodObject<{
    data: z.ZodNull;
    success: z.ZodLiteral<false>;
    message: z.ZodString;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        message: z.ZodString;
        code: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        field: string;
        code?: string | undefined;
    }, {
        message: string;
        field: string;
        code?: string | undefined;
    }>, "many">>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        timestamp: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        path?: string | undefined;
        timestamp?: string | undefined;
        details?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        path?: string | undefined;
        timestamp?: string | undefined;
        details?: Record<string, unknown> | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        pagination: z.ZodOptional<z.ZodObject<{
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            totalItems: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }>>;
        version: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: false;
    data: null;
    error?: {
        code: string;
        message: string;
        path?: string | undefined;
        timestamp?: string | undefined;
        details?: Record<string, unknown> | undefined;
    } | undefined;
    errors?: {
        message: string;
        field: string;
        code?: string | undefined;
    }[] | undefined;
    metadata?: {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    } | undefined;
}, {
    message: string;
    success: false;
    data: null;
    error?: {
        code: string;
        message: string;
        path?: string | undefined;
        timestamp?: string | undefined;
        details?: Record<string, unknown> | undefined;
    } | undefined;
    errors?: {
        message: string;
        field: string;
        code?: string | undefined;
    }[] | undefined;
    metadata?: {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    } | undefined;
}>;
export declare const IdSchema: z.ZodString;
export declare const TimestampSchema: z.ZodString;
export declare const EmailSchema: z.ZodString;
export declare const PaginationParamsSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const BaseEntitySchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
}>;
export declare const FileUploadResponseSchema: z.ZodObject<{
    id: z.ZodString;
    filename: z.ZodString;
    originalName: z.ZodString;
    mimetype: z.ZodString;
    size: z.ZodNumber;
    url: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
}, {
    id: string;
    createdAt: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
}>;
export declare const SuccessMessageSchema: z.ZodObject<{
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
}, {
    message: string;
}>;
export declare const BatchOperationResultSchema: z.ZodObject<{
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
export declare function createPaginatedSchema<T extends z.ZodType>(itemSchema: T): z.ZodObject<{
    data: z.ZodArray<T, "many">;
    success: z.ZodLiteral<true>;
    message: z.ZodOptional<z.ZodString>;
} & {
    metadata: z.ZodObject<{
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        version: z.ZodOptional<z.ZodString>;
    } & {
        pagination: z.ZodObject<{
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            totalItems: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
        duration?: number | undefined;
        version?: string | undefined;
    }, {
        timestamp: string;
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
        duration?: number | undefined;
        version?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: T["_output"][];
    metadata: {
        timestamp: string;
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
        duration?: number | undefined;
        version?: string | undefined;
    };
    message?: string | undefined;
}, {
    success: true;
    data: T["_input"][];
    metadata: {
        timestamp: string;
        pagination: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
        duration?: number | undefined;
        version?: string | undefined;
    };
    message?: string | undefined;
}>;
export declare const schemas: {
    readonly ValidationErrorSchema: z.ZodObject<{
        field: z.ZodString;
        message: z.ZodString;
        code: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        field: string;
        code?: string | undefined;
    }, {
        message: string;
        field: string;
        code?: string | undefined;
    }>;
    readonly ApiErrorSchema: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        timestamp: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        path?: string | undefined;
        timestamp?: string | undefined;
        details?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        path?: string | undefined;
        timestamp?: string | undefined;
        details?: Record<string, unknown> | undefined;
    }>;
    readonly ResponseMetadataSchema: z.ZodObject<{
        timestamp: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        pagination: z.ZodOptional<z.ZodObject<{
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            totalItems: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }, {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        }>>;
        version: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }, {
        timestamp: string;
        duration?: number | undefined;
        pagination?: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        } | undefined;
        version?: string | undefined;
    }>;
    readonly ApiResponseSchema: <T extends z.ZodType>(dataSchema: T) => z.ZodObject<{
        data: T;
        success: z.ZodLiteral<true>;
        message: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodString;
            duration: z.ZodOptional<z.ZodNumber>;
            pagination: z.ZodOptional<z.ZodObject<{
                page: z.ZodNumber;
                pageSize: z.ZodNumber;
                totalPages: z.ZodNumber;
                totalItems: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }>>;
            version: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
        data: T;
        success: z.ZodLiteral<true>;
        message: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodString;
            duration: z.ZodOptional<z.ZodNumber>;
            pagination: z.ZodOptional<z.ZodObject<{
                page: z.ZodNumber;
                pageSize: z.ZodNumber;
                totalPages: z.ZodNumber;
                totalItems: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }>>;
            version: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }>>;
    }>, any> extends infer T_1 ? { [k in keyof T_1]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
        data: T;
        success: z.ZodLiteral<true>;
        message: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodString;
            duration: z.ZodOptional<z.ZodNumber>;
            pagination: z.ZodOptional<z.ZodObject<{
                page: z.ZodNumber;
                pageSize: z.ZodNumber;
                totalPages: z.ZodNumber;
                totalItems: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }>>;
            version: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }>>;
    }>, any>[k]; } : never, z.baseObjectInputType<{
        data: T;
        success: z.ZodLiteral<true>;
        message: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodString;
            duration: z.ZodOptional<z.ZodNumber>;
            pagination: z.ZodOptional<z.ZodObject<{
                page: z.ZodNumber;
                pageSize: z.ZodNumber;
                totalPages: z.ZodNumber;
                totalItems: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }>>;
            version: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }>>;
    }> extends infer T_2 ? { [k_1 in keyof T_2]: z.baseObjectInputType<{
        data: T;
        success: z.ZodLiteral<true>;
        message: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodString;
            duration: z.ZodOptional<z.ZodNumber>;
            pagination: z.ZodOptional<z.ZodObject<{
                page: z.ZodNumber;
                pageSize: z.ZodNumber;
                totalPages: z.ZodNumber;
                totalItems: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }>>;
            version: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }>>;
    }>[k_1]; } : never>;
    readonly ApiErrorResponseSchema: z.ZodObject<{
        data: z.ZodNull;
        success: z.ZodLiteral<false>;
        message: z.ZodString;
        errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            message: z.ZodString;
            code: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            message: string;
            field: string;
            code?: string | undefined;
        }, {
            message: string;
            field: string;
            code?: string | undefined;
        }>, "many">>;
        error: z.ZodOptional<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            timestamp: z.ZodOptional<z.ZodString>;
            path: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            message: string;
            path?: string | undefined;
            timestamp?: string | undefined;
            details?: Record<string, unknown> | undefined;
        }, {
            code: string;
            message: string;
            path?: string | undefined;
            timestamp?: string | undefined;
            details?: Record<string, unknown> | undefined;
        }>>;
        metadata: z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodString;
            duration: z.ZodOptional<z.ZodNumber>;
            pagination: z.ZodOptional<z.ZodObject<{
                page: z.ZodNumber;
                pageSize: z.ZodNumber;
                totalPages: z.ZodNumber;
                totalItems: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }, {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            }>>;
            version: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }, {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        success: false;
        data: null;
        error?: {
            code: string;
            message: string;
            path?: string | undefined;
            timestamp?: string | undefined;
            details?: Record<string, unknown> | undefined;
        } | undefined;
        errors?: {
            message: string;
            field: string;
            code?: string | undefined;
        }[] | undefined;
        metadata?: {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        } | undefined;
    }, {
        message: string;
        success: false;
        data: null;
        error?: {
            code: string;
            message: string;
            path?: string | undefined;
            timestamp?: string | undefined;
            details?: Record<string, unknown> | undefined;
        } | undefined;
        errors?: {
            message: string;
            field: string;
            code?: string | undefined;
        }[] | undefined;
        metadata?: {
            timestamp: string;
            duration?: number | undefined;
            pagination?: {
                page: number;
                pageSize: number;
                totalPages: number;
                totalItems: number;
            } | undefined;
            version?: string | undefined;
        } | undefined;
    }>;
    readonly IdSchema: z.ZodString;
    readonly TimestampSchema: z.ZodString;
    readonly EmailSchema: z.ZodString;
    readonly PaginationParamsSchema: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        pageSize: z.ZodDefault<z.ZodNumber>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        pageSize: number;
        sortOrder: "asc" | "desc";
        sortBy?: string | undefined;
    }, {
        page?: number | undefined;
        pageSize?: number | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
    readonly BaseEntitySchema: z.ZodObject<{
        id: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        createdAt: string;
        updatedAt: string;
    }>;
    readonly FileUploadResponseSchema: z.ZodObject<{
        id: z.ZodString;
        filename: z.ZodString;
        originalName: z.ZodString;
        mimetype: z.ZodString;
        size: z.ZodNumber;
        url: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        filename: string;
        originalName: string;
        mimetype: string;
        size: number;
        url: string;
    }, {
        id: string;
        createdAt: string;
        filename: string;
        originalName: string;
        mimetype: string;
        size: number;
        url: string;
    }>;
    readonly SuccessMessageSchema: z.ZodObject<{
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
    }, {
        message: string;
    }>;
    readonly BatchOperationResultSchema: z.ZodObject<{
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
    readonly createPaginatedSchema: typeof createPaginatedSchema;
};
//# sourceMappingURL=schemas.d.ts.map