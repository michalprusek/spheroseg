/**
 * WebSocket types for the SpherosegV4 application
 */

export interface BatchMessage {
  id: string;
  event: string;
  data: any;
  timestamp: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxBatchWaitTime: number;
  enableCompression?: boolean;
}

export interface BatchCapabilities {
  supportsBatching: boolean;
  supportsCompression: boolean;
  version: string;
}

export interface BatchStatus {
  enabled: boolean;
  queueLength: number;
  pendingAcks: number;
  capabilities: BatchCapabilities | null;
  isConnected: boolean;
}

export interface WebSocketOptions {
  auth?: {
    token: string;
  };
  enableBatching?: boolean;
  batchConfig?: Partial<BatchConfig>;
}

export interface BatchAcknowledgment {
  batchId: string;
  results: Array<{
    messageId: string;
    data?: any;
    error?: string;
  }>;
}

export interface BatchError {
  batchId: string;
  error: string;
}

// Event types for type-safe event handling
export type WebSocketEventMap = {
  // Connection events
  'ws:connected': void;
  'ws:disconnected': string;
  'ws:error': Error;

  // Segmentation events
  'segmentation:update': {
    imageId: string;
    status: string;
    progress?: number;
    message?: string;
  };

  // Image events
  'image:created': {
    imageId: string;
    name: string;
    projectId: string;
  };
  'image:updated': {
    imageId: string;
    changes: Record<string, any>;
  };
  'image:deleted': {
    imageId: string;
  };

  // Cell events
  'cell:created': {
    cellId: string;
    imageId: string;
    polygon: number[][];
  };
  'cell:updated': {
    cellId: string;
    changes: Record<string, any>;
  };
  'cell:deleted': {
    cellId: string;
  };

  // Batch events
  batch: {
    messages: BatchMessage[];
    compressed?: boolean;
  };
  batch_ack: BatchAcknowledgment;
  batch_error: BatchError;
  capabilities: BatchCapabilities;
};

// Type-safe event emitter interface
export interface TypedEventEmitter<T extends Record<string, any>> {
  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void;
  off<K extends keyof T>(event: K, handler?: (data: T[K]) => void): void;
  emit<K extends keyof T>(event: K, data: T[K]): void;
}
