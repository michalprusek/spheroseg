import { Request, Response } from 'express';
import { ProfileService } from '../services/profile.service';

export class ProfileController {
  static async getProfileHandler(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const profile = await ProfileService.getUserProfile(userId);
      res.status(200).json(profile);
    } catch (err: any) {
      if (err.message === 'Profile not found') {
        res.status(404).json({ error: 'Profile not found' });
      } else {
        if (err.message === 'Profile not found') {
          res.status(404).json({ error: 'Profile not found' });
        } else {
          res.status(400).json({ error: err.message });
        }
      }
    }
  }

  static async updateProfileHandler(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const updatedProfile = await ProfileService.updateUserProfile(userId, req.body);
      res.status(200).json(updatedProfile);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}