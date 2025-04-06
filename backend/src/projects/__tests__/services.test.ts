import * as projectService from '../services/project.service';
import * as db from '../../db/connection';

jest.spyOn(db, 'query').mockResolvedValue([{}]);

describe('Project Service', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockResolvedValue([{}]);
  });
  describe('createProject', () => {
    it('should create a new project in the database', async () => {
      // Arrange
      // Mock DB insert
      (db.query as jest.Mock).mockResolvedValueOnce([{ id: 1 }]);

      // Act
      const result = await projectService.createProject({ name: 'Test', description: 'Desc', userId: '1' });

      // Assert
      expect(result).toHaveProperty('id');
    });
  });

  describe('getProjectById', () => {
    it('should fetch a project by ID', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce([{ id: 1, name: 'Test' }]);

      const result = await projectService.getProjectById('1', '1');

      expect(result).toHaveProperty('id', 1);
    });
  });

  describe('updateProject', () => {
    it('should update a project', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce([{ id: 1, name: 'Updated' }]);

      const result = await projectService.updateProject('1', '1', { name: 'Updated' });

      expect(result).toHaveProperty('name', 'Updated');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce([{}]);

      const result = await projectService.deleteProject('1', '1');

      expect(result).toBe(true);
    });
  });

  describe('listProjects', () => {
    it('should list projects with pagination and filters', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await projectService.listProjects('1', { page: 1, pageSize: 10 });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('associateFile', () => {
    it('should associate a file with a project', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce([{}]);

      const result = await projectService.associateFile('1', '1', '1');

      expect(result).toBe(true);
    });
  });

  describe('disassociateFile', () => {
    it('should disassociate a file from a project', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce([{}]);

      const result = await projectService.disassociateFile('1', '1', '1');

      expect(result).toBe(true);
    });
  });
});