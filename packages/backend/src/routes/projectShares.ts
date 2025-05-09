import express, { Router } from 'express';
import authMiddleware from '@/middleware/authMiddleware';
import {
  shareProject,
  removeProjectShare,
  acceptProjectInvitation,
  getSharedProjects,
  getProjectShares,
  checkProjectAccess
} from '@/controllers/projectShareController';
import { createLogger } from '@/utils/logger';

const logger = createLogger('projectSharesRoutes');
const router: Router = express.Router();

// Všechny routy jsou chráněné pomocí authMiddleware

/**
 * @route POST /api/project-shares/:projectId
 * @desc Sdílí projekt s uživatelem podle emailu
 * @access Authenticated (pouze vlastník projektu)
 */
router.post('/:projectId', authMiddleware, shareProject);

/**
 * @route DELETE /api/project-shares/:projectId/:shareId
 * @desc Zruší sdílení projektu
 * @access Authenticated (pouze vlastník projektu)
 */
router.delete('/:projectId/:shareId', authMiddleware, removeProjectShare);

/**
 * @route GET /api/project-shares/:projectId
 * @desc Získá seznam sdílení pro konkrétní projekt
 * @access Authenticated (pouze vlastník projektu)
 */
router.get('/:projectId', authMiddleware, getProjectShares);

/**
 * @route GET /api/project-shares
 * @desc Získá seznam projektů sdílených s přihlášeným uživatelem
 * @access Authenticated
 */
router.get('/', authMiddleware, getSharedProjects);

/**
 * @route POST /api/project-shares/invitation/:token
 * @desc Přijme pozvánku ke sdílení projektu
 * @access Authenticated
 */
router.post('/invitation/:token', authMiddleware, acceptProjectInvitation);

export default router;