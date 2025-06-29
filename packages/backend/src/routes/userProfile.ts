/**
 * User Profile Routes
 * Routes for user profile and settings management
 */
import { Router } from 'express';
import userProfileController from '../controllers/userProfileController';
import { authenticate as authMiddleware } from '../security/middleware/auth';
import { standardLimiter, sensitiveOperationsLimiter } from '../security/middleware/rateLimitMiddleware';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Profile routes
router.get('/', standardLimiter, userProfileController.getUserProfile);
router.get('/with-settings', standardLimiter, userProfileController.getUserProfileWithSettings);
router.post('/', standardLimiter, userProfileController.createUserProfile);
router.put('/', standardLimiter, userProfileController.updateUserProfile);

// Avatar routes
router.post('/avatar', 
  sensitiveOperationsLimiter, 
  userProfileController.uploadAvatar, 
  userProfileController.uploadAvatarHandler
);
router.delete('/avatar', sensitiveOperationsLimiter, userProfileController.deleteAvatar);

// Settings routes
router.get('/settings', standardLimiter, userProfileController.getUserSettings);
router.get('/settings/:key', standardLimiter, userProfileController.getUserSetting);
router.put('/settings/:key', standardLimiter, userProfileController.setUserSetting);
router.delete('/settings/:key', standardLimiter, userProfileController.deleteUserSetting);
router.post('/settings/batch', standardLimiter, userProfileController.batchUpdateUserSettings);

export default router;