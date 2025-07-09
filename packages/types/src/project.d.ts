/**
 * Project related types
 */
export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string | null;
  image_count?: number;
}
export type ProjectCreatePayload = Pick<Project, 'title' | 'description'>;
export interface ProjectStatsResponse {
  user_id: string;
  project_count: number;
  image_count: number;
  segmentation_count: number;
  recently_updated_projects: Array<{
    id: string;
    title: string;
    updated_at: string;
  }>;
  storage_usage: {
    total_bytes: number;
    images_bytes: number;
    segmentations_bytes: number;
  };
}
