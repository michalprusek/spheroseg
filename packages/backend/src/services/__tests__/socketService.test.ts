/**
 * Socket Service Test Suite
 * 
 * Comprehensive tests for WebSocket real-time communication service including
 * connection management, room operations, event broadcasting, and throttling.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import socketService from '../socketService';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../socket');
jest.mock('../../utils/socketThrottle');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock socket initialization
const mockSocket = {
  id: 'socket-test-123',
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  to: jest.fn().mockReturnThis(),
  rooms: new Set<string>(),
} as unknown as Socket;

const mockSocketIOServer = {
  on: jest.fn(),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  close: jest.fn(),
  engine: {
    clientsCount: 0,
  },
} as unknown as SocketIOServer;

const mockInitSocket = jest.fn().mockReturnValue(mockSocketIOServer);

jest.mock('../../socket', () => ({
  initializeSocketIO: mockInitSocket,
}));

// Mock socket throttler
const mockCreateThrottledEmit = jest.fn();
const mockThrottledEmit = jest.fn();

jest.mock('../../utils/socketThrottle', () => ({
  createThrottledEmit: mockCreateThrottledEmit,
}));

describe('Socket Service', () => {
  let mockHttpServer: HttpServer;
  let connectionHandler: (socket: Socket) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks
    mockCreateThrottledEmit.mockReturnValue(mockThrottledEmit);
    
    // Create mock HTTP server
    mockHttpServer = {
      listen: jest.fn(),
      close: jest.fn(),
    } as unknown as HttpServer;

    // Capture the connection handler when it's registered
    mockSocketIOServer.on.mockImplementation((event: string, handler: any) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    });

    // Mock socket event handlers
    const eventHandlers = new Map<string, Function>();
    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      eventHandlers.set(event, handler);
      return mockSocket;
    });

    // Helper to trigger socket events
    (mockSocket as any).triggerEvent = (event: string, data?: any) => {
      const handler = eventHandlers.get(event);
      if (handler) {
        handler(data);
      }
    };
  });

  describe('initializeSocketIO', () => {
    it('should initialize Socket.IO server successfully', () => {
      const result = socketService.initializeSocketIO(mockHttpServer);

      expect(mockInitSocket).toHaveBeenCalledWith(mockHttpServer);
      expect(result).toBe(mockSocketIOServer);
      expect(mockSocketIOServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('Socket.IO server initialized');
    });

    it('should throw error if initialization fails', () => {
      mockInitSocket.mockReturnValueOnce(null);

      expect(() => {
        socketService.initializeSocketIO(mockHttpServer);
      }).toThrow('Failed to initialize Socket.IO server');
    });

    it('should register connection event handler', () => {
      socketService.initializeSocketIO(mockHttpServer);

      expect(mockSocketIOServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('getSocketIO', () => {
    it('should return null when not initialized', () => {
      const result = socketService.getSocketIO();
      expect(result).toBeNull();
    });

    it('should return server instance when initialized', () => {
      socketService.initializeSocketIO(mockHttpServer);
      const result = socketService.getSocketIO();
      expect(result).toBe(mockSocketIOServer);
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      socketService.initializeSocketIO(mockHttpServer);
    });

    it('should log new client connections', () => {
      connectionHandler(mockSocket);

      expect(mockLogger.info).toHaveBeenCalledWith('New client connected', {
        clientId: 'socket-test-123',
      });
    });

    it('should register all required event handlers', () => {
      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('join_project', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('join-project', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('join', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave_project', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Room Management', () => {
    beforeEach(() => {
      socketService.initializeSocketIO(mockHttpServer);
      connectionHandler(mockSocket);
    });

    describe('join_project event', () => {
      it('should join project room with valid projectId', () => {
        const projectData = { projectId: 'project-123' };

        (mockSocket as any).triggerEvent('join_project', projectData);

        expect(mockSocket.join).toHaveBeenCalledWith('project-project-123');
        expect(mockSocket.join).toHaveBeenCalledWith('project:project-123');
        expect(mockSocket.emit).toHaveBeenCalledWith('joined_project', { projectId: 'project-123' });
        expect(mockLogger.info).toHaveBeenCalledWith('Client joined project room via join_project', {
          clientId: 'socket-test-123',
          projectId: 'project-123',
        });
      });

      it('should handle missing projectId in join_project', () => {
        const projectData = {};

        (mockSocket as any).triggerEvent('join_project', projectData);

        expect(mockSocket.join).not.toHaveBeenCalled();
        expect(mockSocket.emit).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith('Invalid join_project request: missing projectId', {
          clientId: 'socket-test-123',
        });
      });

      it('should handle join_project error gracefully', () => {
        mockSocket.join.mockImplementationOnce(() => {
          throw new Error('Join failed');
        });

        (mockSocket as any).triggerEvent('join_project', { projectId: 'project-123' });

        expect(mockLogger.error).toHaveBeenCalledWith('Error handling join_project event', {
          clientId: 'socket-test-123',
          error: expect.any(Error),
        });
      });
    });

    describe('join-project event (alternative format)', () => {
      it('should join project room with valid projectId', () => {
        const projectId = 'project-456';

        (mockSocket as any).triggerEvent('join-project', projectId);

        expect(mockSocket.join).toHaveBeenCalledWith('project-project-456');
        expect(mockSocket.join).toHaveBeenCalledWith('project:project-456');
        expect(mockSocket.emit).toHaveBeenCalledWith('joined_project', { projectId: 'project-456' });
        expect(mockLogger.info).toHaveBeenCalledWith('Client joined project room via join-project', {
          clientId: 'socket-test-123',
          projectId: 'project-456',
        });
      });

      it('should handle missing projectId in join-project', () => {
        (mockSocket as any).triggerEvent('join-project', null);

        expect(mockSocket.join).not.toHaveBeenCalled();
        expect(mockSocket.emit).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith('Invalid join-project request: missing projectId', {
          clientId: 'socket-test-123',
        });
      });

      it('should handle join-project error gracefully', () => {
        mockSocket.join.mockImplementationOnce(() => {
          throw new Error('Join failed');
        });

        (mockSocket as any).triggerEvent('join-project', 'project-456');

        expect(mockLogger.error).toHaveBeenCalledWith('Error handling join-project event', {
          clientId: 'socket-test-123',
          error: expect.any(Error),
        });
      });
    });

    describe('generic join event', () => {
      it('should join room with valid room name', () => {
        const roomName = 'user-notifications';

        (mockSocket as any).triggerEvent('join', roomName);

        expect(mockSocket.join).toHaveBeenCalledWith('user-notifications');
        expect(mockSocket.emit).toHaveBeenCalledWith('joined', { room: 'user-notifications' });
        expect(mockLogger.info).toHaveBeenCalledWith('Client joined room via generic join', {
          clientId: 'socket-test-123',
          room: 'user-notifications',
        });
      });

      it('should handle missing room name', () => {
        (mockSocket as any).triggerEvent('join', null);

        expect(mockSocket.join).not.toHaveBeenCalled();
        expect(mockSocket.emit).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith('Invalid join request: missing room', {
          clientId: 'socket-test-123',
        });
      });

      it('should handle join error gracefully', () => {
        mockSocket.join.mockImplementationOnce(() => {
          throw new Error('Join failed');
        });

        (mockSocket as any).triggerEvent('join', 'test-room');

        expect(mockLogger.error).toHaveBeenCalledWith('Error handling join event', {
          clientId: 'socket-test-123',
          error: expect.any(Error),
        });
      });
    });

    describe('leave_project event', () => {
      it('should leave project room with valid projectId', () => {
        const projectData = { projectId: 'project-789' };

        (mockSocket as any).triggerEvent('leave_project', projectData);

        expect(mockSocket.leave).toHaveBeenCalledWith('project-project-789');
        expect(mockLogger.info).toHaveBeenCalledWith('Client left project room', {
          clientId: 'socket-test-123',
          projectId: 'project-789',
        });
      });

      it('should handle missing projectId in leave_project', () => {
        const projectData = {};

        (mockSocket as any).triggerEvent('leave_project', projectData);

        expect(mockSocket.leave).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith('Invalid leave_project request: missing projectId', {
          clientId: 'socket-test-123',
        });
      });

      it('should handle leave_project error gracefully', () => {
        mockSocket.leave.mockImplementationOnce(() => {
          throw new Error('Leave failed');
        });

        (mockSocket as any).triggerEvent('leave_project', { projectId: 'project-789' });

        expect(mockLogger.error).toHaveBeenCalledWith('Error handling leave_project event', {
          clientId: 'socket-test-123',
          error: expect.any(Error),
        });
      });
    });
  });

  describe('Connection Events', () => {
    beforeEach(() => {
      socketService.initializeSocketIO(mockHttpServer);
      connectionHandler(mockSocket);
    });

    it('should handle disconnect event', () => {
      const reason = 'client namespace disconnect';

      (mockSocket as any).triggerEvent('disconnect', reason);

      expect(mockLogger.info).toHaveBeenCalledWith('Client disconnected', {
        clientId: 'socket-test-123',
        reason,
      });
    });

    it('should handle socket error event', () => {
      const error = new Error('Socket connection error');

      (mockSocket as any).triggerEvent('error', error);

      expect(mockLogger.error).toHaveBeenCalledWith('Socket error', {
        clientId: 'socket-test-123',
        error,
      });
    });
  });

  describe('broadcastSegmentationUpdate', () => {
    beforeEach(() => {
      socketService.initializeSocketIO(mockHttpServer);
      mockCreateThrottledEmit.mockReturnValue(mockThrottledEmit);
    });

    it('should broadcast segmentation update successfully', () => {
      const projectId = 'project-123';
      const imageId = 'image-456';
      const status = 'completed';
      const resultPath = '/path/to/result.jpg';

      socketService.broadcastSegmentationUpdate(projectId, imageId, status, resultPath);

      expect(mockSocketIOServer.to).toHaveBeenCalledWith('project-project-123');
      expect(mockSocketIOServer.emit).toHaveBeenCalledWith('segmentation_update', {
        imageId: 'image-456',
        status: 'completed',
        resultPath: '/path/to/result.jpg',
        error: undefined,
        timestamp: expect.any(String),
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Broadcasting segmentation update', {
        roomName: 'project-project-123',
        imageId: 'image-456',
        status: 'completed',
      });
    });

    it('should broadcast with backward compatibility', () => {
      const projectId = 'project-123';
      const imageId = 'image-456';
      const status = 'queued';

      socketService.broadcastSegmentationUpdate(projectId, imageId, status);

      expect(mockSocketIOServer.emit).toHaveBeenCalledWith('segmentation_update_legacy', {
        imageId: 'image-456',
        status: 'pending', // mapped from 'queued'
        newStatus: 'queued',
        resultPath: undefined,
        error: undefined,
        timestamp: expect.any(String),
      });
    });

    it('should use throttled emit for processing status', () => {
      const projectId = 'project-123';
      const imageId = 'image-456';
      const status = 'processing';

      socketService.broadcastSegmentationUpdate(projectId, imageId, status);

      expect(mockCreateThrottledEmit).toHaveBeenCalledWith(
        expect.any(Function),
        'project-project-123'
      );
      expect(mockThrottledEmit).toHaveBeenCalledWith('segmentation_update', expect.any(Object));
      expect(mockThrottledEmit).toHaveBeenCalledWith('segmentation_update_legacy', expect.any(Object));
    });

    it('should emit immediately for completed status', () => {
      const projectId = 'project-123';
      const imageId = 'image-456';
      const status = 'completed';

      socketService.broadcastSegmentationUpdate(projectId, imageId, status);

      expect(mockSocketIOServer.emit).toHaveBeenCalledWith('segmentation_update', expect.any(Object));
      expect(mockSocketIOServer.emit).toHaveBeenCalledWith('segmentation_update_legacy', expect.any(Object));
      expect(mockThrottledEmit).not.toHaveBeenCalled();
    });

    it('should emit immediately for failed status', () => {
      const projectId = 'project-123';
      const imageId = 'image-456';
      const status = 'failed';
      const error = 'Processing failed';

      socketService.broadcastSegmentationUpdate(projectId, imageId, status, undefined, error);

      expect(mockSocketIOServer.emit).toHaveBeenCalledWith('segmentation_update', {
        imageId: 'image-456',
        status: 'failed',
        resultPath: undefined,
        error: 'Processing failed',
        timestamp: expect.any(String),
      });
      expect(mockThrottledEmit).not.toHaveBeenCalled();
    });

    it('should handle without_segmentation status', () => {
      const projectId = 'project-123';
      const imageId = 'image-456';
      const status = 'without_segmentation';

      socketService.broadcastSegmentationUpdate(projectId, imageId, status);

      expect(mockSocketIOServer.emit).toHaveBeenCalledWith('segmentation_update_legacy', {
        imageId: 'image-456',
        status: 'pending', // mapped from 'without_segmentation'
        newStatus: 'without_segmentation',
        resultPath: undefined,
        error: undefined,
        timestamp: expect.any(String),
      });
    });

    it('should warn when Socket.IO not initialized', () => {
      // Don't initialize Socket.IO
      socketService.broadcastSegmentationUpdate('project-123', 'image-456', 'completed');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot broadcast segmentation update: Socket.IO not initialized'
      );
    });

    it('should handle broadcast errors gracefully', () => {
      mockSocketIOServer.to.mockImplementationOnce(() => {
        throw new Error('Broadcast failed');
      });

      socketService.broadcastSegmentationUpdate('project-123', 'image-456', 'completed');

      expect(mockLogger.error).toHaveBeenCalledWith('Error broadcasting segmentation update', {
        projectId: 'project-123',
        imageId: 'image-456',
        error: expect.any(Error),
      });
    });

    it('should cache throttled emit functions per room', () => {
      // First call to a room
      socketService.broadcastSegmentationUpdate('project-123', 'image-1', 'processing');
      expect(mockCreateThrottledEmit).toHaveBeenCalledTimes(1);

      // Second call to same room should use cached function
      socketService.broadcastSegmentationUpdate('project-123', 'image-2', 'processing');
      expect(mockCreateThrottledEmit).toHaveBeenCalledTimes(1); // Still 1, not 2

      // Call to different room should create new function
      socketService.broadcastSegmentationUpdate('project-456', 'image-3', 'processing');
      expect(mockCreateThrottledEmit).toHaveBeenCalledTimes(2); // Now 2
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      socketService.initializeSocketIO(mockHttpServer);
      connectionHandler(mockSocket);
    });

    it('should handle malformed event data gracefully', () => {
      // Test with circular reference data
      const circularData: any = { projectId: 'test' };
      circularData.self = circularData;

      expect(() => {
        (mockSocket as any).triggerEvent('join_project', circularData);
      }).not.toThrow();

      expect(mockSocket.join).toHaveBeenCalledWith('project-test');
    });

    it('should handle events with null/undefined data', () => {
      (mockSocket as any).triggerEvent('join_project', null);
      (mockSocket as any).triggerEvent('join_project', undefined);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('should handle numeric projectId in events', () => {
      (mockSocket as any).triggerEvent('join_project', { projectId: 123 });

      expect(mockSocket.join).toHaveBeenCalledWith('project-123');
      expect(mockSocket.join).toHaveBeenCalledWith('project:123');
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      socketService.initializeSocketIO(mockHttpServer);
      connectionHandler(mockSocket);
    });

    it('should handle rapid project joins and leaves', () => {
      // Join project
      (mockSocket as any).triggerEvent('join_project', { projectId: 'project-rapid' });
      expect(mockSocket.join).toHaveBeenCalledWith('project-project-rapid');

      // Leave project
      (mockSocket as any).triggerEvent('leave_project', { projectId: 'project-rapid' });
      expect(mockSocket.leave).toHaveBeenCalledWith('project-project-rapid');

      // Join again
      (mockSocket as any).triggerEvent('join_project', { projectId: 'project-rapid' });
      expect(mockSocket.join).toHaveBeenCalledTimes(3); // 2 joins for formats + 1 more
    });

    it('should handle multiple project joins', () => {
      (mockSocket as any).triggerEvent('join_project', { projectId: 'project-1' });
      (mockSocket as any).triggerEvent('join_project', { projectId: 'project-2' });
      (mockSocket as any).triggerEvent('join_project', { projectId: 'project-3' });

      expect(mockSocket.join).toHaveBeenCalledTimes(6); // 2 formats × 3 projects
      expect(mockSocket.emit).toHaveBeenCalledTimes(3); // 3 acknowledgments
    });

    it('should maintain separate throttled emit caches for different rooms', () => {
      socketService.broadcastSegmentationUpdate('project-1', 'image-1', 'processing');
      socketService.broadcastSegmentationUpdate('project-2', 'image-2', 'processing');
      socketService.broadcastSegmentationUpdate('project-1', 'image-3', 'processing');

      // Should create throttled emit for each unique room
      expect(mockCreateThrottledEmit).toHaveBeenCalledWith(
        expect.any(Function),
        'project-project-1'
      );
      expect(mockCreateThrottledEmit).toHaveBeenCalledWith(
        expect.any(Function),
        'project-project-2'
      );
      expect(mockCreateThrottledEmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(() => {
      socketService.initializeSocketIO(mockHttpServer);
    });

    it('should not create excessive throttled emit functions', () => {
      // Simulate many broadcasts to same room
      for (let i = 0; i < 100; i++) {
        socketService.broadcastSegmentationUpdate('project-load-test', `image-${i}`, 'processing');
      }

      // Should only create one throttled emit function per room
      expect(mockCreateThrottledEmit).toHaveBeenCalledTimes(1);
    });

    it('should handle Socket.IO server reinitialization', () => {
      const server1 = socketService.initializeSocketIO(mockHttpServer);
      const server2 = socketService.initializeSocketIO(mockHttpServer);

      expect(server1).toBe(mockSocketIOServer);
      expect(server2).toBe(mockSocketIOServer);
      expect(socketService.getSocketIO()).toBe(mockSocketIOServer);
    });
  });
});