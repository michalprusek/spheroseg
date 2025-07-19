/**
 * Common metric types shared between frontend and backend
 */
/**
 * Performance metric types
 */
export declare enum MetricType {
    PAGE_LOAD = "page_load",
    COMPONENT_RENDER = "component_render",
    API_REQUEST = "api_request",
    RESOURCE_LOAD = "resource_load",
    USER_INTERACTION = "user_interaction",
    MEMORY_USAGE = "memory_usage",
    API_RESPONSE_TIME = "api_response_time",
    DATABASE_QUERY = "database_query",
    FILE_OPERATION = "file_operation",
    ML_INFERENCE = "ml_inference",
    MEMORY_HEAP = "memory_heap",
    CPU_USAGE = "cpu_usage"
}
/**
 * Base metric interface
 */
export interface BaseMetric {
    type: MetricType;
    timestamp: number;
    value: number;
    labels?: Record<string, string>;
}
/**
 * Frontend page load metric
 */
export interface PageLoadMetric extends BaseMetric {
    type: MetricType.PAGE_LOAD;
    route: string;
    loadTime: number;
    domContentLoaded?: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
}
/**
 * Frontend component render metric
 */
export interface ComponentRenderMetric extends BaseMetric {
    type: MetricType.COMPONENT_RENDER;
    component: string;
    renderTime: number;
}
/**
 * API request metric (frontend)
 */
export interface ApiRequestMetric extends BaseMetric {
    type: MetricType.API_REQUEST;
    endpoint: string;
    method: string;
    duration: number;
    status: number;
    error?: string;
}
/**
 * Resource load metric (frontend)
 */
export interface ResourceLoadMetric extends BaseMetric {
    type: MetricType.RESOURCE_LOAD;
    resourceUrl: string;
    resourceType: string;
    loadTime: number;
    size?: number;
}
/**
 * User interaction metric (frontend)
 */
export interface UserInteractionMetric extends BaseMetric {
    type: MetricType.USER_INTERACTION;
    action: string;
    target: string;
    duration: number;
}
/**
 * Memory usage metric (frontend)
 */
export interface MemoryUsageMetric extends BaseMetric {
    type: MetricType.MEMORY_USAGE;
    jsHeapSizeLimit?: number;
    totalJSHeapSize?: number;
    usedJSHeapSize?: number;
}
/**
 * API response time metric (backend)
 */
export interface ApiResponseTimeMetric extends BaseMetric {
    type: MetricType.API_RESPONSE_TIME;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    userId?: string;
}
/**
 * Database query metric (backend)
 */
export interface DatabaseQueryMetric extends BaseMetric {
    type: MetricType.DATABASE_QUERY;
    operation: string;
    table: string;
    duration: number;
    rowCount?: number;
}
/**
 * File operation metric (backend)
 */
export interface FileOperationMetric extends BaseMetric {
    type: MetricType.FILE_OPERATION;
    operation: string;
    filePath: string;
    duration: number;
    fileSize?: number;
}
/**
 * ML inference metric (backend)
 */
export interface MLInferenceMetric extends BaseMetric {
    type: MetricType.ML_INFERENCE;
    model: string;
    inputSize: number;
    duration: number;
    memoryUsage?: number;
}
/**
 * Memory heap metric (backend)
 */
export interface MemoryHeapMetric extends BaseMetric {
    type: MetricType.MEMORY_HEAP;
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
}
/**
 * CPU usage metric (backend)
 */
export interface CPUUsageMetric extends BaseMetric {
    type: MetricType.CPU_USAGE;
    user: number;
    system: number;
    percentage: number;
}
/**
 * Union type of all metrics
 */
export type Metric = PageLoadMetric | ComponentRenderMetric | ApiRequestMetric | ResourceLoadMetric | UserInteractionMetric | MemoryUsageMetric | ApiResponseTimeMetric | DatabaseQueryMetric | FileOperationMetric | MLInferenceMetric | MemoryHeapMetric | CPUUsageMetric;
//# sourceMappingURL=metricsTypes.d.ts.map