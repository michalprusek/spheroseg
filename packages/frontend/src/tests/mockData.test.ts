import { describe, it, expect } from 'vitest';
import { generateMockProject, generateMockImages } from '../mocks/projectMocks';

describe('Mock Data Generation', () => {
  describe('generateMockProject', () => {
    it('should generate a project with the provided ID', () => {
      const projectId = 'test-project-123';
      const mockProject = generateMockProject(projectId);

      expect(mockProject).toBeDefined();
      expect(mockProject.id).toBe(projectId);
      expect(mockProject.name).toBe('Mock Project');
      expect(mockProject.status).toBe('active');
      expect(mockProject.settings).toBeDefined();
      expect(mockProject.settings.segmentation).toBeDefined();
    });

    it('should generate different timestamps for each project', () => {
      const project1 = generateMockProject('project-1');

      // Wait a small amount of time to ensure timestamps are different
      setTimeout(() => {
        const project2 = generateMockProject('project-2');
        expect(project1.created_at).not.toBe(project2.created_at);
      }, 10);
    });
  });

  describe('generateMockImages', () => {
    it('should generate the specified number of images', () => {
      const projectId = 'test-project-123';
      const imageCount = 5;
      const mockImages = generateMockImages(projectId, imageCount);

      expect(mockImages).toBeDefined();
      expect(mockImages.length).toBe(imageCount);

      // Check that all images have the correct project ID
      mockImages.forEach((image) => {
        expect(image.project_id).toBe(projectId);
      });
    });

    it('should generate images with valid properties', () => {
      const projectId = 'test-project-123';
      const mockImages = generateMockImages(projectId, 1);
      const image = mockImages[0];

      expect(image.id).toBeDefined();
      expect(image.name).toBeDefined();
      expect(image.width).toBe(800);
      expect(image.height).toBe(600);
      expect(image.mime_type).toBe('image/png');
      expect(image.status).toBe('ready');
      expect(image.storage_path).toContain('/assets/illustrations/');
    });

    it('should generate segmentation result only for the first image by default', () => {
      const projectId = 'test-project-123';
      const mockImages = generateMockImages(projectId, 3);

      expect(mockImages[0].segmentation_result).toBeDefined();
      expect(mockImages[1].segmentation_result).toBeNull();
      expect(mockImages[2].segmentation_result).toBeNull();
    });
  });
});
