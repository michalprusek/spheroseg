import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphqlUploadExpress } from 'graphql-upload';
import depthLimit from 'graphql-depth-limit';
import costAnalysis from 'graphql-query-complexity';
import { Server } from 'http';
import { Express } from 'express';
import { Pool } from 'pg';
import { applyMiddleware } from 'graphql-middleware';

import schema from './schema';
import { createContext, Context } from './context';
import { authDirective } from './directives/authDirective';
import { rateLimitDirective } from './directives/rateLimitDirective';
import { formatError } from './utils/errorFormatter';
import { complexityPlugin } from './plugins/complexityPlugin';
import { loggingPlugin } from './plugins/loggingPlugin';
import { performancePlugin } from './plugins/performancePlugin';

interface CreateApolloServerOptions {
  httpServer: Server;
  db: Pool;
  isDevelopment?: boolean;
}

export async function createApolloServer({
  httpServer,
  db,
  isDevelopment = false
}: CreateApolloServerOptions): Promise<ApolloServer<Context>> {
  // Apply directives to schema
  let directiveSchema = schema;
  directiveSchema = authDirective(directiveSchema);
  directiveSchema = rateLimitDirective(directiveSchema);

  // Create Apollo Server
  const server = new ApolloServer<Context>({
    schema: directiveSchema,
    plugins: [
      // Drain HTTP server on shutdown
      ApolloServerPluginDrainHttpServer({ httpServer }),
      
      // Landing page for development
      isDevelopment
        ? ApolloServerPluginLandingPageLocalDefault({ 
            embed: true,
            includeCookies: true 
          })
        : ApolloServerPluginLandingPageLocalDefault({ embed: false }),
      
      // Custom plugins
      complexityPlugin({ maxComplexity: 1000 }),
      loggingPlugin(),
      performancePlugin(),
    ],
    
    // Validation rules
    validationRules: [
      depthLimit(7), // Limit query depth
    ],
    
    // Format errors
    formatError,
    
    // Enable introspection in development
    introspection: isDevelopment,
    
    // Include stack traces in development
    includeStacktraceInErrorResponses: isDevelopment,
  });

  return server;
}

export function createGraphQLMiddleware(server: ApolloServer<Context>, db: Pool) {
  return [
    // File upload middleware (before Apollo Server)
    graphqlUploadExpress({
      maxFileSize: 200 * 1024 * 1024, // 200MB
      maxFiles: 10,
    }),
    
    // Apollo Server middleware
    expressMiddleware(server, {
      context: async ({ req, res }) => createContext(req, res, db),
    }),
  ];
}

// Re-export for convenience
export { schema, createContext };