/**
 * Database Performance Test Scenarios
 * Contains test scenarios for performance testing
 */

const config = require('./config');
const { MetricsCollector } = require('./metrics');

/**
 * Base class for test scenarios
 */
class Scenario {
  constructor(name, client) {
    this.name = name;
    this.client = client;
    this.metricsCollector = new MetricsCollector(name);
  }
  
  /**
   * Execute a query and record metrics
   * @param {string} text SQL query text
   * @param {Array} params Query parameters
   * @param {string} type Query type for categorization
   * @returns {Object} Query result
   */
  async executeQuery(text, params = [], type = 'unknown') {
    const start = process.hrtime();
    let error = null;
    let result;
    
    try {
      // Execute the query
      result = await this.client.query(text, params);
    } catch (err) {
      error = err;
      console.error(`Query error in ${this.name}:`, err);
    }
    
    // Calculate duration in milliseconds
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    
    // Record query metrics
    this.metricsCollector.recordQuery({
      text,
      params,
      type,
      duration,
      rowCount: result ? result.rowCount : 0,
      error: error ? error.message : null
    });
    
    // If there was an error, throw it
    if (error) {
      throw error;
    }
    
    return result;
  }
  
  /**
   * Run the scenario
   */
  async run() {
    throw new Error('Scenario.run() must be implemented by subclasses');
  }
  
  /**
   * Save metrics and generate report
   */
  async saveMetrics() {
    await this.metricsCollector.saveMetrics();
    return await this.metricsCollector.generateReport();
  }
}

/**
 * User Authentication and Profile Scenario
 * Tests querying user data and profile information
 */
class UserAuthScenario extends Scenario {
  constructor(client, testData) {
    super('UserAuthScenario', client);
    this.testData = testData;
  }
  
  async run() {
    console.log(`Running ${this.name}...`);
    
    // Run tests with multiple user IDs
    for (let i = 0; i < Math.min(this.testData.userIds.length, 20); i++) {
      const userId = this.testData.userIds[i];
      
      // Get user by ID
      await this.executeQuery(
        'SELECT * FROM users WHERE id = $1',
        [userId],
        'user_by_id'
      );
      
      // Get user by email (simulating login)
      const userResult = await this.executeQuery(
        'SELECT * FROM users WHERE id = $1',
        [userId],
        'user_by_id'
      );
      
      if (userResult.rows.length > 0) {
        const email = userResult.rows[0].email;
        
        // Simulate login query
        await this.executeQuery(
          'SELECT u.*, p.username, p.full_name FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE u.email = $1',
          [email],
          'user_auth'
        );
        
        // Get user profile
        await this.executeQuery(
          'SELECT * FROM user_profiles WHERE user_id = $1',
          [userId],
          'user_profile'
        );
      }
    }
    
    console.log(`Completed ${this.name}`);
  }
}

/**
 * Project Listing and Details Scenario
 * Tests querying project data with various filters and ordering
 */
class ProjectListingScenario extends Scenario {
  constructor(client, testData) {
    super('ProjectListingScenario', client);
    this.testData = testData;
  }
  
