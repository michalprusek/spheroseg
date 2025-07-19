/**
 * Authentication-related type definitions
 */

import { User } from './user';

// JWT payload types
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  sub?: string;
}

export interface RefreshTokenPayload extends JWTPayload {
  tokenId: string;
  remember?: boolean;
}

// JWKS (JSON Web Key Set) types
export interface JWK {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n?: string;
  e?: string;
  x5c?: string[];
  x5t?: string;
  'x5t#S256'?: string;
}

export interface JWKS {
  keys: JWK[];
}

// Auth request/response types
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  preferred_language?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface DeleteAccountRequest {
  username: string;
  password: string;
}

export interface SendVerificationEmailRequest {
  email: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

// Authenticated request extension
export interface AuthenticatedRequest extends Express.Request {
  user?: JWTPayload;
}
