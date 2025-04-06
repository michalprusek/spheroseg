import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config/app';
import db from '../../db/connection';

interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

interface User {
  id: string;
  email: string;
  password_hash: string;
  name?: string;
  bio?: string;
  avatar_url?: string;
  website?: string;
}

export class AuthService {
  static async registerUser(data: RegisterData): Promise<Omit<User, 'password_hash'>> {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    );
    if (existing.rows.length > 0) {
      throw new Error('User already exists');
    }

    const result = await db.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, bio, avatar_url, website`,
      [data.email, hashedPassword, data.name || null]
    );

    return result.rows[0];
  }

  static async loginUser(email: string, password: string): Promise<{ token: string; user: Omit<User, 'password_hash'> }> {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0] as User;
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user.id);

    const { password_hash, ...userData } = user;
    return { token, user: userData };
  }

  static generateToken(userId: string): string {
    return jwt.sign({ userId }, config.auth.jwtSecret, { expiresIn: '7d' });
  }

  static verifyToken(token: string): { userId: string } {
    return jwt.verify(token, config.auth.jwtSecret) as { userId: string };
  }

  static async requestPasswordReset(email: string): Promise<void> {
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    const userId = result.rows[0].id;
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    // TODO: send email with token link
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const result = await db.query(
      `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    );
    if (result.rows.length === 0) {
      throw new Error('Invalid token');
    }
    const { user_id, expires_at, used } = result.rows[0];
    if (used || new Date() > expires_at) {
      throw new Error('Token expired or used');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hashedPassword, user_id]
    );

    await db.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE token = $1`,
      [token]
    );
  }
}