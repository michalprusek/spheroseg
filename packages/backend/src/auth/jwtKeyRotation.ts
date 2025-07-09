/**
 * JWT Key Rotation s jwks-rsa
 *
 * Implementace automatické rotace JWT klíčů pro vyšší bezpečnost
 */

import jwksRsa from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';

/**
 * Konfigurace pro JWKS
 */
interface JWKSConfig {
  cache: boolean;
  cacheMaxEntries: number;
  cacheMaxAge: number;
  rateLimit: boolean;
  jwksRequestsPerMinute: number;
  jwksUri?: string;
  localKeys?: boolean;
}

/**
 * Struktura pro lokální klíče
 */
interface KeyPair {
  kid: string;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
  expiresAt: Date;
  algorithm: 'RS256' | 'RS384' | 'RS512';
}

/**
 * JWT Key Manager pro správu a rotaci klíčů
 */
export class JWTKeyManager {
  private jwksClient: jwksRsa.JwksClient | null = null;
  private localKeys: Map<string, KeyPair> = new Map();
  private currentKeyId: string | null = null;
  private keysPath: string;
  private rotationInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: JWKSConfig = {
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minut
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      localKeys: true,
    }
  ) {
    this.keysPath = path.join(process.cwd(), 'keys');
    this.initialize();
  }

  /**
   * Inicializace key manageru
   */
  private async initialize(): Promise<void> {
    try {
      // Vytvoření adresáře pro klíče
      await fs.mkdir(this.keysPath, { recursive: true });

      if (this.config.jwksUri) {
        // Externí JWKS endpoint
        this.jwksClient = jwksRsa({
          cache: this.config.cache,
          cacheMaxEntries: this.config.cacheMaxEntries,
          cacheMaxAge: this.config.cacheMaxAge,
          rateLimit: this.config.rateLimit,
          jwksRequestsPerMinute: this.config.jwksRequestsPerMinute,
          jwksUri: this.config.jwksUri,
        });
      } else if (this.config.localKeys) {
        // Lokální správa klíčů
        await this.loadLocalKeys();

        // Pokud nejsou žádné klíče, vygenerovat nový pár
        if (this.localKeys.size === 0) {
          await this.generateNewKeyPair();
        }

        // Nastavit automatickou rotaci
        this.setupKeyRotation();
      }

      logger.info('JWT Key Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize JWT Key Manager', error);
      throw error;
    }
  }

  /**
   * Načtení lokálních klíčů
   */
  private async loadLocalKeys(): Promise<void> {
    try {
      const files = await fs.readdir(this.keysPath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const keyData = await fs.readFile(path.join(this.keysPath, file), 'utf-8');
          const keyPair = JSON.parse(keyData) as KeyPair;

          // Kontrola expirace
          if (new Date(keyPair.expiresAt) > new Date()) {
            this.localKeys.set(keyPair.kid, keyPair);

            // Nastavit jako aktuální klíč, pokud není žádný
            if (!this.currentKeyId) {
              this.currentKeyId = keyPair.kid;
            }
          } else {
            // Odstranit expirovaný klíč
            await fs.unlink(path.join(this.keysPath, file));
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load local keys', error);
    }
  }

  /**
   * Generování nového páru klíčů
   */
  private async generateNewKeyPair(): Promise<KeyPair> {
    const kid = crypto.randomBytes(16).toString('hex');

    // Generování RSA klíčů
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    const keyPair: KeyPair = {
      kid,
      publicKey,
      privateKey,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dní
      algorithm: 'RS256',
    };

    // Uložit klíč
    await fs.writeFile(path.join(this.keysPath, `${kid}.json`), JSON.stringify(keyPair, null, 2));

    this.localKeys.set(kid, keyPair);
    this.currentKeyId = kid;

    logger.info(`Generated new key pair with kid: ${kid}`);

    return keyPair;
  }

  /**
   * Nastavení automatické rotace klíčů
   */
  private setupKeyRotation(): void {
    // Rotace každých 7 dní
    const rotationPeriod = 7 * 24 * 60 * 60 * 1000;

    this.rotationInterval = setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        logger.error('Key rotation failed', error);
      }
    }, rotationPeriod);
  }

  /**
   * Rotace klíčů
   */
  public async rotateKeys(): Promise<void> {
    logger.info('Starting key rotation');

    // Generovat nový klíč
    const newKeyPair = await this.generateNewKeyPair();

    // Odstranit staré expirované klíče
    for (const [kid, keyPair] of this.localKeys.entries()) {
      if (new Date(keyPair.expiresAt) < new Date() && kid !== newKeyPair.kid) {
        this.localKeys.delete(kid);
        await fs.unlink(path.join(this.keysPath, `${kid}.json`));
        logger.info(`Removed expired key: ${kid}`);
      }
    }

    logger.info('Key rotation completed');
  }

  /**
   * Získání aktuálního privátního klíče pro podepisování
   */
  public getCurrentPrivateKey(): string | null {
    if (!this.currentKeyId) return null;

    const keyPair = this.localKeys.get(this.currentKeyId);
    return keyPair ? keyPair.privateKey : null;
  }

  /**
   * Získání aktuálního key ID
   */
  public getCurrentKeyId(): string | null {
    return this.currentKeyId;
  }

  /**
   * Získání veřejného klíče podle key ID
   */
  public async getPublicKey(kid: string): Promise<string | null> {
    if (this.jwksClient) {
      // Externí JWKS
      try {
        const key = await this.jwksClient.getSigningKey(kid);
        return key.getPublicKey();
      } catch (error) {
        logger.error(`Failed to get public key for kid: ${kid}`, error);
        return null;
      }
    } else {
      // Lokální klíče
      const keyPair = this.localKeys.get(kid);
      return keyPair ? keyPair.publicKey : null;
    }
  }

  /**
   * Získání JWKS pro veřejný endpoint
   */
  public getJWKS(): any {
    const keys = Array.from(this.localKeys.values()).map((keyPair) => {
      const keyObject = crypto.createPublicKey(keyPair.publicKey);
      const jwk = keyObject.export({ format: 'jwk' });

      return {
        ...jwk,
        kid: keyPair.kid,
        alg: keyPair.algorithm,
        use: 'sig',
      };
    });

    return { keys };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }
  }
}

