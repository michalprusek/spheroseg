/**
 * Database Performance Test Setup
 * Sets up the test environment and generates test data
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const { promises: fs } = require('fs');
const path = require('path');
const config = require('./config');
const faker = require('faker');

// Set seed for deterministic test data
faker.seed(parseInt(config.testData.seed, 10));

// Create a connection pool for the tests
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  max: config.database.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Initialize the test database
 * Creates necessary schema and tables for testing
 */
async function initializeTestDatabase() {
  const client = await pool.connect();
  try {
    console.log('Creating test database schema...');
    
    // Read the schema file and create all tables
    const schemaPath = path.join(__dirname, '../../../../setup-db.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    
    console.log('Database schema created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing test database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate test users
 * @param {number} count Number of users to generate
 * @returns {Array} Array of created user IDs
 */
async function generateTestUsers(count) {
  console.log(`Generating ${count} test users...`);
  const userIds = [];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < count; i++) {
      // Generate user data
      const userId = crypto.randomUUID();
      const email = `test-user-${i}@example.com`;
      const passwordHash = '$2a$10$JwAhXsHQwl4i3WjQojjB3.W.z1q0KOZuPuYmaeNMK4e1XQxcjFpvq'; // hashed 'password'
      const name = faker.name.findName();
      
      // Insert user
      await client.query(
        'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
        [userId, email, passwordHash, name]
      );
      
      // Insert user profile
      await client.query(
        'INSERT INTO user_profiles (user_id, username, full_name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [userId, `user_${i}`, name]
      );
      
      userIds.push(userId);
    }
    
    await client.query('COMMIT');
    console.log(`Created ${userIds.length} test users`);
    return userIds;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating test users:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate test projects for users
 * @param {Array} userIds Array of user IDs
 * @param {number} projectsPerUser Number of projects per user
 * @returns {Array} Array of created project IDs
 */
async function generateTestProjects(userIds, projectsPerUser) {
  console.log(`Generating ${projectsPerUser} projects for each user...`);
  const projectIds = [];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const userId of userIds) {
      for (let i = 0; i < projectsPerUser; i++) {
        const projectId = crypto.randomUUID();
        const title = faker.commerce.productName();
        const description = faker.lorem.sentence();
        
        await client.query(
          'INSERT INTO projects (id, user_id, title, description, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
          [projectId, userId, title, description]
        );
        
        projectIds.push(projectId);
      }
    }
    
    await client.query('COMMIT');
    console.log(`Created ${projectIds.length} test projects`);
    return projectIds;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating test projects:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate test images for projects
 * @param {Array} projectIds Array of project IDs
 * @param {number} imagesPerProject Number of images per project
 * @returns {Array} Array of created image IDs
 */
async function generateTestImages(projectIds, imagesPerProject) {
  console.log(`Generating ${imagesPerProject} images for each project...`);
  const imageIds = [];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const projectId of projectIds) {
      // Get user_id for the project
      const { rows } = await client.query('SELECT user_id FROM projects WHERE id = $1', [projectId]);
      const userId = rows[0].user_id;
      
      for (let i = 0; i < imagesPerProject; i++) {
        const imageId = crypto.randomUUID();
        const name = `test_image_${i}.png`;
        const width = faker.datatype.number({ min: 800, max: 1920 });
        const height = faker.datatype.number({ min: 600, max: 1080 });
        const storagePath = `/uploads/test/${imageId}.png`;
        const thumbnailPath = `/uploads/test/thumbnails/${imageId}_thumb.png`;
        const metadata = JSON.stringify({
          originalName: name,
          fileSize: faker.datatype.number({ min: 50000, max: 1000000 }),
          mimeType: 'image/png'
        });
        
        await client.query(
          `INSERT INTO images 
           (id, project_id, user_id, name, storage_path, thumbnail_path, width, height, metadata, status, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [imageId, projectId, userId, name, storagePath, thumbnailPath, width, height, metadata, 'completed']
        );
        
        imageIds.push(imageId);
      }
    }
    
    await client.query('COMMIT');
    console.log(`Created ${imageIds.length} test images`);
    return imageIds;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating test images:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate test segmentation results for images
 * @param {Array} imageIds Array of image IDs
 * @param {number} segmentationsPerImage Number of segmentations per image
 */
async function generateTestSegmentations(imageIds, segmentationsPerImage) {
  console.log(`Generating ${segmentationsPerImage} segmentations for each image...`);
  let count = 0;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const imageId of imageIds) {
      for (let i = 0; i < segmentationsPerImage; i++) {
        const segmentationId = crypto.randomUUID();
        
        // Generate random polygon data
        const numPolygons = faker.datatype.number({ min: 3, max: 10 });
        const polygons = [];
        
        for (let p = 0; p < numPolygons; p++) {
          const numPoints = faker.datatype.number({ min: 3, max: 12 });
          const points = [];
          
          for (let pt = 0; pt < numPoints; pt++) {
            points.push({
              x: faker.datatype.number({ min: 0, max: 1000 }) / 1000,
              y: faker.datatype.number({ min: 0, max: 1000 }) / 1000
            });
          }
          
          polygons.push({
            id: `polygon_${p}`,
            points,
            label: faker.random.arrayElement(['cell', 'nucleus', 'background']),
            color: faker.internet.color()
          });
        }
        
        const resultData = {
          version: '1.0',
          polygons,
          metadata: {
            generated: new Date().toISOString(),
            source: 'test-data-generator'
          }
        };
        
        const parameters = {
          threshold: faker.datatype.number({ min: 0, max: 100 }) / 100,
          smoothing: faker.datatype.number({ min: 0, max: 100 }) / 100,
          model: 'ResUNet-test'
        };
        
        await client.query(
          `INSERT INTO segmentation_results 
           (id, image_id, result_data, parameters, status, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [segmentationId, imageId, JSON.stringify(resultData), JSON.stringify(parameters), 'completed']
        );
        
        count++;
      }
    }
    
    await client.query('COMMIT');
    console.log(`Created ${count} test segmentations`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating test segmentations:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate shared project records
 * @param {Array} userIds Array of user IDs
 * @param {Array} projectIds Array of project IDs
 */
async function generateProjectShares(userIds, projectIds) {
  // Only share ~20% of projects
  const numSharesToCreate = Math.ceil(projectIds.length * 0.2);
  console.log(`Generating ${numSharesToCreate} project shares...`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // For simplicity, we'll create a deterministic pattern of shares
    for (let i = 0; i < numSharesToCreate; i++) {
      const projectId = projectIds[i];
      
      // Get the project owner
      const { rows } = await client.query('SELECT user_id FROM projects WHERE id = $1', [projectId]);
      const ownerId = rows[0].user_id;
      
      // Find a different user to share with
      const otherUsers = userIds.filter(id => id !== ownerId);
      const targetUser = otherUsers[i % otherUsers.length];
      
      // Get the email of the target user
      const userResult = await client.query('SELECT email FROM users WHERE id = $1', [targetUser]);
      const email = userResult.rows[0].email;
      
      // Create the share
      const shareId = crypto.randomUUID();
      const permission = 'view'; // or 'edit'
      
      await client.query(
        `INSERT INTO project_shares 
         (id, project_id, owner_id, user_id, email, permission, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [shareId, projectId, ownerId, targetUser, email, permission]
      );
    }
    
    await client.query('COMMIT');
    console.log(`Created ${numSharesToCreate} project shares`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating project shares:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate all test data according to configuration
 */
async function generateAllTestData() {
  try {
    await initializeTestDatabase();
    
    const userIds = await generateTestUsers(config.testData.users);
    const projectIds = await generateTestProjects(userIds, config.testData.projectsPerUser);
    const imageIds = await generateTestImages(projectIds, config.testData.imagesPerProject);
    await generateTestSegmentations(imageIds, config.testData.segmentationsPerImage);
    await generateProjectShares(userIds, projectIds);
    
    console.log('All test data generated successfully');
    return {
      userIds,
      projectIds,
      imageIds
    };
  } catch (error) {
    console.error('Error generating test data:', error);
    throw error;
  }
}

/**
 * Clean up test database
 */
async function cleanupTestDatabase() {
  const client = await pool.connect();
  try {
    console.log('Cleaning up test database...');
    
    await client.query('BEGIN');
    
    // Delete data in reverse order of dependencies
    await client.query('DELETE FROM segmentation_results');
    await client.query('DELETE FROM images');
    await client.query('DELETE FROM project_shares');
    await client.query('DELETE FROM projects');
    await client.query('DELETE FROM user_profiles');
    await client.query('DELETE FROM users');
    
    await client.query('COMMIT');
    
    console.log('Test database cleaned up successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cleaning up test database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a database client for test queries
 * @returns {Object} Database client
 */
async function getClient() {
  return await pool.connect();
}

/**
 * Close the database pool when tests are complete
 */
async function closePool() {
  await pool.end();
  console.log('Database connection pool closed');
}

module.exports = {
  pool,
  initializeTestDatabase,
  generateAllTestData,
  cleanupTestDatabase,
  getClient,
  closePool,
};