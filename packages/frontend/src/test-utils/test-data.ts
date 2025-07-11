/**
 * Common test data utilities
 */

export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  createdAt: new Date('2023-01-01').toISOString(),
  updatedAt: new Date('2023-01-01').toISOString(),
  ...overrides,
});

export const createMockProject = (overrides = {}) => ({
  id: 'project-123',
  title: 'Test Project',
  name: 'Test Project',
  description: 'A test project',
  created_at: new Date('2023-01-01').toISOString(),
  updated_at: new Date('2023-01-01').toISOString(),
  image_count: 5,
  thumbnail_url: '/thumbnails/project-123.jpg',
  is_owner: true,
  ...overrides,
});

export const createMockImage = (overrides = {}) => ({
  id: 'image-123',
  name: 'test-image.jpg',
  url: '/images/test-image.jpg',
  thumbnailUrl: '/thumbnails/test-image.jpg',
  thumbnail_url: '/thumbnails/test-image.jpg',
  width: 800,
  height: 600,
  size: 102400,
  mime_type: 'image/jpeg',
  project_id: 'project-123',
  created_at: new Date('2023-01-01').toISOString(),
  updated_at: new Date('2023-01-01').toISOString(),
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  segmentationStatus: 'without_segmentation',
  segmentation_status: 'without_segmentation',
  has_segmentation: false,
  ...overrides,
});

export const createMockSegmentation = (overrides = {}) => ({
  id: 'segmentation-123',
  image_id: 'image-123',
  polygons: [
    {
      id: 'polygon-1',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
      type: 'external',
      color: '#00FF00',
      label: 'Cell 1',
      visible: true,
    },
  ],
  width: 800,
  height: 600,
  created_at: new Date('2023-01-01').toISOString(),
  updated_at: new Date('2023-01-01').toISOString(),
  ...overrides,
});

export const createMockPolygon = (overrides = {}) => ({
  id: 'polygon-123',
  points: [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
  ],
  type: 'external',
  color: '#00FF00',
  label: 'Cell',
  visible: true,
  ...overrides,
});

export const createMockApiResponse = (data: any, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {},
});

export const createMockApiError = (message: string, status = 400, data = {}) => {
  const error = new Error(message) as any;
  error.isAxiosError = true;
  error.response = {
    data,
    status,
    statusText: status === 400 ? 'Bad Request' : status === 404 ? 'Not Found' : 'Error',
    headers: {},
    config: {},
  };
  return error;
};