import { initiateSegmentationJob, handleWorkerCallback, getSegmentationStatus, getSegmentationResult } from '../services/ml.service';
import * as storageService from '../../storage/storageService';
import { segmentationQueue } from '../queue';

jest.mock('../../storage/storageService');
jest.mock('../queue');

Object.defineProperty(segmentationQueue, 'add', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(storageService, 'getSignedUrl', {
  value: jest.fn(),
  writable: true,
});
const mockDb = { query: jest.fn() };

describe('ML Service Additional Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateSegmentationJob', () => {
    it('should handle empty parameters', async () => {
      // @ts-expect-error mock
      segmentationQueue.add.mockResolvedValue({ id: 'job-123' });
      // @ts-expect-error mock
      storageService.getSignedUrl.mockResolvedValue('https://signed.url/image.png');
      mockDb.query.mockResolvedValue([{ id: 'job-123' }]);

      const result = await initiateSegmentationJob(mockDb, 'project-1', 'image-1', {});

      expect(segmentationQueue.add).toHaveBeenCalled();
      expect(result).toHaveProperty('jobId', 'job-123');
    });
    
    it('should handle null parameters', async () => {
      // @ts-expect-error mock
      segmentationQueue.add.mockResolvedValue({ id: 'job-123' });
      // @ts-expect-error mock
      storageService.getSignedUrl.mockResolvedValue('https://signed.url/image.png');
      mockDb.query.mockResolvedValue([{ id: 'job-123' }]);

      // @ts-expect-error testing null params
      const result = await initiateSegmentationJob(mockDb, 'project-1', 'image-1', null);

      expect(segmentationQueue.add).toHaveBeenCalled();
      expect(result).toHaveProperty('jobId', 'job-123');
    });
    
    it('should handle undefined parameters', async () => {
      // @ts-expect-error mock
      segmentationQueue.add.mockResolvedValue({ id: 'job-123' });
      // @ts-expect-error mock
      storageService.getSignedUrl.mockResolvedValue('https://signed.url/image.png');
      mockDb.query.mockResolvedValue([{ id: 'job-123' }]);

      // @ts-expect-error testing undefined params
      const result = await initiateSegmentationJob(mockDb, 'project-1', 'image-1', undefined);

      expect(segmentationQueue.add).toHaveBeenCalled();
      expect(result).toHaveProperty('jobId', 'job-123');
    });
  });

  describe('handleWorkerCallback', () => {
    it('should handle empty payload', async () => {
      mockDb.query.mockResolvedValue([]);
      
      await handleWorkerCallback(mockDb, 'job-123', true, {});
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE segmentation_jobs'),
        expect.arrayContaining(['job-123', 'completed'])
      );
    });
    
    it('should handle null payload', async () => {
      mockDb.query.mockResolvedValue([]);
      
      // @ts-expect-error testing null payload
      await handleWorkerCallback(mockDb, 'job-123', true, null);
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE segmentation_jobs'),
        expect.arrayContaining(['job-123', 'completed'])
      );
    });
    
    it('should handle undefined payload', async () => {
      mockDb.query.mockResolvedValue([]);
      
      // @ts-expect-error testing undefined payload
      await handleWorkerCallback(mockDb, 'job-123', true, undefined);
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE segmentation_jobs'),
        expect.arrayContaining(['job-123', 'completed'])
      );
    });
  });

  describe('getSegmentationStatus', () => {
    it('should handle different status values', async () => {
      // Test with different status values
      mockDb.query.mockResolvedValue([{ status: 'processing' }]);
      let status = await getSegmentationStatus(mockDb, 'job-123');
      expect(status).toBe('processing');
      
      mockDb.query.mockResolvedValue([{ status: 'completed' }]);
      status = await getSegmentationStatus(mockDb, 'job-123');
      expect(status).toBe('completed');
      
      mockDb.query.mockResolvedValue([{ status: 'failed' }]);
      status = await getSegmentationStatus(mockDb, 'job-123');
      expect(status).toBe('failed');
      
      mockDb.query.mockResolvedValue([{ status: 'pending' }]);
      status = await getSegmentationStatus(mockDb, 'job-123');
      expect(status).toBe('pending');
    });
  });

  describe('getSegmentationResult', () => {
    it('should handle missing result_url', async () => {
      // Test with missing result_url
      const db = { query: jest.fn().mockResolvedValue([{ 
        metadata: JSON.stringify({
          contours: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
          statistics: { area: 100, perimeter: 40 }
        })
      }]) };

      const result = await getSegmentationResult(db, 'job-123');

      expect(result).toEqual({});
    });
    
    it('should handle empty result', async () => {
      // Test with empty result
      const db = { query: jest.fn().mockResolvedValue([{}]) };

      const result = await getSegmentationResult(db, 'job-123');

      expect(result).toEqual({});
    });
    
    it('should throw if job not found', async () => {
      // Test with no results
      const db = { query: jest.fn().mockResolvedValue([]) };

      await expect(getSegmentationResult(db, 'job-123')).rejects.toThrow('Job not found');
    });
  });
  
  describe('handleWorkerCallback with complex payloads', () => {
    it('should handle nested complex payloads', async () => {
      const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      const nestedPayload = {
        result: {
          maskUrl: 'mask.png',
          contours: {
            regions: [
              { points: [[0, 0], [10, 0], [10, 10], [0, 10]], label: 'cell' },
              { points: [[20, 20], [30, 20], [30, 30], [20, 30]], label: 'nucleus' }
            ]
          },
          statistics: {
            summary: { totalCells: 2, averageSize: 150 },
            details: [
              { id: 1, area: 100, perimeter: 40 },
              { id: 2, area: 200, perimeter: 60 }
            ]
          }
        }
      };
      
      await handleWorkerCallback(db, 'job-123', true, nestedPayload);
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE segmentation_jobs'),
        expect.arrayContaining(['job-123', 'completed', null, expect.any(String)])
      );
    });
  });
});
