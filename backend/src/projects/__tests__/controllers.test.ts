jest.mock('../services/project.service', () => ({
  createProject: jest.fn(),
  getProjectById: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  listProjects: jest.fn().mockImplementation(() =>
    Promise.resolve([
      { id: '550e8400-e29b-41d4-a716-446655440000' },
      { id: '550e8400-e29b-41d4-a716-446655440001' }
    ])
  ),
  associateFile: jest.fn(),
  disassociateFile: jest.fn()
}));

jest.mock('../../ml/services/ml.service', () => ({
  initiateSegmentationJob: jest.fn(),
  getSegmentationStatus: jest.fn(),
  getSegmentationResult: jest.fn()
}));

jest.mock('../../ml/queue', () => ({ segmentationQueue: { add: jest.fn() } }));

import * as projectController from '../controllers/project.controller';
import * as projectService from '../services/project.service';
import * as mlService from '../../ml/services/ml.service';
import { Request, Response } from 'express';


describe('Project Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = { user: { id: '550e8400-e29b-41d4-a716-446655440000' }, body: {}, params: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('createProject', () => {
    it('should create a project and return it', async () => {
      (projectService.createProject as jest.Mock).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' });
      req.body = { name: 'Test Project' };

      await projectController.createProject(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: '550e8400-e29b-41d4-a716-446655440000' });
    });

    it('should return 400 if name is missing', async () => {
      req.body = {};

      await projectController.createProject(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
    });

    it('should return 400 if name is empty', async () => {
      req.body = { name: '' };

      await projectController.createProject(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
    });

    it('should handle service errors', async () => {
      req.body = { name: 'Test Project' };
      const error = new Error('Service error');
      (projectService.createProject as jest.Mock).mockRejectedValue(error);

      await projectController.createProject(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getProject', () => {
    it('should return a project by id', async () => {
      (projectService.getProjectById as jest.Mock).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' });
      req.params = { projectId: 'some-id' };

      await projectController.getProject(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({ id: '550e8400-e29b-41d4-a716-446655440000' });
    });

    it('should return 404 if project not found', async () => {
      (projectService.getProjectById as jest.Mock).mockResolvedValue(null);
      req.params = { projectId: 'non-existent-id' };

      await projectController.getProject(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('should handle service errors', async () => {
      req.params = { projectId: 'some-id' };
      const error = new Error('Service error');
      (projectService.getProjectById as jest.Mock).mockRejectedValue(error);

      await projectController.getProject(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProject', () => {
    it('should update a project and return it', async () => {
      (projectService.updateProject as jest.Mock).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Updated' });
      req.params = { projectId: 'some-id' };
      req.body = { name: 'Updated Project' };

      await projectController.updateProject(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Updated' });
    });

    it('should return 400 if no fields to update', async () => {
      req.params = { projectId: 'some-id' };
      req.body = {};

      await projectController.updateProject(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No fields to update' });
    });

    it('should return 404 if project not found or not owned', async () => {
      (projectService.updateProject as jest.Mock).mockResolvedValue(null);
      req.params = { projectId: 'non-existent-id' };
      req.body = { name: 'Updated Project' };

      await projectController.updateProject(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found or not owned' });
    });

    it('should handle service errors', async () => {
      req.params = { projectId: 'some-id' };
      req.body = { name: 'Updated Project' };
      const error = new Error('Service error');
      (projectService.updateProject as jest.Mock).mockRejectedValue(error);

      await projectController.updateProject(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteProject', () => {
    it('should delete a project and return success', async () => {
      (projectService.deleteProject as jest.Mock).mockResolvedValue(true);
      req.params = { projectId: 'some-id' };

      await projectController.deleteProject(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 if project not found or not owned', async () => {
      (projectService.deleteProject as jest.Mock).mockResolvedValue(false);
      req.params = { projectId: 'non-existent-id' };

      await projectController.deleteProject(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found or not owned' });
    });

    it('should handle service errors', async () => {
      req.params = { projectId: 'some-id' };
      const error = new Error('Service error');
      (projectService.deleteProject as jest.Mock).mockRejectedValue(error);

      await projectController.deleteProject(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listProjects', () => {
    it('should list projects', async () => {
      (projectService.listProjects as jest.Mock).mockImplementation(() =>
        Promise.resolve([
          { id: '550e8400-e29b-41d4-a716-446655440000' },
          { id: '550e8400-e29b-41d4-a716-446655440001' }
        ])
      );

      await projectController.listProjects(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith([
        { id: '550e8400-e29b-41d4-a716-446655440000' },
        { id: '550e8400-e29b-41d4-a716-446655440001' }
      ]);
    });

    it('should handle pagination parameters', async () => {
      (projectService.listProjects as jest.Mock).mockImplementation(() =>
        Promise.resolve([
          { id: '550e8400-e29b-41d4-a716-446655440000' }
        ])
      );
      req.query = { page: '2', pageSize: '5' };

      await projectController.listProjects(req as Request, res as Response, next);

      expect(projectService.listProjects).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        { page: 2, pageSize: 5 }
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      (projectService.listProjects as jest.Mock).mockRejectedValue(error);

      await projectController.listProjects(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('associateFile', () => {
    it('should associate a file and return success', async () => {
      (projectService.associateFile as jest.Mock).mockResolvedValue(true);
      req.params = { projectId: 'some-id' };
      req.body = { fileId: 'file-id' };

      await projectController.associateFile(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 if fileId is missing', async () => {
      req.params = { projectId: 'some-id' };
      req.body = {};

      await projectController.associateFile(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'fileId is required' });
    });

    it('should return 404 if project not found or not owned', async () => {
      (projectService.associateFile as jest.Mock).mockResolvedValue(false);
      req.params = { projectId: 'non-existent-id' };
      req.body = { fileId: 'file-id' };

      await projectController.associateFile(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found or not owned' });
    });

    it('should handle service errors', async () => {
      req.params = { projectId: 'some-id' };
      req.body = { fileId: 'file-id' };
      const error = new Error('Service error');
      (projectService.associateFile as jest.Mock).mockRejectedValue(error);

      await projectController.associateFile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('disassociateFile', () => {
    it('should disassociate a file and return success', async () => {
      (projectService.disassociateFile as jest.Mock).mockResolvedValue(true);
      req.params = { projectId: 'some-id', fileId: 'file-id' };

      await projectController.disassociateFile(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 if fileId is missing', async () => {
      req.params = { projectId: 'some-id' };

      await projectController.disassociateFile(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'fileId param is required' });
    });

    it('should return 404 if project not found or not owned', async () => {
      (projectService.disassociateFile as jest.Mock).mockResolvedValue(false);
      req.params = { projectId: 'non-existent-id', fileId: 'file-id' };

      await projectController.disassociateFile(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found or not owned' });
    });

    it('should handle service errors', async () => {
      req.params = { projectId: 'some-id', fileId: 'file-id' };
      const error = new Error('Service error');
      (projectService.disassociateFile as jest.Mock).mockRejectedValue(error);

      await projectController.disassociateFile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('startSegmentationJob', () => {
    it('should start a segmentation job and return jobId and signedUrl', async () => {
      (mlService.initiateSegmentationJob as jest.Mock).mockResolvedValue({
        jobId: 'job-123',
        signedUrl: 'https://example.com/signed-url'
      });
      req.params = { projectId: 'project-123' };
      req.body = { fileId: 'file-123', params: { threshold: 0.5 } };
      req.app = { get: jest.fn().mockReturnValue('db-connection') } as any;

      await projectController.startSegmentationJob(req as Request, res as Response, next);

      expect(mlService.initiateSegmentationJob).toHaveBeenCalledWith(
        'db-connection',
        'project-123',
        'file-123',
        { threshold: 0.5 }
      );
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        jobId: 'job-123',
        signedUrl: 'https://example.com/signed-url'
      });
    });

    it('should return 400 if fileId is missing', async () => {
      req.params = { projectId: 'project-123' };
      req.body = {};

      await projectController.startSegmentationJob(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'fileId is required' });
    });

    it('should use empty object if params is not provided', async () => {
      (mlService.initiateSegmentationJob as jest.Mock).mockResolvedValue({
        jobId: 'job-123',
        signedUrl: 'https://example.com/signed-url'
      });
      req.params = { projectId: 'project-123' };
      req.body = { fileId: 'file-123' };
      req.app = { get: jest.fn().mockReturnValue('db-connection') } as any;

      await projectController.startSegmentationJob(req as Request, res as Response, next);

      expect(mlService.initiateSegmentationJob).toHaveBeenCalledWith(
        'db-connection',
        'project-123',
        'file-123',
        {}
      );
    });

    it('should handle service errors', async () => {
      req.params = { projectId: 'project-123' };
      req.body = { fileId: 'file-123' };
      req.app = { get: jest.fn().mockReturnValue('db-connection') } as any;
      const error = new Error('Service error');
      (mlService.initiateSegmentationJob as jest.Mock).mockRejectedValue(error);

      await projectController.startSegmentationJob(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getSegmentationJobStatus', () => {
    it('should return the status of a segmentation job', async () => {
      (mlService.getSegmentationStatus as jest.Mock).mockResolvedValue('processing');
      req.params = { jobId: 'job-123' };
      req.app = { get: jest.fn().mockReturnValue('db-connection') } as any;

      await projectController.getSegmentationJobStatus(req as Request, res as Response, next);

      expect(mlService.getSegmentationStatus).toHaveBeenCalledWith('db-connection', 'job-123');
      expect(res.json).toHaveBeenCalledWith({ jobId: 'job-123', status: 'processing' });
    });

    it('should handle service errors', async () => {
      req.params = { jobId: 'job-123' };
      req.app = { get: jest.fn().mockReturnValue('db-connection') } as any;
      const error = new Error('Service error');
      (mlService.getSegmentationStatus as jest.Mock).mockRejectedValue(error);

      await projectController.getSegmentationJobStatus(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getSegmentationJobResult', () => {
    it('should return the result of a segmentation job', async () => {
      (mlService.getSegmentationResult as jest.Mock).mockResolvedValue({
        resultUrl: 'https://example.com/result.png'
      });
      req.params = { jobId: 'job-123' };
      req.app = { get: jest.fn().mockReturnValue('db-connection') } as any;

      await projectController.getSegmentationJobResult(req as Request, res as Response, next);

      expect(mlService.getSegmentationResult).toHaveBeenCalledWith('db-connection', 'job-123');
      expect(res.json).toHaveBeenCalledWith({ resultUrl: 'https://example.com/result.png' });
    });

    it('should handle service errors', async () => {
      req.params = { jobId: 'job-123' };
      req.app = { get: jest.fn().mockReturnValue('db-connection') } as any;
      const error = new Error('Service error');
      (mlService.getSegmentationResult as jest.Mock).mockRejectedValue(error);

      await projectController.getSegmentationJobResult(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});