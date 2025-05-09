// Define types locally or import from new backend API definitions

// Represents Project data fetched from the API (e.g., /api/projects)
export interface Project {
  id: string; // uuid
  user_id: string; // uuid
  title: string;
  description: string | null;
  created_at: string; // ISO date string (timestamptz)
  updated_at: string; // ISO date string (timestamptz)
  // Optional fields often included in list views
  thumbnail_url?: string | null;
  image_count?: number;
}

// Possible statuses for an image, including client-side saving state
export type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'saving';

// Represents Image data fetched from the API (e.g., /api/projects/:id/images)
export interface Image {
  id: string; // uuid
  project_id: string; // uuid
  user_id: string; // uuid
  name: string;
  storage_path: string; // Relative path in server storage
  thumbnail_path: string | null; // Relative path to thumbnail
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown> | null;
  status: ImageStatus; // Use the unified status type
  created_at: string; // ISO date string (timestamptz)
  updated_at: string; // ISO date string (timestamptz)
  segmentation_result?: {
    path?: string | null; // Relative path to the result file (e.g., PNG mask)
  } | null;
}

// --- Segmentation Related Types ---

export interface Point {
  x: number;
  y: number;
}

// import { Polygon as OpenSeadragonPolygon } from 'openseadragon'; // Removed example import

export interface Polygon {
  id: string; // Or number, depending on how Konva/script generates it
  points: Point[];
  type?: 'internal' | 'external'; // Made optional, can be derived from hierarchy
  class?: string; // e.g., 'spheroid', 'nucleus' - Keep optional
  color?: 'red' | 'blue' | string; // Allow specific colors or general string
  parentId?: string; // Reference to parent polygon for holes - Keep optional
}

// Structure for segmentation data (output from Python script, stored in DB, used by canvas)
export interface SegmentationResultData {
  polygons?: Polygon[]; // Make optional if contours are primary
  // Add fields for contours and hierarchy from OpenCV
  contours?: Array<Array<[number, number]>>; // Array of contours, each contour is array of [x, y] points
  hierarchy?: Array<[number, number, number, number]>; // Array of hierarchy [Next, Previous, First_Child, Parent]
  // Use direct properties for width and height, consistent with usage
  imageWidth: number;
  imageHeight: number;
  // Metadata for tracking segmentation source and other information
  metadata?: {
    source?: 'resunet' | 'api' | 'empty' | 'cv2'; // Add 'cv2' source
    timestamp?: string;
    modelType?: string;
    [key: string]: unknown; // Changed any to unknown for better type safety
  };
}

// Type for the API response from GET /api/images/:id/segmentation
// Reflects the structure of the segmentation_results table row
export interface SegmentationApiResponse {
  image_id: string;
  status: ImageStatus; // Use the shared ImageStatus type
  result_data?: SegmentationResultData | null; // Use the updated type
  // Use 'unknown' instead of 'any' for better type safety
  parameters?: Record<string, unknown> | null; // Parameters used for segmentation
  created_at: string;
  updated_at: string;
  error?: string | null; // Added for consistency if backend sends error details this way
}

// --- UI Specific Types (Derived/Transformed from API types) ---

// Represents structure needed by UI components like image lists/thumbnails
// Note: Dates are converted to Date objects here
export interface ProjectImage {
  id: string;
  project_id: string;
  name: string;
  url: string; // Derived from storage_path (e.g., prepended base URL)
  thumbnail_url: string | null; // Derived from thumbnail_path
  createdAt: Date; // Date object, converted from API string
  updatedAt: Date; // Date object, converted from API string
  width: number | null; // Added width
  height: number | null; // Added height
  segmentationStatus: ImageStatus; // Maps to Image.status, includes 'saving'
  segmentationResultPath?: string | null; // Add this field for result URL
}

// Export UserProfile from its dedicated file
export * from './userProfile';

// Alias for clarity in canvas components - Use the new type
export type CanvasSegmentationData = SegmentationResultData;

// --- Core Types ---
/* // Start comment block for removal
export interface User {
  id: string;
  email: string;
  // Add other user fields as needed (e.g., name, role) from your token/API
}

export interface UserProfile {
  user_id: string;
  username?: string | null;
  full_name?: string | null;
  title?: string | null;
  organization?: string | null;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  preferred_language?: string | null;
}
*/ // End comment block for removal

// --- API Request/Response Specific Types (Optional but helpful) ---
/* // Start comment block for removal
// Example for Login
export interface LoginResponse {
  token: string;
  user: User; // Or just user ID/email
}

// Example for User Profile Update
export type UserProfileUpdatePayload = Partial<Omit<UserProfile, 'user_id'>>;

// Example for Project Creation
export type ProjectCreatePayload = Pick<Project, 'title' | 'description'>;

// Example for Access Request
export interface AccessRequestPayload {
  email: string;
  name?: string;
  organization?: string;
  reason?: string;
}
export interface AccessRequestResponse {
    id: string;
    email: string;
    status: string;
    created_at: string;
}
*/ // End comment block for removal
