/**
 * Shared API type definitions for SpherosegV4
 * These types ensure type safety across frontend and backend
 */

// Base API response types
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  metadata?: ResponseMetadata;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  statusCode?: number;
  validationErrors?: ValidationError[];
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ResponseMetadata {
  timestamp?: string;
  requestId?: string;
  version?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Pagination types
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  preferredLanguage?: string;
  avatar?: string;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  imageCount: number;
  cellCount: number;
  status: ProjectStatus;
  isPublic: boolean;
  tags?: string[];
}

export enum ProjectStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

// Image types
export interface Image {
  id: string;
  projectId: string;
  filename: string;
  originalFilename: string;
  filesize: number;
  mimeType: string;
  width: number;
  height: number;
  uploadedAt: string;
  segmentationStatus: SegmentationStatus;
  thumbnailUrl?: string;
  metadata?: ImageMetadata;
}

export enum SegmentationStatus {
  WITHOUT_SEGMENTATION = 'without_segmentation',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ImageMetadata {
  originalName?: string;
  uploadedBy?: string;
  processingTime?: number;
  error?: string;
}

// Segmentation types
export interface SegmentationResult {
  id: string;
  imageId: string;
  taskId: string;
  cellCount: number;
  features: CellFeatures[];
  polygons: Polygon[];
  processedAt: string;
  processingTime: number;
  modelVersion?: string;
}

export interface CellFeatures {
  id: string;
  area: number;
  perimeter: number;
  eccentricity: number;
  circularity: number;
  meanIntensity?: number;
  polygon: Polygon;
  centroid: Point;
}

export interface Polygon {
  points: Point[];
  id?: string;
  label?: string;
  confidence?: number;
}

export interface Point {
  x: number;
  y: number;
}

// File upload types
export interface FileUploadRequest {
  projectId: string;
  files: File[];
}

export interface FileUploadProgress {
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface FileUploadResponse {
  uploadedFiles: UploadedFile[];
  failedFiles: FailedUpload[];
}

export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  url: string;
}

export interface FailedUpload {
  filename: string;
  error: string;
}

// WebSocket event types
export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  data: T;
  timestamp: string;
  userId?: string;
}

export enum WebSocketEventType {
  // Image events
  IMAGE_PROCESSING_STARTED = 'image-processing-started',
  IMAGE_PROCESSING_PROGRESS = 'image-processing-progress',
  IMAGE_PROCESSING_COMPLETED = 'image-processing-completed',
  IMAGE_PROCESSING_FAILED = 'image-processing-failed',
  IMAGE_DELETED = 'image-deleted',

  // Project events
  PROJECT_UPDATED = 'project-updated',
  PROJECT_DELETED = 'project-deleted',

  // User events
  USER_JOINED_PROJECT = 'user-joined-project',
  USER_LEFT_PROJECT = 'user-left-project',

  // System events
  SYSTEM_NOTIFICATION = 'system-notification',
  CONNECTION_STATUS = 'connection-status',
}

// Query result type for database operations
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
  command: string;
}