  async run() {
    console.log(`Running ${this.name}...`);
    
    // Run tests with multiple user IDs
    for (let i = 0; i < Math.min(this.testData.userIds.length, 10); i++) {
      const userId = this.testData.userIds[i];
      
      // Get all projects for a user
      await this.executeQuery(
        'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
        [userId],
        'list_projects'
      );
      
      // Get all projects with count of images
      await this.executeQuery(
        `SELECT p.*, COUNT(i.id) as image_count 
         FROM projects p 
         LEFT JOIN images i ON p.id = i.project_id 
         WHERE p.user_id = $1 
         GROUP BY p.id 
         ORDER BY p.created_at DESC`,
        [userId],
        'list_projects_with_counts'
      );
      
      // Get all shared projects for a user
      await this.executeQuery(
        `SELECT p.*, ps.permission 
         FROM projects p 
         JOIN project_shares ps ON p.id = ps.project_id 
         WHERE ps.user_id = $1 
         ORDER BY p.created_at DESC`,
        [userId],
        'list_shared_projects'
      );
      
      // Get recent projects with limit
      await this.executeQuery(
        'SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5',
        [userId],
        'recent_projects'
      );
    }
    
    // Get specific projects with details
    for (let i = 0; i < Math.min(this.testData.projectIds.length, 10); i++) {
      const projectId = this.testData.projectIds[i];
      
      // Get project details
      await this.executeQuery(
        'SELECT * FROM projects WHERE id = $1',
        [projectId],
        'project_details'
      );
      
      // Get project with image count
      await this.executeQuery(
        `SELECT p.*, COUNT(i.id) as image_count 
         FROM projects p 
         LEFT JOIN images i ON p.id = i.project_id 
         WHERE p.id = $1 
         GROUP BY p.id`,
        [projectId],
        'project_with_counts'
      );
      
      // Get project users (owner and shared users)
      await this.executeQuery(
        `SELECT u.id, u.email, u.name, CASE WHEN p.user_id = u.id THEN 'owner' ELSE ps.permission END as role
         FROM projects p
         LEFT JOIN project_shares ps ON p.id = ps.project_id
         LEFT JOIN users u ON u.id = ps.user_id OR u.id = p.user_id
         WHERE p.id = $1
         GROUP BY u.id, u.email, u.name, p.user_id, ps.permission`,
        [projectId],
        'project_users'
      );
    }
    
    console.log(`Completed ${this.name}`);
  }
}

/**
 * Image Operations Scenario
 * Tests querying and filtering images
 */
class ImageOperationsScenario extends Scenario {
  constructor(client, testData) {
    super('ImageOperationsScenario', client);
    this.testData = testData;
  }
  
  async run() {
    console.log(`Running ${this.name}...`);
    
    // Run tests with multiple project IDs
    for (let i = 0; i < Math.min(this.testData.projectIds.length, 10); i++) {
      const projectId = this.testData.projectIds[i];
      
      // Get all images for a project
      await this.executeQuery(
        'SELECT * FROM images WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId],
        'list_images'
      );
      
      // Get images with segmentation status
      await this.executeQuery(
        `SELECT i.*, EXISTS(SELECT 1 FROM segmentation_results sr WHERE sr.image_id = i.id) as has_segmentation
         FROM images i
         WHERE i.project_id = $1
         ORDER BY i.created_at DESC`,
        [projectId],
        'list_images_with_segmentation'
      );
      
      // Get images with filtering by status
      await this.executeQuery(
        'SELECT * FROM images WHERE project_id = $1 AND status = $2 ORDER BY created_at DESC',
        [projectId, 'completed'],
        'filter_images_by_status'
      );
      
      // Search images by name
      await this.executeQuery(
        'SELECT * FROM images WHERE project_id = $1 AND name ILIKE $2',
        [projectId, '%test%'],
        'search_images'
      );
    }
    
    // Get specific image details
    for (let i = 0; i < Math.min(this.testData.imageIds.length, 20); i++) {
      const imageId = this.testData.imageIds[i];
      
      // Get image details
      await this.executeQuery(
        'SELECT * FROM images WHERE id = $1',
        [imageId],
        'image_details'
      );
      
      // Get image with segmentation data
      await this.executeQuery(
        `SELECT i.*, sr.id as segmentation_id, sr.status as segmentation_status
         FROM images i
         LEFT JOIN segmentation_results sr ON i.id = sr.image_id
         WHERE i.id = $1`,
        [imageId],
        'image_with_segmentation'
      );
    }
    
    console.log(`Completed ${this.name}`);
  }
}

/**
 * Segmentation Operations Scenario
 * Tests querying and manipulating segmentation data
 */
class SegmentationScenario extends Scenario {
  constructor(client, testData) {
    super('SegmentationScenario', client);
    this.testData = testData;
  }
  
