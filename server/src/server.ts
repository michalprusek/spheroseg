import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import http from 'http'; // Import http module
import { Server as SocketIOServer, Socket } from 'socket.io'; // Import Socket.IO
import jwt from 'jsonwebtoken'; // Import jwt for token verification
import authRoutes from './routes/auth'; // Import authentication routes
import userRoutes from './routes/users'; // Import user routes
import projectRoutes from './routes/projects'; // Import project routes
import imageRoutes from './routes/images'; // Import image routes
import segmentationRoutes from './routes/segmentation'; // Import segmentation routes
import accessRequestRoutes from './routes/accessRequests'; // Import access request routes
import statusRoutes from './routes/status'; // Import status routes
import path from 'path';
import { errorHandler } from './middleware/errorHandler'; // Import the error handler
import { requestLogger } from './middleware/requestLogger'; // Import the request logger

dotenv.config(); // Load environment variables from .env file

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

// --- Socket.IO Setup ---
// Initialize Socket.IO without explicit CORS config; let Express handle it.
const io = new SocketIOServer(server);

// Socket.IO Authentication Middleware (simple example)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined for Socket.IO.");
    process.exit(1);
}

io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token; // Assuming token is passed in auth object during connection
    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        if (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
        // Attach user info to the socket for later use
        socket.data.user = { userId: decoded.userId, email: decoded.email };
        next();
    });
});

// Handle new connections
io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}, UserID: ${socket.data.user?.userId}`);

    // Join a room based on user ID
    if (socket.data.user?.userId) {
        socket.join(socket.data.user.userId);
        console.log(`Socket ${socket.id} joined room ${socket.data.user.userId}`);
    }

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });

    // Handle other custom events if needed
    // socket.on('my_event', (data) => { ... });
});

// Export io instance so services can use it (or pass it down)
// NOTE: Directly exporting might not be ideal for complex apps, consider dependency injection
export { io };
// --- End Socket.IO Setup ---

const port = process.env.PORT || 5006; // Use environment variable or default to 5006

// --- Request Logger ---
// Should be one of the first middleware
app.use(requestLogger);

// --- CORS Configuration ---
// const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];
// console.log('Allowed CORS origins:', allowedOrigins.length > 0 ? allowedOrigins : '*');
//
// const corsOptions: CorsOptions = {
//     origin: (origin, callback) => {
//         // Allow requests with no origin (like mobile apps or curl requests)
//         // Allow all origins in development mode if CORS_ALLOWED_ORIGINS is not set
//         // Otherwise, check if the origin is in the allowed list
//         if (!origin ||
//             (process.env.NODE_ENV === 'development' && allowedOrigins.length === 0) ||
//             (allowedOrigins.length > 0 && allowedOrigins.indexOf(origin) !== -1))
//         {
//             callback(null, true);
//         } else {
//             console.warn(`CORS blocked origin: ${origin}`);
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     credentials: true, // Allow cookies/authorization headers
//     optionsSuccessStatus: 200 // For legacy browser support
// };
//
// app.use(cors(corsOptions)); // Use configured CORS options
app.use(cors()); // Temporarily allow all origins for debugging
// --- End CORS Configuration ---

app.use(express.json({ limit: '50mb' })); // Middleware to parse JSON bodies with increased limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Middleware to parse URL-encoded bodies with increased limit

// Serve uploaded files statically (adjust path as needed)
// This allows the frontend to access uploaded images via URL
const uploadsPath = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
console.log(`Serving static files from: ${uploadsPath}`);
app.use('/uploads', express.static(uploadsPath));
app.use('/api/uploads', express.static(uploadsPath)); // Also serve under /api/uploads for API routes

// Basic route to check if the server is running
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
});

// --- API Routes --- 
// Order matters here, more specific routes should come first if paths overlap
app.use('/api', statusRoutes); // Register status routes FIRST
app.use('/api/auth', authRoutes); // Mount authentication routes under /api/auth
app.use('/api/users', userRoutes); // Mount user routes under /api/users
app.use('/api/projects', projectRoutes); // Mount project routes under /api/projects
app.use('/api', imageRoutes);
app.use('/api', segmentationRoutes);
// Mount access request routes
app.use('/api/access-requests', accessRequestRoutes);

// --- Error Handling Middleware ---
// This MUST be the last middleware added
app.use(errorHandler);

// Start the HTTP server instead of the Express app directly
server.listen(port, () => {
  console.log(`Server with Socket.IO listening on port ${port}`);
});

// Export the Express app for testing purposes
export { app };