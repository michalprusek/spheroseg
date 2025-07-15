/**
 * JWT Key Rotation Routes
 * 
 * Provides endpoints for JWT key rotation management
 */

import { Router } from 'express';
import { requireAdmin } from '../../security/middleware/auth';
import { jwksEndpoint, rotateKeysEndpoint } from '../../auth/jwtKeyRotation';
import logger from '../../utils/logger';

const router = Router();

/**
 * GET /.well-known/jwks.json
 * Public endpoint for retrieving JSON Web Key Set (JWKS)
 */
router.get('/.well-known/jwks.json', (req, res) => {
  try {
    jwksEndpoint(req, res);
  } catch (error) {
    logger.error('JWKS endpoint error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/jwt/rotate-keys
 * Admin endpoint for manually rotating JWT keys
 */
router.post('/auth/jwt/rotate-keys', requireAdmin, async (req, res) => {
  try {
    await rotateKeysEndpoint(req, res);
  } catch (error) {
    logger.error('Key rotation endpoint error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/jwt/status
 * Admin endpoint for checking JWT key rotation status
 */
router.get('/auth/jwt/status', requireAdmin, async (req, res) => {
  try {
    const { getKeyManager } = await import('../../auth/jwtKeyRotation');
    const keyManager = getKeyManager();
    
    res.json({
      message: 'JWT key rotation is active',
      currentKeyId: keyManager.getCurrentKeyId(),
      keyCount: keyManager.getJWKS().keys.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('JWT status endpoint error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;