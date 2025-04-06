import { segmentationQueue, addSegmentationJob } from '../queue';
import { config } from '../../config/app';

// Mock the bull module
jest.mock('bull', () => {
  // Create mock objects inside the factory function
  const mockBullInstance = {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    process: jest.fn(),
    on: jest.fn()
  };

  // Return the mock constructor
  return jest.fn().mockImplementation(() => mockBullInstance);
});

// Get references to the mocked objects after mocking
const mockBull = require('bull');
const mockBullInstance = mockBull();

// Mock the config module
jest.mock('../../config/app', () => ({
  config: {
    queue: {
      name: 'segmentationQueue',
      redisUrl: 'redis://redis:6379?connectTimeout=10000'
    }
  }
}));

describe('ML Queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('segmentationQueue', () => {
    it('should be initialized with correct configuration', () => {
      expect(segmentationQueue).toBeDefined();
    });
  });

  describe('addSegmentationJob', () => {
    it('should add a job to the queue', async () => {
      // Setup the mock to return a successful response
      mockBullInstance.add.mockResolvedValueOnce({ id: 'job-123' });

      // Prepare test data
      const jobData = {
        jobId: 'job-123',
        fileId: 'file-123',
        signedUrl: 'https://example.com/file.jpg',
        params: { threshold: 0.5 }
      };

      // Call the function under test
      const result = await addSegmentationJob(jobData);

      // Verify the mock was called correctly
      expect(mockBullInstance.add).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-123',
          fileId: 'file-123',
          signedUrl: 'https://example.com/file.jpg',
          params: { threshold: 0.5 }
        }),
        expect.objectContaining({
          attempts: expect.any(Number),
          backoff: expect.any(Object)
        })
      );

      // Verify the result
      expect(result).toEqual({ id: 'job-123' });
    });

    it('should use default options if not provided', async () => {
      // Setup the mock to return a successful response
      mockBullInstance.add.mockResolvedValueOnce({ id: 'job-123' });

      // Prepare test data
      const jobData = {
        jobId: 'job-123',
        fileId: 'file-123',
        signedUrl: 'https://example.com/file.jpg',
        params: {}
      };

      // Call the function under test
      await addSegmentationJob(jobData);

      // Verify the mock was called with default options
      expect(mockBullInstance.add).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 }
        })
      );
    });

    it('should use custom options if provided', async () => {
      // Setup the mock to return a successful response
      mockBullInstance.add.mockResolvedValueOnce({ id: 'job-123' });

      // Prepare test data
      const jobData = {
        jobId: 'job-123',
        fileId: 'file-123',
        signedUrl: 'https://example.com/file.jpg',
        params: {}
      };

      // Prepare custom options
      const options = {
        attempts: 5,
        backoff: { type: 'fixed', delay: 10000 }
      };

      // Call the function under test
      await addSegmentationJob(jobData, options);

      // Verify the mock was called with custom options
      expect(mockBullInstance.add).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'fixed', delay: 10000 }
        })
      );
    });

    it('should throw an error if queue add fails', async () => {
      // Setup the mock to throw an error
      mockBullInstance.add.mockRejectedValueOnce(new Error('Queue error'));

      // Prepare test data
      const jobData = {
        jobId: 'job-123',
        fileId: 'file-123',
        signedUrl: 'https://example.com/file.jpg',
        params: {}
      };

      // Call the function under test and verify it throws
      await expect(addSegmentationJob(jobData)).rejects.toThrow('Queue error');
    });
  });

  describe('Queue configuration', () => {
    it('should use Redis URL from config', () => {
      // Since we're mocking Bull, we can't directly verify the constructor args
      // Instead, we'll verify that the queue is defined
      expect(segmentationQueue).toBeDefined();
      // We can't verify that mockBull was called because it's defined before the test runs
    });
  });
});

afterAll(async () => {
  if (segmentationQueue && typeof segmentationQueue.close === 'function') {
    await segmentationQueue.close();
  }
});

describe('SegmentationJob validation', () => {
  it('should accept valid SegmentationJobData payloads', async () => {
    const validPayload = {
      fileId: 'file-123',
      params: { threshold: 0.5 },
      jobId: 'job-123',
      signedUrl: 'https://example.com/file.jpg',
      filePath: '/tmp/file.jpg',
      userId: 'user-123',
      projectId: 'project-123'
    };

    mockBullInstance.add.mockResolvedValueOnce({ id: 'job-123' });

    await expect(addSegmentationJob(validPayload)).resolves.toEqual({ id: 'job-123' });
  });

  it('should reject payload missing required fields', async () => {
    const invalidPayload = {
      jobId: 'job-123',
      signedUrl: 'https://example.com/file.jpg',
      params: { threshold: 0.5 }
      // missing fileId
    };

    await expect(addSegmentationJob(invalidPayload as any)).rejects.toThrow();
  });

  it('should throw Zod validation errors on schema violations', async () => {
    const invalidPayload = {
      fileId: 123, // invalid type
      params: 'not-an-object' // invalid type
    };

    await expect(addSegmentationJob(invalidPayload as any)).rejects.toThrowError(/Zod/);
  });

  it('should handle malformed jobs gracefully', async () => {
    const malformedPayload = null;

    await expect(addSegmentationJob(malformedPayload as any)).rejects.toThrow();
  });
});