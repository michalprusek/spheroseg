import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import logger from '../utils/logger';

/**
 * Middleware function factory to validate request data (body, query, params) against a Zod schema.
 * @param schema The Zod schema to validate against.
 * @returns An Express middleware function.
 */
export const validate = (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dataToValidate: { [key: string]: any } = {};

    // Dynamicky přidáme části požadavku, které jsou definovány ve schématu
    if ('body' in schema.shape) {
      dataToValidate.body = req.body;
    }
    if ('query' in schema.shape) {
      dataToValidate.query = req.query;
    }
    if ('params' in schema.shape) {
      dataToValidate.params = req.params;
    }

    logger.debug('Validating request data:', { dataToValidate });

    await schema.parseAsync(dataToValidate);

    logger.debug('Validation successful for request data');

    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        // received: e.path.reduce((obj, key) => obj?.[key], dataToValidate) // Simplified for now
      }));
      logger.error('Validation Error:', {
        errors: errorMessages,
        requestData: { body: req.body, query: req.query, params: req.params },
      });
      return res.status(400).json({
        message: 'Validation failed',
        errors: errorMessages,
      });
    }
    // Handle unexpected errors
    logger.error('Internal Server Error during validation:', {
      error,
      requestData: { body: req.body, query: req.query, params: req.params },
    });
    return res.status(500).json({ message: 'Internal server error during validation' });
  }
};
