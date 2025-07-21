/**
 * Main export file for @spheroseg/types package
 *
 * Uses explicit re-exports to avoid naming conflicts
 *
 * The api.ts module contains the primary types for API interactions,
 * so we export those as the default types and alias the others.
 */

// Export all from polygon except types that conflict with api.ts
export type {
  VertexHoverInfo,
  VertexDragInfo,
  DragInfo,
  TempPointsInfo,
  TransformState,
  EditMode,
  InteractionState,
} from './polygon';

// Export polygon types with aliases to avoid conflicts
export type { Point as PolygonPoint, Polygon as PolygonType } from './polygon';

// Export all from segmentation except types that conflict with api.ts
export type {
  ImageStatus,
  SegmentationData,
  SegmentationResultData,
  SegmentationApiResponse,
  CanvasSegmentationData,
} from './segmentation';

// Export segmentation types with aliases to avoid conflicts
export type {
  SegmentationStatus as SegmentationStatusEnum,
  SegmentationResult as SegmentationResultType,
} from './segmentation';

// Export all from project except types that conflict with api.ts
export type { ProjectCreatePayload, ProjectStatsResponse } from './project';

// Export project type with alias to avoid conflicts
export type { Project as ProjectType } from './project';

// Export all from user except types that conflict with api.ts
export type {
  UserProfile,
  RefreshTokenResponse,
  UserProfileUpdatePayload,
  AccessRequestPayload,
  AccessRequestResponse,
} from './user';

// Export user types with aliases to avoid conflicts
export type { User as UserType, LoginResponse as LoginResponseType } from './user';

// Export all from image except types that conflict with api.ts
export type { ImageData, ProjectImage } from './image';

// Export image type with alias to avoid conflicts
export type { Image as ImageType } from './image';

// Export all from export (no conflicts)
export * from './export';

// Export all from api - these are the primary types for API interactions
export * from './api';

// Export all from queue (no conflicts)
export * from './queue';

// Export all from auth except types that conflict with api.ts
export type {
  JWTPayload,
  RefreshTokenPayload,
  JWK,
  JWKS,
  RegisterRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  SendVerificationEmailRequest,
  VerifyEmailRequest,
  AuthResponse,
  AuthenticatedRequest,
} from './auth';

// Export auth types with aliases to avoid conflicts
export type { LoginRequest as AuthLoginRequest } from './auth';
