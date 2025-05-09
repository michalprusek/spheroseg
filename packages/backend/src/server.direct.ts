import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

// Create Express app
const app = express();
const server = http.createServer(app);

// Setup Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://frontend:3000', '*'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configure middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://frontend:3000', '*'],
  credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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

// Default handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
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

export { app, server, io };