  async run() {
    console.log(`Running ${this.name}...`);
    
    // Run tests with multiple image IDs
    for (let i = 0; i < Math.min(this.testData.imageIds.length, 20); i++) {
      const imageId = this.testData.imageIds[i];
      
      // Get segmentation for an image
      const segResult = await this.executeQuery(
        'SELECT * FROM segmentation_results WHERE image_id = $1',
        [imageId],
        'get_segmentation'
      );
      
      if (segResult.rows.length > 0) {
        const segmentationId = segResult.rows[0].id;
        
        // Get detailed segmentation data (with JSONB queries)
        await this.executeQuery(
          `SELECT sr.*, 
             sr.result_data->'polygons' as polygons,
             sr.parameters->>'threshold' as threshold,
             sr.parameters->>'model' as model
           FROM segmentation_results sr 
           WHERE sr.id = $1`,
          [segmentationId],
          'get_segmentation_details'
        );
        
        // Count polygons in segmentation (JSONB array length)
        await this.executeQuery(
          `SELECT jsonb_array_length(result_data->'polygons') as polygon_count
           FROM segmentation_results 
           WHERE id = $1`,
          [segmentationId],
          'count_polygons'
        );
        
        // Filter polygons by label (JSONB path query)
        await this.executeQuery(
          `SELECT jsonb_path_query_array(
             result_data->'polygons', 
             '$[*] ? (@.label == "cell")'
           ) as cell_polygons
           FROM segmentation_results 
           WHERE id = $1`,
          [segmentationId],
          'filter_polygons_by_label'
        );
      }
      
      // Get image with latest segmentation
      await this.executeQuery(
        `SELECT i.*, sr.* 
         FROM images i
         LEFT JOIN segmentation_results sr ON i.id = sr.image_id
         WHERE i.id = $1
         ORDER BY sr.created_at DESC
         LIMIT 1`,
        [imageId],
        'get_latest_segmentation'
      );
    }
    
    // Simulate writing a new segmentation result
    const randomImageId = this.testData.imageIds[
      Math.floor(Math.random() * this.testData.imageIds.length)
    ];
    
    // Create a test segmentation
    const segmentationId = require('crypto').randomUUID();
    const resultData = {
      version: '1.0',
      polygons: [
        {
          id: 'poly_1',
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.1 },
            { x: 0.2, y: 0.2 },
            { x: 0.1, y: 0.2 }
          ],
          label: 'test',
          color: '#ff0000'
        }
      ],
      metadata: {
        generated: new Date().toISOString(),
        source: 'performance-test'
      }
    };
    
    const parameters = {
      threshold: 0.5,
      smoothing: 0.3,
      model: 'ResUNet-test'
    };
    
    // Insert new segmentation result
    await this.executeQuery(
      `INSERT INTO segmentation_results 
       (id, image_id, result_data, parameters, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (image_id) DO UPDATE
       SET result_data = $3, parameters = $4, status = $5, updated_at = NOW()`,
      [segmentationId, randomImageId, JSON.stringify(resultData), JSON.stringify(parameters), 'completed'],
      'create_segmentation'
    );
    
    console.log(`Completed ${this.name}`);
  }
}

/**
 * Complex Queries Scenario
 * Tests complex queries with JOINs, aggregations, and JSONB operations
 */
class ComplexQueriesScenario extends Scenario {
  constructor(client, testData) {
    super('ComplexQueriesScenario', client);
    this.testData = testData;
  }
  
