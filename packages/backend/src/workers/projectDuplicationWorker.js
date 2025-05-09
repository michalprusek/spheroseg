/**
 * Project Duplication Worker
 * 
 * This worker handles project duplication in a separate thread to avoid
 * blocking the main event loop.
 */

const { workerData, parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const pg = require('pg');

let pool;

// Function to send progress updates back to the parent thread
function sendProgress(progress, processedItems, totalItems) {
  parentPort.postMessage({
    type: 'progress',
    progress,
    processedItems,
    totalItems
  });
}

// Function to send completion notification back to the parent thread
function sendComplete(result) {
  parentPort.postMessage({
    type: 'complete',
    result,
    processedItems: workerData.totalItems,
    totalItems: workerData.totalItems
  });
}

// Function to send error notification back to the parent thread
function sendError(error, progress = 0, processedItems = 0, totalItems = 0) {
  parentPort.postMessage({
    type: 'error',
    error: error instanceof Error ? error.message : String(error),
    progress,
    processedItems,
    totalItems
  });
}

// Function to setup database connection
async function setupDatabase() {
  try {
    // Load environment variables for database connection
    const dbConfig = require('../config').default.database;
    
    // Create a new pool
    pool = new pg.Pool({
      user: dbConfig.user,
      host: dbConfig.host,
      database: dbConfig.database,
      password: dbConfig.password,
      port: dbConfig.port,
      ssl: dbConfig.ssl
    });
    
    // Test connection
    await pool.query('SELECT NOW()');
    return true;
  } catch (error) {
    console.error('Error setting up database connection:', error);
    sendError('Failed to connect to database: ' + error.message);
    return false;
  }
}

// Function to copy a file
async function copyFile(sourcePath, targetPath, baseDir) {
  try {
    // Normalize paths
    const normalizedSourcePath = sourcePath.startsWith('/') ? sourcePath.substring(1) : sourcePath;
    const normalizedTargetPath = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;
    
    // Create full paths
    const fullSourcePath = path.join(baseDir, normalizedSourcePath);
    const fullTargetPath = path.join(baseDir, normalizedTargetPath);
    
    // Create target directory if it doesn't exist
    const targetDir = path.dirname(fullTargetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Check if source file exists
    if (fs.existsSync(fullSourcePath)) {
      // Copy file
      fs.copyFileSync(fullSourcePath, fullTargetPath);
      return true;
    } else {
      console.warn(`Source file not found: ${fullSourcePath}`);
      return false;
    }
  } catch (error) {
    console.error('Error copying file:', error);
    return false;
  }
}

// Function to generate new file paths for duplicated image
function generateNewFilePaths(originalStoragePath, originalThumbnailPath, newProjectId) {
  // Generate timestamp and random suffix for uniqueness
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000000);
  
  // Extract filename from original path
  const originalFileName = originalStoragePath.split('/').pop() || '';
  const fileNameParts = originalFileName.split('.');
  const fileExtension = fileNameParts.pop() || 'png';
  const fileBaseName = fileNameParts.join('.');
  
  // Generate new storage path
  const newStoragePath = `/uploads/${newProjectId}/${fileBaseName}-copy-${timestamp}-${randomSuffix}.${fileExtension}`;
  
  // Generate new thumbnail path if original exists
  let newThumbnailPath;
  if (originalThumbnailPath) {
    const originalThumbName = originalThumbnailPath.split('/').pop() || '';
    const thumbNameParts = originalThumbName.split('.');
    const thumbExtension = thumbNameParts.pop() || 'png';
    const thumbBaseName = thumbNameParts.join('.');
    
    newThumbnailPath = `/uploads/${newProjectId}/thumb-${thumbBaseName}-copy-${timestamp}-${randomSuffix}.${thumbExtension}`;
  }
  
  return { newStoragePath, newThumbnailPath };
}

// Main function to process the duplication
async function processProjectDuplication() {
  try {
    // Extract data from worker data
    const { taskId, originalProjectId, newProjectId, userId, options } = workerData;
    
    // Setup database connection
    if (!await setupDatabase()) {
      return;
    }
    
    // Get the updated new project
    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [newProjectId]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error('New project not found');
    }
    
    const newProject = projectResult.rows[0];
    
    // Fetch images from the original project
    const imagesResult = await pool.query(
      'SELECT * FROM images WHERE project_id = $1',
      [originalProjectId]
    );
    
    const originalImages = imagesResult.rows;
    const totalItems = originalImages.length + 1; // +1 for project creation
    let processedItems = 1; // Project creation already done
    
    console.log(`Processing ${originalImages.length} images for duplication task ${taskId}`);
    
    // Create project directory if copying files
    if (options.copyFiles) {
      const baseDir = options.baseDir || process.cwd();
      const projectDir = path.join(baseDir, 'public', 'uploads', newProjectId);
      
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
        console.log(`Created directory for new project: ${projectDir}`);
      }
    }
    
    // Get a client for transaction
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Process images in batches to avoid overwhelming the system
      const BATCH_SIZE = 5;
      const batches = Math.ceil(originalImages.length / BATCH_SIZE);
      
      for (let i = 0; i < batches; i++) {
        const batchStart = i * BATCH_SIZE;
        const batchEnd = Math.min((i + 1) * BATCH_SIZE, originalImages.length);
        const batch = originalImages.slice(batchStart, batchEnd);
        
        console.log(`Processing batch ${i + 1}/${batches} for duplication task ${taskId}`);
        
        // Process batch sequentially to avoid transaction conflicts
        for (const image of batch) {
          try {
            // Generate new file paths
            const { newStoragePath, newThumbnailPath } = generateNewFilePaths(
              image.storage_path,
              image.thumbnail_path,
              newProjectId
            );
            
            // Copy files if needed
            if (options.copyFiles) {
              const baseDir = options.baseDir || process.cwd();
              
              await copyFile(image.storage_path, newStoragePath, path.join(baseDir, 'public'));
              
              if (image.thumbnail_path && newThumbnailPath) {
                await copyFile(image.thumbnail_path, newThumbnailPath, path.join(baseDir, 'public'));
              }
            }
            
            // Determine segmentation status and path
            let segmentationStatus = 'pending';
            let segmentationResultPath = null;
            
            if (options.copySegmentations && !options.resetStatus && 
                image.segmentation_status === 'completed' && 
                image.segmentation_result_path) {
              
              // Generate new segmentation result path
              const segmentationFileName = image.segmentation_result_path.split('/').pop() || '';
              const newSegmentationPath = `/uploads/${newProjectId}/segmentation-${Date.now()}-${segmentationFileName}`;
              
              // Copy segmentation file
              if (options.copyFiles) {
                const baseDir = options.baseDir || process.cwd();
                await copyFile(
                  image.segmentation_result_path,
                  newSegmentationPath,
                  path.join(baseDir, 'public')
                );
              }
              
              segmentationStatus = 'completed';
              segmentationResultPath = newSegmentationPath;
            }
            
            // Create new image record
            await client.query(
              `INSERT INTO images (
                project_id, user_id, name, storage_path, thumbnail_path,
                width, height, metadata, status, segmentation_status, segmentation_result_path
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                newProjectId,
                userId,
                `${image.name} (Copy)`,
                newStoragePath,
                newThumbnailPath,
                image.width,
                image.height,
                image.metadata,
                options.resetStatus ? 'pending' : image.status,
                segmentationStatus,
                segmentationResultPath
              ]
            );
            
            // Update progress
            processedItems++;
            const progress = Math.floor((processedItems / totalItems) * 100);
            sendProgress(progress, processedItems, totalItems);
            
          } catch (imageError) {
            console.error(`Error duplicating image ${image.id}:`, imageError);
            // Continue with other images, don't fail the whole task
          }
        }
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      
      // Get the updated project after all images are processed
      const updatedProjectResult = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [newProjectId]
      );
      
      const updatedProject = updatedProjectResult.rows[0];
      
      // Return success
      sendComplete(updatedProject);
      
    } catch (error) {
      // Rollback the transaction on error
      await client.query('ROLLBACK');
      console.error('Error in transaction:', error);
      sendError(error, Math.floor((processedItems / totalItems) * 100), processedItems, totalItems);
    } finally {
      // Release the client
      client.release();
    }
    
  } catch (error) {
    console.error('Error in worker:', error);
    sendError(error);
  } finally {
    // Close the pool when done
    if (pool) {
      await pool.end();
    }
  }
}

// Start processing
processProjectDuplication().catch(error => {
  console.error('Unhandled error in worker:', error);
  sendError(error);
});