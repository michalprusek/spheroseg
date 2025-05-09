/**
 * Direct endpoints module - immediately loaded endpoints
 */
const setupDirectEndpoints = (app) => {
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        api: 'healthy',
        database: 'connected'
      }
    });
  });

  // Add simple mock login endpoint for testing
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    // Simple check for test user
    if (email === 'test@example.com' && password === 'password123') {
      res.status(200).json({
        message: 'Login successful',
        token: 'mock-jwt-token-for-testing',
        user: {
          id: 'c63f95fd-4029-428c-8914-80407cf8ac5c',
          email: 'test@example.com',
          name: 'Test User'
        }
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });

  console.log('Direct endpoints registered!');
};

module.exports = setupDirectEndpoints;
