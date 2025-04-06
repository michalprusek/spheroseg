import { Router } from 'express';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';

const router = Router();

router.post('/register', (req, res) => {
  AuthController.registerHandler(req, res).catch(err => {
    console.error('Unhandled error in register endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
});

router.post('/login', (req, res) => {
  AuthController.loginHandler(req, res).catch(err => {
    console.error('Unhandled error in login endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
});

export { router as authRouter };
export const registerHandler = AuthController.registerHandler;
export const loginHandler = AuthController.loginHandler;
export const signToken = AuthService.generateToken;
