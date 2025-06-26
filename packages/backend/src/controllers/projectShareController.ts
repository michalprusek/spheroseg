import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '@/utils/errors';
import { ProjectShareService } from '@/services/projectShareService';
import db from '@/db';

// Vytvoření instance service
const projectShareService = new ProjectShareService(db);

// Validační schéma pro sdílení projektu
const shareProjectSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  permission: z.enum(['view', 'edit'], {
    errorMap: () => ({ message: 'Permission must be either "view" or "edit"' }),
  }),
});

/**
 * Sdílí projekt s uživatelem pomocí emailu
 */
export async function shareProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError('Unauthorized', 'You must be logged in to share projects', 401);
    }

    // Validace vstupních dat
    const validationResult = shareProjectSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new ApiError('Bad Request', validationResult.error.message, 400);
    }

    const { email, permission } = validationResult.data;

    // Kontrola, zda uživatel nesdílí sám se sebou
    const isSelfSharing = await isUserEmail(userId, email);
    if (isSelfSharing) {
      throw new ApiError('Bad Request', 'You cannot share a project with yourself', 400);
    }

    // Sdílení projektu
    const result = await projectShareService.shareProject({
      projectId,
      ownerId: userId,
      email,
      permission,
    });

    res.status(201).json({
      message: 'Project shared successfully',
      data: {
        id: result.id,
        projectId: result.projectId,
        email: result.email,
        permission: result.permission,
        isPending: !!result.invitationToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Zruší sdílení projektu
 */
export async function removeProjectShare(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId, shareId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError('Unauthorized', 'You must be logged in to manage shared projects', 401);
    }

    const result = await projectShareService.removeProjectShare(projectId, shareId, userId);

    if (!result) {
      throw new ApiError('Not Found', 'Share not found or already removed', 404);
    }

    res.json({
      message: 'Project share removed successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Přijme pozvánku ke sdílení projektu
 */
export async function acceptProjectInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError('Unauthorized', 'You must be logged in to accept project invitations', 401);
    }

    const project = await projectShareService.acceptProjectInvitation(token, userId);

    res.json({
      message: 'Project invitation accepted successfully',
      data: project,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Získá seznam projektů sdílených s uživatelem
 */
export async function getSharedProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError('Unauthorized', 'You must be logged in to view shared projects', 401);
    }

    const projects = await projectShareService.getProjectsSharedWithUser(userId);

    res.json({
      data: projects,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Získá seznam sdílení pro konkrétní projekt
 */
export async function getProjectShares(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError('Unauthorized', 'You must be logged in to view project shares', 401);
    }

    const shares = await projectShareService.getProjectShares(projectId, userId);

    res.json({
      data: shares,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Kontroluje, zda má uživatel přístup k projektu (používá se jako middleware)
 */
export async function checkProjectAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError('Unauthorized', 'You must be logged in to access projects', 401);
    }

    const hasAccess = await projectShareService.hasUserAccessToProject(projectId, userId);

    if (!hasAccess) {
      throw new ApiError('Forbidden', 'You do not have access to this project', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Ověří, zda email patří uživateli
 */
async function isUserEmail(userId: string, email: string): Promise<boolean> {
  const query = `SELECT id FROM users WHERE id = $1 AND email = $2`;
  const result = await db.query(query, [userId, email]);
  return result.rowCount > 0;
}
