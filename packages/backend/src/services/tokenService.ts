/**
 * Token Service
 * This service manages the creation, validation, and refresh of JWT tokens
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db';
import config from '../config';
import logger from '../utils/logger';

// Define token types
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh'
}

// Define token payload interfaces
export interface TokenPayload {
  userId: string;
  email: string;
  type: TokenType;
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
  if (!config.auth.jwtSecret) {
    throw new Error('JWT secret is not defined');
  }

  const { 
    expiry = config.auth.accessTokenExpiry || '15m',
    jti = generateTokenId(),
    tokenVersion = 1 
  } = options;

  // Get client IP and user agent if available from the request
  let fingerprint = '';
  try {
    const crypto = require('crypto');
    // Create a partial fingerprint from available data
    fingerprint = crypto.createHash('sha256').update(userId + email).digest('hex').substring(0, 16);
  } catch (error) {
    logger.warn('Failed to generate token fingerprint', { error });
  }

  return jwt.sign(
    { 
      userId, 
      email, 
      type: TokenType.ACCESS,
      jti,                  // Unique token ID
      version: tokenVersion, // Token schema version
      fingerprint           // Security fingerprint
    },
    config.auth.jwtSecret,
    { 
      expiresIn: expiry,
      audience: 'spheroseg-api',
      issuer: 'spheroseg-auth'
    }
  );
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
  if (!config.auth.jwtSecret) {
    throw new Error('JWT secret is not defined');
  }

  const { 
    expiry = config.auth.refreshTokenExpiry || '7d',
    familyId = generateTokenId(), // Generate a new family ID if not provided
    userAgent = '',
    ipAddress = ''
  } = options;

  // Generate a unique token ID for this refresh token
  const jti = generateTokenId();
  
  // Generate device identifier from available data
  const deviceId = crypto
    .createHash('sha256')
    .update(`${userId}:${userAgent}:${ipAddress || familyId}`)
    .digest('hex')
    .substring(0, 32);

  // Generate refresh token with the specified expiry
  const refreshToken = jwt.sign(
    { 
      userId, 
      email, 
      type: TokenType.REFRESH,
      jti,               // Unique token ID
      fid: familyId,     // Family ID for token rotation/revocation
      device: deviceId   // Device identifier for tracking
    },
    config.auth.jwtSecret,
    { 
      expiresIn: expiry,
      audience: 'spheroseg-api',
      issuer: 'spheroseg-auth'
    }
  );

  // Calculate expiry time from the expiry string
  const expiresAt = new Date();
  if (expiry.endsWith('d')) {
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiry.slice(0, -1), 10));
  } else if (expiry.endsWith('h')) {
    expiresAt.setHours(expiresAt.getHours() + parseInt(expiry.slice(0, -1), 10));
  } else if (expiry.endsWith('m')) {
    expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(expiry.slice(0, -1), 10));
  } else {
    // Default to 7 days if format is not recognized
    expiresAt.setDate(expiresAt.getDate() + 7);
  }

  try {
    // Store refresh token in database with additional metadata
    await pool.query(
      `INSERT INTO refresh_tokens 
       (user_id, token_id, family_id, device_id, user_agent, ip_address, expires_at, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [userId, jti, familyId, deviceId, userAgent?.substring(0, 255) || null, ipAddress || null, expiresAt]
    );

    // Return the refresh token combined with the jti for verification
    return `${refreshToken}.${jti}`;
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
export const verifyToken = (
  token: string, 
  type: TokenType,
  options: {
    validateFingerprint?: boolean;
    requiredIssuer?: string;
    requiredAudience?: string;
  } = {}
): TokenPayload => {
  if (!config.auth.jwtSecret) {
    throw new Error('JWT secret is not defined');
  }

  const { 
    validateFingerprint = false,
    requiredIssuer = 'spheroseg-auth',
    requiredAudience = 'spheroseg-api'
  } = options;

  try {
    // Configure verification options
    const verifyOptions: jwt.VerifyOptions = {
      issuer: requiredIssuer,
      audience: requiredAudience
    };

    // Verify token signature and expiry
    const payload = jwt.verify(token, config.auth.jwtSecret, verifyOptions) as TokenPayload;

    // Ensure token type matches expected type
    if (payload.type !== type) {
      logger.warn('Token type mismatch', { 
        expected: type, 
        received: payload.type,
        tokenId: payload.jti
      });
      throw new Error(`Invalid token type: expected ${type}, got ${payload.type}`);
    }

    // Perform additional validation for different token types
    if (type === TokenType.ACCESS && validateFingerprint) {
      // For access tokens, we might validate the fingerprint matches expected value
      // This would be more relevant in a stateful context with stored session data
      if (!payload.fingerprint) {
        logger.warn('Missing fingerprint in access token', { tokenId: payload.jti });
        throw new Error('Invalid token structure: missing fingerprint');
      }
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Token expired', { 
        expiredAt: error.expiredAt, 
        now: new Date(),
        type 
      });
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token', { error: error.message, type });
      throw new Error('Invalid token');
    } else if (error instanceof jwt.NotBeforeError) {
      logger.warn('Token not active yet', { error: error.message, type });
      throw new Error('Token not active yet');
    }
    
    // Log other types of errors
    logger.error('Token verification error', { 
      error: error instanceof Error ? error.message : String(error), 
      type 
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
  const { 
    userAgent = '',
    ipAddress = '',
    strictDeviceCheck = false 
  } = options;

  try {
    // Split the combined token into the JWT and the jti
    const [token, jti] = combinedToken.split('.');

    if (!token || !jti) {
      logger.warn('Invalid refresh token format');
      throw new Error('Invalid refresh token format');
    }

    // Verify the token
    const payload = verifyToken(token, TokenType.REFRESH) as TokenPayload & { 
      fid: string;
      device: string; 
    };

    if (!payload.jti || !payload.fid || !payload.device) {
      logger.warn('Incomplete refresh token payload', { 
        hasJti: !!payload.jti,
        hasFid: !!payload.fid, 
        hasDevice: !!payload.device
      });
      throw new Error('Invalid refresh token: missing required claims');
    }

    // Check if token exists in database, is not revoked, and hasn't expired
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

    // Check if token has been revoked
    if (storedToken.is_revoked) {
      logger.warn('Refresh token has been revoked', { tokenId: jti });
      throw new Error('Refresh token has been revoked');
    }

    // Verify the token belongs to the correct user
    if (storedToken.user_id !== payload.userId) {
      logger.warn('Token user mismatch', { 
        tokenUserId: payload.userId, 
        storedUserId: storedToken.user_id,
        tokenId: jti
      });
      throw new Error('Token user mismatch');
    }

    // Ensure the JWT's jti matches the token_id from database
    if (payload.jti !== storedToken.token_id) {
      logger.warn('Token ID mismatch', { 
        payloadJti: payload.jti, 
        storedJti: storedToken.token_id
      });
      throw new Error('Token ID mismatch');
    }

    // Ensure the family ID in the token matches the one in the database
    if (payload.fid !== storedToken.family_id) {
      logger.warn('Token family ID mismatch', { 
        payloadFid: payload.fid, 
        storedFid: storedToken.family_id
      });
      throw new Error('Token family ID mismatch');
    }

    // Check device fingerprint if strict device checking is enabled
    if (strictDeviceCheck) {
      // Generate the device ID using the same algorithm used during token creation
      const expectedDeviceId = crypto
        .createHash('sha256')
        .update(`${payload.userId}:${userAgent}:${ipAddress || payload.fid}`)
        .digest('hex')
        .substring(0, 32);
      
      // Verify the device fingerprint matches
      if (payload.device !== expectedDeviceId && payload.device !== storedToken.device_id) {
        logger.warn('Device fingerprint mismatch', { 
          expectedDevice: expectedDeviceId,
          tokenDevice: payload.device,
          storedDevice: storedToken.device_id
        });
        throw new Error('Device fingerprint mismatch');
      }
    }

    // Check for suspicious activity: excessive tokens in the same family
    if (parseInt(storedToken.token_count, 10) > 10) {
      logger.warn('Excessive refresh tokens in family', { 
        familyId: storedToken.family_id, 
        tokenCount: storedToken.token_count
      });
      // Log the suspicious activity but don't reject the token
      // Instead, you might want to implement a cleanup procedure
    }

    // Return the verified payload with additional info
    return {
      ...payload,
      familyId: storedToken.family_id,
      deviceId: storedToken.device_id
    };
  } catch (error) {
    if (error instanceof Error) {
      // Don't modify the error if it's already appropriately formatted
      throw error;
    }
    
    // Otherwise log and rethrow with a more specific message
    logger.error('Refresh token verification failed', { 
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error('Refresh token verification failed');
  }
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
  const {
    userAgent = '',
    ipAddress = '',
    maxTokensPerFamily = 10
  } = options;

  try {
    // Verify the old token first to get family ID
    const oldTokenPayload = await verifyRefreshToken(oldCombinedToken, { 
      userAgent, 
      ipAddress 
    });
    
    const { familyId } = oldTokenPayload;
    
    // Split the combined token to get the jti
    const [, jti] = oldCombinedToken.split('.');

    if (!jti) {
      throw new Error('Invalid refresh token format');
    }

    // Begin transaction
    await pool.query('BEGIN');

    try {
      // Revoke the old token
      await pool.query(
        'UPDATE refresh_tokens SET is_revoked = true, updated_at = NOW() WHERE token_id = $1',
        [jti]
      );
      
      // Check how many tokens are in this family
      const tokenCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM refresh_tokens WHERE family_id = $1',
        [familyId]
      );
      
      const tokenCount = parseInt(tokenCountResult.rows[0].count, 10);
      
      // If there are too many tokens in this family, it might indicate token theft
      // In that case, revoke all tokens in the family and start a new family
      if (tokenCount >= maxTokensPerFamily) {
        logger.warn('Too many refresh tokens in family, revoking all', { 
          familyId,
          tokenCount,
          userId
        });
        
        // Revoke all tokens in this family
        await pool.query(
          'UPDATE refresh_tokens SET is_revoked = true, updated_at = NOW() WHERE family_id = $1',
          [familyId]
        );
        
        // Generate completely new refresh token with a new family
        const newRefreshToken = await generateRefreshToken(userId, email, {
          userAgent,
          ipAddress
        });
        
        await pool.query('COMMIT');
        return newRefreshToken;
      }
      
      // Otherwise, generate new refresh token in the same family
      const newRefreshToken = await generateRefreshToken(userId, email, {
        familyId, // Keep the same family ID for token rotation
        userAgent,
        ipAddress
      });

      // Commit transaction
      await pool.query('COMMIT');

      return newRefreshToken;
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Error rotating refresh token', { 
      error: error instanceof Error ? error.message : String(error), 
      userId 
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
  const { 
    exceptFamilyId, 
    exceptDeviceId,
    olderThan 
  } = options;

  try {
    let query = 'UPDATE refresh_tokens SET is_revoked = true, updated_at = NOW() WHERE user_id = $1';
    const params: any[] = [userId];

    // Add conditions for selective revocation
    if (exceptFamilyId) {
      query += ' AND family_id != $' + (params.length + 1);
      params.push(exceptFamilyId);
    }

    if (exceptDeviceId) {
      query += ' AND device_id != $' + (params.length + 1);
      params.push(exceptDeviceId);
    }

    if (olderThan) {
      query += ' AND created_at < $' + (params.length + 1);
      params.push(olderThan);
    }

    // Execute the query
    const result = await pool.query(query, params);
    
    logger.info('Revoked refresh tokens for user', { 
      userId, 
      count: result.rowCount,
      exceptFamilyId,
      exceptDeviceId
    });
  } catch (error) {
    logger.error('Error revoking user tokens', { 
      error: error instanceof Error ? error.message : String(error), 
      userId
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
  const { 
    olderThan, 
    beforeTimestamp,
    limit = 1000 
  } = options;
  
  try {
    let query = 'DELETE FROM refresh_tokens WHERE expires_at < NOW()';
    const params: any[] = [];
    
    // Add conditions for selective cleanup
    if (olderThan) {
      query += ' AND created_at < $' + (params.length + 1);
      params.push(olderThan);
    }
    
    if (beforeTimestamp) {
      const date = new Date(beforeTimestamp);
      query += ' AND created_at < $' + (params.length + 1);
      params.push(date);
    }
    
    // Add limit
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);
    
    // Execute the query
    const result = await pool.query(query, params);
    
    logger.info('Cleaned up expired tokens', { count: result.rowCount });
    return result.rowCount;
  } catch (error) {
    logger.error('Error cleaning up expired tokens', { 
      error: error instanceof Error ? error.message : String(error)
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
) => {
  const { 
    userAgent = '',
    ipAddress = '',
    accessTokenExpiry = config.auth.accessTokenExpiry || '15m', 
    refreshTokenExpiry = config.auth.refreshTokenExpiry || '7d'
  } = options;

  // Generate access token with specified expiry
  const accessToken = generateAccessToken(userId, email, {
    expiry: accessTokenExpiry
  });
  
  // Generate refresh token with specified expiry and device info
  const refreshToken = await generateRefreshToken(userId, email, {
    expiry: refreshTokenExpiry,
    userAgent,
    ipAddress
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: accessTokenExpiry
  };
};

export default {
  // Token generation
  generateAccessToken,
  generateRefreshToken,
  generateRandomToken,
  generateTokenId,
  
  // Token verification
  verifyToken,
  verifyRefreshToken,
  
  // Token management
  rotateRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  
  // Unified response
  createTokenResponse,
  
  // Types
  TokenType
};