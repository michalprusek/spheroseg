import { Request, Response, NextFunction } from 'express';
import { query } from '../../db/connection';

export async function checkProjectOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId;
    const userId = req.user!.id;

    const result = await query(
      'SELECT id, user_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.length === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
    
      const project = result[0];
    
      if (project.user_id !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

    next();
  } catch (error) {
    next(error);
  }
}