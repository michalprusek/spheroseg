/**
 * Main export file for @spheroseg/types package
 *
 * Uses explicit re-exports to avoid naming conflicts
 *
 * The api.ts module contains the primary types for API interactions,
 * so we export those as the default types and alias the others.
 */
export { VertexHoverInfo, VertexDragInfo, DragInfo, TempPointsInfo, TransformState, EditMode, InteractionState, } from './polygon';
export { Point as PolygonPoint, Polygon as PolygonType } from './polygon';
export { ImageStatus, SegmentationData, SegmentationResultData, SegmentationApiResponse, CanvasSegmentationData, } from './segmentation';
export { SegmentationStatus as SegmentationStatusEnum, SegmentationResult as SegmentationResultType, } from './segmentation';
export { ProjectCreatePayload, ProjectStatsResponse } from './project';
export { Project as ProjectType } from './project';
export { UserProfile, RefreshTokenResponse, UserProfileUpdatePayload, AccessRequestPayload, AccessRequestResponse, } from './user';
export { User as UserType, LoginResponse as LoginResponseType } from './user';
export { ImageData, ProjectImage } from './image';
export { Image as ImageType } from './image';
export * from './export';
export * from './api';
export * from './queue';
export { JWTPayload, RefreshTokenPayload, JWK, JWKS, RegisterRequest, RefreshTokenRequest, ChangePasswordRequest, DeleteAccountRequest, SendVerificationEmailRequest, VerifyEmailRequest, AuthResponse, AuthenticatedRequest, } from './auth';
export { LoginRequest as AuthLoginRequest } from './auth';
//# sourceMappingURL=index.d.ts.map