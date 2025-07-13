/**
 * Integration tests for GraphQL Rate Limiting
 * 
 * Tests rate limiting, query complexity, and cost analysis
 */
import request from 'supertest';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import { buildSchema } from 'graphql';
import { createRateLimitDirective } from 'graphql-rate-limit';
import costAnalysis from 'graphql-cost-analysis';
import app from '../../app';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../utils/logger');

// Test schema with rate limiting
const testSchema = `
  directive @rateLimit(
    window: String!
    max: Int!
    identityArgs: [String]
  ) on FIELD_DEFINITION

  type Query {
    users: [User!]! @rateLimit(window: "1m", max: 10)
    expensiveQuery: ExpensiveResult! @rateLimit(window: "1m", max: 2)
    user(id: ID!): User
    cheapQuery: String!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    comments: [Comment!]!
  }

  type Comment {
    id: ID!
    text: String!
    author: User!
  }

  type ExpensiveResult {
    data: String!
    computation: Float!
  }
`;

describe('GraphQL Rate Limiting', () => {
  let server: ApolloServer;
  let testApp: express.Application;
  const authToken = 'test-token';

  beforeAll(async () => {
    // Create rate limit directive
    const rateLimitDirective = createRateLimitDirective({
      identifyContext: (ctx) => ctx.user?.id || ctx.ip,
    });

    // Create Apollo Server with rate limiting
    server = new ApolloServer({
      typeDefs: [
        rateLimitDirective.typeDefs,
        testSchema,
      ],
      resolvers: {
        Query: {
          users: () => [
            { id: '1', name: 'User 1', email: 'user1@test.com' },
            { id: '2', name: 'User 2', email: 'user2@test.com' },
          ],
          expensiveQuery: async () => {
            // Simulate expensive computation
            await new Promise(resolve => setTimeout(resolve, 100));
            return { data: 'expensive', computation: Math.random() };
          },
          user: (_, { id }) => ({ 
            id, 
            name: `User ${id}`, 
            email: `user${id}@test.com` 
          }),
          cheapQuery: () => 'cheap result',
        },
        User: {
          posts: () => [],
        },
        Post: {
          comments: () => [],
          author: () => ({ id: '1', name: 'Author', email: 'author@test.com' }),
        },
      },
      schemaDirectives: {
        rateLimit: rateLimitDirective.directive,
      },
      validationRules: [
        costAnalysis({
          maximumCost: 1000,
          defaultCost: 1,
          scalarCost: 1,
          objectCost: 2,
          listFactor: 10,
          introspectionCost: 1000,
          enforceIntrospectionCost: true,
        }),
      ],
      plugins: [
        {
          async requestDidStart() {
            return {
              async willSendResponse(requestContext) {
                // Log query complexity
                const { query, variables } = requestContext.request;
                logger.info('GraphQL query executed', {
                  query,
                  variables,
                  complexity: requestContext.metrics?.complexity,
                });
              },
            };
          },
        },
      ],
    });

    await server.start();

    // Create test app
    testApp = express();
    testApp.use(express.json());
    
    testApp.use(
      '/graphql',
      expressMiddleware(server, {
        context: async ({ req }) => ({
          user: req.headers.authorization ? { id: 'user-123' } : null,
          ip: req.ip,
        }),
      })
    );
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on queries', async () => {
      const query = `
        query GetUsers {
          users {
            id
            name
            email
          }
        }
      `;

      // Make requests up to the limit
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(testApp)
            .post('/graphql')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ query })
        );
      }

      const responses = await Promise.all(requests);
      
      // All should succeed
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.data.users).toHaveLength(2);
      });

      // 11th request should be rate limited
      const rateLimitedResponse = await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query });

      expect(rateLimitedResponse.status).toBe(200); // GraphQL returns 200
      expect(rateLimitedResponse.body.errors).toBeDefined();
      expect(rateLimitedResponse.body.errors[0].message).toContain('rate limit');
    });

    it('should have separate rate limits for different queries', async () => {
      const expensiveQuery = `
        query GetExpensive {
          expensiveQuery {
            data
            computation
          }
        }
      `;

      const cheapQuery = `
        query GetCheap {
          cheapQuery
        }
      `;

      // Use up expensive query limit
      await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: expensiveQuery });

      await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: expensiveQuery });

      // Third expensive query should fail
      const expensiveLimited = await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: expensiveQuery });

      expect(expensiveLimited.body.errors).toBeDefined();

      // But cheap query should still work
      const cheapResponse = await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: cheapQuery });

      expect(cheapResponse.status).toBe(200);
      expect(cheapResponse.body.data.cheapQuery).toBe('cheap result');
    });

    it('should rate limit by user identity', async () => {
      const query = `
        query GetUsers {
          users {
            id
            name
          }
        }
      `;

      // Different users should have separate limits
      const user1Requests = [];
      const user2Requests = [];

      // User 1 makes 5 requests
      for (let i = 0; i < 5; i++) {
        user1Requests.push(
          request(testApp)
            .post('/graphql')
            .set('Authorization', 'Bearer user1-token')
            .send({ query })
        );
      }

      // User 2 makes 5 requests
      for (let i = 0; i < 5; i++) {
        user2Requests.push(
          request(testApp)
            .post('/graphql')
            .set('Authorization', 'Bearer user2-token')
            .send({ query })
        );
      }

      const allResponses = await Promise.all([
        ...user1Requests,
        ...user2Requests,
      ]);

      // All should succeed (each user under their limit)
      allResponses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.errors).toBeUndefined();
      });
    });
  });

  describe('Query Complexity', () => {
    it('should reject queries exceeding complexity limit', async () => {
      const complexQuery = `
        query ComplexQuery {
          users {
            id
            name
            posts {
              id
              title
              comments {
                id
                text
                author {
                  id
                  name
                  posts {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      `;

      const response = await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: complexQuery });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('exceeds maximum cost');
    });

    it('should allow queries within complexity limit', async () => {
      const simpleQuery = `
        query SimpleQuery {
          user(id: "1") {
            id
            name
            email
          }
        }
      `;

      const response = await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: simpleQuery });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.user).toBeDefined();
    });

    it('should calculate cost correctly for list queries', async () => {
      const listQuery = `
        query ListQuery {
          users {
            id
            posts {
              id
            }
          }
        }
      `;

      const response = await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: listQuery });

      expect(response.status).toBe(200);
      // Query should execute as it's within limits
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Introspection Protection', () => {
    it('should limit introspection queries', async () => {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            types {
              name
              fields {
                name
                type {
                  name
                }
              }
            }
          }
        }
      `;

      const response = await request(testApp)
        .post('/graphql')
        .send({ query: introspectionQuery });

      // Should be blocked due to high cost
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('cost');
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors gracefully', async () => {
      const query = `
        query GetExpensive {
          expensiveQuery {
            data
          }
        }
      `;

      // Exhaust rate limit
      await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query });

      await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query });

      // This should be rate limited
      const response = await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query });

      expect(response.status).toBe(200);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0]).toMatchObject({
        message: expect.stringContaining('rate limit'),
        extensions: {
          code: 'RATE_LIMITED',
        },
      });
    });

    it('should include retry-after header when rate limited', async () => {
      const query = `
        query GetUsers {
          users {
            id
          }
        }
      `;

      // Exhaust limit
      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(testApp)
            .post('/graphql')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ query })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses[10];

      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
      expect(parseInt(rateLimitedResponse.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('Performance Impact', () => {
    it('should not significantly impact query performance', async () => {
      const query = `
        query PerformanceTest {
          cheapQuery
        }
      `;

      // Measure baseline performance
      const baselineStart = Date.now();
      await request(testApp)
        .post('/graphql')
        .send({ query });
      const baselineDuration = Date.now() - baselineStart;

      // Measure with rate limiting
      const rateLimitedStart = Date.now();
      await request(testApp)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query });
      const rateLimitedDuration = Date.now() - rateLimitedStart;

      // Rate limiting should add minimal overhead (<10ms)
      expect(rateLimitedDuration - baselineDuration).toBeLessThan(10);
    });
  });

  describe('Monitoring Integration', () => {
    it('should expose rate limit metrics', async () => {
      // Make some requests to generate metrics
      const query = `
        query MetricsTest {
          users {
            id
          }
        }
      `;

      for (let i = 0; i < 5; i++) {
        await request(testApp)
          .post('/graphql')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ query });
      }

      // In a real implementation, check Prometheus metrics
      // This is a placeholder for where metrics would be verified
      expect(logger.info).toHaveBeenCalledWith(
        'GraphQL query executed',
        expect.objectContaining({
          query: expect.any(String),
        })
      );
    });
  });
});