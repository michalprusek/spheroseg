/**
 * Script to emit socket events to force frontend cache refresh
 */

import { io } from 'socket.io-client';
import logger from '../utils/logger';

async function emitRefreshEvents() {
  try {
    // Connect to socket server
    const socket = io('http://localhost:5001', {
      transports: ['polling', 'websocket'],
    });

    socket.on('connect', () => {
      logger.info('Connected to socket server');

      // Emit queue update event
      socket.emit('segmentation_queue_update', {
        queueLength: 0,
        runningTasks: [],
        queuedTasks: [],
        processingImages: [],
        timestamp: new Date().toISOString(),
        images: {
          processing_count: 0,
          pending_count: 0,
          completed_count: 32,
        },
      });

      logger.info('Emitted segmentation_queue_update event');

      // Emit individual image status updates for test2 project
      const test2Images = [
        'edb08bf2-bfdf-4c08-a1bf-7af8074f0448',
        '5738cd21-274d-4440-a0ac-54cc34b5eb1f',
        '2cd7ca7c-9a6a-46ad-a7ad-4b002040b9e1',
        '4fd74124-f4c1-4223-bbb5-15ecd941f027',
        '2909e900-30a0-4dd2-9fbf-7246ca8d1ae5',
        'baf55046-4558-48ab-ad6a-a19bc18b5239',
        '7fed0ea7-db8c-4583-b7c4-24371a8ca364',
        'de3e4f28-6355-4df8-b459-8992e8b14cf9',
        '4ba1db3a-02e3-468f-a7ca-9ca3d7907b4b',
        'ab2ceb62-112e-4b7d-a28e-1f8dfa23f5e6',
        'e3d5f59f-4833-4da2-be66-ed7ce6fe9883',
        '71c2961b-db03-4589-927a-e68025119247',
        'a03399d9-e1aa-48d9-8c6c-80e481939eb5',
      ];

      test2Images.forEach((imageId, index) => {
        setTimeout(() => {
          socket.emit('segmentation_update', {
            imageId,
            status: 'completed',
            timestamp: new Date().toISOString(),
          });
          logger.info(`Emitted segmentation_update for image ${imageId}`);
        }, index * 100); // Stagger the events
      });

      // Disconnect after all events are sent
      setTimeout(
        () => {
          socket.disconnect();
          logger.info('Disconnected from socket server');
          process.exit(0);
        },
        test2Images.length * 100 + 1000
      );
    });

    socket.on('error', (error) => {
      logger.error('Socket error:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Error emitting refresh events:', error);
    process.exit(1);
  }
}

// Command line execution
if (require.main === module) {
  logger.info('Starting refresh event emission');
  emitRefreshEvents();
}

export { emitRefreshEvents };
