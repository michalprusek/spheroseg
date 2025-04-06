import { ProfileService } from '../services/profile.service';
import db from '../../db/connection';

jest.mock('../../db/connection', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

beforeEach(() => {
 (db.query as jest.Mock).mockReset();
 (db.query as jest.Mock).mockResolvedValue({ rows: [] });
});

describe('ProfileService', () => {
  describe('getUserProfile', () => {
    it('should return user profile data', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: 'user123',
            email: 'alice@example.com',
            name: 'Alice',
            bio: 'Bio',
            avatar_url: 'avatar.png',
            website: 'https://example.com'
          }]
        })
        .mockResolvedValue({ rows: [] }); // fallback for any other calls

      const result = await ProfileService.getUserProfile('user123');

      expect(result).toEqual({
        id: 'user123',
        email: 'alice@example.com',
        name: 'Alice',
        bio: 'Bio',
        avatar_url: 'avatar.png',
        website: 'https://example.com'
      });
    });

    it('should throw error if profile not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(ProfileService.getUserProfile('user123')).rejects.toThrow('Profile not found');
    });
  });

  describe('updateUserProfile', () => {
    it('should update and return updated profile', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'user123' }] }) // update query result
        .mockResolvedValueOnce({ // getUserProfile result
          rows: [{
            id: 'user123',
            email: 'bob@example.com',
            name: 'Bob',
            bio: 'New bio',
            avatar_url: 'avatar2.png',
            website: 'https://bob.com'
          }]
        })
        .mockResolvedValue({ rows: [] }); // fallback for any other calls

      const result = await ProfileService.updateUserProfile('user123', { name: 'Bob' });

      expect(result).toEqual({
        id: 'user123',
        email: 'bob@example.com',
        name: 'Bob',
        bio: 'New bio',
        avatar_url: 'avatar2.png',
        website: 'https://bob.com'
      });
    });

    it('should throw error if no valid fields to update', async () => {
      await expect(ProfileService.updateUserProfile('user123', {}))
        .rejects.toThrow('No valid fields to update');
    });
  });
});