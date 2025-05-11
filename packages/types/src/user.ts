/**
 * User and authentication related types
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  user_id: string;
  username: string | null;
  full_name: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  preferred_theme?: 'light' | 'dark' | 'system' | null;
  storage_limit_bytes?: number | null;
  storage_used_bytes?: number | null;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RefreshTokenResponse {
  token: string;
  expires_at: string;
}

export type UserProfileUpdatePayload = Partial<Omit<UserProfile, 'user_id'>>;

export interface AccessRequestPayload {
  email: string;
  name?: string;
  organization?: string;
  reason?: string;
}

export interface AccessRequestResponse {
  id: string;
  email: string;
  status: string;
  created_at: string;
}
