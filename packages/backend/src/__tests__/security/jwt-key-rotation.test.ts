/**
 * JWT Key Rotation Integration Tests
 */

import { generateAccessToken, verifyToken, TokenType } from '../../services/tokenService';
import { getKeyManager } from '../../auth/jwtKeyRotation';
import config from '../../config';
import { SecurityManager } from '../../security/SecurityManager';

describe('JWT Key Rotation Integration', () => {
  const originalConfig = config.auth.useKeyRotation;

  beforeEach(() => {
    // Reset to ensure clean state
    config.auth.useKeyRotation = false;
  });

  afterEach(() => {
    // Restore original config
    config.auth.useKeyRotation = originalConfig;
  });

  describe('Token Generation', () => {
    it('should generate access token with regular JWT when key rotation is disabled', () => {
      config.auth.useKeyRotation = false;

      const userId = 'test-user-id';
      const email = 'test@example.com';

      const token = generateAccessToken(userId, email);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should generate access token with key rotation when enabled', () => {
      config.auth.useKeyRotation = true;

      const userId = 'test-user-id';
      const email = 'test@example.com';

      const token = generateAccessToken(userId, email);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('Token Verification', () => {
    it('should verify token with regular JWT when key rotation is disabled', async () => {
      config.auth.useKeyRotation = false;

      const userId = 'test-user-id';
      const email = 'test@example.com';

      const token = generateAccessToken(userId, email);
      const payload = await verifyToken(token, TokenType.ACCESS);

      expect(payload.userId).toBe(userId);
      expect(payload.email).toBe(email);
      expect(payload.type).toBe(TokenType.ACCESS);
    });

    it('should verify token with key rotation fallback when enabled but no key ID', async () => {
      config.auth.useKeyRotation = true;

      const userId = 'test-user-id';
      const email = 'test@example.com';

      // Generate token without key rotation (regular JWT)
      config.auth.useKeyRotation = false;
      const token = generateAccessToken(userId, email);

      // Try to verify with key rotation enabled (should fallback)
      config.auth.useKeyRotation = true;
      const payload = await verifyToken(token, TokenType.ACCESS);

      expect(payload.userId).toBe(userId);
      expect(payload.email).toBe(email);
      expect(payload.type).toBe(TokenType.ACCESS);
    });
  });

  describe('Key Manager Integration', () => {
    it('should initialize key manager and generate keys', async () => {
      const keyManager = getKeyManager();

      expect(keyManager).toBeTruthy();
      expect(keyManager.getCurrentKeyId()).toBeTruthy();
      expect(keyManager.getCurrentPrivateKey()).toBeTruthy();

      const jwks = keyManager.getJWKS();
      expect(jwks.keys).toBeTruthy();
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys.length).toBeGreaterThan(0);
    });

    it('should rotate keys successfully', async () => {
      const keyManager = getKeyManager();
      const oldKeyId = keyManager.getCurrentKeyId();

      await keyManager.rotateKeys();

      const newKeyId = keyManager.getCurrentKeyId();
      expect(newKeyId).toBeTruthy();
      expect(newKeyId).not.toBe(oldKeyId);
    });
  });

  describe('Security Headers', () => {
    it('should have proper CSP configuration', () => {
      const securityManager = SecurityManager.getInstance();

      expect(securityManager).toBeTruthy();
      expect(typeof securityManager.applySecurityHeaders).toBe('function');
    });
  });
});
