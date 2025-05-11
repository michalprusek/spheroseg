/**
 * Image related types
 */

import { ImageStatus } from './segmentation';

export interface ImageData {
  id: string;
  name: string;
  width: number;
  height: number;
  src: string;
  storage_path?: string;
  storage_path_full?: string;
  project_id?: string;
  projectId?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  status?: ImageStatus;
  actualId?: string;
  [key: string]: unknown;
}

export interface Image {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  storage_path: string;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown> | null;
  status: ImageStatus;
  created_at: string;
  updated_at: string;
  segmentation_result?: {
    path?: string | null;
  } | null;
}

export interface ProjectImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  createdAt: Date;
  updatedAt: Date;
  width: number | null;
  height: number | null;
  segmentationStatus: ImageStatus;
  segmentationResultPath?: string | null;
}
