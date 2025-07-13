/**
 * Image Test Factory
 * 
 * Provides factory functions for creating test image data
 */

import { v4 as uuidv4 } from 'uuid';

export interface MockImage {
  id: string;
  name: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
  project_id: string;
  user_id: string;
  segmentation_status: 'without_segmentation' | 'queued' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export interface MockFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
  buffer?: Buffer;
}

export function createMockImage(overrides: Partial<MockImage> = {}): MockImage {
  const id = overrides.id || uuidv4();
  return {
    id,
    name: `image-${id}.jpg`,
    originalname: 'test-image.jpg',
    mimetype: 'image/jpeg',
    size: 1024 * 1024, // 1MB
    path: `/uploads/${id}.jpg`,
    project_id: uuidv4(),
    user_id: uuidv4(),
    segmentation_status: 'without_segmentation',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };
}

export function createMockFile(overrides: Partial<MockFile> = {}): MockFile {
  const filename = `mock-${Date.now()}.jpg`;
  return {
    fieldname: 'images',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    destination: '/tmp/uploads',
    filename,
    path: `/tmp/uploads/${filename}`,
    size: 1024 * 100, // 100KB
    ...overrides
  };
}

export function createMockTiffFile(overrides: Partial<MockFile> = {}): MockFile {
  return createMockFile({
    originalname: 'test-image.tiff',
    mimetype: 'image/tiff',
    filename: `mock-${Date.now()}.tiff`,
    ...overrides
  });
}

export function createLargeMockFile(sizeMB: number = 150): MockFile {
  return createMockFile({
    size: sizeMB * 1024 * 1024,
    originalname: `large-image-${sizeMB}mb.tiff`,
    mimetype: 'image/tiff'
  });
}

export function createMockImageBatch(count: number, projectId: string): MockImage[] {
  return Array.from({ length: count }, (_, i) => 
    createMockImage({
      project_id: projectId,
      name: `batch-image-${i}.jpg`,
      segmentation_status: i % 3 === 0 ? 'completed' : 
                          i % 3 === 1 ? 'queued' : 
                          'without_segmentation'
    })
  );
}

export function createMockWebSocketEvent(type: string, data: any) {
  return {
    type,
    data,
    projectId: data.projectId || uuidv4(),
    timestamp: new Date().toISOString()
  };
}