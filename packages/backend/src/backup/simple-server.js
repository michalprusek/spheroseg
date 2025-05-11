// Simple HTTP server without dependencies
const http = require('http');
const fs = require('fs');
const path = require('path');

// Import the test-hot-reload file to test hot reload functionality
try {
  // Use require to load the TypeScript file (will be compiled by ts-node)
  const testHotReload = require('./test-hot-reload');
  console.log('Successfully loaded test-hot-reload.ts');
} catch (error) {
  console.error('Error loading test-hot-reload.ts:', error);
}

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
  else if (pathname.match(/^\/api\/projects\/project-/) && req.method === 'GET' &&
           !pathname.match(/\/segmentation\/queue$/) && !pathname.match(/\/segmentation\/trigger$/)) {
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
  // Handle segmentation queue status - both new and legacy paths
  else if (pathname.match(/^\/api\/projects\/project-.*\/segmentation\/queue$/) || pathname.match(/^\/api\/segmentation\/queue$/)) {
    // Check if we're using the legacy endpoint with projectId as query param
    const projectId = pathname.includes('/projects/')
      ? pathname.split('/')[3]
      : url.searchParams.get('projectId');

    console.log(`Handling segmentation queue request for project: ${projectId}`);

    // Get the actual queue status from the images
    try {
      const fs = require('fs');
      const path = require('path');
      const imagesDir = path.join(__dirname, 'mock-data', 'images');

      // Initialize empty arrays for tasks
      const pendingTasks = [];
      const runningTasks = [];

      if (projectId) {
        // If project ID is provided, check that project's images
        const imagesPath = path.join(imagesDir, `${projectId}.json`);

        if (fs.existsSync(imagesPath)) {
          const images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));

          // Find pending and processing images
          images.forEach(img => {
            if (img.segmentationStatus === 'pending') {
              pendingTasks.push(img.id);
            } else if (img.segmentationStatus === 'processing') {
              runningTasks.push(img.id);
            }
          });
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        pendingTasks,
        runningTasks,
        queueLength: pendingTasks.length,
        activeTasksCount: runningTasks.length,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting queue status:', error);

      // Fallback to mock data if there's an error
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        pendingTasks: [],
        runningTasks: [],
        queueLength: 0,
        activeTasksCount: 0,
        timestamp: new Date().toISOString()
      }));
    }
  }
  // Handle project images
  else if (pathname.match(/^\/api\/projects\/project-\d+\/images$/)) {
    const projectId = pathname.split('/')[3];

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

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(mockImages));
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
        console.log('Creating project with data:', data);

        const newProject = {
          id: `project-${Date.now()}`,
          title: data.title || data.name || 'Untitled Project', // Support both title and name fields
          name: data.title || data.name || 'Untitled Project', // Add name field for compatibility
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
  // Handle batch segmentation endpoint - multiple paths for compatibility
  else if (pathname === '/images/segmentation/trigger-batch' ||
           pathname === '/api/images/segmentation/trigger-batch' ||
           pathname.match(/^\/api\/projects\/project-.*\/segmentation\/batch-trigger$/)) {
    // Parse request body for batch segmentation
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // Extract project ID if using the new endpoint format
        let projectId = null;
        if (pathname.includes('/projects/')) {
          projectId = pathname.split('/')[3];
        }

        console.log(`Received batch segmentation request for project ${projectId}:`, data);

        // Get the image IDs from the request
        const imageIds = data.imageIds || [];

        if (imageIds.length === 0) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'No image IDs provided',
            message: 'At least one image ID is required'
          }));
          return;
        }

        // Update the segmentation status for each image
        try {
          const fs = require('fs');
          const path = require('path');
          const imagesDir = path.join(__dirname, 'mock-data', 'images');

          // Find the project ID for each image if not provided
          if (!projectId) {
            // Try to find the project ID from the first image
            const allProjectsDir = fs.readdirSync(imagesDir);

            for (const projectFile of allProjectsDir) {
              if (!projectFile.endsWith('.json')) continue;

              const projectImagesPath = path.join(imagesDir, projectFile);
              const projectImages = JSON.parse(fs.readFileSync(projectImagesPath, 'utf8'));

              const matchingImage = projectImages.find(img => imageIds.includes(img.id));
              if (matchingImage) {
                projectId = matchingImage.project_id;
                break;
              }
            }
          }

          if (projectId) {
            const imagesPath = path.join(imagesDir, `${projectId}.json`);

            if (fs.existsSync(imagesPath)) {
              let images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));
              let updatedCount = 0;

              // Update the status of each image
              images = images.map(img => {
                if (imageIds.includes(img.id)) {
                  updatedCount++;
                  return {
                    ...img,
                    segmentationStatus: 'processing',
                    updated_at: new Date().toISOString()
                  };
                }
                return img;
              });

              // Save the updated images
              fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2));
              console.log(`Updated segmentation status for ${updatedCount} images in project ${projectId}`);

              // Simulate segmentation completion after a delay
              setTimeout(() => {
                try {
                  let images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));

                  // Update the status of each image to completed
                  images = images.map(img => {
                    if (imageIds.includes(img.id)) {
                      return {
                        ...img,
                        segmentationStatus: 'completed',
                        segmentationResultPath: `/uploads/${projectId}/${img.id}-segmentation.json`,
                        updated_at: new Date().toISOString()
                      };
                    }
                    return img;
                  });

                  // Save the updated images
                  fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2));
                  console.log(`Completed segmentation for ${imageIds.length} images in project ${projectId}`);

                  // Create a mock segmentation result file for each image
                  const uploadsDir = path.join(__dirname, '../uploads', projectId);
                  if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                  }

                  imageIds.forEach(imageId => {
                    const segmentationResult = {
                      id: imageId,
                      project_id: projectId,
                      status: 'completed',
                      polygons: [
                        {
                          id: `poly-${Date.now()}-1`,
                          points: [
                            { x: 100, y: 100 },
                            { x: 200, y: 100 },
                            { x: 200, y: 200 },
                            { x: 100, y: 200 }
                          ],
                          type: 'polygon',
                          label: 'spheroid',
                          color: '#FF0000'
                        },
                        {
                          id: `poly-${Date.now()}-2`,
                          points: [
                            { x: 300, y: 300 },
                            { x: 400, y: 300 },
                            { x: 400, y: 400 },
                            { x: 300, y: 400 }
                          ],
                          type: 'polygon',
                          label: 'spheroid',
                          color: '#00FF00'
                        }
                      ],
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    };

                    const segmentationPath = path.join(uploadsDir, `${imageId}-segmentation.json`);
                    fs.writeFileSync(segmentationPath, JSON.stringify(segmentationResult, null, 2));
                  });
                } catch (error) {
                  console.error('Error completing segmentation:', error);
                }
              }, 5000); // Complete after 5 seconds
            }
          }
        } catch (error) {
          console.error('Error updating segmentation status:', error);
        }

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: 'Batch segmentation triggered successfully',
          jobId: 'mock-job-' + Date.now(),
          imageIds: imageIds,
          projectId,
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

  // Handle single image segmentation trigger
  else if (pathname.match(/^\/api\/projects\/project-.*\/segmentation\/trigger$/) ||
           pathname.match(/^\/api\/images\/.*\/segmentation$/)) {
    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        let projectId = null;
        let imageId = null;

        // Extract IDs based on the URL pattern
        if (pathname.includes('/projects/')) {
          projectId = pathname.split('/')[3];
          imageId = data.imageId;
        } else if (pathname.includes('/images/')) {
          imageId = pathname.split('/')[3];
          // We'll need to find the project ID from the image
        }

        console.log(`Received segmentation trigger for image ${imageId}, project ${projectId}`);

        if (!imageId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Missing image ID',
            message: 'Image ID is required'
          }));
          return;
        }

        // Update the segmentation status for the image
        try {
          const fs = require('fs');
          const path = require('path');
          const imagesDir = path.join(__dirname, 'mock-data', 'images');

          // Find the project ID if not provided
          if (!projectId) {
            const allProjectsDir = fs.readdirSync(imagesDir);

            for (const projectFile of allProjectsDir) {
              if (!projectFile.endsWith('.json')) continue;

              const projectImagesPath = path.join(imagesDir, projectFile);
              const projectImages = JSON.parse(fs.readFileSync(projectImagesPath, 'utf8'));

              const matchingImage = projectImages.find(img => img.id === imageId);
              if (matchingImage) {
                projectId = matchingImage.project_id;
                break;
              }
            }
          }

          if (projectId) {
            const imagesPath = path.join(imagesDir, `${projectId}.json`);

            if (fs.existsSync(imagesPath)) {
              let images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));
              let updated = false;

              // Update the status of the image
              images = images.map(img => {
                if (img.id === imageId) {
                  updated = true;
                  return {
                    ...img,
                    segmentationStatus: 'processing',
                    updated_at: new Date().toISOString()
                  };
                }
                return img;
              });

              if (updated) {
                // Save the updated images
                fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2));
                console.log(`Updated segmentation status for image ${imageId} in project ${projectId}`);

                // Simulate segmentation completion after a delay
                setTimeout(() => {
                  try {
                    let images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));

                    // Update the status of the image to completed
                    images = images.map(img => {
                      if (img.id === imageId) {
                        return {
                          ...img,
                          segmentationStatus: 'completed',
                          segmentationResultPath: `/uploads/${projectId}/${imageId}-segmentation.json`,
                          updated_at: new Date().toISOString()
                        };
                      }
                      return img;
                    });

                    // Save the updated images
                    fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2));
                    console.log(`Completed segmentation for image ${imageId} in project ${projectId}`);

                    // Create a mock segmentation result file
                    const uploadsDir = path.join(__dirname, '../uploads', projectId);
                    if (!fs.existsSync(uploadsDir)) {
                      fs.mkdirSync(uploadsDir, { recursive: true });
                    }

                    const segmentationResult = {
                      id: imageId,
                      project_id: projectId,
                      status: 'completed',
                      polygons: [
                        {
                          id: `poly-${Date.now()}-1`,
                          points: [
                            { x: 100, y: 100 },
                            { x: 200, y: 100 },
                            { x: 200, y: 200 },
                            { x: 100, y: 200 }
                          ],
                          type: 'polygon',
                          label: 'spheroid',
                          color: '#FF0000'
                        },
                        {
                          id: `poly-${Date.now()}-2`,
                          points: [
                            { x: 300, y: 300 },
                            { x: 400, y: 300 },
                            { x: 400, y: 400 },
                            { x: 300, y: 400 }
                          ],
                          type: 'polygon',
                          label: 'spheroid',
                          color: '#00FF00'
                        }
                      ],
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    };

                    const segmentationPath = path.join(uploadsDir, `${imageId}-segmentation.json`);
                    fs.writeFileSync(segmentationPath, JSON.stringify(segmentationResult, null, 2));
                  } catch (error) {
                    console.error('Error completing segmentation:', error);
                  }
                }, 3000); // Complete after 3 seconds
              }
            }
          }
        } catch (error) {
          console.error('Error updating segmentation status:', error);
        }

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: 'Segmentation triggered successfully',
          jobId: 'mock-job-' + Date.now(),
          imageId,
          projectId,
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
  // Handle image uploads
  else if ((pathname === '/api/images/upload' || pathname.match(/^\/api\/projects\/project-.*\/images\/upload-batch$/)) && req.method === 'POST') {
    const projectId = pathname.includes('/projects/') ? pathname.split('/')[3] : url.searchParams.get('projectId');
    console.log(`Processing image upload for project: ${projectId}`);

    // Parse multipart form data
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      // Handle non-multipart data (likely JSON or FormData without files)
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          // Try to parse as JSON if provided
          const data = contentType.includes('application/json') ? JSON.parse(body) : {};
          console.log('Received non-multipart upload request:', data);

          // Create a mock response with generated image IDs
          const generatedImages = [];
          const count = data.count || 1;

          for (let i = 0; i < count; i++) {
            // Generate a valid UUID for the image ID
            const uuid = require('crypto').randomUUID();
            const id = uuid;
            generatedImages.push({
              id,
              project_id: projectId,
              name: data.name || `Image ${i+1}`,
              url: `/uploads/${projectId || 'default'}/${id}.png`,
              thumbnail_url: `/uploads/${projectId || 'default'}/${id}-thumb.png`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              width: 800,
              height: 600,
              segmentationStatus: 'pending',
              segmentationResultPath: null
            });
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 201;
          res.end(JSON.stringify({
            success: true,
            message: 'Images uploaded successfully',
            images: generatedImages
          }));
        } catch (error) {
          console.error('Error processing upload data:', error);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Invalid upload data',
            message: error.message
          }));
        }
      });
      return;
    }

    // For actual files, we'd need to parse the multipart data
    // Since we don't have busboy or similar, we'll handle it in a simplified way
    const chunks = [];
    req.on('data', chunk => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const buffer = Buffer.concat(chunks);

      // Extract boundary from content-type
      const boundary = contentType.split('boundary=')[1].trim();

      // For now, just acknowledge the upload without actually saving files
      console.log(`Received ${buffer.length} bytes with boundary: ${boundary}`);

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(__dirname, '../uploads', projectId || 'default');
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch (err) {
        console.error('Error creating upload directory:', err);
      }

      // For batch uploads, create multiple image objects
      // Determine the number of files by counting boundary occurrences
      // This is a simplified approach - in a real implementation, we would properly parse the multipart data
      const boundaryCount = (buffer.toString().match(new RegExp(boundary, 'g')) || []).length;
      const fileCount = Math.max(1, Math.floor((boundaryCount - 1) / 2)); // Rough estimate of file count

      console.log(`Estimated ${fileCount} files in the upload based on boundary count`);

      // Generate image objects for each file
      const uploadedImages = [];

      for (let i = 0; i < fileCount; i++) {
        // Generate a valid UUID for each image ID
        const uuid = require('crypto').randomUUID();
        const imageId = uuid;

        // Create a proper image object with a valid UUID
        const uploadedImage = {
          id: imageId,
          project_id: projectId,
          name: `Uploaded Image ${i+1} ${new Date().toISOString().slice(0, 10)}`,
          url: `/uploads/${projectId || 'default'}/${imageId}.png`,
          thumbnail_url: `/uploads/${projectId || 'default'}/${imageId}-thumb.png`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          width: 800,
          height: 600,
          segmentationStatus: 'pending',
          segmentationResultPath: null
        };

        uploadedImages.push(uploadedImage);
      }

      // Update the project's image count
      try {
        const projectsPath = path.join(__dirname, 'mock-data', 'projects.json');
        if (fs.existsSync(projectsPath)) {
          let projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
          const projectIndex = projects.findIndex(p => p.id === projectId);

          if (projectIndex !== -1) {
            // Increment the image count by the number of uploaded images
            projects[projectIndex].image_count = (projects[projectIndex].image_count || 0) + uploadedImages.length;
            fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
            console.log(`Updated image count for project ${projectId} to ${projects[projectIndex].image_count}`);
          }
        }
      } catch (error) {
        console.error('Error updating project image count:', error);
      }

      // Save the image metadata to a file
      try {
        const imagesDir = path.join(__dirname, 'mock-data', 'images');
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }

        const imagesPath = path.join(imagesDir, `${projectId}.json`);
        let images = [];

        if (fs.existsSync(imagesPath)) {
          try {
            images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));
          } catch (parseError) {
            console.error('Error parsing images file, starting with empty images:', parseError);
          }
        }

        // Add all uploaded images to the images array
        images.push(...uploadedImages);
        fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2));
        console.log(`Saved metadata for ${uploadedImages.length} images in project ${projectId}`);
      } catch (error) {
        console.error('Error saving image metadata:', error);
      }

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 201;
      res.end(JSON.stringify({
        success: true,
        message: `${uploadedImages.length} files uploaded successfully`,
        images: uploadedImages
      }));
    });
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
  // Add support for project images
  else if (pathname.match(/^\/api\/projects\/project-.*\/images$/)) {
    const projectId = pathname.split('/')[3]; // Extract project ID from URL

    // Try to find project
    let project = null;
    try {
      const fs = require('fs');
      const path = require('path');
      const projectsPath = path.join(__dirname, 'mock-data', 'projects.json');
      if (fs.existsSync(projectsPath)) {
        const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
        project = projects.find(p => p.id === projectId);
      }
    } catch (error) {
      console.error('Error finding project for images:', error);
    }

    if (project) {
      // Try to load actual images for the project from the images file
      try {
        const imagesDir = path.join(__dirname, 'mock-data', 'images');
        const imagesPath = path.join(imagesDir, `${projectId}.json`);

        if (fs.existsSync(imagesPath)) {
          const images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));
          console.log(`Loaded ${images.length} images for project ${projectId}`);

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(images));
          return;
        }
      } catch (error) {
        console.error('Error loading images from file:', error);
      }

      // If no images file exists or there was an error, return empty array
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify([]));
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: "Project not found",
        message: "The requested project does not exist"
      }));
    }
  }
  // Handle DELETE for project images - primary endpoint
  else if (pathname.match(/^\/api\/projects\/project-.*\/images\//) && req.method === 'DELETE') {
    const projectId = pathname.split('/')[3]; // Extract project ID from URL
    const imageId = pathname.split('/')[5]; // Extract image ID from URL

    console.log(`Deleting image ${imageId} from project ${projectId}`);

    // Try to delete the image from the project's images file
    try {
      const fs = require('fs');
      const path = require('path');
      const imagesDir = path.join(__dirname, 'mock-data', 'images');
      const imagesPath = path.join(imagesDir, `${projectId}.json`);

      if (fs.existsSync(imagesPath)) {
        let images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));
        const initialCount = images.length;

        // Filter out the image to delete
        images = images.filter(img => img.id !== imageId);

        if (images.length < initialCount) {
          // Image was found and removed
          fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2));
          console.log(`Deleted image ${imageId} from project ${projectId}. Images remaining: ${images.length}`);

          // Update the project's image count
          const projectsPath = path.join(__dirname, 'mock-data', 'projects.json');
          if (fs.existsSync(projectsPath)) {
            let projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
            const projectIndex = projects.findIndex(p => p.id === projectId);

            if (projectIndex !== -1) {
              // Update the image count
              projects[projectIndex].image_count = images.length;
              fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
              console.log(`Updated image count for project ${projectId} to ${images.length}`);
            }
          }
        } else {
          console.log(`Image ${imageId} not found in project ${projectId}`);
        }
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }

    // Return 204 success with no content
    res.statusCode = 204;
    res.end();
  }
  // Handle DELETE for images - legacy endpoint
  else if (pathname.match(/^\/api\/images\//) && req.method === 'DELETE') {
    const imageId = pathname.split('/')[3]; // Extract image ID from URL

    console.log(`Deleting image ${imageId} using legacy endpoint`);

    // Try to find the image in all projects
    try {
      const fs = require('fs');
      const path = require('path');
      const imagesDir = path.join(__dirname, 'mock-data', 'images');

      if (fs.existsSync(imagesDir)) {
        const files = fs.readdirSync(imagesDir);

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const projectId = file.replace('.json', '');
          const imagesPath = path.join(imagesDir, file);
          let images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));
          const initialCount = images.length;

          // Filter out the image to delete
          images = images.filter(img => img.id !== imageId);

          if (images.length < initialCount) {
            // Image was found and removed
            fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2));
            console.log(`Deleted image ${imageId} from project ${projectId}. Images remaining: ${images.length}`);

            // Update the project's image count
            const projectsPath = path.join(__dirname, 'mock-data', 'projects.json');
            if (fs.existsSync(projectsPath)) {
              let projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
              const projectIndex = projects.findIndex(p => p.id === projectId);

              if (projectIndex !== -1) {
                // Update the image count
                projects[projectIndex].image_count = images.length;
                fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
                console.log(`Updated image count for project ${projectId} to ${images.length}`);
              }
            }

            break; // Stop after finding and deleting the image
          }
        }
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }

    // Return 204 success with no content
    res.statusCode = 204;
    res.end();
  }
  // Handle GET for segmentation results
  else if ((pathname.match(/^\/api\/projects\/project-.*\/segmentations\//) ||
            pathname.match(/^\/api\/images\/.*\/segmentation$/)) && req.method === 'GET') {
    let projectId = null;
    let imageId = null;

    // Extract IDs based on the URL pattern
    if (pathname.includes('/projects/')) {
      projectId = pathname.split('/')[3];
      imageId = pathname.split('/')[5];
    } else if (pathname.includes('/images/')) {
      imageId = pathname.split('/')[3];
      // We'll need to find the project ID from the image
    }

    console.log(`Getting segmentation results for image ${imageId}, project ${projectId}`);

    if (!imageId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Missing image ID',
        message: 'Image ID is required'
      }));
      return;
    }

    // Try to find the segmentation results
    try {
      const fs = require('fs');
      const path = require('path');
      const imagesDir = path.join(__dirname, 'mock-data', 'images');

      // Find the project ID if not provided
      if (!projectId) {
        const allProjectsDir = fs.readdirSync(imagesDir);

        for (const projectFile of allProjectsDir) {
          if (!projectFile.endsWith('.json')) continue;

          const projectImagesPath = path.join(imagesDir, projectFile);
          const projectImages = JSON.parse(fs.readFileSync(projectImagesPath, 'utf8'));

          const matchingImage = projectImages.find(img => img.id === imageId);
          if (matchingImage) {
            projectId = matchingImage.project_id;
            break;
          }
        }
      }

      if (projectId) {
        // Check if the segmentation result file exists
        const segmentationPath = path.join(__dirname, '../uploads', projectId, `${imageId}-segmentation.json`);

        if (fs.existsSync(segmentationPath)) {
          // Read the segmentation result
          const segmentationResult = JSON.parse(fs.readFileSync(segmentationPath, 'utf8'));

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(segmentationResult));
          return;
        }

        // If the file doesn't exist, check if the image exists and has a segmentation status
        const imagesPath = path.join(imagesDir, `${projectId}.json`);

        if (fs.existsSync(imagesPath)) {
          const images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));
          const image = images.find(img => img.id === imageId);

          if (image) {
            if (image.segmentationStatus === 'processing') {
              // If the segmentation is still processing, return a 202 Accepted status
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 202;
              res.end(JSON.stringify({
                status: 'processing',
                message: 'Segmentation is still processing',
                imageId,
                projectId
              }));
              return;
            } else if (image.segmentationStatus === 'pending') {
              // If the segmentation is pending, return a 202 Accepted status
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 202;
              res.end(JSON.stringify({
                status: 'pending',
                message: 'Segmentation is pending',
                imageId,
                projectId
              }));
              return;
            } else if (image.segmentationStatus === 'completed' && !image.segmentationResultPath) {
              // If the segmentation is completed but there's no result path, create a mock result
              const segmentationResult = {
                id: imageId,
                project_id: projectId,
                status: 'completed',
                polygons: [
                  {
                    id: `poly-${Date.now()}-1`,
                    points: [
                      { x: 100, y: 100 },
                      { x: 200, y: 100 },
                      { x: 200, y: 200 },
                      { x: 100, y: 200 }
                    ],
                    type: 'polygon',
                    label: 'spheroid',
                    color: '#FF0000'
                  },
                  {
                    id: `poly-${Date.now()}-2`,
                    points: [
                      { x: 300, y: 300 },
                      { x: 400, y: 300 },
                      { x: 400, y: 400 },
                      { x: 300, y: 400 }
                    ],
                    type: 'polygon',
                    label: 'spheroid',
                    color: '#00FF00'
                  }
                ],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              // Create the uploads directory if it doesn't exist
              const uploadsDir = path.join(__dirname, '../uploads', projectId);
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }

              // Save the segmentation result
              const segmentationPath = path.join(uploadsDir, `${imageId}-segmentation.json`);
              fs.writeFileSync(segmentationPath, JSON.stringify(segmentationResult, null, 2));

              // Update the image with the segmentation result path
              image.segmentationResultPath = `/uploads/${projectId}/${imageId}-segmentation.json`;
              fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2));

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(segmentationResult));
              return;
            }
          }
        }
      }

      // If we get here, the segmentation result doesn't exist
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Segmentation not found',
        message: 'No segmentation results found for this image'
      }));
    } catch (error) {
      console.error('Error getting segmentation results:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }));
    }
  }
  // Handle segmentation queue status endpoint
  else if (pathname === '/api/segmentation/queue-status' || pathname.match(/^\/api\/projects\/project-.*\/segmentation\/queue-status$/)) {
    // Extract project ID if using the new endpoint format
    let projectId = null;
    if (pathname.includes('/projects/')) {
      projectId = pathname.split('/')[3];
    }

    // Get the actual queue status
    try {
      const fs = require('fs');
      const path = require('path');
      const imagesDir = path.join(__dirname, 'mock-data', 'images');

      // Find all images in processing state
      const pendingTasks = [];
      const runningTasks = [];
      const completedTasks = [];

      if (projectId) {
        // If project ID is provided, only check that project
        const imagesPath = path.join(imagesDir, `${projectId}.json`);

        if (fs.existsSync(imagesPath)) {
          const images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));

          images.forEach(img => {
            if (img.segmentationStatus === 'processing') {
              runningTasks.push({
                id: img.id,
                project_id: projectId,
                status: 'processing',
                started_at: img.updated_at,
                priority: 5
              });
            } else if (img.segmentationStatus === 'pending') {
              pendingTasks.push({
                id: img.id,
                project_id: projectId,
                status: 'pending',
                queued_at: img.updated_at,
                priority: 5
              });
            } else if (img.segmentationStatus === 'completed') {
              completedTasks.push({
                id: img.id,
                project_id: projectId,
                status: 'completed',
                completed_at: img.updated_at
              });
            }
          });
        }
      } else {
        // If no project ID, check all projects
        const allProjectsDir = fs.readdirSync(imagesDir);

        for (const projectFile of allProjectsDir) {
          if (!projectFile.endsWith('.json')) continue;

          const projectId = projectFile.replace('.json', '');
          const projectImagesPath = path.join(imagesDir, projectFile);
          const projectImages = JSON.parse(fs.readFileSync(projectImagesPath, 'utf8'));

          projectImages.forEach(img => {
            if (img.segmentationStatus === 'processing') {
              runningTasks.push({
                id: img.id,
                project_id: projectId,
                status: 'processing',
                started_at: img.updated_at,
                priority: 5
              });
            } else if (img.segmentationStatus === 'pending') {
              pendingTasks.push({
                id: img.id,
                project_id: projectId,
                status: 'pending',
                queued_at: img.updated_at,
                priority: 5
              });
            } else if (img.segmentationStatus === 'completed') {
              completedTasks.push({
                id: img.id,
                project_id: projectId,
                status: 'completed',
                completed_at: img.updated_at
              });
            }
          });
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        pendingTasks,
        runningTasks,
        completedTasks,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting queue status:', error);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({
        status: 'error',
        error: 'Failed to get queue status',
        message: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }
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

// Add a simple Socket.IO mock implementation
// We'll use HTTP long polling instead of WebSockets since we don't have ws installed
const socketSessions = new Map();

// Track active segmentation tasks
const activeSegmentationTasks = new Map();
const pendingSegmentationTasks = new Map();

// Generate a random session ID
const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
};

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
        messages: [],
        isWebSocket: false
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
        pingInterval: 25000,
        pingTimeout: 20000,
        maxPayload: 1000000
      });

      const packet = `0${handshakeData}`;
      const response = `${packet.length}:${packet}`;

      console.log(`Socket.IO handshake: created session ${sid}`);
      res.end(response);

      // Set up segmentation updates after a connection is established
      setTimeout(() => {
        sendSegmentationUpdates(sid);
      }, 1000);
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
          // No messages, send empty response
          res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
          res.statusCode = 200;
          res.end('');
        }
      } else {
        // Invalid session
        res.statusCode = 400;
        res.end('Invalid session');
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
          console.log(`Socket.IO message from client (${sid}):`, body);

          try {
            // Parse the packet(s)
            // Socket.IO packets are formatted as <packet length>:<packet data>
            const packets = parseSocketIOPackets(body);

            for (const packet of packets) {
              // Handle different packet types
              // 2 = EVENT
              if (packet.type === '2') {
                try {
                  const eventData = JSON.parse(packet.data);
                  console.log(`Received event: ${eventData[0]}`, eventData[1]);

                  // If it's a connection to a specific room (like joining a project)
                  if (eventData[0] === 'join' && eventData[1]) {
                    const room = eventData[1];
                    console.log(`Client joining room: ${room}`);

                    // Store the room in the session
                    session.room = room;

                    // Send acknowledgement
                    const ackEvent = JSON.stringify(['joined', { room }]);
                    const ackPacket = `2${ackEvent}`;
                    session.messages.push(`${ackPacket.length}:${ackPacket}`);

                    // Schedule sending of periodic updates
                    sendSegmentationUpdates(sid);
                  }
                } catch (err) {
                  console.error('Error parsing event packet:', err);
                }
              }
            }
          } catch (err) {
            console.error('Error handling Socket.IO message:', err);
          }

          // Acknowledge the message
          res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
          res.statusCode = 200;
          res.end('ok');
        });
      } else {
        // Invalid session
        res.statusCode = 400;
        res.end('Invalid session');
      }
    }
    else {
      // Unknown Socket.IO request
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      res.statusCode = 400;
      res.end('Invalid Socket.IO request');
    }
  } else {
    // Default Socket.IO response
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: "ok",
      message: "Socket.IO endpoint mock - real-time updates available",
      timestamp: new Date().toISOString()
    }));
  }
};

