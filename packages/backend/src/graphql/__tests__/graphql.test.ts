import { ApolloServer } from '@apollo/server';
import { createTestClient } from 'apollo-server-testing';
import { gql } from 'graphql-tag';
import { Pool } from 'pg';
import { createApolloServer } from '../server';
import { Context } from '../context';

// Mock database
const mockDb = {
  query: jest.fn(),
} as unknown as Pool;

// Mock HTTP server
const mockHttpServer = {
  on: jest.fn(),
  once: jest.fn(),
} as any;

// Test user
const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  isAdmin: false,
  isApproved: true,
  storage_used_bytes: 0,
  storage_limit_bytes: 10737418240,
};

describe('GraphQL API', () => {
  let server: ApolloServer<Context>;
  let testClient: any;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create server
    server = await createApolloServer({
      httpServer: mockHttpServer,
      db: mockDb,
      isDevelopment: true,
    });

    // Create test context
    const context: Context = {
      req: {} as any,
      res: {} as any,
      db: mockDb,
      user: testUser,
      loaders: {
        user: { load: jest.fn().mockResolvedValue(testUser) } as any,
        project: { load: jest.fn() } as any,
        image: { load: jest.fn() } as any,
        segmentation: { load: jest.fn() } as any,
      },
    };

    // Create test client with context
    testClient = createTestClient(server, () => context);
  });

  describe('User Queries', () => {
    it('should fetch current user', async () => {
      const ME_QUERY = gql`
        query Me {
          me {
            id
            email
            name
            isApproved
            storageUsedMB
            storageLimitMB
            storageUsagePercent
          }
        }
      `;

      const result = await testClient.query({ query: ME_QUERY });

      expect(result.errors).toBeUndefined();
      expect(result.data.me).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        isApproved: testUser.isApproved,
        storageUsedMB: 0,
        storageLimitMB: 10240,
        storageUsagePercent: 0,
      });
    });

    it('should check if email exists', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });

      const CHECK_EMAIL_QUERY = gql`
        query CheckEmail($email: String!) {
          checkEmail(email: $email)
        }
      `;

      const result = await testClient.query({
        query: CHECK_EMAIL_QUERY,
        variables: { email: 'existing@example.com' },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.checkEmail).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT id FROM users WHERE email = $1', [
        'existing@example.com',
      ]);
    });
  });

  describe('Authentication Mutations', () => {
    it('should register a new user', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Email doesn't exist
        .mockResolvedValueOnce({
          // Create user
          rows: [
            {
              ...testUser,
              id: 'new-user-id',
              email: 'newuser@example.com',
              name: 'New User',
            },
          ],
        })
        .mockResolvedValueOnce({
          // Create refresh token
          rows: [{ token: 'refresh-token' }],
        });

      const REGISTER_MUTATION = gql`
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            success
            message
            user {
              id
              email
              name
            }
            accessToken
            refreshToken
          }
        }
      `;

      const result = await testClient.mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          input: {
            email: 'newuser@example.com',
            password: 'password123',
            name: 'New User',
          },
        },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.register.success).toBe(true);
      expect(result.data.register.user).toMatchObject({
        email: 'newuser@example.com',
        name: 'New User',
      });
      expect(result.data.register.accessToken).toBeDefined();
      expect(result.data.register.refreshToken).toBeDefined();
    });

    it('should handle registration with existing email', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-user' }],
      });

      const REGISTER_MUTATION = gql`
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            success
          }
        }
      `;

      const result = await testClient.mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          input: {
            email: 'existing@example.com',
            password: 'password123',
            name: 'Test User',
          },
        },
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Email already registered');
    });
  });

  describe('Project Queries', () => {
    it('should fetch user projects', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          title: 'Test Project 1',
          description: 'Description 1',
          tags: ['test'],
          public: false,
          user_id: testUser.id,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'project-2',
          title: 'Test Project 2',
          description: 'Description 2',
          tags: ['test', 'sample'],
          public: true,
          user_id: testUser.id,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockProjects })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const PROJECTS_QUERY = gql`
        query Projects($pagination: PaginationInput) {
          projects(pagination: $pagination) {
            items {
              id
              title
              description
              tags
              public
            }
            total
            hasMore
          }
        }
      `;

      const result = await testClient.query({
        query: PROJECTS_QUERY,
        variables: {
          pagination: { limit: 10, offset: 0 },
        },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.projects.items).toHaveLength(2);
      expect(result.data.projects.total).toBe(2);
      expect(result.data.projects.hasMore).toBe(false);
    });

    it('should fetch public projects without authentication', async () => {
      // Create client without user context
      const publicContext: Context = {
        req: {} as any,
        res: {} as any,
        db: mockDb,
        user: null,
        loaders: {
          user: { load: jest.fn() } as any,
          project: { load: jest.fn() } as any,
          image: { load: jest.fn() } as any,
          segmentation: { load: jest.fn() } as any,
        },
      };

      const publicClient = createTestClient(server, () => publicContext);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'public-project',
              title: 'Public Project',
              public: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const PUBLIC_PROJECTS_QUERY = gql`
        query PublicProjects {
          publicProjects {
            items {
              id
              title
              public
            }
            total
          }
        }
      `;

      const result = await publicClient.query({
        query: PUBLIC_PROJECTS_QUERY,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.publicProjects.items).toHaveLength(1);
      expect(result.data.publicProjects.items[0].public).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should require authentication for protected queries', async () => {
      // Create client without user context
      const unauthContext: Context = {
        req: {} as any,
        res: {} as any,
        db: mockDb,
        user: null,
        loaders: {
          user: { load: jest.fn() } as any,
          project: { load: jest.fn() } as any,
          image: { load: jest.fn() } as any,
          segmentation: { load: jest.fn() } as any,
        },
      };

      const unauthClient = createTestClient(server, () => unauthContext);

      const ME_QUERY = gql`
        query Me {
          me {
            id
          }
        }
      `;

      const result = await unauthClient.query({ query: ME_QUERY });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });

    it('should require admin role for admin queries', async () => {
      const USERS_QUERY = gql`
        query Users {
          users {
            items {
              id
              email
            }
          }
        }
      `;

      const result = await testClient.query({ query: USERS_QUERY });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].extensions.code).toBe('FORBIDDEN');
    });
  });

  describe('Query Complexity', () => {
    it('should reject overly complex queries', async () => {
      const COMPLEX_QUERY = gql`
        query ComplexQuery {
          projects {
            items {
              id
              owner {
                id
                projects {
                  items {
                    id
                    owner {
                      id
                      projects {
                        items {
                          id
                          owner {
                            id
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await testClient.query({ query: COMPLEX_QUERY });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].extensions.code).toBe('QUERY_TOO_COMPLEX');
    });
  });
});

describe('GraphQL Schema', () => {
  it('should have valid schema', async () => {
    const server = await createApolloServer({
      httpServer: mockHttpServer,
      db: mockDb,
      isDevelopment: true,
    });

    expect(server).toBeDefined();
    // Schema validation happens during server creation
    // If we get here, schema is valid
  });
});
