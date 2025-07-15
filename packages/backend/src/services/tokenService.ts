/**
 * Token Service
 * This service manages the creation, validation, and refresh of JWT tokens
 */
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import ms, { StringValue } from 'ms';
import pool from '../db';
import config from '../config';
import logger from '../utils/logger';
import { getKeyManager, signJWTWithRotation } from '../auth/jwtKeyRotation';

// Define token types
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

// Define token payload interfaces
export interface TokenPayload {
  userId: string;
  email: string;
  type: TokenType;
  jti?: string; // JWT ID
  fingerprint?: string; // Security fingerprint
  version?: number; // Token format version
  fid?: string; // Family ID for refresh tokens
  device?: string; // Device identifier for refresh tokens
  tokenVersion?: number; // Token version number
  // Standard JWT claims
  iat?: number; // Issued at
  exp?: number; // Expiration time
  nbf?: number; // Not before
  iss?: string; // Issuer
  sub?: string; // Subject
  aud?: string; // Audience
}

// Define TokenResponse interface
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Number of seconds until access token expiry
  tokenType: string; // Typically 'Bearer'
}

/**
 * Generate a crypto-secure random token
 * @param length The length of the token in bytes (default: 40)
 * @returns A random hex token
 */
export const generateRandomToken = (length: number = 40): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a unique token identifier
 * @returns A short unique identifier for a token
 */
export const generateTokenId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate an access token for the user with enhanced security features
 *
 * @param userId The user's ID
 * @param email The user's email
 * @param options Optional configuration
 * @returns JWT access token
 */
export const generateAccessToken = (
  userId: string,
  email: string,
  options: {
    expiry?: string;
    jti?: string;
    tokenVersion?: number;
  } = {}
): string => {
  const {
    expiry = config.auth.accessTokenExpiry || '15m',
    jti = generateTokenId(),
    tokenVersion = 1,
  } = options;

  const fingerprint = generateRandomToken(32);

  const payload = {
    userId,
    email,
    type: TokenType.ACCESS,
    jti,
    version: tokenVersion,
    fingerprint,
  };

  const signOpts: SignOptions = {
    expiresIn: ms(expiry as StringValue) / 1000,
    audience: 'spheroseg-api',
    issuer: 'spheroseg-auth',
  };

  // Use JWT key rotation system if available, fallback to regular signing
  if (config.auth.useKeyRotation) {
    const rotatedToken = signJWTWithRotation(payload, signOpts);
    if (rotatedToken) {
      return rotatedToken;
    }
  }

  // Fallback to regular JWT signing
  const jwtSecret = config.auth.jwtSecret;
  if (!jwtSecret) {
    logger.error('JWT secret is not defined and key rotation is not available. Cannot generate access token.');
    throw new Error('JWT secret is not defined');
  }

  const secret: Secret = jwtSecret;
  return jwt.sign(payload, secret, signOpts);
};

/**
 * Generate a refresh token for the user with enhanced security features
 *
 * @param userId The user's ID
 * @param email The user's email
 * @param options Optional configuration options
 * @returns Promise resolving to a combined refresh token string
 */
