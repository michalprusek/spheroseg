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
    // Log the request data for debugging
    const dataToValidate: { [key: string]: any } = {};
    if (Object.keys(req.body).length > 0) dataToValidate.body = req.body;
    if (Object.keys(req.query).length > 0) dataToValidate.query = req.query;
    if (Object.keys(req.params).length > 0) dataToValidate.params = req.params;

    logger.debug('Validating request data:', { dataToValidate });

    // Parse and validate the request data
    // Ensure we are passing the correct parts of the request to the schema
    // Zod schemas usually expect an object with body, query, params keys if they are to validate them.
    // Or they can be simpler schemas for just one part.
    // The current schema.parseAsync expects an object {body, query, params}.
    await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Log successful validation
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