// Parse Socket.IO packets from a string
function parseSocketIOPackets(data) {
  const packets = [];
  let i = 0;

  while (i < data.length) {
    // Find the colon that separates length from data
    const colonIndex = data.indexOf(':', i);
    if (colonIndex === -1) break;

    // Extract packet length
    const lengthStr = data.substring(i, colonIndex);
    const length = parseInt(lengthStr, 10);

    // Extract packet data
    const packetStart = colonIndex + 1;
    const packetEnd = packetStart + length;
    const packetData = data.substring(packetStart, packetEnd);

    // First character is the packet type
    const packetType = packetData.charAt(0);
    const packetContent = packetData.substring(1);

    packets.push({
      type: packetType,
      data: packetContent,
      raw: packetData
    });

    // Move to the next packet
    i = packetEnd;
  }

  return packets;
}

// Send real-time updates to a session based on actual segmentation status
function sendSegmentationUpdates(sid) {
  if (!socketSessions.has(sid)) return;

  const session = socketSessions.get(sid);

  console.log(`Session ${sid} subscribed to segmentation updates`);

  // Regular info message to inform clients about the connection
  const infoEvent = JSON.stringify(['info', {
    message: 'Connected to segmentation service',
    timestamp: new Date().toISOString()
  }]);
  const infoPacket = `2${infoEvent}`;
  const infoMessage = `${infoPacket.length}:${infoPacket}`;

  // Add the message to the session
  session.messages.push(infoMessage);

  // Get actual queue status from the segmentation service
  const fetchQueueStatus = async () => {
    try {
      // Implement actual queue status fetching logic here
      // For example, query the database or an external service

      // Example: query the database for pending segmentation tasks
      const fs = require('fs');
      const path = require('path');

      // Try to read queue status data if it exists
      let pendingTasks = [];
      let runningTasks = [];

      try {
        const queueStatusPath = path.join(__dirname, 'data', 'segmentation-queue.json');
        if (fs.existsSync(queueStatusPath)) {
          const queueData = JSON.parse(fs.readFileSync(queueStatusPath, 'utf8'));
          pendingTasks = queueData.pendingTasks || [];
          runningTasks = queueData.runningTasks || [];
        }
      } catch (fsError) {
        console.error('Error reading queue status:', fsError);
        // Log the error but continue with empty arrays
      }

      // Return actual queue status
      return {
        pendingTasks,
        runningTasks,
        queueLength: pendingTasks.length,
        activeTasksCount: runningTasks.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching segmentation queue status:', error);
      // Log error details for debugging
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };

      // Send error to client
      const errorEvent = JSON.stringify(['error', {
        source: 'segmentation_service',
        message: 'Failed to fetch segmentation queue status',
        error: errorInfo,
        timestamp: new Date().toISOString()
      }]);
      const errorPacket = `2${errorEvent}`;
      const errorMessage = `${errorPacket.length}:${errorPacket}`;

      // Add error message to session
      if (socketSessions.has(sid)) {
        socketSessions.get(sid).messages.push(errorMessage);
      }

      // Return empty status on error
      return {
        pendingTasks: [],
        runningTasks: [],
        queueLength: 0,
        activeTasksCount: 0,
        timestamp: new Date().toISOString(),
        error: 'Failed to fetch queue status'
      };
    }
  };

  // Send initial queue status
  fetchQueueStatus().then(queueStatus => {
    // Create a Socket.IO event packet for queue status
    const queueEventData = JSON.stringify(['segmentation_queue_update', queueStatus]);
    const queuePacket = `2${queueEventData}`;
    const queueMessage = `${queuePacket.length}:${queuePacket}`;

    // Add the message to the session
    if (socketSessions.has(sid)) {
      socketSessions.get(sid).messages.push(queueMessage);
    }
  });

  // Set up a periodic update interval
  const updateInterval = setInterval(async () => {
    if (!socketSessions.has(sid)) {
      clearInterval(updateInterval);
      return;
    }

    // Fetch current queue status
    const queueStatus = await fetchQueueStatus();

    // Create a Socket.IO event packet for queue status
    const queueEventData = JSON.stringify(['segmentation_queue_update', queueStatus]);
    const queuePacket = `2${queueEventData}`;
    const queueMessage = `${queuePacket.length}:${queuePacket}`;

    // Add the message to the session
    if (socketSessions.has(sid)) {
      socketSessions.get(sid).messages.push(queueMessage);
    }
  }, 10000); // Every 10 seconds

  // Clean up interval when session is removed
  session.cleanup = () => {
    clearInterval(updateInterval);
  };
}

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  // Extract path from URL
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/socket.io/')) {
    // Handle Socket.IO WebSocket upgrade
    console.log('Socket.IO WebSocket upgrade request received');

    // Create a simple WebSocket handshake response
    // Note: This is a simplistic implementation that will allow the frontend to
    // think it's connected via WebSocket, but we'll still be using HTTP polling

    // Extract session ID from URL
    const sidMatch = pathname.match(/\/socket\.io\/([^/]+)\//);
    const sid = sidMatch ? sidMatch[1] : null;

    if (sid && socketSessions.has(sid)) {
      // Valid session, accept the upgrade
      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Accept: ' + createSocketAccept(request.headers['sec-websocket-key'] || '')
      ];

      socket.write(headers.join('\r\n') + '\r\n\r\n');

      // Update session
      const session = socketSessions.get(sid);
      session.lastActivity = Date.now();
      session.isWebSocket = true;

      console.log(`WebSocket upgrade accepted for session ${sid}`);

      // Set up event listeners for socket
      socket.on('close', () => {
        console.log(`WebSocket closed for session ${sid}`);
        socketSessions.delete(sid);
      });

      // Keep the socket alive
      const keepAlive = setInterval(() => {
        if (socket.writable) {
          try {
            // Send a ping frame
            const pingFrame = Buffer.from([0x89, 0x00]);
            socket.write(pingFrame);
          } catch (err) {
            clearInterval(keepAlive);
          }
        } else {
          clearInterval(keepAlive);
        }
      }, 30000);

      return;
    }
  }

  // For any other path or invalid sessions, close the connection
  console.log('WebSocket upgrade request for non-Socket.IO or invalid session');
  socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
  socket.destroy();
});

// Helper function to create a valid Sec-WebSocket-Accept value
function createSocketAccept(key) {
  const crypto = require('crypto');
  const magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  return crypto.createHash('sha1')
    .update(key + magic)
    .digest('base64');
}

// Start server
const PORT = process.env.PORT || 3000;
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