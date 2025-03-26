import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';
import { generateThumbnail, getFileUrl, moveFile, deleteFile } from '../utils/fileStorage';

/**
 * Upload a new image
 */
export const uploadImage = async (
  userId: string,
  projectId: string,
  file: Express.Multer.File
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

  try {
    // Move file from temp to permanent location
    const imagePath = moveFile(file.path, userId, projectId);
    
    // Generate thumbnail
    const thumbnailPath = await generateThumbnail(imagePath);
    
    // Get URLs
    const imageUrl = getFileUrl(imagePath);
    const thumbnailUrl = getFileUrl(thumbnailPath);

    // Create image record in database
    const image = await prisma.image.create({
      data: {
        name: file.originalname,
        imageUrl,
        thumbnailUrl,
        userId,
        projectId,
        segmentationStatus: 'pending'
      }
    });

    return image;
  } catch (error) {
    // Cleanup if something goes wrong
    if (file.path) {
      deleteFile(file.path);
    }
    
    throw error;
  }
};

/**
 * Get an image by ID
 */
export const getImageById = async (imageId: string, userId: string) => {
  // Find image
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: {
      project: true
    }
  });

  if (!image) {
    throw new AppError('Image not found', 404);
  }

  // Check if user is the owner
  if (image.userId !== userId) {
    throw new AppError('Unauthorized access to image', 403);
  }

  return image;
};

/**
 * Get all images for a project
 */
export const getProjectImages = async (projectId: string, userId: string) => {
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

  // Find all images
  const images = await prisma.image.findMany({
    where: { projectId },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return images;
};

/**
 * Delete an image
 */
export const deleteImage = async (imageId: string, userId: string) => {
  // Check if image exists and belongs to user
  const image = await prisma.image.findUnique({
    where: { id: imageId }
  });

  if (!image) {
    throw new AppError('Image not found', 404);
  }

  if (image.userId !== userId) {
    throw new AppError('Unauthorized access to image', 403);
  }

  // Delete image
  await prisma.image.delete({
    where: { id: imageId }
  });

  // TODO: Delete physical files from storage
  // This would need parsing the URLs back to file paths and deleting them

  return { message: 'Image deleted successfully' };
};

/**
 * Update image segmentation status
 */
export const updateSegmentationStatus = async (
  imageId: string,
  status: string,
  result?: any
) => {
  // Find image
  const image = await prisma.image.findUnique({
    where: { id: imageId }
  });

  if (!image) {
    throw new AppError('Image not found', 404);
  }

  // Update image
  const updatedImage = await prisma.image.update({
    where: { id: imageId },
    data: {
      segmentationStatus: status,
      ...(result && { segmentationResult: result })
    }
  });

  return updatedImage;
}; 