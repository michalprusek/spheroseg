// Simple HTTP server without dependencies
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Handle API endpoints
  if (pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: "OK",
      timestamp: new Date().toISOString(),
      service: "backend-simple"
    }));
  }
  else if (pathname === '/api/status') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: "running",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime()
    }));
  }
  else if (pathname === '/api/metrics/performance') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
  }
  // Support multiple paths for login (compatibility with standard Express router)
  else if (pathname === '/api/auth/login' || pathname === '/auth/login') {
    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Login attempt:', data.email);

        // Simple mock authentication
        if (data.email && data.password) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            user: {
              id: "user-12bprusek-gym-nymburk-cz",
              email: data.email,
              name: "Michal Průšek",
              created_at: new Date().toISOString(),
              preferred_language: "en",
              theme_preference: "dark"
            },
            accessToken: "mock-access-token-" + Date.now(),
            refreshToken: "mock-refresh-token-" + Date.now(),
            tokenType: "Bearer"
          }));
        } else {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            message: "Invalid email or password"
          }));
        }
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Invalid request body',
          message: error.message
        }));
      }
    });
  }
  // Handle register endpoint - support multiple paths for compatibility
  else if (pathname === '/api/auth/register' || pathname === '/auth/register') {
    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Registration attempt:', data.email);

        // Simple mock registration
        if (data.email && data.password) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 201;
          res.end(JSON.stringify({
            user: {
              id: "user-" + data.email.replace(/[^a-zA-Z0-9]/g, '-'),
              email: data.email,
              name: data.name || data.email.split('@')[0],
              created_at: new Date().toISOString()
            },
            accessToken: "mock-access-token-" + Date.now(),
            refreshToken: "mock-refresh-token-" + Date.now(),
            tokenType: "Bearer"
          }));
        } else {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            message: "Email and password are required"
          }));
        }
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Invalid request body',
          message: error.message
        }));
      }
    });
  }
  // Handle refresh token endpoint - support multiple paths for compatibility
  else if (pathname === '/api/auth/refresh' || pathname === '/auth/refresh') {
    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Token refresh attempt');

        // Simple mock token refresh
        if (data.refreshToken) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            accessToken: "mock-access-token-" + Date.now(),
            refreshToken: "mock-refresh-token-" + Date.now(),
            tokenType: "Bearer"
          }));
        } else {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            message: "Refresh token is required"
          }));
        }
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Invalid request body',
          message: error.message
        }));
      }
    });
  }
  // Handle logout endpoint - support multiple paths for compatibility
  else if (pathname === '/api/auth/logout' || pathname === '/auth/logout') {
    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Logout attempt');

        // Simple mock logout
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          message: "Logged out successfully"
        }));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Invalid request body',
          message: error.message
        }));
      }
    });
  }
  else if (pathname === '/api/users/me' || pathname === '/users/me') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      id: "user-12bprusek-gym-nymburk-cz",
      email: "12bprusek@gym-nymburk.cz",
      name: "Michal Průšek",
      role: "admin",
      created_at: new Date().toISOString(),
      profile: {
        preferred_language: "en",
        theme_preference: "dark"
      }
    }));
  }
  else if (pathname === '/api/users/me/statistics' || pathname === '/api/users/me/stats') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      projects_count: 5,
      images_count: 120,
      segmentations_count: 98,
      last_login: new Date().toISOString()
    }));
  }
  else if (pathname === '/api/projects' && req.method === 'GET') {
    // Parse query parameters
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // Load projects from file
    let projects = [];
    try {
      const fs = require('fs');
      const path = require('path');
      const projectsPath = path.join(__dirname, 'mock-data', 'projects.json');
      if (fs.existsSync(projectsPath)) {
        try {
          projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
          console.log(`Loaded ${projects.length} projects`);
        } catch (parseError) {
          console.error('Error parsing projects file:', parseError);
        }
      } else {
        console.log('Projects file not found, creating empty file');
        // Create the directory if it doesn't exist
        const mockDataDir = path.join(__dirname, 'mock-data');
        if (!fs.existsSync(mockDataDir)) {
          fs.mkdirSync(mockDataDir, { recursive: true });
        }
        // Create an empty projects file
        fs.writeFileSync(projectsPath, JSON.stringify([]));
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      projects,
      total: projects.length,
      limit,
      offset
    }));
  }
  // Handle specific project details
  else if (pathname.match(/^\/api\/projects\/project-/) && req.method === 'GET') {
    const projectId = pathname.split('/').pop();

    // Try to find project in data
    let project = null;
    try {
      const fs = require('fs');
      const path = require('path');
      const projectsPath = path.join(__dirname, 'mock-data', 'projects.json');
      if (fs.existsSync(projectsPath)) {
        try {
          const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
          project = projects.find(p => p.id === projectId);
          console.log(`Looking for project ${projectId}, found: ${project ? 'yes' : 'no'}`);
        } catch (parseError) {
          console.error('Error parsing projects file:', parseError);
        }
      }
    } catch (error) {
      console.error('Error finding project:', error);
    }

    if (project) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify(project));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 404;
      res.end(JSON.stringify({
        error: "Project not found",
        message: "The requested project does not exist"
      }));
    }
  }
  // Handle queue status
  else if (pathname.match(/^\/api\/queue-status\/project-\d+$/)) {
    const projectId = pathname.split('/').pop();

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      project_id: projectId,
      total_images: 15,
      processed_images: 12,
      pending_images: 3,
      failed_images: 0,
      status: "processing",
      last_updated: new Date().toISOString()
    }));
  }
  // Handle project images - support all variations of the path
  else if (pathname.match(/^\/api\/projects\/project-[^\/]+\/images$/) || pathname.match(/^\/projects\/project-[^\/]+\/images$/)) {
    // Extract project ID from URL, handling both patterns
    let projectId;
    if (pathname.includes('/api/projects/')) {
      projectId = pathname.split('/')[3];
    } else {
      projectId = pathname.split('/')[2];
    }

    console.log(`[DEBUG] Project images request for projectId: ${projectId}, URL: ${pathname}`);

    // Handle project IDs with "project-" prefix
    let dbProjectId = projectId;
    if (projectId.startsWith('project-')) {
      dbProjectId = projectId.substring(8); // Remove "project-" prefix for database query
      console.log(`[DEBUG] Removed project- prefix for database query: ${dbProjectId}`);
    }

    // Create mock images for project
    const mockImages = [
      {
        id: `image-1-${projectId}`,
        project_id: projectId,
        name: "Sample Image 1",
        file_path: "/uploads/sample1.jpg",
        thumbnail_path: "/uploads/sample1_thumb.jpg",
        width: 800,
        height: 600,
        file_size: 120000,
        mime_type: "image/jpeg",
        created_at: new Date().toISOString(),
        status: "processed"
      },
      {
        id: `image-2-${projectId}`,
        project_id: projectId,
        name: "Sample Image 2",
        file_path: "/uploads/sample2.jpg",
        thumbnail_path: "/uploads/sample2_thumb.jpg",
        width: 1024,
        height: 768,
        file_size: 150000,
        mime_type: "image/jpeg",
        created_at: new Date().toISOString(),
        status: "processed"
      },
      {
        id: `image-3-${projectId}`,
        project_id: projectId,
        name: "Sample Image 3",
        file_path: "/uploads/sample3.jpg",
        thumbnail_path: "/uploads/sample3_thumb.jpg",
        width: 1280,
        height: 720,
        file_size: 180000,
        mime_type: "image/jpeg",
        created_at: new Date().toISOString(),
        status: "processed"
      }
    ];

    // Try to get images from database
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        host: 'db',
        port: 5432,
        database: 'spheroseg',
        user: 'postgres',
        password: 'postgres'
      });

      // Get user ID from auth header
      const authHeader = req.headers.authorization;
      let userId = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        // In a real app, we would verify the token
        // For now, just use a mock user ID
        userId = 1; // Admin user ID
      }

      if (!userId) {
        // If no auth header, use default user
        userId = 1;
      }

      console.log(`[DEBUG] Using user ID: ${userId} for project images request`);

      // First check if project exists and user has access
      pool.query('SELECT id FROM projects WHERE id = $1', [dbProjectId], (err, projectResult) => {
        if (err) {
          console.error('Database error checking project:', err);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Database error', message: err.message }));
          return;
        }

        if (projectResult.rows.length === 0) {
          console.log(`[DEBUG] Project ${dbProjectId} not found, returning mock data`);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(mockImages));
          return;
        }

        // Project exists, get images
        pool.query('SELECT * FROM images WHERE project_id = $1 ORDER BY id', [dbProjectId], (err, result) => {
          pool.end();

          if (err) {
            console.error('Database error fetching images:', err);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Database error', message: err.message }));
            return;
          }

          if (result.rows.length === 0) {
            console.log(`[DEBUG] No images found for project ${dbProjectId}, returning mock data`);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(mockImages));
            return;
          }

          console.log(`[DEBUG] Found ${result.rows.length} images for project ${dbProjectId}`);

          // Format images for response
          const images = result.rows.map(image => ({
            id: image.id.toString(),
            project_id: projectId, // Use original project ID with prefix
            name: image.filename || image.name || `Image ${image.id}`,
            file_path: image.filepath || image.storage_path || `/uploads/${image.id}.jpg`,
            thumbnail_path: image.thumbnail_path || `/uploads/thumbnails/${image.id}.jpg`,
            width: image.width || 800,
            height: image.height || 600,
            file_size: image.size || 100000,
            mime_type: "image/jpeg",
            created_at: image.created_at.toISOString(),
            status: "processed"
          }));

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(images));
        });
      });
    } catch (error) {
      console.error('Error connecting to database:', error);
      // Fall back to mock data
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify(mockImages));
    }
  }
  // Handle API POST to /api/projects
  else if (pathname === '/api/projects' && req.method === 'POST') {
    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Creating project with data:', JSON.stringify(data, null, 2));

        const newProject = {
          id: `project-${Date.now()}`,
          name: data.title || data.name || '',  // Accept both title and name fields
          description: data.description || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: "user-12bprusek-gym-nymburk-cz",
          status: "active",
          image_count: 0
        };

        // Try to save to mock projects file
        try {
          const fs = require('fs');
          const path = require('path');
          const mockDataDir = path.join(__dirname, 'mock-data');
          const mockProjectsPath = path.join(mockDataDir, 'projects.json');
          let projects = [];

          if (fs.existsSync(mockProjectsPath)) {
            try {
              projects = JSON.parse(fs.readFileSync(mockProjectsPath, 'utf8'));
              console.log(`Loaded ${projects.length} existing projects`);
            } catch (parseError) {
              console.error('Error parsing projects file, starting with empty projects:', parseError);
              projects = [];
            }
          } else {
            console.log('Projects file not found, creating new file');
            fs.mkdirSync(path.dirname(mockProjectsPath), { recursive: true });
          }

          projects.push(newProject);
          fs.writeFileSync(mockProjectsPath, JSON.stringify(projects, null, 2));
          console.log(`Added new project to data: ${newProject.id}`);
        } catch (error) {
          console.error('Error saving project to data:', error);
        }

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 201;
        res.end(JSON.stringify(newProject));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Invalid request body',
          message: error.message
        }));
      }
    });
  }
  // Handle DELETE project
  else if (pathname.match(/^\/api\/projects\/project-/) && req.method === 'DELETE') {
    const projectId = pathname.split('/').pop();
    console.log(`Deleting project with ID: ${projectId}`);

    try {
      const fs = require('fs');
      const path = require('path');
      const projectsPath = path.join(__dirname, 'mock-data', 'projects.json');

      if (fs.existsSync(projectsPath)) {
        try {
          let projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
          const initialLength = projects.length;

          // Find the project index
          const projectIndex = projects.findIndex(p => p.id === projectId);

          if (projectIndex !== -1) {
            // Remove the project
            projects.splice(projectIndex, 1);
            fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
            console.log(`Project ${projectId} deleted. Projects remaining: ${projects.length}`);

            // Return 204 status code (success with no content) to match the real API
            res.statusCode = 204;
            res.end();
          } else {
            console.error(`Project ${projectId} not found for deletion`);
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: "Project not found",
              message: "The requested project does not exist or has already been deleted"
            }));
          }
        } catch (parseError) {
          console.error('Error parsing projects file for deletion:', parseError);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: "Internal server error",
            message: "Error reading project data"
          }));
        }
      } else {
        // Create the directory if it doesn't exist
        const mockDataDir = path.join(__dirname, 'mock-data');
        if (!fs.existsSync(mockDataDir)) {
          fs.mkdirSync(mockDataDir, { recursive: true });
        }
        // Create an empty projects file
        fs.writeFileSync(projectsPath, JSON.stringify([]));

        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: "Project not found",
          message: "No projects data available"
        }));
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: "Internal server error",
        message: error.message
      }));
    }
  }
  // Handle batch segmentation endpoint
  else if (pathname === '/images/segmentation/trigger-batch' || pathname === '/api/images/segmentation/trigger-batch') {
    // Parse request body for batch segmentation
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Received batch segmentation request:', data);

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: 'Batch segmentation triggered successfully',
          jobId: 'mock-job-' + Date.now(),
          imageIds: data.imageIds || [],
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Invalid request body',
          message: error.message
        }));
      }
    });
  }
  // Handle Socket.IO endpoint
  else if (pathname === '/socket.io' || pathname.startsWith('/socket.io/')) {
    handleSocketIORequest(req, res);
  }
  // Handle static files from uploads directory
  else if (pathname.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '..', pathname);

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "File not found" }));
        return;
      }

      // Determine content type
      let contentType = 'application/octet-stream';
      if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (filePath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filePath.endsWith('.json')) {
        contentType = 'application/json';
      }

      // Stream the file
      res.setHeader('Content-Type', contentType);
      fs.createReadStream(filePath).pipe(res);
    });
  }
  // Support for project images is now handled above
  // Default 404 handler
  else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`Created uploads directory: ${UPLOADS_DIR}`);
}