export const generateRefreshToken = async (
  userId: string,
  email: string,
  options: {
    expiry?: string;
    familyId?: string;
    userAgent?: string;
    ipAddress?: string;
  } = {}
): Promise<string> => {
  const jwtSecret = config.auth.jwtSecret;
  if (!jwtSecret) {
    logger.error('JWT secret is not defined. Cannot generate refresh token.');
    throw new Error('JWT secret is not defined');
  }

  const {
    expiry = config.auth.refreshTokenExpiry || '7d',
    familyId = generateTokenId(),
    userAgent = '',
    ipAddress = '',
  } = options;

  const jti = generateTokenId();

  const deviceId = crypto
    .createHash('sha256')
    .update(`${userId}:${userAgent}:${ipAddress || familyId}`)
    .digest('hex')
    .substring(0, 32);

  const payload = {
    userId,
    email,
    type: TokenType.REFRESH,
    jti,
    fid: familyId,
    device: deviceId,
  };

  const secret: Secret = jwtSecret;
  const signOpts: SignOptions = {
    expiresIn: ms(expiry as StringValue) / 1000,
    audience: 'spheroseg-api',
    issuer: 'spheroseg-auth',
  };

  const token = jwt.sign(payload, secret, signOpts);

  const expiresAt = new Date(Date.now() + ms(expiry as StringValue));

  try {
    await pool.query(
      `INSERT INTO refresh_tokens
       (user_id, token_id, family_id, device_id, user_agent, ip_address, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        userId,
        jti,
        familyId,
        deviceId,
        userAgent?.substring(0, 255) || null,
        ipAddress || null,
        expiresAt,
      ]
    );

    return `${token}.${jti}`;
  } catch (error) {
    logger.error('Error storing refresh token', { error, userId });
    throw new Error('Failed to generate refresh token');
  }
};

/**
 * Enhanced token verification with additional security checks
 *
 * @param token The JWT token to verify
 * @param type The expected token type (ACCESS or REFRESH)
 * @param options Additional verification options
 * @returns The verified token payload
 */
export const verifyToken = async (
  token: string,
  type: TokenType,
  options: {
    validateFingerprint?: boolean;
    requiredIssuer?: string;
    requiredAudience?: string;
  } = {}
): Promise<TokenPayload> => {
  const {
    validateFingerprint = false,
    requiredAudience = 'spheroseg-api',
    requiredIssuer = 'spheroseg-auth',
  } = options;

  try {
    let decoded: TokenPayload;

    // Try JWT key rotation verification first if enabled
    if (config.auth.useKeyRotation) {
      try {
        // Decode token to get kid (key ID)
        const tokenHeader = jwt.decode(token, { complete: true });
        
        if (tokenHeader && typeof tokenHeader === 'object' && tokenHeader.header.kid) {
          const keyManager = getKeyManager();
          const publicKey = await keyManager.getPublicKey(tokenHeader.header.kid);
          
          if (publicKey) {
            decoded = jwt.verify(token, publicKey, {
              audience: requiredAudience,
              issuer: requiredIssuer,
              algorithms: ['RS256', 'RS384', 'RS512']
            }) as TokenPayload;
          } else {
            throw new Error('Public key not found for token');
          }
        } else {
          throw new Error('No key ID in token header');
        }
      } catch (keyRotationError) {
        // Fall back to regular JWT verification
        logger.debug('Key rotation verification failed, falling back to regular JWT', {
          error: keyRotationError instanceof Error ? keyRotationError.message : String(keyRotationError)
        });
        
        const jwtSecret = config.auth.jwtSecret;
        if (!jwtSecret) {
          throw new Error('JWT secret is not defined and key rotation failed');
        }
        
        decoded = jwt.verify(token, jwtSecret, {
          audience: requiredAudience,
          issuer: requiredIssuer,
        }) as TokenPayload;
      }
    } else {
      // Regular JWT verification
      const jwtSecret = config.auth.jwtSecret;
      if (!jwtSecret) {
        logger.error('JWT secret is not defined. Cannot verify token.');
        throw new Error('JWT secret is not defined');
      }

      decoded = jwt.verify(token, jwtSecret, {
        audience: requiredAudience,
        issuer: requiredIssuer,
      }) as TokenPayload;
    }

    if (decoded.type !== type) {
      logger.warn('Token type mismatch', {
        expected: type,
        received: decoded.type,
        tokenId: decoded.jti,
      });
      throw new Error(`Invalid token type: expected ${type}, got ${decoded.type}`);
    }

    if (type === TokenType.ACCESS && validateFingerprint) {
      if (!decoded.fingerprint) {
        logger.warn('Missing fingerprint in access token', {
          tokenId: decoded.jti,
        });
        throw new Error('Invalid token structure: missing fingerprint');
      }
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Token expired', {
        expiredAt: error.expiredAt,
        now: new Date(),
        type,
      });
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token', { error: error.message, type });
      throw new Error('Invalid token');
    } else if (error instanceof jwt.NotBeforeError) {
      logger.warn('Token not active yet', { error: error.message, type });
      throw new Error('Token not active yet');
    }

    logger.error('Token verification error', {
      error: error instanceof Error ? error.message : String(error),
      type,
    });
    throw error;
  }
};

/**
 * Verify a refresh token including enhanced database validation
 *
 * @param combinedToken The combined refresh token (JWT + jti)
 * @param options Additional verification options
 * @returns The verified token payload
 */
export const verifyRefreshToken = async (
  combinedToken: string,
  options: {
    userAgent?: string;
    ipAddress?: string;
    strictDeviceCheck?: boolean;
  } = {}
): Promise<TokenPayload & { familyId: string; deviceId: string }> => {
  const jwtSecret = config.auth.jwtSecret;
  if (!jwtSecret) {
    logger.error('JWT_SECRET is not defined. Cannot verify refresh token.');
    throw new Error('JWT_SECRET is not defined for refresh token verification');
  }

  const [jwtPart, jti] = combinedToken.split('.');

  if (!jwtPart || !jti) {
    logger.warn('Invalid refresh token format');
    throw new Error('Invalid refresh token format');
  }

  const { userAgent = '', ipAddress = '', strictDeviceCheck = false } = options;

  const decoded = jwt.verify(jwtPart, jwtSecret, {
    audience: 'spheroseg-api',
    issuer: 'spheroseg-auth',
  }) as TokenPayload & { fid: string; device: string };

  if (decoded.type !== TokenType.REFRESH) {
    logger.warn('Token type mismatch', {
      expected: TokenType.REFRESH,
      received: decoded.type,
      tokenId: decoded.jti,
    });
    throw new Error(`Invalid token type: expected ${TokenType.REFRESH}, got ${decoded.type}`);
  }

  if (!decoded.jti || !decoded.fid || !decoded.device) {
    logger.warn('Incomplete refresh token payload', {
      hasJti: !!decoded.jti,
      hasFid: !!decoded.fid,
      hasDevice: !!decoded.device,
    });
    throw new Error('Invalid refresh token: missing required claims');
  }

  const result = await pool.query(
    `SELECT
      id, user_id, is_revoked, family_id, device_id, token_id,
      user_agent, ip_address, created_at, updated_at, expires_at,
      (SELECT COUNT(*) FROM refresh_tokens WHERE family_id = t.family_id) as token_count
    FROM refresh_tokens t
    WHERE token_id = $1 AND expires_at > NOW()`,
    [jti]
  );

  if (result.rows.length === 0) {
    logger.warn('Refresh token not found or expired', { tokenId: jti });
    throw new Error('Refresh token not found or expired');
  }

  const storedToken = result.rows[0];

  if (storedToken.is_revoked) {
    logger.warn('Refresh token has been revoked', { tokenId: jti });
    throw new Error('Refresh token has been revoked');
  }

  if (storedToken.user_id !== decoded.userId) {
    logger.warn('Token user mismatch', {
      tokenUserId: decoded.userId,
      storedUserId: storedToken.user_id,
      tokenId: jti,
    });
    throw new Error('Token user mismatch');
  }

  if (decoded.jti !== storedToken.token_id) {
    logger.warn('Token ID mismatch', {
      payloadJti: decoded.jti,
      storedJti: storedToken.token_id,
    });
    throw new Error('Token ID mismatch');
  }

  if (decoded.fid !== storedToken.family_id) {
    logger.warn('Token family ID mismatch', {
      payloadFid: decoded.fid,
      storedFid: storedToken.family_id,
    });
    throw new Error('Token family ID mismatch');
  }

  if (strictDeviceCheck) {
    const expectedDeviceId = crypto
      .createHash('sha256')
      .update(`${decoded.userId}:${userAgent}:${ipAddress || decoded.fid}`)
      .digest('hex')
      .substring(0, 32);

    if (decoded.device !== expectedDeviceId && decoded.device !== storedToken.device_id) {
      logger.warn('Device fingerprint mismatch', {
        expectedDevice: expectedDeviceId,
        tokenDevice: decoded.device,
        storedDevice: storedToken.device_id,
      });
      throw new Error('Device fingerprint mismatch');
    }
  }

  if (parseInt(storedToken.token_count, 10) > 10) {
    logger.warn('Excessive refresh tokens in family', {
      familyId: storedToken.family_id,
      tokenCount: storedToken.token_count,
    });
  }

  return {
    ...decoded,
    familyId: storedToken.family_id,
    deviceId: storedToken.device_id,
  };
};

/**
 * Rotate refresh token - invalidate the old one and generate a new one in the same family
 *
 * This implements token rotation security pattern where old tokens are revoked when used
 * and new tokens in the same family are issued. This helps detect token theft.
 *
 * @param oldCombinedToken The combined refresh token to rotate
 * @param userId The user ID
 * @param email The user email
 * @param options Additional options for the new token
 * @returns Promise resolving to a new refresh token
 */
export const rotateRefreshToken = async (
  oldCombinedToken: string,
  userId: string,
  email: string,
  options: {
    userAgent?: string;
    ipAddress?: string;
    maxTokensPerFamily?: number;
  } = {}
): Promise<string> => {
  const jwtSecret = config.auth.jwtSecret;
  if (!jwtSecret) {
    logger.error('JWT_SECRET is not defined. Cannot rotate refresh token.');
    throw new Error('JWT_SECRET is not defined for token rotation');
  }

  const { userAgent = '', ipAddress = '', maxTokensPerFamily = 5 } = options;

  try {
    const oldDecoded = await verifyRefreshToken(oldCombinedToken, {
      userAgent,
      ipAddress,
      strictDeviceCheck: false,
    });

    await pool.query(
      'UPDATE refresh_tokens SET is_revoked = true, updated_at = NOW() WHERE token_id = $1',
      [oldDecoded.jti]
    );

    const tokenCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM refresh_tokens WHERE family_id = $1',
      [oldDecoded.fid]
    );

    const tokenCount = parseInt(tokenCountResult.rows[0].count, 10);

    if (tokenCount >= maxTokensPerFamily) {
      logger.warn('Too many refresh tokens in family, revoking all', {
        familyId: oldDecoded.fid,
        tokenCount,
        userId,
      });

      await pool.query(
        'UPDATE refresh_tokens SET is_revoked = true, updated_at = NOW() WHERE family_id = $1',
        [oldDecoded.fid]
      );

      const newRefreshToken = await generateRefreshToken(userId, email, {
        userAgent,
        ipAddress,
      });

      return newRefreshToken;
    }

    const newRefreshToken = await generateRefreshToken(userId, email, {
      familyId: oldDecoded.fid,
      userAgent,
      ipAddress,
    });

    return newRefreshToken;
  } catch (error) {
    logger.error('Error rotating refresh token', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw new Error('Failed to rotate refresh token');
  }
};

/**
 * Revoke all refresh tokens for a user with additional options for selective revocation
 *
 * @param userId The user ID whose tokens to revoke
 * @param options Additional options for selective revocation
 * @returns Promise resolving when revocation is complete
 */
export const revokeAllUserTokens = async (
  userId: string,
  options: {
    exceptFamilyId?: string;
    exceptDeviceId?: string;
    olderThan?: Date;
  } = {}
): Promise<void> => {
  let query =
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL';
  const params: any[] = [userId];
  let paramIndex = 2;

  const { exceptFamilyId, exceptDeviceId, olderThan } = options;

  if (exceptFamilyId) {
    query += ` AND family_id != $${paramIndex}`;
    params.push(exceptFamilyId);
    paramIndex++;
  }

  if (exceptDeviceId) {
    query += ` AND device_id != $${paramIndex}`;
    params.push(exceptDeviceId);
    paramIndex++;
  }

  if (olderThan) {
    query += ` AND created_at < $${paramIndex}`;
    params.push(olderThan);
  }

  try {
    const result = await pool.query(query, params);

    logger.info('Revoked refresh tokens for user', {
      userId,
      count: result.rowCount,
      exceptFamilyId,
      exceptDeviceId,
    });
  } catch (error) {
    logger.error('Error revoking user tokens', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw new Error('Failed to revoke user tokens');
  }
};

/**
 * Delete expired tokens from the database to maintain performance
 *
 * @param options Additional options for cleanup
 * @returns Promise with number of deleted tokens
 */
export const cleanupExpiredTokens = async (
  options: {
    olderThan?: Date;
    beforeTimestamp?: number;
    limit?: number;
  } = {}
): Promise<number> => {
  let query = 'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL';
  const params: any[] = [];

  const { olderThan, beforeTimestamp, limit } = options;

  if (olderThan) {
    query += ' AND created_at < $1';
    params.push(olderThan);
  }

  if (beforeTimestamp) {
    const date = new Date(beforeTimestamp);
    query += ' AND created_at < $' + (params.length + 1);
    params.push(date);
  }

  if (limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  try {
    const result = await pool.query(query, params);

    logger.info('Cleaned up expired tokens', { count: result.rowCount });
    return result.rowCount || 0;
  } catch (error) {
    logger.error('Error cleaning up expired tokens', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to clean up expired tokens');
  }
};

/**
 * Creates a combined token response with access and refresh tokens
 *
 * @param userId The user ID
 * @param email The user email
 * @param options Additional options for token generation
 * @returns Promise resolving to token response object
 */
export const createTokenResponse = async (
  userId: string,
  email: string,
  options: {
    userAgent?: string;
    ipAddress?: string;
    accessTokenExpiry?: string;
    refreshTokenExpiry?: string;
  } = {}
): Promise<TokenResponse> => {
  const jwtSecret = config.auth.jwtSecret;
  if (!jwtSecret) {
    logger.error('JWT_SECRET is not defined. Cannot create token response.');
    throw new Error('JWT_SECRET is not defined for creating token response');
  }

  const { userAgent, ipAddress, accessTokenExpiry, refreshTokenExpiry } = options;

  const accessTokenExpiresIn = accessTokenExpiry || config.auth.accessTokenExpiry || '15m';
  const refreshTokenExpiresIn = refreshTokenExpiry || config.auth.refreshTokenExpiry || '7d';

  const accessToken = generateAccessToken(userId, email, {
    expiry: accessTokenExpiresIn,
  });

  const refreshToken = await generateRefreshToken(userId, email, {
    expiry: refreshTokenExpiresIn,
    userAgent,
    ipAddress,
  });

  const expiresInNumeric = ms(accessTokenExpiresIn as StringValue) / 1000;

  return {
    accessToken,
    refreshToken,
    expiresIn: expiresInNumeric,
    tokenType: 'Bearer',
  };
};

export default {
  generateAccessToken,
  generateRefreshToken,
  generateRandomToken,
  generateTokenId,

  verifyToken,
  verifyRefreshToken,

  rotateRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,

  createTokenResponse,

  TokenType,
};
