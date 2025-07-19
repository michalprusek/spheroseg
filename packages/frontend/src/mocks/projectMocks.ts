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
}

export interface MockImage {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
  segmentationStatus: string;
  segmentationResult?: string;
}

/**
 * Generate a mock project with default values
 */
export function generateMockProject(overrides: Partial<MockProject> = {}): MockProject {
  const id = overrides.id || `project-${Date.now()}`;
  return {
    id,
    title: `Project ${id}`,
    name: `Project ${id}`,
    description: 'A mock project for testing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    image_count: 0,
    is_owner: true,
    ...overrides,
  };
}

/**
 * Generate mock images with default values
 */
export function generateMockImages(count: number = 5, _projectId?: string): MockImage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `image-${index + 1}`,
    name: `test-image-${index + 1}.jpg`,
    url: `/images/test-${index + 1}.jpg`,
    thumbnailUrl: `/thumbnails/test-${index + 1}.jpg`,
    width: 800,
    height: 600,
    createdAt: new Date(),
    updatedAt: new Date(),
    segmentationStatus: index % 2 === 0 ? 'completed' : 'pending',
    segmentationResult:
      index % 2 === 0
        ? JSON.stringify({
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
          })
        : undefined,
  }));
}
