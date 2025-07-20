/**
 * Swagger Middleware
 *
 * This middleware configures Swagger UI for API documentation.
 */

// import swaggerJsdoc from 'swagger-jsdoc';
// import swaggerUi from 'swagger-ui-express';
import { Express, Application } from 'express';
import logger from '../utils/logger';
// import config from '../config'; // Currently unused since Swagger is disabled

/**
 * Swagger options - currently unused since Swagger is disabled
 */
// const _swaggerOptions = {
//   definition: {
//     openapi: '3.0.0',
//     info: {
//       title: 'SpheroSeg API',
//       version: '1.0.0',
//       description: 'API documentation for SpheroSeg application',
//       license: {
//         name: 'MIT',
//         url: 'https://opensource.org/licenses/MIT',
//       },
//       contact: {
//         name: 'Michal Průšek',
//         email: 'michalprusek@gmail.com',
//       },
//     },
//     servers: [
//       {
//         url: `http://localhost:${config.server.port}`,
//         description: 'Development server',
//       },
//       {
//         url: 'https://api.spheroseg.com',
//         description: 'Production server',
//       },
//     ],
//     components: {
//       securitySchemes: {
//         bearerAuth: {
//           type: 'http',
//           scheme: 'bearer',
//           bearerFormat: 'JWT',
//         },
//       },
//     },
//     security: [
//       {
//         bearerAuth: [],
//       },
//     ],
//   },
//   apis: ['./src/routes/*.ts', './src/models/*.ts'],
// };

/**
 * Generate Swagger specification
 */
// const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Apply Swagger middleware to Express app
 * @param app Express application
 */
export const applySwagger = (_app: Express | Application) => {
  // Swagger is disabled in development mode
  logger.info('Swagger middleware disabled in development mode');
};

export default applySwagger;