  async run() {
    console.log(`Running ${this.name}...`);
    
    // Project statistics
    for (let i = 0; i < Math.min(this.testData.userIds.length, 5); i++) {
      const userId = this.testData.userIds[i];
      
      // Get project statistics for a user
      await this.executeQuery(
        `SELECT 
           COUNT(DISTINCT p.id) as project_count,
           COUNT(DISTINCT i.id) as image_count,
           COUNT(DISTINCT sr.id) as segmentation_count,
           COUNT(DISTINCT ps.id) as shared_count
         FROM users u
         LEFT JOIN projects p ON u.id = p.user_id
         LEFT JOIN images i ON p.id = i.project_id
         LEFT JOIN segmentation_results sr ON i.id = sr.image_id
         LEFT JOIN project_shares ps ON p.id = ps.project_id
         WHERE u.id = $1`,
        [userId],
        'user_statistics'
      );
      
      // Get detailed project statistics
      await this.executeQuery(
        `SELECT 
           p.id as project_id,
           p.title as project_title,
           COUNT(i.id) as image_count,
           SUM(CASE WHEN sr.id IS NOT NULL THEN 1 ELSE 0 END) as segmented_count,
           COUNT(DISTINCT ps.user_id) as shared_with_count,
           MAX(i.created_at) as last_image_date
         FROM projects p
         LEFT JOIN images i ON p.id = i.project_id
         LEFT JOIN segmentation_results sr ON i.id = sr.image_id
         LEFT JOIN project_shares ps ON p.id = ps.project_id
         WHERE p.user_id = $1
         GROUP BY p.id, p.title
         ORDER BY p.created_at DESC`,
        [userId],
        'detailed_project_statistics'
      );
    }
    
    // Complex JSONB queries
    for (let i = 0; i < Math.min(this.testData.imageIds.length, 10); i++) {
      const imageId = this.testData.imageIds[i];
      
      // Get segmentation polygon statistics
      await this.executeQuery(
        `SELECT 
           i.id as image_id,
           i.name as image_name,
           jsonb_array_length(sr.result_data->'polygons') as total_polygons,
           (
             SELECT COUNT(*)
             FROM jsonb_array_elements(sr.result_data->'polygons') as p
             WHERE p->>'label' = 'cell'
           ) as cell_count,
           (
             SELECT COUNT(*)
             FROM jsonb_array_elements(sr.result_data->'polygons') as p
             WHERE p->>'label' = 'nucleus'
           ) as nucleus_count,
           (
             SELECT COUNT(*)
             FROM jsonb_array_elements(sr.result_data->'polygons') as p
             WHERE p->>'label' = 'background'
           ) as background_count
         FROM images i
         JOIN segmentation_results sr ON i.id = sr.image_id
         WHERE i.id = $1`,
        [imageId],
        'polygon_statistics'
      );
    }
    
    // Full-text search simulation using LIKE
    await this.executeQuery(
      `SELECT 
         p.id as project_id,
         p.title as project_title,
         p.description as project_description,
         i.id as image_id,
         i.name as image_name
       FROM projects p
       LEFT JOIN images i ON p.id = i.project_id
       WHERE 
         p.title ILIKE $1 OR
         p.description ILIKE $1 OR
         i.name ILIKE $1
       ORDER BY p.updated_at DESC
       LIMIT 20`,
      ['%test%'],
      'full_text_search'
    );
    
    // Complex query with multiple joins, filtering, and ordering
    await this.executeQuery(
      `SELECT 
         u.id as user_id,
         u.name as user_name,
         p.id as project_id,
         p.title as project_title,
         i.id as image_id,
         i.name as image_name,
         i.width,
         i.height,
         sr.id as segmentation_id,
         jsonb_array_length(sr.result_data->'polygons') as polygon_count,
         sr.parameters
       FROM users u
       JOIN projects p ON u.id = p.user_id
       JOIN images i ON p.id = i.project_id
       LEFT JOIN segmentation_results sr ON i.id = sr.image_id
       WHERE 
         i.status = 'completed' AND
         (sr.id IS NULL OR sr.status = 'completed')
       ORDER BY i.created_at DESC
       LIMIT 50`,
      [],
      'complex_dashboard_query'
    );
    
    console.log(`Completed ${this.name}`);
  }
}

/**
 * Transaction Performance Scenario
 * Tests query performance within transactions
 */
class TransactionScenario extends Scenario {
  constructor(client, testData) {
    super('TransactionScenario', client);
    this.testData = testData;
  }
  
