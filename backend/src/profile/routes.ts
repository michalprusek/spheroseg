import { Router } from 'express';
import { ProfileController } from './controllers/profile.controller';
import { authenticateJWT } from '../auth/middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', (req, res) => {
  ProfileController.getProfileHandler(req, res).catch(err => {
    console.error('Unhandled error in get profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
});

router.put('/', (req, res) => {
  ProfileController.updateProfileHandler(req, res).catch(err => {
    console.error('Unhandled error in update profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
});

export { router as profileRouter };
export const getProfileHandler = ProfileController.getProfileHandler;
export const updateProfileHandler = ProfileController.updateProfileHandler;
export const getProfile = ProfileController.getProfileHandler;
export const updateProfile = ProfileController.updateProfileHandler;