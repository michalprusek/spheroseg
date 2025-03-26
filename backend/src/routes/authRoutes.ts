import { Router } from 'express';
import { register, login, updatePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.put('/password', authenticate, updatePassword);

export default router; 