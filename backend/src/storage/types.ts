export interface FileData {
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  createdAt?: Date;
  modifiedAt?: Date;
  original_name?: string;
  project_id?: string;
}

export interface FileResponse {
  success: boolean;
  data?: FileData;
  error?: string;
  message?: string;
}