/**
 * Project Mock Data Generator
 */

export interface MockProject {
  id: string;
  title: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  image_count: number;
  thumbnail_url?: string;
  is_owner?: boolean;
  permission?: string;
  owner_name?: string;
  owner_email?: string;
  status?: string;
  settings?: {
    segmentation?: {
      enabled?: boolean;
      auto_save?: boolean;
    };
  };
}

export interface MockImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
  segmentationStatus: string;
  segmentation_result?: any;
  mime_type?: string;
  status?: string;
  storage_path?: string;
}

/**
 * Generate a mock project with default values
 */
export function generateMockProject(idOrOverrides?: string | Partial<MockProject>): MockProject {
  const overrides = typeof idOrOverrides === 'string' ? { id: idOrOverrides } : (idOrOverrides || {});
  const id = overrides.id || `project-${Date.now()}`;
  return {
    id,
    title: `Project ${id}`,
    name: 'Mock Project',
    description: 'A mock project for testing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    image_count: 0,
    is_owner: true,
    status: 'active',
    settings: {
      segmentation: {
        enabled: true,
        auto_save: true,
      },
    },
    ...overrides,
  };
}

/**
 * Generate mock images with default values
 */
export function generateMockImages(projectId: string, count: number = 5): MockImage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `image-${index + 1}`,
    project_id: projectId,
    name: `test-image-${index + 1}.jpg`,
    url: `/images/test-${index + 1}.jpg`,
    thumbnailUrl: `/thumbnails/test-${index + 1}.jpg`,
    width: 800,
    height: 600,
    createdAt: new Date(),
    updatedAt: new Date(),
    segmentationStatus: index === 0 ? 'completed' : 'pending',
    segmentation_result: index === 0
      ? {
          polygons: [
            {
              id: `polygon-${index + 1}`,
              type: 'external',
              points: [
                { x: 100, y: 100 },
                { x: 200, y: 100 },
                { x: 200, y: 200 },
                { x: 100, y: 200 },
              ],
            },
          ],
        }
      : null,
    mime_type: 'image/png',
    status: 'ready',
    storage_path: `/assets/illustrations/sample-${index + 1}.png`,
  }));
}
