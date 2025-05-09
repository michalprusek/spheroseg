/**
 * Tutorial Project Service
 *
 * Creates a tutorial project with sample images for newly registered users
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

/**
 * Create a tutorial project for a newly registered user
 * 
 * @param pool Database connection pool
 * @param userId ID of the newly registered user
 * @returns Object containing project ID or null if creation failed
 */
export async function createTutorialProject(pool: Pool, userId: string): Promise<{ projectId: string } | null> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Create the tutorial project
    const projectResult = await client.query(
      'INSERT INTO projects (user_id, title, description) VALUES ($1, $2, $3) RETURNING id',
      [
        userId, 
        'Tutorial', 
        'Welcome to SpheroSeg! This tutorial project contains sample images to help you get started with the segmentation tools.'
      ]
    );
    
    const projectId = projectResult.rows[0].id;
    logger.info(`Created tutorial project for new user`, { userId, projectId });

    // 2. Copy two sample images from project-2
    // Source paths for sample images
    const rootDir = process.cwd();
    const imagesDir = path.join(rootDir, 'uploads', 'images');
    const sourceSampleImage1 = path.join(rootDir, 'packages', 'backend', 'uploads', 'images', 'project-2', 'sample_image_1.jpg');
    const sourceSampleImage2 = path.join(rootDir, 'packages', 'backend', 'uploads', 'images', 'project-2', 'sample_image_2.jpg');
    
    // Create uploads/images directory if it doesn't exist
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      logger.debug(`Created images directory: ${imagesDir}`);
    }
    
    // Create directory for the new project
    const projectDir = path.join(imagesDir, projectId);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
      logger.debug(`Created project directory: ${projectDir}`);
    }
    
    // Copy the first sample image with error handling
    const image1FileName = `tutorial_image_1_${Date.now()}.jpg`;
    const image1Path = path.join(projectDir, image1FileName);
    try {
      if (fs.existsSync(sourceSampleImage1)) {
        fs.copyFileSync(sourceSampleImage1, image1Path);
        logger.debug(`Copied sample image 1 to ${image1Path}`);
      } else {
        logger.warn(`Source sample image 1 not found at ${sourceSampleImage1}`);
        throw new Error('Source sample image 1 not found');
      }
    } catch (err) {
      logger.error('Failed to copy sample image 1', { error: err });
      throw err;
    }
    
    // Copy the second sample image with error handling
    const image2FileName = `tutorial_image_2_${Date.now()}.jpg`;
    const image2Path = path.join(projectDir, image2FileName);
    try {
      if (fs.existsSync(sourceSampleImage2)) {
        fs.copyFileSync(sourceSampleImage2, image2Path);
        logger.debug(`Copied sample image 2 to ${image2Path}`);
      } else {
        logger.warn(`Source sample image 2 not found at ${sourceSampleImage2}`);
        throw new Error('Source sample image 2 not found');
      }
    } catch (err) {
      logger.error('Failed to copy sample image 2', { error: err });
      throw err;
    }
    
    // 3. Add the images to the database
    // First image - without segmentation
    await client.query(
      `INSERT INTO images (
        project_id, user_id, name, storage_path, status
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        projectId,
        userId,
        'Sample Image (No Segmentation)',
        `/uploads/images/${projectId}/${image1FileName}`,
        'completed'
      ]
    );
    
    // Second image - with segmentation
    const image2Result = await client.query(
      `INSERT INTO images (
        project_id, user_id, name, storage_path, status, segmentation_status
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        projectId,
        userId,
        'Sample Image (With Segmentation)',
        `/uploads/images/${projectId}/${image2FileName}`,
        'completed',
        'completed'
      ]
    );
    
    const image2Id = image2Result.rows[0].id;
    
    // 4. Create a sample segmentation result for the second image
    const sampleSegmentation = {
      polygons: [
        {
          id: "poly1",
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: 200 }
          ],
          label: "Sample Cell",
          color: "#FF5733"
        },
        {
          id: "poly2",
          points: [
            { x: 250, y: 150 },
            { x: 350, y: 150 },
            { x: 350, y: 250 },
            { x: 250, y: 250 }
          ],
          label: "Sample Cell",
          color: "#33FF57"
        }
      ],
      metadata: {
        imageWidth: 800,
        imageHeight: 600,
        createdAt: new Date().toISOString(),
        tool: "tutorial"
      }
    };
    
    await client.query(
      `INSERT INTO segmentation_results (
        image_id, result_data, status
      ) VALUES ($1, $2, $3)`,
      [
        image2Id,
        JSON.stringify(sampleSegmentation),
        'completed'
      ]
    );
    
    await client.query('COMMIT');
    logger.info('Tutorial project created successfully', { userId, projectId });
    
    return { projectId };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create tutorial project', { error, userId });
    return null;
  } finally {
    client.release();
  }
}

export default {
  createTutorialProject
};