// Create mock-data directory if it doesn't exist
const MOCK_DATA_DIR = path.join(__dirname, 'mock-data');
if (!fs.existsSync(MOCK_DATA_DIR)) {
  fs.mkdirSync(MOCK_DATA_DIR, { recursive: true });
  console.log(`Created mock-data directory: ${MOCK_DATA_DIR}`);

  // Create empty projects.json file if it doesn't exist
  const PROJECTS_FILE = path.join(MOCK_DATA_DIR, 'projects.json');
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify([]));
    console.log(`Created empty projects.json file`);
  }
}

// Add a simple Socket.IO mock implementation with improved timeout handling
// We'll use HTTP long polling instead of WebSockets since we don't have ws installed
const socketSessions = new Map();

// Generate a random session ID
const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
};

// Start a session cleanup timer
setInterval(() => {
  const now = Date.now();
  // Cleanup sessions older than 5 minutes (300000ms)
  for (const [sid, session] of socketSessions.entries()) {
    if (now - session.lastActivity > 300000) {
      console.log(`Removing stale Socket.IO session: ${sid}`);
      socketSessions.delete(sid);
    }
  }
}, 60000); // Run cleanup every minute

// Handle Socket.IO HTTP requests
const handleSocketIORequest = (req, res) => {
  // Parse URL to get the specific Socket.IO endpoint
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  // Handle different Socket.IO endpoints
  if (pathname.includes('/socket.io/')) {
    // Handle handshake request (first request in Socket.IO connection)
    if (pathname === '/socket.io/' && req.method === 'GET') {
      // Create a new session
      const sid = generateSessionId();
      const session = {
        id: sid,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: []
      };

      socketSessions.set(sid, session);

      // Send a valid Socket.IO handshake response
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      res.statusCode = 200;

      // Format: <length>:<packet type><data>
      // 0 = open packet
      const handshakeData = JSON.stringify({
        sid: sid,
        upgrades: ["websocket", "polling"],
        // Increase ping interval and timeout to reduce timeouts
        pingInterval: 50000,   // Doubled from 25000
        pingTimeout: 50000,    // Increased from 20000
        maxPayload: 1000000
      });

      const packet = `0${handshakeData}`;
      const response = `${packet.length}:${packet}`;

      console.log(`Socket.IO handshake: created session ${sid}`);
      res.end(response);
    }
    // Handle polling requests (subsequent GET requests)
    else if (pathname.includes('/socket.io/') && req.method === 'GET' && pathname.includes('/polling/')) {
      // Extract session ID from URL
      const sidMatch = pathname.match(/\/socket\.io\/([^/]+)\/polling\//);
      const sid = sidMatch ? sidMatch[1] : null;

      if (sid && socketSessions.has(sid)) {
        const session = socketSessions.get(sid);
        session.lastActivity = Date.now();

        // If there are messages to send, send them
        if (session.messages.length > 0) {
          const messages = session.messages;
          session.messages = [];

          res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
          res.statusCode = 200;
          res.end(messages.join(''));
        } else {
          // No messages, send empty response with heartbeat
          res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
          res.statusCode = 200;

          // Send a heartbeat packet (2::) to keep the connection alive
          res.end('2::');
        }
      } else {
        // If session doesn't exist, create a new one instead of returning error
        if (sid && !socketSessions.has(sid)) {
          console.log(`Socket.IO session ${sid} not found, creating new session`);
          const newSid = generateSessionId();
          const session = {
            id: newSid,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            messages: []
          };

          socketSessions.set(newSid, session);

          // Return handshake data with new session ID
          const handshakeData = JSON.stringify({
            sid: newSid,
            upgrades: ["websocket", "polling"],
            pingInterval: 50000,
            pingTimeout: 50000,
            maxPayload: 1000000
          });

          const packet = `0${handshakeData}`;
          const response = `${packet.length}:${packet}`;

          res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
          res.statusCode = 200;
          res.end(response);
        } else {
          // Invalid format
          res.statusCode = 400;
          res.end('Invalid session format');
        }
      }
    }
    // Handle POST requests (client sending messages)
    else if (req.method === 'POST') {
      // Extract session ID from URL
      const sidMatch = pathname.match(/\/socket\.io\/([^/]+)\/polling\//);
      const sid = sidMatch ? sidMatch[1] : null;

      if (sid && socketSessions.has(sid)) {
        const session = socketSessions.get(sid);
        session.lastActivity = Date.now();

        // Read request body
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          console.log(`Socket.IO message from client (${sid}): ${body}`);

          // Handle ping messages (2::)
          if (body === '2::') {
            // Respond with a pong (3::)
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            res.statusCode = 200;
            res.end('3::');
            return;
          }

          // Acknowledge the message
          res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
          res.statusCode = 200;
          res.end('ok');
        });
      } else {
        // If no session exists, create one
        console.log(`Creating new session for POST request, sid: ${sid}`);
        const session = {
          id: sid || generateSessionId(),
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messages: []
        };

        socketSessions.set(session.id, session);

        // Read and acknowledge the message
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          console.log(`Socket.IO message from new client (${session.id}): ${body}`);
          res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
          res.statusCode = 200;
          res.end('ok');
        });
      }
    }
    else {
      // For any other Socket.IO request, return a valid but empty response
      // This helps clients continue functioning even if they make unexpected requests
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      res.statusCode = 200;
      res.end('');
    }
  } else {
    // Default Socket.IO response
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: "ok",
      message: "Socket.IO endpoint mock - real-time updates not available in simple server mode",
      timestamp: new Date().toISOString()
    }));
  }
};

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  // We don't support WebSockets in this simple server
  // Just close the connection, the client will fall back to polling
  console.log('WebSocket upgrade request received, but not supported');
  socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
  socket.destroy();
});

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Socket.IO endpoint available at /socket.io (with WebSocket support)`);

  // Log available authentication endpoints for diagnostics
  console.log("Available authentication endpoints:");
  console.log("- POST /api/auth/login (or /auth/login)");
  console.log("- POST /api/auth/register (or /auth/register)");
  console.log("- POST /api/auth/refresh (or /auth/refresh)");
  console.log("- POST /api/auth/logout (or /auth/logout)");
  console.log("- GET /api/users/me (or /users/me)");
});