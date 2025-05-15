const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Create Express app
const app = express();
const server = http.createServer(app);

// Setup Socket.IO server
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://frontend:3000', '*'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/spheroseg',
});

// Configure middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://frontend:3000', '*'],
  credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Configure uploads directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Setup file upload storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit
});

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOAD_DIR));

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Setup metrics endpoint
app.post('/api/metrics/performance', (req, res) => {
  console.log('Received metrics:', req.body);
  res.json({ success: true });
});

// Mock current user endpoint
app.get('/api/users/me', (req, res) => {
  res.json({
    id: 1,
    email: 'demo@example.com',
    name: 'Demo User',
    role: 'user',
    created_at: new Date().toISOString(),
    profile: {
      preferred_language: 'en',
      theme_preference: 'light'
    }
  });
});

// Mock user stats endpoint
app.get('/api/users/me/stats', (req, res) => {
  res.json({
    projects_count: 5,
    images_count: 25,
    segmentations_count: 15
  });
});

// Mock user statistics endpoint
app.get('/api/users/me/statistics', (req, res) => {
  res.json({
    projects: {
      total: 5,
      active: 3,
      archived: 2
    },
    images: {
      total: 25,
      segmented: 15,
      unsegmented: 10
    },
    activities: [
      {
        type: 'project_created',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        details: { project_id: 5, project_name: 'Sample Project 5' }
      },
      {
        type: 'image_uploaded',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        details: { image_id: 25, project_id: 5, project_name: 'Sample Project 5' }
      }
    ]
  });
});

// Mock update user endpoint
app.put('/api/users/me', (req, res) => {
  const userData = req.body;
  // In a real app, we would update the user in the database
  console.log('Updating user data:', userData);
  res.json({
    id: 1,
    email: 'demo@example.com',
    name: userData.name || 'Demo User',
    role: 'user',
    created_at: new Date().toISOString(),
    profile: {
      preferred_language: userData.preferred_language || 'en',
      theme_preference: userData.theme_preference || 'light'
    }
  });
});

// Projects endpoint
app.get('/api/projects', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  // Return empty projects array - no mock projects
  const projects = [];

  res.json({
    projects,
    total: 0,
    limit,
    offset
  });
});

// Database health check
app.get('/api/db/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();

    res.json({
      status: 'connected',
      timestamp: result.rows[0].time
    });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Could not connect to database',
      error: err.message
    });
  }
});

// Initialize database tables if they don't exist
async function initializeDatabase() {
  try {
    const client = await pool.connect();

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );
    `);

    // Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create images table
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id),
        filename VARCHAR(255) NOT NULL,
        filepath VARCHAR(255) NOT NULL,
        size INTEGER,
        width INTEGER,
        height INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    client.release();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: `/uploads/${req.file.filename}`,
        size: req.file.size
      }
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'File upload failed', details: err.message });
  }
});

// Default handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database when server starts
initializeDatabase().catch(console.error);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Socket.IO client connected:', socket.id);

  socket.on('join-project', (projectId) => {
    console.log(`Client ${socket.id} joined project ${projectId}`);
    socket.join(`project:${projectId}`);
  });

  socket.on('leave-project', (projectId) => {
    console.log(`Client ${socket.id} left project ${projectId}`);
    socket.leave(`project:${projectId}`);
  });

  socket.on('segmentation-progress', (data) => {
    console.log('Broadcasting segmentation progress:', data);
    io.to(`project:${data.projectId}`).emit('segmentation-progress', data);
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

server.listen(PORT, () => {
  console.log(`Server started on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };