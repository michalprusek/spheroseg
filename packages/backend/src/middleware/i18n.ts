import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';

// Extend Express Request type to include translation function
declare global {
  namespace Express {
    interface Request {
      t: (key: string, options?: any) => string;
      language: string;
      i18n: any;
    }
  }
}

/**
 * Middleware to set user's preferred language if authenticated
 */
export async function setUserLanguage(req: Request, res: Response, next: NextFunction) {
  try {
    // If user is authenticated and has a preferred language, use it
    if (req.user?.id) {
      const userLanguage = await authService.getUserLanguage(req.user.id);
      if (userLanguage && req.i18n.languages.includes(userLanguage)) {
        await req.i18n.changeLanguage(userLanguage);
      }
    }

    // Set language in response header for client
    res.setHeader('Content-Language', req.i18n.language);
    
    next();
  } catch (error) {
    // Don't fail the request if language detection fails
    console.error('Error setting user language:', error);
    next();
  }
}

/**
 * Helper to get translated validation errors
 */
export function getValidationErrors(errors: any[], req: Request): any[] {
  return errors.map(error => ({
    ...error,
    message: req.t(error.msg, error.params || {})
  }));
}