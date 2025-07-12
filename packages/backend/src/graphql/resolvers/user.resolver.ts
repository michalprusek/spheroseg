import { GraphQLError } from 'graphql';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { IResolvers } from '@graphql-tools/utils';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} from '../../utils/auth';
import { 
  createUser, 
  getUserById, 
  getUserByEmail, 
  updateUser,
  deleteUser,
  getUserStats
} from '../../services/userService';
import { getProjectsByUserId } from '../../services/projectService';
import { Context } from '../context';
import { 
  validateEmail, 
  validatePassword,
  validateName 
} from '../../utils/validation';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../services/emailService';
import { createUserLoader } from '../dataloaders/userLoader';

const userResolvers: IResolvers = {
  Query: {
    me: async (_parent, _args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      
      return context.loaders.user.load(context.user.id);
    },

    users: async (_parent, args, context: Context) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const { pagination = {}, filter = {} } = args;
      const { offset = 0, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;

      // Build query
      let query = 'SELECT * FROM users WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.search) {
        query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        params.push(`%${filter.search}%`);
        paramIndex++;
      }

      if (filter.isApproved !== undefined) {
        query += ` AND is_approved = $${paramIndex}`;
        params.push(filter.isApproved);
        paramIndex++;
      }

      if (filter.isAdmin !== undefined) {
        query += ` AND is_admin = $${paramIndex}`;
        params.push(filter.isAdmin);
        paramIndex++;
      }

      // Add sorting and pagination
      query += ` ORDER BY ${sortBy} ${sortOrder}`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const [users, countResult] = await Promise.all([
        context.db.query(query, params),
        context.db.query('SELECT COUNT(*) FROM users WHERE 1=1', [])
      ]);

      const total = parseInt(countResult.rows[0].count);

      return {
        items: users.rows,
        total,
        offset,
        limit,
        hasMore: offset + limit < total
      };
    },

    user: async (_parent, args, context: Context) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return context.loaders.user.load(args.id);
    },

    checkEmail: async (_parent, args, context: Context) => {
      const result = await context.db.query(
        'SELECT id FROM users WHERE email = $1',
        [args.email.toLowerCase()]
      );
      return result.rows.length > 0;
    }
  },

  Mutation: {
    register: async (_parent, args, context: Context) => {
      const { email, password, name } = args.input;

      // Validation
      if (!validateEmail(email)) {
        throw new GraphQLError('Invalid email format', {
          extensions: { code: 'BAD_USER_INPUT', field: 'email' }
        });
      }

      if (!validatePassword(password)) {
        throw new GraphQLError('Password must be at least 8 characters', {
          extensions: { code: 'BAD_USER_INPUT', field: 'password' }
        });
      }

      if (!validateName(name)) {
        throw new GraphQLError('Name must be between 2 and 50 characters', {
          extensions: { code: 'BAD_USER_INPUT', field: 'name' }
        });
      }

      try {
        // Check if email exists
        const existingUser = await getUserByEmail(context.db, email);
        if (existingUser) {
          throw new GraphQLError('Email already registered', {
            extensions: { code: 'BAD_USER_INPUT', field: 'email' }
          });
        }

        // Create user
        const user = await createUser(context.db, {
          email: email.toLowerCase(),
          password,
          name
        });

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = await generateRefreshToken(context.db, user);

        // Send verification email
        await sendVerificationEmail(user);

        return {
          success: true,
          message: 'Registration successful. Please check your email to verify your account.',
          user,
          accessToken,
          refreshToken
        };
      } catch (error: any) {
        if (error instanceof GraphQLError) throw error;
        
        throw new GraphQLError('Registration failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

    login: async (_parent, args, context: Context) => {
      const { email, password, rememberMe } = args.input;

      try {
        // Find user
        const user = await getUserByEmail(context.db, email.toLowerCase());
        if (!user) {
          throw new GraphQLError('Invalid credentials', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
          throw new GraphQLError('Invalid credentials', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        // Update last login
        await context.db.query(
          'UPDATE users SET last_login = NOW() WHERE id = $1',
          [user.id]
        );

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = await generateRefreshToken(context.db, user, rememberMe);

        return {
          success: true,
          message: 'Login successful',
          user,
          accessToken,
          refreshToken
        };
      } catch (error: any) {
        if (error instanceof GraphQLError) throw error;
        
        throw new GraphQLError('Login failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

    logout: async (_parent, _args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // Invalidate refresh token if provided
      if (context.refreshToken) {
        await context.db.query(
          'DELETE FROM refresh_tokens WHERE token = $1',
          [context.refreshToken]
        );
      }

      return {
        success: true,
        message: 'Logged out successfully'
      };
    },

    refreshToken: async (_parent, args, context: Context) => {
      try {
        const { userId, tokenId } = await verifyRefreshToken(context.db, args.refreshToken);
        
        // Get user
        const user = await getUserById(context.db, userId);
        if (!user) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = await generateRefreshToken(context.db, user);

        // Invalidate old refresh token
        await context.db.query(
          'DELETE FROM refresh_tokens WHERE id = $1',
          [tokenId]
        );

        return {
          success: true,
          message: 'Token refreshed successfully',
          user,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        };
      } catch (error) {
        throw new GraphQLError('Invalid refresh token', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
    },

    updateProfile: async (_parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const updates: any = {};
      
      if (args.input.name !== undefined) {
        if (!validateName(args.input.name)) {
          throw new GraphQLError('Invalid name', {
            extensions: { code: 'BAD_USER_INPUT', field: 'name' }
          });
        }
        updates.name = args.input.name;
      }

      if (args.input.email !== undefined) {
        if (!validateEmail(args.input.email)) {
          throw new GraphQLError('Invalid email', {
            extensions: { code: 'BAD_USER_INPUT', field: 'email' }
          });
        }
        
        // Check if email is taken
        const existingUser = await getUserByEmail(context.db, args.input.email);
        if (existingUser && existingUser.id !== context.user.id) {
          throw new GraphQLError('Email already in use', {
            extensions: { code: 'BAD_USER_INPUT', field: 'email' }
          });
        }
        
        updates.email = args.input.email.toLowerCase();
        updates.email_verified = false; // Reset verification
      }

      const updatedUser = await updateUser(context.db, context.user.id, updates);
      
      // Clear cache
      context.loaders.user.clear(context.user.id);
      
      return updatedUser;
    },

    // Additional mutation resolvers would go here...
  },

  User: {
    storageUsedMB: (parent) => parent.storage_used_bytes / (1024 * 1024),
    storageLimitMB: (parent) => parent.storage_limit_bytes / (1024 * 1024),
    storageUsagePercent: (parent) => (parent.storage_used_bytes / parent.storage_limit_bytes) * 100,
    
    projects: async (parent, args, context: Context) => {
      // Check if user can view projects
      if (context.user?.id !== parent.id && !context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return getProjectsByUserId(context.db, parent.id, args.pagination, args.filter);
    },

    stats: async (parent, args, context: Context) => {
      // Check if user can view stats
      if (context.user?.id !== parent.id && !context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return getUserStats(context.db, parent.id);
    }
  }
};

export default userResolvers;