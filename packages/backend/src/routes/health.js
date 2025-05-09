
// Direct route handlers
const express = require('express');
const mockRouter = express.Router();

// Health check route
mockRouter.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      api: 'healthy',
      database: 'connected'
    }
  });
});

module.exports = mockRouter;