  async run() {
    console.log(`Running ${this.name}...`);
    
    // Run a few project creation transactions
    for (let i = 0; i < 5; i++) {
      // Get a random user
      const randomUserIndex = Math.floor(Math.random() * this.testData.userIds.length);
      const userId = this.testData.userIds[randomUserIndex];
      
      // Begin transaction
      await this.executeQuery('BEGIN', [], 'transaction_begin');
      
      try {
        // Create a new project
        const projectId = require('crypto').randomUUID();
        const projectResult = await this.executeQuery(
          'INSERT INTO projects (id, user_id, title, description, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id',
          [projectId, userId, `Performance Test Project ${i}`, 'Created during performance testing'],
          'transaction_create_project'
        );
        
        // Create a few test images for the project
        for (let j = 0; j < 3; j++) {
          const imageId = require('crypto').randomUUID();
          const width = 800 + Math.floor(Math.random() * 400);
          const height = 600 + Math.floor(Math.random() * 300);
          
          await this.executeQuery(
            `INSERT INTO images 
             (id, project_id, user_id, name, storage_path, thumbnail_path, width, height, metadata, status, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
            [
              imageId, 
              projectId, 
              userId, 
              `test_image_tx_${j}.png`, 
              `/uploads/test/${imageId}.png`,
              `/uploads/test/thumbnails/${imageId}_thumb.png`,
              width,
              height,
              JSON.stringify({
                originalName: `test_image_tx_${j}.png`,
                fileSize: 50000 + Math.floor(Math.random() * 100000),
                mimeType: 'image/png'
              }),
              'completed'
            ],
            'transaction_create_image'
          );
        }
        
        // Create a share record
        if (this.testData.userIds.length > 1) {
          // Find a different user to share with
          const otherUsers = this.testData.userIds.filter(id => id !== userId);
          const targetUser = otherUsers[0];
          
          // Get the email of the target user
          const userResult = await this.executeQuery(
            'SELECT email FROM users WHERE id = $1',
            [targetUser],
            'transaction_get_user_email'
          );
          
          if (userResult.rows.length > 0) {
            const email = userResult.rows[0].email;
            const shareId = require('crypto').randomUUID();
            
            await this.executeQuery(
              `INSERT INTO project_shares 
               (id, project_id, owner_id, user_id, email, permission, created_at, updated_at) 
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
              [shareId, projectId, userId, targetUser, email, 'view'],
              'transaction_create_share'
            );
          }
        }
        
        // Commit the transaction
        await this.executeQuery('COMMIT', [], 'transaction_commit');
      } catch (error) {
        // Rollback on error
        await this.executeQuery('ROLLBACK', [], 'transaction_rollback');
        console.error('Transaction error:', error);
      }
    }
    
    // Test project duplication simulation
    for (let i = 0; i < Math.min(this.testData.projectIds.length, 2); i++) {
      const projectId = this.testData.projectIds[i];
      
      // Begin transaction
      await this.executeQuery('BEGIN', [], 'transaction_begin');
      
      try {
        // Get project details
        const projectResult = await this.executeQuery(
          'SELECT * FROM projects WHERE id = $1',
          [projectId],
          'duplicate_get_project'
        );
        
        if (projectResult.rows.length > 0) {
          const project = projectResult.rows[0];
          const newProjectId = require('crypto').randomUUID();
          
          // Create new project
          await this.executeQuery(
            'INSERT INTO projects (id, user_id, title, description, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
            [newProjectId, project.user_id, `${project.title} (Copy)`, project.description],
            'duplicate_create_project'
          );
          
          // Get images from the original project
          const imagesResult = await this.executeQuery(
            'SELECT * FROM images WHERE project_id = $1',
            [projectId],
            'duplicate_get_images'
          );
          
          // Duplicate images
          for (const image of imagesResult.rows) {
            const newImageId = require('crypto').randomUUID();
            
            await this.executeQuery(
              `INSERT INTO images 
               (id, project_id, user_id, name, storage_path, thumbnail_path, width, height, metadata, status, created_at, updated_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
              [
                newImageId,
                newProjectId,
                image.user_id,
                image.name,
                image.storage_path,
                image.thumbnail_path,
                image.width,
                image.height,
                image.metadata,
                image.status
              ],
              'duplicate_create_image'
            );
            
            // Also duplicate segmentation if it exists
            const segResult = await this.executeQuery(
              'SELECT * FROM segmentation_results WHERE image_id = $1',
              [image.id],
              'duplicate_get_segmentation'
            );
            
            if (segResult.rows.length > 0) {
              const segmentation = segResult.rows[0];
              const newSegmentationId = require('crypto').randomUUID();
              
              await this.executeQuery(
                `INSERT INTO segmentation_results 
                 (id, image_id, result_data, parameters, status, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                [
                  newSegmentationId,
                  newImageId,
                  segmentation.result_data,
                  segmentation.parameters,
                  segmentation.status
                ],
                'duplicate_create_segmentation'
              );
            }
          }
        }
        
        // Commit the transaction
        await this.executeQuery('COMMIT', [], 'transaction_commit');
      } catch (error) {
        // Rollback on error
        await this.executeQuery('ROLLBACK', [], 'transaction_rollback');
        console.error('Duplication transaction error:', error);
      }
    }
    
    console.log(`Completed ${this.name}`);
  }
}

module.exports = {
  UserAuthScenario,
  ProjectListingScenario,
  ImageOperationsScenario,
  SegmentationScenario,
  ComplexQueriesScenario,
  TransactionScenario
};