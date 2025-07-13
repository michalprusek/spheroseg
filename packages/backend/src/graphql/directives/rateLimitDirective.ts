import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { GraphQLSchema, GraphQLFieldConfig, GraphQLError } from 'graphql';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Context } from '../context';

// Store rate limiters by key
const rateLimiters = new Map<string, RateLimiterMemory>();

function getRateLimiter(key: string, max: number, window: string): RateLimiterMemory {
  const cacheKey = `${key}-${max}-${window}`;
  
  if (!rateLimiters.has(cacheKey)) {
    // Parse window duration (e.g., "15m", "1h", "1d")
    const duration = parseDuration(window);
    
    rateLimiters.set(cacheKey, new RateLimiterMemory({
      points: max,
      duration: duration / 1000, // Convert to seconds
      keyPrefix: key,
    }));
  }
  
  return rateLimiters.get(cacheKey)!;
}

function parseDuration(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid rate limit window: ${window}`);
  }
  
  const [, value, unit] = match;
  const num = parseInt(value, 10);
  
  switch (unit) {
    case 's': return num * 1000; // seconds
    case 'm': return num * 60 * 1000; // minutes
    case 'h': return num * 60 * 60 * 1000; // hours
    case 'd': return num * 24 * 60 * 60 * 1000; // days
    default: throw new Error(`Invalid time unit: ${unit}`);
  }
}

export function rateLimitDirective(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig: GraphQLFieldConfig<any, any>) => {
      const rateLimitDirective = getDirective(schema, fieldConfig, 'rateLimit')?.[0];

      if (rateLimitDirective) {
        const { max, window } = rateLimitDirective;
        const { resolve = () => null } = fieldConfig;

        fieldConfig.resolve = async function (source, args, context: Context, info) {
          // Get rate limit key (use user ID if authenticated, otherwise IP)
          const key = context.user 
            ? `user-${context.user.id}` 
            : `ip-${context.req.ip}`;
          
          const fieldKey = `${info.parentType.name}.${info.fieldName}`;
          const rateLimiter = getRateLimiter(fieldKey, max, window);

          try {
            await rateLimiter.consume(key);
          } catch (rejRes) {
            const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
            throw new GraphQLError(
              `Too many requests. Please try again in ${secs} seconds.`,
              {
                extensions: {
                  code: 'RATE_LIMITED',
                  http: { status: 429 },
                  retryAfter: secs,
                }
              }
            );
          }

          // Call original resolver
          return resolve(source, args, context, info);
        };
      }

      return fieldConfig;
    },
  });
}