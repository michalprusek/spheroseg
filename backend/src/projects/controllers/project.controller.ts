import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service';
import { initiateSegmentationJob, getSegmentationStatus, getSegmentationResult } from '../../ml/services/ml.service';

export async function createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      void res.status(400).json({ error: 'Name is required' });
      return;
    }

    const project = await projectService.createProject({
      name,
      description,
      userId: req.user!.id,
    });

    void res.status(201).json(project);
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.getProjectById(req.params.projectId, req.user!.id);
    if (!project) {
      void res.status(404).json({ error: 'Project not found' });
      return;
    }
    void res.json(project);
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description } = req.body;
    if (!name && !description) {
      void res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const updated = await projectService.updateProject(req.params.projectId, req.user!.id, { name, description });
    if (!updated) {
      void res.status(404).json({ error: 'Project not found or not owned' });
      return;
    }
    void res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const success = await projectService.deleteProject(req.params.projectId, req.user!.id);
    if (!success) {
      void res.status(404).json({ error: 'Project not found or not owned' });
      return;
    }
    void res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const projects = await projectService.listProjects(req.user!.id, { page, pageSize });
    void res.json(projects);
  } catch (error) {
    next(error);
  }
}

export async function associateFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      void res.status(400).json({ error: 'fileId is required' });
      return;
    }

    const success = await projectService.associateFile(req.params.projectId, fileId, req.user!.id);
    if (!success) {
      void res.status(404).json({ error: 'Project not found or not owned' });
      return;
    }
    void res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function disassociateFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      void res.status(400).json({ error: 'fileId param is required' });
      return;
    }

    const success = await projectService.disassociateFile(req.params.projectId, fileId, req.user!.id);
    if (!success) {
      void res.status(404).json({ error: 'Project not found or not owned' });
      return;
    }
    void res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function startSegmentationJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fileId, params } = req.body;
    if (!fileId) {
      void res.status(400).json({ error: 'fileId is required' });
      return;
    }
    const db = req.app.get('db');
    const { jobId, signedUrl } = await initiateSegmentationJob(db, req.params.projectId, fileId, params || {});
    void res.status(202).json({ jobId, signedUrl });
  } catch (error) {
    next(error);
  }
}

export async function getSegmentationJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = req.app.get('db');
    const status = await getSegmentationStatus(db, req.params.jobId);
    void res.json({ jobId: req.params.jobId, status });
  } catch (error) {
    next(error);
  }
}

export async function getSegmentationJobResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = req.app.get('db');
    const result = await getSegmentationResult(db, req.params.jobId);
    void res.json(result);
  } catch (error) {
    next(error);
  }
}