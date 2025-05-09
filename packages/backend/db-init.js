
/**
 * Database initialization script
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Create a connection pool to the database
const pool = new Pool({
  host: 'spheroseg-db',
  port: 5432,
  database: 'spheroseg',
  user: 'postgres',
  password: 'postgres',
});

console.log('Database connection configuration:', {
  host: 'spheroseg-db',
  port: 5432,
  database: 'spheroseg',
  user: 'postgres'
});

async function initializeDatabase() {
  let client;
  try {
    console.log('Connecting to database...');
    client = await pool.connect();

    console.log('Checking for existing tables...');

    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'users'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('Tables do not exist. Creating schema...');

      // Create tables
      // Create UUID extension if it doesn't exist
      await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

      await client.query(`
        -- Users table for authentication
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- User profiles table for additional user information
        CREATE TABLE IF NOT EXISTS user_profiles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            username VARCHAR(50) UNIQUE, -- Optional username
            full_name VARCHAR(100),
            title VARCHAR(100),
            organization VARCHAR(100),
            bio TEXT,
            location VARCHAR(100),
            avatar_url VARCHAR(255),
            preferred_language VARCHAR(10),
            preferred_theme VARCHAR(10), -- Add preferred_theme column (e.g., 'light', 'dark', 'system')
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- Projects table
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Check if image_status type exists
      const typeCheck = await client.query(`
        SELECT typname FROM pg_type WHERE typname = 'image_status';
      `);

      if (typeCheck.rows.length === 0) {
        await client.query(`CREATE TYPE image_status AS ENUM ('pending', 'processing', 'completed', 'failed');`);
      }

      await client.query(`
        -- Images table
        CREATE TABLE IF NOT EXISTS images (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id), -- Denormalized for easier access/filtering?
            name VARCHAR(255) NOT NULL,
            storage_path VARCHAR(512) NOT NULL, -- Path to the image file (e.g., local path or S3 key)
            thumbnail_path VARCHAR(512),       -- Path to the thumbnail file
            width INTEGER,
            height INTEGER,
            metadata JSONB,                  -- Store original image metadata (optional)
            status image_status DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- Segmentation results table (might be combined with images if 1:1)
        -- If storing results separately allows for multiple segmentation versions/runs per image
        CREATE TABLE IF NOT EXISTS segmentation_results (
            id SERIAL PRIMARY KEY,
            image_id INTEGER UNIQUE NOT NULL REFERENCES images(id) ON DELETE CASCADE, -- Use UNIQUE if only one result per image
            result_data JSONB, -- Store segmentation polygons/masks as JSON
            parameters JSONB, -- Store parameters used for segmentation (optional)
            status image_status DEFAULT 'pending', -- Status of the segmentation task itself
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- Access requests table
        CREATE TABLE IF NOT EXISTS access_requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Link to user if they exist
            email VARCHAR(255) NOT NULL,
            name VARCHAR(100),
            organization VARCHAR(100),
            reason TEXT,
            status VARCHAR(20) DEFAULT 'pending', -- e.g., pending, approved, rejected
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('Database schema created successfully');
    } else {
      console.log('Tables already exist');
    }

    // Check if test user exists
    console.log('Checking for test user...');
    const userCheck = await client.query('SELECT id FROM users WHERE email = $1', ['test@example.com']);

    if (userCheck.rows.length === 0) {
      // Create test user
      console.log('Creating test user...');
      const hashedPassword = await bcrypt.hash('password123', 10);

      // Insert the test user
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, created_at',
        ['test@example.com', hashedPassword, 'Test User']
      );

      console.log('Test user created successfully:', userResult.rows[0]);

      // Create a profile for the test user
      const userId = userResult.rows[0].id;

      try {
        const profileResult = await client.query(
          'INSERT INTO user_profiles (user_id, username, full_name, organization, preferred_language) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id',
          [userId, 'testuser', 'Test User', 'Test Organization', 'en']
        );

        console.log('Test user profile created successfully:', profileResult.rows[0]);
      } catch (profileError) {
        console.error('Error creating user profile:', profileError);
      }

      try {
        // Create a test project for the user
        const projectResult = await client.query(
          'INSERT INTO projects (user_id, title, description) VALUES ($1, $2, $3) RETURNING id, title',
          [userId, 'Test Project', 'This is a test project for development']
        );

        console.log('Test project created successfully:', projectResult.rows[0]);
      } catch (projectError) {
        console.error('Error creating test project:', projectError);
      }
    } else {
      console.log('Test user already exists:', userCheck.rows[0]);
    }

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the function
initializeDatabase();
