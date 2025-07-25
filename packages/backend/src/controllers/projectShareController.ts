import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/errors';
import { ProjectShareService } from '../services/projectShareService';
import db from '../db';
import { AuthenticatedRequest } from '../security/middleware/auth';

// Vytvoření instance service
const projectShareService = new ProjectShareService(db);

// Validační schéma pro sdílení projektu
const shareProjectSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  permission: z.enum(['view', 'edit'], {
    errorMap: () => ({ message: 'Permission must be either "view" or "edit"' }),
  }),
});

// Validační schéma pro generování invitation linku
const generateInvitationLinkSchema = z.object({
  permission: z.enum(['view', 'edit'], {
    errorMap: () => ({ message: 'Permission must be either "view" or "edit"' }),
  }),
});

/**
 * Sdílí projekt s uživatelem pomocí emailu
 */
export async function shareProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError('You must be logged in to share projects', 401);
    }

    // Validace vstupních dat
    const validationResult = shareProjectSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new ApiError(validationResult.error.errors.map((e) => e.message).join(', '), 400);
    }

    const { email, permission } = validationResult.data;

    // Kontrola, zda uživatel nesdílí sám se sebou
    const isSelfSharing = await isUserEmail(userId, email);
    if (isSelfSharing) {
      throw new ApiError('You cannot share a project with yourself', 400);
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
export async function removeProjectShare(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { projectId, shareId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError('You must be logged in to manage shared projects', 401);
    }

    const result = await projectShareService.removeProjectShare(projectId, shareId, userId);

    if (!result) {
      throw new ApiError('Share not found or already removed', 404);
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
export async function acceptProjectInvitation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { token } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError('You must be logged in to accept project invitations', 401);
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
export async function getSharedProjects(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError('You must be logged in to view shared projects', 401);
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
export async function getProjectShares(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError('You must be logged in to view project shares', 401);
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
export async function checkProjectAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError('You must be logged in to access projects', 401);
    }

    const hasAccess = await projectShareService.hasUserAccessToProject(projectId, userId);

    if (!hasAccess) {
      throw new ApiError('You do not have access to this project', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Generuje invitation link pro sdílení projektu
 */
export async function generateInvitationLink(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError('You must be logged in to generate invitation links', 401);
    }

    // Validace vstupních dat
    const validationResult = generateInvitationLinkSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new ApiError(validationResult.error.errors.map((e) => e.message).join(', '), 400);
    }

    const { permission } = validationResult.data;

    // Generování invitation linku
    const result = await projectShareService.generateInvitationLink({
      projectId,
      ownerId: userId,
      permission,
    });

    // Vytvoření plné URL pro frontend
    const frontendUrl = process.env.FRONTEND_URL || 'https://spherosegapp.utia.cas.cz';
    const invitationUrl = `${frontendUrl}/invitation/${result.token}`;

    res.status(201).json({
      message: 'Invitation link generated successfully',
      data: {
        invitationUrl,
        token: result.token,
        expiresAt: result.expiresAt,
        permission: result.permission,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Ověří, zda email patří uživateli
 */
async function isUserEmail(userId: string | number, email: string): Promise<boolean> {
  const query = `SELECT id FROM users WHERE id = $1 AND email = $2`;
  const result = await db.query(query, [userId, email]);
  return (result.rowCount ?? 0) > 0;
}
