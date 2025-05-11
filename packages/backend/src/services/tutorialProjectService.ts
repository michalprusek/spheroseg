/**
 * Tutorial Project Service
 *
 * Creates a tutorial project with sample images for newly registered users
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import axios from 'axios'; // Added axios for HTTP requests
import { pipeline } from 'stream/promises'; // Added for stream handling
import logger from '../utils/logger';

/**
 * Create a tutorial project for a newly registered user
 *
 * @param pool Database connection pool
 * @param userId ID of the newly registered user
 * @returns Object containing project ID or null if creation failed
 */
export async function createTutorialProject(pool: Pool, userId: string): Promise<{ projectId: string } | null> {
  logger.debug('createTutorialProject service called with userId', { userId });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the tutorial project
    const projectResult = await client.query(
      'INSERT INTO projects (user_id, title, description) VALUES ($1, $2, $3) RETURNING id',
      [
        userId,
        'Tutorial Project',
        'Welcome to SpheroSeg! This tutorial project features sample images from our platform to help you get started.',
      ],
    );

    const projectId = projectResult.rows[0].id;
    logger.info(`Created tutorial project for new user`, { userId, projectId });

    // 2. Define source URLs for hero images from the assets service
    const heroImage1Url = 'http://assets/assets/illustrations/026f6ae6-fa28-487c-8263-f49babd99dd3.png';
    const heroImage2Url = 'http://assets/assets/illustrations/19687f60-a78f-49e3-ada7-8dfc6a5fab4e.png';

    const rootDir = process.cwd();
    const imagesDir = path.join(rootDir, 'uploads', 'images');

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

    // Helper function to download an image
    async function downloadImage(imageUrl: string, destinationPath: string) {
      try {
        const response = await axios.get(imageUrl, { responseType: 'stream' });
        await pipeline(response.data, fs.createWriteStream(destinationPath));
        logger.debug(`Downloaded image from ${imageUrl} to ${destinationPath}`);
      } catch (err: any) {
        logger.error(`Failed to download image from ${imageUrl}`, {
          error: err.message,
          stack: err.stack,
        });
        // Check if the error is from Axios and has a response (e.g. 404)
        if (axios.isAxiosError(err) && err.response) {
          logger.error(`Axios error details: status=${err.response.status}, data=${JSON.stringify(err.response.data)}`);
          throw new Error(`Failed to download ${imageUrl}: Server responded with ${err.response.status}`);
        }
        throw new Error(`Failed to download ${imageUrl}: ${err.message}`);
      }
    }

    // Download and save the first hero image
    const image1FileName = `hero_tutorial_image_1_${Date.now()}.png`;
    const image1Path = path.join(projectDir, image1FileName);
    await downloadImage(heroImage1Url, image1Path);

    // Download and save the second hero image
    const image2FileName = `hero_tutorial_image_2_${Date.now()}.png`;
    const image2Path = path.join(projectDir, image2FileName);
    await downloadImage(heroImage2Url, image2Path);

    // 3. Add the images to the database
    // First image - without segmentation
    await client.query(
      `INSERT INTO images (
        project_id, user_id, name, storage_filename, status
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        projectId,
        userId,
        'Hero Image 1 (No Segmentation)',
        `/uploads/images/${projectId}/${image1FileName}`,
        'completed',
      ],
    );

    // Second image - with segmentation
    const image2Result = await client.query(
      `INSERT INTO images (
        project_id, user_id, name, storage_filename, status, segmentation_status
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        projectId,
        userId,
        'Hero Image 2 (With Segmentation)',
        `/uploads/images/${projectId}/${image2FileName}`,
        'completed',
        'completed', // Mark for segmentation
      ],
    );

    const image2Id = image2Result.rows[0].id;

    // 4. Create a sample segmentation result for the second image
    const sampleSegmentation = {
      polygons: [
        {
          id: 'poly1',
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: 200 },
          ],
          label: 'Sample Area 1',
          color: '#FF5733',
        },
        {
          id: 'poly2',
          points: [
            { x: 250, y: 150 },
            { x: 350, y: 150 },
            { x: 350, y: 250 },
            { x: 250, y: 250 },
          ],
          label: 'Sample Area 2',
          color: '#33FF57',
        },
      ],
      metadata: {
        imageWidth: 800, // These might need adjustment based on actual hero image dimensions
        imageHeight: 600, // These might need adjustment based on actual hero image dimensions
        createdAt: new Date().toISOString(),
        tool: 'tutorial_placeholder',
      },
    };

    await client.query(
      `INSERT INTO segmentation_results (
        image_id, result_data, status
      ) VALUES ($1, $2, $3)`,
      [image2Id, JSON.stringify(sampleSegmentation), 'completed'],
    );

    await client.query('COMMIT');
    logger.info('Tutorial project with hero images DB transaction committed', {
      userId,
      projectId,
    });
    logger.info('Tutorial project with hero images created successfully', {
      userId,
      projectId,
    });

    return { projectId };
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Failed to create tutorial project with hero images', {
      error: error.message,
      stack: error.stack,
      userId,
    });
    return null;
  } finally {
    client.release();
  }
}

export default {
  createTutorialProject,
};
