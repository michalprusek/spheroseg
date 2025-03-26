import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';

/**
 * Create a new project
 */
export const createProject = async (userId: string, title: string, description?: string) => {
  // Create project
  const project = await prisma.project.create({
    data: {
      title,
      description,
      userId
    }
  });

  return project;
};

/**
 * Get a project by ID
 */
export const getProjectById = async (projectId: string, userId: string) => {
  // Find project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      images: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  // Check if user is the owner
  if (project.userId !== userId) {
    throw new AppError('Unauthorized access to project', 403);
  }

  return project;
};

/**
 * Get all projects for a user
 */
export const getUserProjects = async (userId: string) => {
  // Find all projects
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: {
      updatedAt: 'desc'
    },
    include: {
      _count: {
        select: { images: true }
      }
    }
  });

  return projects;
};

/**
 * Update a project
 */
export const updateProject = async (
  projectId: string,
  userId: string,
  title?: string,
  description?: string
) => {
  // Check if project exists and belongs to user
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.userId !== userId) {
    throw new AppError('Unauthorized access to project', 403);
  }

  // Update project
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description })
    }
  });

  return updatedProject;
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string, userId: string) => {
  // Check if project exists and belongs to user
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.userId !== userId) {
    throw new AppError('Unauthorized access to project', 403);
  }

  // Delete project (cascade will delete images)
  await prisma.project.delete({
    where: { id: projectId }
  });

  return { message: 'Project deleted successfully' };
}; 