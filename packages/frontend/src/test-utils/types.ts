// Types for test utilities

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Image {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  thumbnail_path: string;
  segmentation_status: 'without_segmentation' | 'queued' | 'processing' | 'completed' | 'failed';
  project_id: string;
  uploaded_at: string;
}

export interface Cell {
  id: string;
  image_id: string;
  polygon_data: string;
  area: number;
  perimeter: number;
  circularity: number;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: string;
}

export interface ApiError {
  message: string;
  status: number;
  code: string;
  timestamp: string;
}