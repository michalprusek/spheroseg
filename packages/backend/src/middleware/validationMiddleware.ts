import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Middleware function factory to validate request data (body, query, params) against a Zod schema.
 * @param schema The Zod schema to validate against.
 * @returns An Express middleware function.
 */
export const validate = (schema: AnyZodObject) => 
    async (req: Request, res: Response, next: NextFunction) => {
    try {
        await schema.parseAsync({body: req.body, query: req.query, params: req.params});
        return next();
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessages = error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message,
            }));
            console.error('Validation Error:', JSON.stringify(errorMessages, null, 2));
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: errorMessages 
            });
        }
        // Handle unexpected errors
        console.error('Internal Server Error during validation:', error);
        return res.status(500).json({ message: 'Internal server error during validation' });
    }
}; 
