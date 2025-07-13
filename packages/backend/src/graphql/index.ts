import { Express } from 'express';
import { createServer } from 'http';
import { Pool } from 'pg';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createApolloServer, createGraphQLMiddleware } from './server';
import { authenticate } from '../middleware/auth';
import config from '../config';

export async function setupGraphQL(app: Express, db: Pool, httpServer: ReturnType<typeof createServer>) {
  // Create Apollo Server
  const apolloServer = await createApolloServer({
    httpServer,
    db,
    isDevelopment: config.env === 'development',
  });

  // Start Apollo Server
  await apolloServer.start();

  // GraphQL endpoint configuration
  const graphqlPath = '/graphql';

  // Apply middleware to GraphQL endpoint
  app.use(
    graphqlPath,
    cors<cors.CorsRequest>({
      origin: config.cors.origin,
      credentials: true,
    }),
    bodyParser.json({ limit: '50mb' }),
    authenticate, // Add user to request if authenticated
    ...createGraphQLMiddleware(apolloServer, db)
  );

  console.log(`🚀 GraphQL server ready at ${graphqlPath}`);

  return apolloServer;
}

// Export types and utilities
export * from './context';
export * from './server';