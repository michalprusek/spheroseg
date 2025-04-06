import { config } from '../config/app';

/**
 * Check if the current environment is production.
 */
export function isProduction(): boolean {
  return config.server.env === 'production';
}

/**
 * Validate the Redis URL scheme.
 * Throws an error in production if invalid.
 * Logs a warning in development or test.
 */
export function validateRedisUrl(redisUrl: string): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(redisUrl);
  } catch (err) {
    const message = `Invalid REDIS_URL format: ${redisUrl}`;
    if (isProduction()) {
      throw new Error(message);
    } else {
      console.warn(message);
      return;
    }
  }

  const scheme = parsedUrl.protocol.replace(':', '');
  if (scheme !== 'redis' && scheme !== 'rediss') {
    const message = `Unsupported Redis URL scheme "${scheme}". Only "redis" and "rediss" are allowed.`;
    if (isProduction()) {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }
}