import { Router } from 'express';
import { create, getOne, getAll, update, remove } from '../controllers/projectController';
import { getAll as getAllImages } from '../controllers/imageController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Project routes
router.post('/', create);
router.get('/', getAll);
router.get('/:id', getOne);
router.put('/:id', update);
router.delete('/:id', remove);

// Project images routes
router.get('/:projectId/images', getAllImages);

export default router; 