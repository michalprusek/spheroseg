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