// Singleton instance
let keyManager: JWTKeyManager | null = null;

/**
 * Získání instance key manageru
 */
export function getKeyManager(): JWTKeyManager {
  if (!keyManager) {
    keyManager = new JWTKeyManager({
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      localKeys: !config.auth.jwksUri,
      jwksUri: config.auth.jwksUri,
    });
  }

  return keyManager;
}

/**
 * Middleware pro validaci JWT s rotovanými klíči
 */
export function validateJWTWithRotation(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError('No token provided', 401);
  }

  // Dekódovat token pro získání kid
  const decoded = jwt.decode(token, { complete: true });

  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new ApiError('Invalid token format', 401);
  }

  const kid = decoded.header.kid;
  const manager = getKeyManager();

  // Získat veřejný klíč
  manager
    .getPublicKey(kid)
    .then((publicKey) => {
      if (!publicKey) {
        throw new ApiError('Unknown key ID', 401);
      }

      // Verifikovat token
      jwt.verify(token, publicKey, { algorithms: ['RS256', 'RS384', 'RS512'] }, (err, payload) => {
        if (err) {
          throw new ApiError('Invalid token', 401);
        }

        (req as any).user = payload;
        next();
      });
    })
    .catch(next);
}

/**
 * Funkce pro podepsání JWT s rotovanými klíči
 */
export function signJWTWithRotation(payload: any, options?: jwt.SignOptions): string | null {
  const manager = getKeyManager();
  const privateKey = manager.getCurrentPrivateKey();
  const kid = manager.getCurrentKeyId();

  if (!privateKey || !kid) {
    logger.error('No private key available for signing');
    return null;
  }

  return jwt.sign(payload, privateKey, {
    ...options,
    algorithm: 'RS256',
    keyid: kid,
  });
}

/**
 * Express route pro JWKS endpoint
 */
export function jwksEndpoint(req: Request, res: Response): void {
  const manager = getKeyManager();
  const jwks = manager.getJWKS();

  res.json(jwks);
}

/**
 * Express route pro manuální rotaci klíčů (admin only)
 */
export async function rotateKeysEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const manager = getKeyManager();
    await manager.rotateKeys();

    res.json({
      message: 'Keys rotated successfully',
      currentKeyId: manager.getCurrentKeyId(),
    });
  } catch (error) {
    logger.error('Manual key rotation failed', error);
    res.status(500).json({ error: 'Key rotation failed' });
  }
}
