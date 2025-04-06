import { Request, Response } from 'express';
import * as ownershipMiddleware from '../middleware/ownership.middleware';
import { query } from '../../db/connection';

jest.mock('../../db/connection');

describe('Ownership Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = { user: { id: '1' }, params: { projectId: '1' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('should call next if user owns the project', async () => {
    (query as jest.Mock).mockResolvedValueOnce([{ id: 1, user_id: '1' }]);

    await ownershipMiddleware.checkProjectOwnership(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if user does not own the project', async () => {
    (query as jest.Mock).mockResolvedValueOnce([{ id: 1, user_id: '2' }]);

    await ownershipMiddleware.checkProjectOwnership(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  it('should return 404 if project not found', async () => {
    (query as jest.Mock).mockResolvedValueOnce([]);

    await ownershipMiddleware.checkProjectOwnership(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
  });

  it('should call next with error on DB failure', async () => {
    const error = new Error('DB error');
    (query as jest.Mock).mockRejectedValueOnce(error);

    await ownershipMiddleware.checkProjectOwnership(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});