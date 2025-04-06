import db from '../../db/connection';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  bio?: string;
  avatar_url?: string;
  website?: string;
}

export class ProfileService {
  static async getUserProfile(userId: string): Promise<UserProfile> {
    const result = await db.query(
      `SELECT id, email, name, bio, avatar_url, website FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }
    return result.rows[0];
  }

  static async updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (['name', 'bio', 'avatar_url', 'website'].includes(key) && value !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);

    await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`,
      values
    );

    return this.getUserProfile(userId);
  }
}