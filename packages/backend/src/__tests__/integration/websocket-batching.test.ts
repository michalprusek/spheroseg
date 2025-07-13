/**
 * Integration tests for WebSocket Message Batching
 * 
 * Tests batching efficiency, client capability detection, and compression
 */
import { Server as SocketIOServer, Socket as ServerSocket } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createServer } from 'http';
import { 
  initializeEnhancedSocketIO,
  broadcastSegmentationUpdate,
  broadcastBulkUpdates,
  getEnhancedMetrics
} from '../../services/socketServiceEnhanced';
import { getWebSocketBatcher } from '../../services/websocketBatcher';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../utils/logger');

describe('WebSocket Batching Integration', () => {
  let httpServer: any;
  let io: SocketIOServer;
  let clientSocket: ClientSocket;
  let serverSocket: ServerSocket;
  const port = 3333;

  beforeAll((done) => {
    httpServer = createServer();
    io = initializeEnhancedSocketIO(httpServer);
    
    httpServer.listen(port, () => {
      done();
    });

    io.on('connection', (socket) => {
      serverSocket = socket;
    });
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  beforeEach((done) => {
    clientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Client Capability Detection', () => {
    it('should detect and acknowledge batching capabilities', (done) => {
      clientSocket.emit('client-capabilities', {
        batching: true,
        compression: true,
        maxBatchSize: 100,
      });

      clientSocket.on('capabilities-acknowledged', (ack) => {
        expect(ack).toMatchObject({
          batching: true,
          compression: true,
          batchConfig: {
            maxBatchSize: expect.any(Number),
            maxBatchDelay: expect.any(Number),
          },
        });
        done();
      });
    });

    it('should handle clients without batching support', (done) => {
      clientSocket.emit('client-capabilities', {
        batching: false,
        compression: false,
      });

      clientSocket.on('capabilities-acknowledged', (ack) => {
        expect(ack.batching).toBe(false);
        done();
      });
    });

    it('should add batching clients to special rooms', (done) => {
      clientSocket.emit('client-capabilities', {
        batching: true,
      });

      clientSocket.on('capabilities-acknowledged', () => {
        clientSocket.emit('join_project', { projectId: 'test-123' });
      });

      clientSocket.on('joined_project', (data) => {
        expect(data).toMatchObject({
          projectId: 'test-123',
          batching: true,
        });

        // Verify client is in batched room on server
        const rooms = Array.from(serverSocket.rooms);
        expect(rooms).toContain('project-test-123:batched');
        done();
      });
    });
  });

  describe('Message Batching', () => {
    it('should batch multiple messages sent quickly', (done) => {
      const receivedBatches: any[] = [];
      
      // Setup batching client
      clientSocket.emit('client-capabilities', { batching: true });

      clientSocket.on('batch-update', (batch) => {
        receivedBatches.push(batch);
      });

      // Send multiple updates quickly
      const projectId = 'batch-test';
      clientSocket.emit('join_project', { projectId });

      clientSocket.on('joined_project', () => {
        // Trigger multiple updates
        for (let i = 0; i < 10; i++) {
          broadcastSegmentationUpdate(
            projectId,
            `image-${i}`,
            'processing',
            undefined,
            undefined
          );
        }

        // Wait for batch to arrive
        setTimeout(() => {
          expect(receivedBatches.length).toBeGreaterThan(0);
          
          const batch = receivedBatches[0];
          expect(batch).toHaveProperty('messages');
          expect(batch).toHaveProperty('count');
          expect(batch.count).toBeGreaterThan(1);
          
          done();
        }, 200);
      });
    });

    it('should send high-priority messages immediately', (done) => {
      const regularMessages: any[] = [];
      const priorityMessages: any[] = [];

      clientSocket.emit('client-capabilities', { batching: true });
      clientSocket.emit('join_project', { projectId: 'priority-test' });

      clientSocket.on('segmentation_update', (data) => {
        if (data.status === 'completed' || data.status === 'failed') {
          priorityMessages.push(data);
        } else {
          regularMessages.push(data);
        }
      });

      clientSocket.on('joined_project', () => {
        // Send priority message
        broadcastSegmentationUpdate(
          'priority-test',
          'image-1',
          'completed',
          '/path/to/result'
        );

        // Verify it arrives immediately
        setTimeout(() => {
          expect(priorityMessages).toHaveLength(1);
          expect(priorityMessages[0].status).toBe('completed');
          done();
        }, 50); // Should arrive within 50ms
      });
    });

    it('should respect maximum batch size', (done) => {
      const batches: any[] = [];
      
      clientSocket.emit('client-capabilities', { batching: true });
      clientSocket.on('batch-update', (batch) => {
        batches.push(batch);
      });

      clientSocket.emit('join_project', { projectId: 'size-test' });

      clientSocket.on('joined_project', () => {
        // Send more messages than max batch size
        for (let i = 0; i < 150; i++) {
          broadcastSegmentationUpdate(
            'size-test',
            `image-${i}`,
            'queued'
          );
        }

        // Wait for batches
        setTimeout(() => {
          expect(batches.length).toBeGreaterThan(1);
          
          // Each batch should respect max size
          batches.forEach(batch => {
            expect(batch.count).toBeLessThanOrEqual(50); // Default max batch size
          });
          
          done();
        }, 500);
      });
    });
  });

  describe('Compression', () => {
    it('should compress large batches', (done) => {
      clientSocket.emit('client-capabilities', { 
        batching: true,
        compression: true 
      });

      clientSocket.on('batch-update', (batch) => {
        if (batch.compressed) {
          expect(batch).toHaveProperty('data');
          expect(batch).toHaveProperty('originalSize');
          expect(batch.originalSize).toBeGreaterThan(1024); // Compression threshold
          done();
        }
      });

      clientSocket.emit('join_project', { projectId: 'compress-test' });

      clientSocket.on('joined_project', () => {
        // Send large messages to trigger compression
        const largeData = 'x'.repeat(500); // Large payload
        
        for (let i = 0; i < 10; i++) {
          broadcastSegmentationUpdate(
            'compress-test',
            `image-${i}`,
            'processing',
            largeData
          );
        }
      });
    });

    it('should track compression savings', async () => {
      const batcher = getWebSocketBatcher();
      const initialMetrics = batcher?.getMetrics();
      
      clientSocket.emit('client-capabilities', { 
        batching: true,
        compression: true 
      });

      clientSocket.emit('join_project', { projectId: 'savings-test' });

      // Send compressible data
      const repetitiveData = 'test'.repeat(1000);
      
      for (let i = 0; i < 5; i++) {
        broadcastSegmentationUpdate(
          'savings-test',
          `image-${i}`,
          'processing',
          repetitiveData
        );
      }

      // Wait and check metrics
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const finalMetrics = batcher?.getMetrics();
      
      if (finalMetrics && initialMetrics) {
        expect(finalMetrics.compressionSavings).toBeGreaterThan(
          initialMetrics.compressionSavings || 0
        );
      }
    });
  });

  describe('Bulk Updates', () => {
    it('should efficiently handle bulk updates', (done) => {
      const receivedUpdates = new Map<string, any[]>();

      clientSocket.emit('client-capabilities', { batching: true });
      
      clientSocket.on('bulk_updates', (data) => {
        if (!receivedUpdates.has(data.projectId)) {
          receivedUpdates.set(data.projectId, []);
        }
        receivedUpdates.get(data.projectId)!.push(...data.updates);
      });

      // Join multiple projects
      const projects = ['proj-1', 'proj-2', 'proj-3'];
      let joinedCount = 0;

      projects.forEach(projectId => {
        clientSocket.emit('join_project', { projectId });
      });

      clientSocket.on('joined_project', () => {
        joinedCount++;
        
        if (joinedCount === projects.length) {
          // Send bulk updates
          const updates = projects.flatMap(projectId => 
            Array.from({ length: 5 }, (_, i) => ({
              projectId,
              imageId: `image-${i}`,
              status: 'completed',
              resultPath: `/results/${projectId}/${i}`,
            }))
          );

          broadcastBulkUpdates(updates);

          // Verify grouped delivery
          setTimeout(() => {
            expect(receivedUpdates.size).toBe(projects.length);
            
            projects.forEach(projectId => {
              const projectUpdates = receivedUpdates.get(projectId);
              expect(projectUpdates).toHaveLength(5);
            });
            
            done();
          }, 200);
        }
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should track batching efficiency', async () => {
      const metrics = getEnhancedMetrics();
      
      expect(metrics).toHaveProperty('totalClients');
      expect(metrics).toHaveProperty('batchedClients');
      expect(metrics).toHaveProperty('nonBatchedClients');
      expect(metrics).toHaveProperty('batcherMetrics');
      
      if (metrics.batcherMetrics) {
        expect(metrics.batcherMetrics).toHaveProperty('efficiency');
        expect(metrics.batcherMetrics).toHaveProperty('avgMessagesPerBatch');
      }
    });

    it('should calculate message reduction percentage', async () => {
      const batcher = getWebSocketBatcher();
      
      // Send many messages
      for (let i = 0; i < 100; i++) {
        broadcastSegmentationUpdate(
          'metrics-test',
          `image-${i}`,
          'processing'
        );
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      
      const metrics = batcher?.getMetrics();
      
      if (metrics && metrics.totalMessages > 0 && metrics.batchesSent > 0) {
        const reduction = ((metrics.totalMessages - metrics.batchesSent) / metrics.totalMessages) * 100;
        expect(reduction).toBeGreaterThan(50); // Should achieve >50% reduction
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should send unbatched messages to non-batching clients', (done) => {
      const messages: any[] = [];

      // Don't send batching capability
      clientSocket.emit('join_project', { projectId: 'compat-test' });

      clientSocket.on('segmentation_update', (data) => {
        messages.push(data);
      });

      clientSocket.on('joined_project', () => {
        // Send multiple updates
        for (let i = 0; i < 5; i++) {
          broadcastSegmentationUpdate(
            'compat-test',
            `image-${i}`,
            'processing'
          );
        }

        // Should receive individual messages, not batches
        setTimeout(() => {
          expect(messages).toHaveLength(5);
          messages.forEach(msg => {
            expect(msg).toHaveProperty('imageId');
            expect(msg).toHaveProperty('status');
          });
          done();
        }, 200);
      });
    });

    it('should send legacy format for backward compatibility', (done) => {
      const legacyMessages: any[] = [];

      clientSocket.on('segmentation_update_legacy', (data) => {
        legacyMessages.push(data);
      });

      clientSocket.emit('join_project', { projectId: 'legacy-test' });

      clientSocket.on('joined_project', () => {
        broadcastSegmentationUpdate(
          'legacy-test',
          'image-1',
          'queued'
        );

        setTimeout(() => {
          expect(legacyMessages).toHaveLength(1);
          expect(legacyMessages[0].status).toBe('pending'); // Mapped to old status
          expect(legacyMessages[0].newStatus).toBe('queued'); // New status preserved
          done();
        }, 100);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle batch acknowledgment timeout', (done) => {
      let ackTimeout: NodeJS.Timeout;

      clientSocket.emit('client-capabilities', { batching: true });
      
      clientSocket.on('batch-update', (batch) => {
        // Don't send acknowledgment to simulate timeout
        ackTimeout = setTimeout(() => {
          // Server should handle missing ack gracefully
          expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('acknowledgment')
          );
          done();
        }, 1000);
      });

      clientSocket.emit('join_project', { projectId: 'ack-test' });

      clientSocket.on('joined_project', () => {
        broadcastSegmentationUpdate('ack-test', 'image-1', 'processing');
      });

      // Cleanup
      return () => clearTimeout(ackTimeout);
    });

    it('should handle malformed batch data gracefully', (done) => {
      clientSocket.emit('client-capabilities', { batching: true });

      // Send malformed batch acknowledgment
      clientSocket.emit('batch-ack', { invalid: 'data' });
      clientSocket.emit('batch-ack', null);
      clientSocket.emit('batch-ack', 'string-instead-of-object');

      // Should not crash the server
      setTimeout(() => {
        expect(serverSocket.connected).toBe(true);
        done();
      }, 100);
    });
  });
});