/**
 * Integration Test Setup
 *
 * Common setup for integration tests across the monorepo
 */
export declare const integrationTestConfig: {
    database: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
    api: {
        baseUrl: string;
        timeout: number;
    };
    ml: {
        baseUrl: string;
        timeout: number;
    };
    websocket: {
        url: string;
        timeout: number;
    };
    upload: {
        maxSize: number;
        chunkSize: number;
    };
    timeouts: {
        unit: number;
        integration: number;
        e2e: number;
    };
};
export declare function getTestDbPool(): Promise<any>;
export declare const testDb: {
    query(text: string, params?: any[]): Promise<any>;
    transaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
    cleanup(): Promise<void>;
};
export declare const testFactories: {
    user: (overrides?: {}) => {
        id: string;
        email: string;
        password: string;
        name: string;
    };
    project: (userId: string, overrides?: {}) => {
        id: string;
        userId: string;
        name: string;
        description: string;
    };
    image: (projectId: string, overrides?: {}) => {
        id: string;
        projectId: string;
        name: string;
        url: string;
        thumbnailUrl: string;
        size: number;
        width: number;
        height: number;
        segmentationStatus: string;
    };
    segmentation: (imageId: string, overrides?: {}) => {
        id: string;
        imageId: string;
        status: string;
        cellCount: number;
        metadata: {};
    };
};
export declare const testApi: {
    post(endpoint: string, data: any, options?: any): Promise<unknown>;
    get(endpoint: string, options?: any): Promise<unknown>;
};
export declare class TestWebSocketClient {
    private ws;
    private handlers;
    connect(token?: string): Promise<void>;
    on(event: string, handler: Function): void;
    off(event: string, handler?: Function): void;
    emit(event: string, data: any): void;
    disconnect(): void;
}
export declare function setupIntegrationTests(): void;
export declare function waitForCondition(condition: () => boolean | Promise<boolean>, timeout?: number, interval?: number): Promise<void>;
export declare function createAuthenticatedContext(): Promise<{
    user: {
        id: string;
        email: string;
        password: string;
        name: string;
    };
    accessToken: any;
    refreshToken: any;
    headers: {
        Authorization: string;
    };
}>;
declare const _default: {
    config: {
        database: {
            host: string;
            port: number;
            database: string;
            user: string;
            password: string;
        };
        api: {
            baseUrl: string;
            timeout: number;
        };
        ml: {
            baseUrl: string;
            timeout: number;
        };
        websocket: {
            url: string;
            timeout: number;
        };
        upload: {
            maxSize: number;
            chunkSize: number;
        };
        timeouts: {
            unit: number;
            integration: number;
            e2e: number;
        };
    };
    db: {
        query(text: string, params?: any[]): Promise<any>;
        transaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
        cleanup(): Promise<void>;
    };
    factories: {
        user: (overrides?: {}) => {
            id: string;
            email: string;
            password: string;
            name: string;
        };
        project: (userId: string, overrides?: {}) => {
            id: string;
            userId: string;
            name: string;
            description: string;
        };
        image: (projectId: string, overrides?: {}) => {
            id: string;
            projectId: string;
            name: string;
            url: string;
            thumbnailUrl: string;
            size: number;
            width: number;
            height: number;
            segmentationStatus: string;
        };
        segmentation: (imageId: string, overrides?: {}) => {
            id: string;
            imageId: string;
            status: string;
            cellCount: number;
            metadata: {};
        };
    };
    api: {
        post(endpoint: string, data: any, options?: any): Promise<unknown>;
        get(endpoint: string, options?: any): Promise<unknown>;
    };
    WebSocketClient: typeof TestWebSocketClient;
    setupIntegrationTests: typeof setupIntegrationTests;
    waitForCondition: typeof waitForCondition;
    createAuthenticatedContext: typeof createAuthenticatedContext;
};
export default _default;
//# sourceMappingURL=integration-test-setup.d.ts.map