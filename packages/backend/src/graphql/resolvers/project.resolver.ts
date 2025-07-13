import { GraphQLError } from 'graphql';
import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../context';
import { 
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectsByUserId,
  getProjectStats,
  duplicateProject as duplicateProjectService
} from '../../services/projectService';
import { getImagesByProjectId } from '../../services/imageService';

const projectResolvers: IResolvers = {
  Query: {
    projects: async (_parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const { pagination = {}, filter = {} } = args;
      return getProjectsByUserId(context.db, context.user.id, pagination, filter);
    },

    project: async (_parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const project = await context.loaders.project.load(args.id);
      
      if (!project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Check permissions
      const hasAccess = project.user_id === context.user.id || 
                       project.public || 
                       context.user.isAdmin;
      
      if (!hasAccess) {
        // Check if user has share access
        const shareResult = await context.db.query(
          'SELECT permission FROM project_shares WHERE project_id = $1 AND user_id = $2',
          [project.id, context.user.id]
        );
        
        if (shareResult.rows.length === 0) {
          throw new GraphQLError('Not authorized to view this project', {
            extensions: { code: 'FORBIDDEN' }
          });
        }
      }

      return project;
    },

    publicProjects: async (_parent, args, context: Context) => {
      const { pagination = {}, filter = {} } = args;
      const { offset = 0, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;

      let query = 'SELECT * FROM projects WHERE public = true';
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.search) {
        query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        params.push(`%${filter.search}%`);
        paramIndex++;
      }

      if (filter.tags && filter.tags.length > 0) {
        query += ` AND tags && $${paramIndex}`;
        params.push(filter.tags);
        paramIndex++;
      }

      // Add sorting and pagination
      query += ` ORDER BY ${sortBy} ${sortOrder}`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const [projects, countResult] = await Promise.all([
        context.db.query(query, params),
        context.db.query('SELECT COUNT(*) FROM projects WHERE public = true', [])
      ]);

      const total = parseInt(countResult.rows[0].count);

      return {
        items: projects.rows,
        total,
        offset,
        limit,
        hasMore: offset + limit < total
      };
    }
  },

  Mutation: {
    createProject: async (_parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      if (!context.user.isApproved) {
        throw new GraphQLError('Account not approved', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const { title, description, tags, public: isPublic } = args.input;

      if (!title || title.trim().length < 1) {
        throw new GraphQLError('Project title is required', {
          extensions: { code: 'BAD_USER_INPUT', field: 'title' }
        });
      }

      const project = await createProject(context.db, {
        userId: context.user.id,
        title: title.trim(),
        description: description?.trim(),
        tags: tags || [],
        public: isPublic || false
      });

      return project;
    },

    updateProject: async (_parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const project = await getProjectById(context.db, args.id);
      
      if (!project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      if (project.user_id !== context.user.id && !context.user.isAdmin) {
        throw new GraphQLError('Not authorized to update this project', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const updates: any = {};
      
      if (args.input.title !== undefined) {
        if (!args.input.title.trim()) {
          throw new GraphQLError('Project title cannot be empty', {
            extensions: { code: 'BAD_USER_INPUT', field: 'title' }
          });
        }
        updates.title = args.input.title.trim();
      }

      if (args.input.description !== undefined) {
        updates.description = args.input.description?.trim() || null;
      }

      if (args.input.tags !== undefined) {
        updates.tags = args.input.tags;
      }

      if (args.input.public !== undefined) {
        updates.public = args.input.public;
      }

      const updatedProject = await updateProject(context.db, args.id, updates);
      
      // Clear cache
      context.loaders.project.clear(args.id);
      
      return updatedProject;
    },

    deleteProject: async (_parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const project = await getProjectById(context.db, args.id);
      
      if (!project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      if (project.user_id !== context.user.id && !context.user.isAdmin) {
        throw new GraphQLError('Not authorized to delete this project', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      await deleteProject(context.db, args.id);

      return {
        success: true,
        message: 'Project deleted successfully'
      };
    },

    duplicateProject: async (_parent, args, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const sourceProject = await getProjectById(context.db, args.id);
      
      if (!sourceProject) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Check if user has access to source project
      const hasAccess = sourceProject.user_id === context.user.id || 
                       sourceProject.public || 
                       context.user.isAdmin;

      if (!hasAccess) {
        throw new GraphQLError('Not authorized to duplicate this project', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const newProject = await duplicateProjectService(
        context.db, 
        args.id, 
        context.user.id,
        args.title
      );

      return newProject;
    }
  },

  Project: {
    owner: async (parent, _args, context: Context) => {
      return context.loaders.user.load(parent.user_id);
    },

    images: async (parent, args, context: Context) => {
      return getImagesByProjectId(context.db, parent.id, args.pagination, args.filter);
    },

    imageCount: async (parent, _args, context: Context) => {
      const result = await context.db.query(
        'SELECT COUNT(*) FROM images WHERE project_id = $1',
        [parent.id]
      );
      return parseInt(result.rows[0].count);
    },

    segmentationCount: async (parent, _args, context: Context) => {
      const result = await context.db.query(
        'SELECT COUNT(*) FROM images WHERE project_id = $1 AND segmentation_status = $2',
        [parent.id, 'completed']
      );
      return parseInt(result.rows[0].count);
    },

    totalSize: async (parent, _args, context: Context) => {
      const result = await context.db.query(
        'SELECT COALESCE(SUM(file_size), 0) as total FROM images WHERE project_id = $1',
        [parent.id]
      );
      return parseInt(result.rows[0].total);
    },

    stats: async (parent, _args, context: Context) => {
      return getProjectStats(context.db, parent.id);
    },

    shares: async (parent, _args, context: Context) => {
      // Only project owner or admin can see shares
      if (context.user?.id !== parent.user_id && !context.user?.isAdmin) {
        return [];
      }

      const result = await context.db.query(
        `SELECT ps.*, u.name as user_name, u.email as user_email
         FROM project_shares ps
         JOIN users u ON ps.user_id = u.id
         WHERE ps.project_id = $1
         ORDER BY ps.created_at DESC`,
        [parent.id]
      );

      return result.rows;
    },

    userPermission: async (parent, _args, context: Context) => {
      if (!context.user) return null;

      // Owner has admin permission
      if (parent.user_id === context.user.id) {
        return 'ADMIN';
      }

      // Check shares
      const result = await context.db.query(
        'SELECT permission FROM project_shares WHERE project_id = $1 AND user_id = $2',
        [parent.id, context.user.id]
      );

      if (result.rows.length > 0) {
        return result.rows[0].permission;
      }

      // Public projects give viewer permission
      if (parent.public) {
        return 'VIEWER';
      }

      return null;
    }
  }
};

export default projectResolvers;