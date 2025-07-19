/**
 * Integration tests for ProjectService
 * 
 * Tests project management with real database operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ProjectService } from '../projectService';
import pool from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

describe('ProjectService Integration Tests', () => {
  let projectService: ProjectService;
  let testUserId: string;
  let testUserId2: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Initialize service
    projectService = new ProjectService();

    // Create test users
    testUserId = uuidv4();
    testUserId2 = uuidv4();
    
    await pool.query(
      'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
      [testUserId, 'projtest1@test.integration.com', 'hashed', 'Test User 1']
    );
    
    await pool.query(
      'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
      [testUserId2, 'projtest2@test.integration.com', 'hashed', 'Test User 2']
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM project_shares WHERE project_id IN (SELECT id FROM projects WHERE user_id IN ($1, $2))', [testUserId, testUserId2]);
    await pool.query('DELETE FROM images WHERE project_id IN (SELECT id FROM projects WHERE user_id IN ($1, $2))', [testUserId, testUserId2]);
    await pool.query('DELETE FROM projects WHERE user_id IN ($1, $2)', [testUserId, testUserId2]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, testUserId2]);
  });

  beforeEach(async () => {
    // Clean up any existing test projects
    await pool.query('DELETE FROM project_shares WHERE project_id IN (SELECT id FROM projects WHERE user_id IN ($1, $2))', [testUserId, testUserId2]);
    await pool.query('DELETE FROM images WHERE project_id IN (SELECT id FROM projects WHERE user_id IN ($1, $2))', [testUserId, testUserId2]);
    await pool.query('DELETE FROM projects WHERE user_id IN ($1, $2)', [testUserId, testUserId2]);
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test project description',
        settings: {
          defaultSegmentationParams: {
            threshold: 0.5,
            minCellSize: 100
          }
        }
      };

      const project = await projectService.createProject(testUserId, projectData);

      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name', projectData.name);
      expect(project).toHaveProperty('description', projectData.description);
      expect(project).toHaveProperty('userId', testUserId);
      expect(project).toHaveProperty('settings');
      expect(project.settings).toMatchObject(projectData.settings);

      // Verify in database
      const result = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [project.id]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe(projectData.name);

      testProjectId = project.id;
    });

    it('should create project with minimal data', async () => {
      const project = await projectService.createProject(testUserId, {
        name: 'Minimal Project'
      });

      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name', 'Minimal Project');
      expect(project).toHaveProperty('description', null);
      expect(project).toHaveProperty('settings', {});
    });

    it('should enforce unique project names per user', async () => {
      await projectService.createProject(testUserId, {
        name: 'Duplicate Name'
      });

      await expect(
        projectService.createProject(testUserId, {
          name: 'Duplicate Name'
        })
      ).rejects.toThrow();
    });
  });

  describe('getProjects', () => {
    beforeEach(async () => {
      // Create test projects
      for (let i = 0; i < 3; i++) {
        await projectService.createProject(testUserId, {
          name: `Project ${i}`,
          description: `Description ${i}`
        });
      }

      // Create a shared project
      const sharedProject = await projectService.createProject(testUserId2, {
        name: 'Shared Project'
      });

      // Share it with testUserId
      await pool.query(
        'INSERT INTO project_shares (id, project_id, shared_with_user_id, permission) VALUES ($1, $2, $3, $4)',
        [uuidv4(), sharedProject.id, testUserId, 'view']
      );
    });

    it('should get all user projects including shared', async () => {
      const projects = await projectService.getProjects(testUserId);

      expect(projects).toHaveLength(4); // 3 owned + 1 shared
      
      const ownedProjects = projects.filter(p => p.userId === testUserId);
      expect(ownedProjects).toHaveLength(3);
      
      const sharedProjects = projects.filter(p => p.userId !== testUserId);
      expect(sharedProjects).toHaveLength(1);
      expect(sharedProjects[0].name).toBe('Shared Project');
    });

    it('should include project statistics', async () => {
      // Add images to a project
      const project = await projectService.createProject(testUserId, {
        name: 'Project with Images'
      });

      // Add test images
      for (let i = 0; i < 5; i++) {
        await pool.query(
          `INSERT INTO images (id, project_id, name, url, thumbnail_url, size, width, height, segmentation_status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [uuidv4(), project.id, `image${i}.jpg`, `http://test.com/image${i}.jpg`, 
           `http://test.com/thumb${i}.jpg`, 1024000, 1920, 1080, 
           i < 3 ? 'completed' : 'without_segmentation']
        );
      }

      const projects = await projectService.getProjects(testUserId);
      const projectWithImages = projects.find(p => p.id === project.id);

      expect(projectWithImages).toHaveProperty('imageCount', 5);
      expect(projectWithImages).toHaveProperty('segmentedCount', 3);
    });
  });

  describe('getProject', () => {
    beforeEach(async () => {
      const project = await projectService.createProject(testUserId, {
        name: 'Test Project',
        description: 'Test description'
      });
      testProjectId = project.id;
    });

    it('should get project by id', async () => {
      const project = await projectService.getProject(testProjectId, testUserId);

      expect(project).toHaveProperty('id', testProjectId);
      expect(project).toHaveProperty('name', 'Test Project');
      expect(project).toHaveProperty('description', 'Test description');
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        projectService.getProject(uuidv4(), testUserId)
      ).rejects.toThrow('Project not found');
    });

    it('should throw error for unauthorized access', async () => {
      await expect(
        projectService.getProject(testProjectId, testUserId2)
      ).rejects.toThrow('not authorized');
    });

    it('should allow access to shared project', async () => {
      // Share project
      await pool.query(
        'INSERT INTO project_shares (id, project_id, shared_with_user_id, permission) VALUES ($1, $2, $3, $4)',
        [uuidv4(), testProjectId, testUserId2, 'view']
      );

      const project = await projectService.getProject(testProjectId, testUserId2);
      expect(project).toHaveProperty('id', testProjectId);
    });
  });

  describe('updateProject', () => {
    beforeEach(async () => {
      const project = await projectService.createProject(testUserId, {
        name: 'Original Name',
        description: 'Original description'
      });
      testProjectId = project.id;
    });

    it('should update project details', async () => {
      const updates = {
        name: 'Updated Name',
        description: 'Updated description',
        settings: {
          theme: 'dark',
          defaultView: 'grid'
        }
      };

      const updatedProject = await projectService.updateProject(
        testProjectId,
        testUserId,
        updates
      );

      expect(updatedProject).toHaveProperty('name', updates.name);
      expect(updatedProject).toHaveProperty('description', updates.description);
      expect(updatedProject.settings).toMatchObject(updates.settings);

      // Verify in database
      const result = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [testProjectId]
      );
      expect(result.rows[0].name).toBe(updates.name);
      expect(result.rows[0].updated_at).not.toBe(result.rows[0].created_at);
    });

    it('should not allow updating by non-owner', async () => {
      await expect(
        projectService.updateProject(testProjectId, testUserId2, {
          name: 'Hacked Name'
        })
      ).rejects.toThrow('not authorized');
    });

    it('should allow updating by user with edit permission', async () => {
      // Share with edit permission
      await pool.query(
        'INSERT INTO project_shares (id, project_id, shared_with_user_id, permission) VALUES ($1, $2, $3, $4)',
        [uuidv4(), testProjectId, testUserId2, 'edit']
      );

      const updatedProject = await projectService.updateProject(
        testProjectId,
        testUserId2,
        { description: 'Updated by collaborator' }
      );

      expect(updatedProject).toHaveProperty('description', 'Updated by collaborator');
    });
  });

  describe('deleteProject', () => {
    let imageIds: string[];

    beforeEach(async () => {
      const project = await projectService.createProject(testUserId, {
        name: 'Project to Delete'
      });
      testProjectId = project.id;

      // Add images
      imageIds = [];
      for (let i = 0; i < 3; i++) {
        const imageId = uuidv4();
        await pool.query(
          `INSERT INTO images (id, project_id, name, url, thumbnail_url, size, width, height, segmentation_status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [imageId, testProjectId, `image${i}.jpg`, `http://test.com/image${i}.jpg`, 
           `http://test.com/thumb${i}.jpg`, 1024000, 1920, 1080, 'completed']
        );
        imageIds.push(imageId);
      }

      // Add segmentation results
      for (const imageId of imageIds) {
        await pool.query(
          'INSERT INTO segmentation_results (id, image_id, status) VALUES ($1, $2, $3)',
          [uuidv4(), imageId, 'completed']
        );
      }
    });

    it('should delete project and cascade to related data', async () => {
      await projectService.deleteProject(testProjectId, testUserId);

      // Verify project deleted
      const projectResult = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [testProjectId]
      );
      expect(projectResult.rows).toHaveLength(0);

      // Verify images deleted
      const imageResult = await pool.query(
        'SELECT * FROM images WHERE project_id = $1',
        [testProjectId]
      );
      expect(imageResult.rows).toHaveLength(0);

      // Verify segmentation results deleted
      const segResult = await pool.query(
        'SELECT * FROM segmentation_results WHERE image_id = ANY($1)',
        [imageIds]
      );
      expect(segResult.rows).toHaveLength(0);
    });

    it('should not allow deletion by non-owner', async () => {
      await expect(
        projectService.deleteProject(testProjectId, testUserId2)
      ).rejects.toThrow('not authorized');
    });
  });

  describe('shareProject', () => {
    beforeEach(async () => {
      const project = await projectService.createProject(testUserId, {
        name: 'Project to Share'
      });
      testProjectId = project.id;
    });

    it('should share project with another user', async () => {
      const share = await projectService.shareProject(
        testProjectId,
        testUserId,
        testUserId2,
        'view'
      );

      expect(share).toHaveProperty('projectId', testProjectId);
      expect(share).toHaveProperty('sharedWithUserId', testUserId2);
      expect(share).toHaveProperty('permission', 'view');

      // Verify in database
      const result = await pool.query(
        'SELECT * FROM project_shares WHERE project_id = $1 AND shared_with_user_id = $2',
        [testProjectId, testUserId2]
      );
      expect(result.rows).toHaveLength(1);
    });

    it('should update existing share permission', async () => {
      // Create initial share
      await projectService.shareProject(testProjectId, testUserId, testUserId2, 'view');

      // Update permission
      const updatedShare = await projectService.shareProject(
        testProjectId,
        testUserId,
        testUserId2,
        'edit'
      );

      expect(updatedShare).toHaveProperty('permission', 'edit');

      // Verify only one share exists
      const result = await pool.query(
        'SELECT * FROM project_shares WHERE project_id = $1',
        [testProjectId]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].permission).toBe('edit');
    });

    it('should not allow sharing by non-owner', async () => {
      await expect(
        projectService.shareProject(testProjectId, testUserId2, testUserId, 'view')
      ).rejects.toThrow('not authorized');
    });
  });

  describe('getProjectStats', () => {
    beforeEach(async () => {
      const project = await projectService.createProject(testUserId, {
        name: 'Stats Project'
      });
      testProjectId = project.id;

      // Add various images
      const statuses = ['completed', 'completed', 'queued', 'processing', 'without_segmentation'];
      for (let i = 0; i < statuses.length; i++) {
        const imageId = uuidv4();
        await pool.query(
          `INSERT INTO images (id, project_id, name, url, thumbnail_url, size, width, height, segmentation_status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [imageId, testProjectId, `image${i}.jpg`, `http://test.com/image${i}.jpg`, 
           `http://test.com/thumb${i}.jpg`, 1024000 * (i + 1), 1920, 1080, statuses[i]]
        );

        // Add cells for completed images
        if (statuses[i] === 'completed') {
          const segId = uuidv4();
          await pool.query(
            'INSERT INTO segmentation_results (id, image_id, status) VALUES ($1, $2, $3)',
            [segId, imageId, 'completed']
          );

          for (let j = 0; j < 10; j++) {
            await pool.query(
              `INSERT INTO cells (id, image_id, segmentation_result_id, cell_index, polygon, area) 
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [uuidv4(), imageId, segId, j, '[[0,0],[10,0],[10,10],[0,10]]', 100 + j * 10]
            );
          }
        }
      }
    });

    it('should calculate project statistics', async () => {
      const stats = await projectService.getProjectStats(testProjectId, testUserId);

      expect(stats).toHaveProperty('totalImages', 5);
      expect(stats).toHaveProperty('segmentedImages', 2);
      expect(stats).toHaveProperty('queuedImages', 1);
      expect(stats).toHaveProperty('processingImages', 1);
      expect(stats).toHaveProperty('totalCells', 20);
      expect(stats).toHaveProperty('totalSize');
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats).toHaveProperty('averageCellsPerImage', 10);
    });
  });
});