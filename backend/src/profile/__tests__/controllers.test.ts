import { Request, Response } from 'express';
import { getProfileHandler, updateProfileHandler } from '../routes'; // not exported yet, so test will fail
import { ProfileService } from '../services/profile.service'; // import the ProfileService class


describe('Profile Controller Layer', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock })) as any;
    req = {};
    res = { status: statusMock, json: jsonMock };
  });

  describe('getProfileHandler', () => {
    it('should return 200 and user profile on success', async () => {
      jest.spyOn(ProfileService, 'getUserProfile').mockResolvedValue({ id: 'user123', name: 'Alice', email: 'alice@example.com' });
      req.user = { id: 'user123' };

      await getProfileHandler(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({ id: 'user123', name: 'Alice', email: 'alice@example.com' });
    });

    it('should return 404 if profile not found', async () => {
      jest.spyOn(ProfileService, 'getUserProfile').mockRejectedValue(new Error('Profile not found'));
      req.user = { id: 'user123' };

      await getProfileHandler(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Profile not found' });
    });
  });

  describe('updateProfileHandler', () => {
    it('should return 200 and updated profile on success', async () => {
      jest.spyOn(ProfileService, 'updateUserProfile').mockResolvedValue({ id: 'user123', name: 'Bob', email: 'bob@example.com' });
      req.user = { id: 'user123' };
      req.body = { name: 'Bob' };

      await updateProfileHandler(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({ id: 'user123', name: 'Bob', email: 'bob@example.com' });
    });

    it('should return 400 if update fails', async () => {
      jest.spyOn(ProfileService, 'updateUserProfile').mockRejectedValue(new Error('Update failed'));
      req.user = { id: 'user123' };
      req.body = { name: 'Bob' };

      await updateProfileHandler(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Update failed' });
    });
  });
});