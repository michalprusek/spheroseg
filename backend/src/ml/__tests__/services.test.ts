import { initiateSegmentationJob, handleWorkerCallback, getSegmentationStatus, getSegmentationResult } from '../services/ml.service';
import * as storageService from '../../storage/storageService';
import { segmentationQueue } from '../queue';

jest.mock('../../storage/storageService');
jest.mock('../queue');

Object.defineProperty(segmentationQueue, 'add', {
  value: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  writable: true,
});

Object.defineProperty(storageService, 'getSignedUrl', {
  value: jest.fn(),
  writable: true,
});
const mockDb = { query: jest.fn() };

describe('ML Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateSegmentationJob', () => {
    it('should enqueue a segmentation job and return jobId and signed URL', async () => {
      // @ts-expect-error mock
      segmentationQueue.add.mockResolvedValue({ id: 'job-123' });
      // @ts-expect-error mock
      storageService.getSignedUrl.mockResolvedValue('https://signed.url/image.png');
      mockDb.query.mockResolvedValue([{ id: 'job-123' }]);

      const result = await initiateSegmentationJob(mockDb, 'project-1', 'image-1', { threshold: 0.5 });

      expect(segmentationQueue.add).toHaveBeenCalled();
      expect(storageService.getSignedUrl).toHaveBeenCalled();
      expect(result).toHaveProperty('jobId', 'job-123');
      expect(result).toHaveProperty('signedUrl', 'https://signed.url/image.png');
    });

    it('should throw error if queue enqueue fails', async () => {
      // @ts-expect-error mock
      segmentationQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(
        initiateSegmentationJob(mockDb, 'project-1', 'image-1', { threshold: 0.5 })
      ).rejects.toThrow('Queue error');
    });

   it('should handle Redis connection errors gracefully', async () => {
     // Simulate Redis connection error
     // @ts-expect-error mock
     segmentationQueue.add.mockRejectedValue(new Error('Redis connection failed'));

     await expect(
       initiateSegmentationJob(mockDb, 'project-1', 'image-1', { threshold: 0.5 })
     ).rejects.toThrow('Redis connection failed');
   });
  });

  describe('handleWorkerCallback', () => {
    it('should update DB on successful segmentation', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await handleWorkerCallback(mockDb, 'job-123', true, { maskUrl: 'mask.png' });

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should update DB on failed segmentation', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await handleWorkerCallback(mockDb, 'job-123', false, { error: 'Failed' });

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getSegmentationStatus', () => {
    it('should return status if job exists', async () => {
      mockDb.query.mockResolvedValue([{ status: 'processing' }]);

      const status = await getSegmentationStatus(mockDb, 'job-123');

      expect(status).toBe('processing');
    });

    it('should throw if job not found', async () => {
      mockDb.query.mockResolvedValue([]);

      await expect(getSegmentationStatus(mockDb, 'job-123')).rejects.toThrow('Job not found');
    });
  });

  describe('getSegmentationResult', () => {
    it('should return result if job completed', async () => {
      mockDb.query.mockResolvedValue([{ result_url: 'result.png' }]);

      const result = await getSegmentationResult(mockDb, 'job-123');

      expect(result).toEqual({ resultUrl: 'result.png' });
    });

    it('should throw if result not ready', async () => {
      mockDb.query.mockResolvedValue([{ result_url: null }]);

      await expect(getSegmentationResult(mockDb, 'job-123')).rejects.toThrow('Result not ready');
    });

    it('should throw if job not found', async () => {
      mockDb.query.mockResolvedValue([]);

      await expect(getSegmentationResult(mockDb, 'job-123')).rejects.toThrow('Job not found');
    });
  });

  // Additional edge case and failure tests
  describe('ML Service edge cases and failures', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('initiateSegmentationJob', () => {
      it('should throw if getSignedUrl fails', async () => {
        require('../../storage/storageService').getSignedUrl.mockRejectedValue(new Error('Signed URL error'));

        await expect(
          initiateSegmentationJob({ query: jest.fn() }, 'p', 'f', { a: 1 })
        ).rejects.toThrow('Signed URL error');
      });

      it('should throw if DB insert fails', async () => {
        require('../../storage/storageService').getSignedUrl.mockResolvedValue('url');
        const db = { query: jest.fn().mockRejectedValue(new Error('DB error')) };

        await expect(
          initiateSegmentationJob(db, 'p', 'f', { a: 1 })
        ).rejects.toThrow('DB error');
      });

      it('should handle missing env vars gracefully', async () => {
        process.env.ML_CALLBACK_URL = '';
        process.env.ML_CALLBACK_TOKEN = '';
        require('../../storage/storageService').getSignedUrl.mockResolvedValue('url');
        const db = { query: jest.fn().mockResolvedValue([{ id: 'job-xyz' }]) };
        const queue = require('../queue');
        queue.addSegmentationJob = jest.fn().mockResolvedValue(undefined);

        const result = await initiateSegmentationJob(db, 'p', 'f', { a: 1 });
        expect(result).toHaveProperty('jobId', 'job-xyz');
      });

      it('should throw generic error if queue throws non-Error', async () => {
        require('../../storage/storageService').getSignedUrl.mockResolvedValue('url');
        const db = { query: jest.fn().mockResolvedValue([{ id: 'job-xyz' }]) };
        const queue = require('../queue');
        queue.addSegmentationJob = jest.fn().mockRejectedValue('some string error');

        await expect(
          initiateSegmentationJob(db, 'p', 'f', { a: 1 })
        ).rejects.toThrow('Failed to enqueue segmentation job');
      });
    it('should include callback URL and token when env vars are set', async () => {
      process.env.ML_CALLBACK_URL = 'http://ml-service';
      process.env.ML_CALLBACK_TOKEN = 'sometoken';

      const mockGetSignedUrl = require('../../storage/storageService').getSignedUrl;
      mockGetSignedUrl.mockResolvedValue('signed-url');

      const db = { query: jest.fn().mockResolvedValue([{ id: 'job-cb' }]) };

      const queue = require('../queue');
      const addSegmentationJobMock = jest.fn().mockResolvedValue(undefined);
      queue.addSegmentationJob = addSegmentationJobMock;

      const result = await initiateSegmentationJob(db, 'proj', 'file', { param1: 'x' });

      expect(result).toHaveProperty('jobId', 'job-cb');
      expect(result).toHaveProperty('signedUrl', 'signed-url');

      expect(addSegmentationJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          callbackUrl: expect.stringContaining('/api/ml/jobs/job-cb/callback'),
          callbackToken: 'sometoken',
          jobId: 'job-cb',
          fileId: 'file',
          signedUrl: 'signed-url',
          params: { param1: 'x' }
        })
      );
    });
    });

    describe('handleWorkerCallback', () => {
      it('should throw if DB insert fails on success', async () => {
        const db = { query: jest.fn().mockRejectedValue(new Error('DB insert error')) };

        await expect(
          handleWorkerCallback(db, 'job-1', true, { maskUrl: 'mask.png' })
        ).rejects.toThrow('DB insert error');
      });

      it('should throw if DB update fails on failure', async () => {
        const db = { query: jest.fn().mockRejectedValue(new Error('DB update error')) };

        await expect(
          handleWorkerCallback(db, 'job-1', false, { error: 'fail' })
        ).rejects.toThrow('DB update error');
      });
    });

    describe('getSegmentationStatus', () => {
      it('should throw if DB query fails', async () => {
        const db = { query: jest.fn().mockRejectedValue(new Error('DB status error')) };

        await expect(getSegmentationStatus(db, 'job-1')).rejects.toThrow('DB status error');
      });
    });

    describe('getSegmentationResult', () => {
      it('should throw if DB query fails', async () => {
        const db = { query: jest.fn().mockRejectedValue(new Error('DB result error')) };

        await expect(getSegmentationResult(db, 'job-1')).rejects.toThrow('DB result error');
      });

      it('should handle different result formats', async () => {
        // Test with different result formats
        const db = { query: jest.fn().mockResolvedValue([{
          result_url: 'result.png',
          metadata: JSON.stringify({
            contours: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
            statistics: { area: 100, perimeter: 40 }
          })
        }]) };

        const result = await getSegmentationResult(db, 'job-123');

        expect(result).toEqual({
          resultUrl: 'result.png'
        });
      });

      it('should handle malformed metadata', async () => {
        // Test with malformed metadata
        const db = { query: jest.fn().mockResolvedValue([{
          result_url: 'result.png',
          metadata: 'not-valid-json'
        }]) };

        const result = await getSegmentationResult(db, 'job-123');

        expect(result).toEqual({
          resultUrl: 'result.png'
        });
      });
    });

    describe('handleWorkerCallback with complex payloads', () => {
      it('should handle complex success payloads', async () => {
        const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
        const complexPayload = {
          maskUrl: 'mask.png',
          contours: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
          statistics: { area: 100, perimeter: 40 },
          processingTime: 1.23,
          modelVersion: '1.0.0'
        };

        await handleWorkerCallback(db, 'job-123', true, complexPayload);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE segmentation_jobs'),
          expect.arrayContaining(['job-123', 'completed', 'mask.png', expect.any(String)])
        );
      });

      it('should handle complex error payloads', async () => {
        const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
        const complexErrorPayload = {
          error: 'Processing failed',
          errorCode: 'OUT_OF_MEMORY',
          errorDetails: { memoryRequested: '2GB', memoryAvailable: '1GB' },
          stackTrace: 'Error: Out of memory\n    at processImage (image.js:42)'
        };

        await handleWorkerCallback(db, 'job-123', false, complexErrorPayload);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE segmentation_jobs'),
          expect.arrayContaining(['job-123', 'failed', null, expect.any(String)])
        );
      });
    });
  });
});