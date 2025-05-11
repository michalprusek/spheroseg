/**
 * Socket.IO Authentication Middleware
 * This middleware validates JWT tokens for Socket.IO connections
 * and populates socket.data.user with user information.
 */
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';

// JWT secret key from configuration
const JWT_SECRET = config.auth.jwtSecret;

// JWT payload interface
interface JwtPayload {
  userId: string;
  email: string;
  // Add any other fields that are included in your JWT
}

/**
 * Middleware function to authenticate Socket.IO connections
 * Validates JWT token and adds user data to socket.data
 */
export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    // Get token from either auth object, headers, or query params for flexibility
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
      (socket.handshake.query?.token as string);

    // Always log connection attempt in development
    if (config.isDevelopment) {
      logger.debug('Socket connection attempt', {
        socketId: socket.id,
        hasToken: !!token,
        transportType: socket.conn.transport.name,
        address: socket.handshake.address,
      });
    }

    // In development mode, allow connections without a token or with an invalid token
    if (config.isDevelopment && process.env.USE_MOCK_USER === 'true') {
      if (!token) {
        logger.info('Development mode: Using automatic authentication for WebSocket');
        socket.data.user = {
          userId: '5af06e91-7821-4242-9c15-a23fb1e15f57',
          email: 'dev@example.com',
        };

        // Join user to their room based on userId
        socket.join(socket.data.user.userId);
        logger.debug(`Development socket joined room: ${socket.data.user.userId}`);

        next();
        return;
      }

      // Try to verify the token, but use mock user if it fails in development
      try {
        // Verify the JWT token
        const decoded = jwt.verify(token, String(JWT_SECRET)) as JwtPayload;

        // Attach user data to the socket
        socket.data.user = {
          userId: decoded.userId,
          email: decoded.email,
        };
      } catch (verifyError) {
        logger.warn('Token verification failed in development mode, using automatic authentication', {
          error: verifyError instanceof Error ? verifyError.message : String(verifyError),
        });

        socket.data.user = {
          userId: '5af06e91-7821-4242-9c15-a23fb1e15f57',
          email: 'dev@example.com',
        };
      }

      // Join user to their room based on userId
      socket.join(socket.data.user.userId);
      logger.debug(`Socket joined room: ${socket.data.user.userId}`);

      next();
      return;
    }

    // Production mode requires valid token
    if (!token) {
      logger.warn('Socket connection attempt without token', {
        socketId: socket.id,
      });
      return next(new Error('Authentication token required'));
    }

    // Ensure JWT_SECRET is defined
    if (!JWT_SECRET) {
      logger.error('JWT_SECRET is undefined in socketAuthMiddleware');
      return next(new Error('Server configuration error'));
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, String(JWT_SECRET)) as JwtPayload;

    // Attach user data to the socket
    socket.data.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    logger.debug(`Socket authenticated: ${socket.data.user.userId}`, {
      socketId: socket.id,
      userId: socket.data.user.userId,
    });

    // Join user to their room based on userId for targeted messages
    socket.join(socket.data.user.userId);
    logger.debug(`Socket joined room: ${socket.data.user.userId}`);

    next();
  } catch (error) {
    logger.warn('Socket authentication failed', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(new Error('Authentication failed'));
  }
};

export default socketAuthMiddleware;
