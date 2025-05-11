/**
 * Create Test User Script
 * 
 * This script creates a test user in the database for development purposes.
 * It's useful for local development when using the mock authentication mode.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Initialize PostgreSQL client
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'spheroseg',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function createTestUser() {
  const client = await pool.connect();
  
  try {
    console.log('Starting test user creation...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Define the mock user ID used in authMiddleware
    const mockUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const email = 'dev@example.com';

    // Check if user already exists
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [mockUserId]);
    
    if (userCheck.rows.length > 0) {
      console.log('Test user already exists, skipping creation.');
      await client.query('COMMIT');
      return { success: true, message: 'Test user already exists' };
    }
    
    // Create the test user
    await client.query(`
      INSERT INTO users (id, email, name, is_approved, storage_limit_bytes)
      VALUES ($1, $2, $3, $4, $5)
    `, [mockUserId, email, 'Test User', true, 10737418240]);
    
    console.log('Test user created successfully');
    
    // Create a profile for the test user
    await client.query(`
      INSERT INTO user_profiles (id, user_id, username, full_name)
      VALUES ($1, $2, $3, $4)
    `, [mockUserId, mockUserId, 'testuser', 'Test User']);
    
    console.log('Test user profile created successfully');
    
    // Commit transaction
    await client.query('COMMIT');
    
    return { 
      success: true,
      message: 'Test user created successfully',
      userId: mockUserId,
      email: email
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating test user:', error);
    return { 
      success: false, 
      message: 'Failed to create test user', 
      error: error.message 
    };
  } finally {
    client.release();
  }
}

// Execute if this script is run directly
if (require.main === module) {
  createTestUser()
    .then(result => {
      console.log(result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = createTestUser;