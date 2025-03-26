import { Router } from 'express';
import { upload as uploadMiddleware } from '../utils/fileStorage';
import { upload, getOne, remove, updateSegmentation } from '../controllers/imageController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Image routes
router.post('/:projectId', uploadMiddleware.single('image'), upload);
router.get('/:id', getOne);
router.delete('/:id', remove);
router.put('/:id/segmentation', updateSegmentation);

export default router; 