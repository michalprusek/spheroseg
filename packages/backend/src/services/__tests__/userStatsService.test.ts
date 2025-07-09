import { Pool } from 'pg';
import { UserStatsService } from '../userStatsService';
import logger from '../../utils/logger';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('UserStatsService', () => {
  let userStatsService: UserStatsService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Create mock pool
    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn(),
    } as any;

    userStatsService = new UserStatsService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserStats', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    it('should use segmentation_status column when it exists', async () => {
      // Mock table existence checks
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // projects table exists
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // total projects
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // images table exists
        .mockResolvedValueOnce({ rows: [{ count: '20' }] }) // total images
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // segmentation_status column exists
        .mockResolvedValueOnce({ rows: [{ count: '15' }] }) // completed segmentations
        .mockResolvedValueOnce({
          rows: [{ storage_used_bytes: '1000000', storage_limit_bytes: '10737418240' }],
        }) // storage info
        .mockResolvedValueOnce({ rows: [] }) // recent images
        .mockResolvedValueOnce({ rows: [] }) // recent projects
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // projects this month
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // projects last month
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // images this month
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // images last month
        .mockResolvedValueOnce({ rows: [{ exists: false }] }); // user_activity table doesn't exist

      const result = await userStatsService.getUserStats(mockPool, userId);

      // Verify segmentation_status column check
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('segmentation_status'));

      // Verify the correct query was used for completed segmentations
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('i.segmentation_status = $2'),
        [userId, 'completed']
      );

      expect(result.completedSegmentations).toBe(15);
    });

    it('should fall back to status column when segmentation_status does not exist', async () => {
      // Mock table existence checks
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // projects table exists
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // total projects
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // images table exists
        .mockResolvedValueOnce({ rows: [{ count: '20' }] }) // total images
        .mockResolvedValueOnce({ rows: [{ exists: false }] }) // segmentation_status column doesn't exist
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // completed segmentations using status
        .mockResolvedValueOnce({
          rows: [{ storage_used_bytes: '1000000', storage_limit_bytes: '10737418240' }],
        }) // storage info
        .mockResolvedValueOnce({ rows: [] }) // recent images
        .mockResolvedValueOnce({ rows: [] }) // recent projects
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // projects this month
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // projects last month
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // images this month
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // images last month
        .mockResolvedValueOnce({ rows: [{ exists: false }] }); // user_activity table doesn't exist

      const result = await userStatsService.getUserStats(mockPool, userId);

      // Verify fallback query was used
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('i.status = $2'), [
        userId,
        'completed',
      ]);

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        'segmentation_status column not found, falling back to status column'
      );

      expect(result.completedSegmentations).toBe(10);
    });

    it('should handle errors gracefully and return 0 for completed segmentations', async () => {
      // Mock table existence checks
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // projects table exists
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // total projects
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // images table exists
        .mockResolvedValueOnce({ rows: [{ count: '20' }] }) // total images
        .mockRejectedValueOnce(new Error('Database error')); // error checking column

      // Continue with other mocks to complete the function
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ storage_used_bytes: '1000000', storage_limit_bytes: '10737418240' }],
        }) // storage info
        .mockResolvedValueOnce({ rows: [] }) // recent images
        .mockResolvedValueOnce({ rows: [] }) // recent projects
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // projects this month
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // projects last month
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // images this month
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // images last month
        .mockResolvedValueOnce({ rows: [{ exists: false }] }); // user_activity table doesn't exist

      const result = await userStatsService.getUserStats(mockPool, userId);

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching completed segmentations',
        expect.objectContaining({ userId })
      );

      expect(result.completedSegmentations).toBe(0);
    });
  });
});
