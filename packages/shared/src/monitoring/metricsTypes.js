"use strict";
/**
 * Common metric types shared between frontend and backend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricType = void 0;
/**
 * Performance metric types
 */
var MetricType;
(function (MetricType) {
    // Frontend metrics
    MetricType["PAGE_LOAD"] = "page_load";
    MetricType["COMPONENT_RENDER"] = "component_render";
    MetricType["API_REQUEST"] = "api_request";
    MetricType["RESOURCE_LOAD"] = "resource_load";
    MetricType["USER_INTERACTION"] = "user_interaction";
    MetricType["MEMORY_USAGE"] = "memory_usage";
    // Backend metrics
    MetricType["API_RESPONSE_TIME"] = "api_response_time";
    MetricType["DATABASE_QUERY"] = "database_query";
    MetricType["FILE_OPERATION"] = "file_operation";
    MetricType["ML_INFERENCE"] = "ml_inference";
    MetricType["MEMORY_HEAP"] = "memory_heap";
    MetricType["CPU_USAGE"] = "cpu_usage";
})(MetricType || (exports.MetricType = MetricType = {}));
//# sourceMappingURL=metricsTypes.js.map