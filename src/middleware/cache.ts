import { Request, Response, NextFunction } from 'express';
import redisService from '../services/redisService';
import logger from '../utils/logger';
import crypto from 'crypto';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  vary?: string[]; // Headers to vary cache by
  skipCache?: (req: Request) => boolean;
}

// Advanced cache configuration
interface CacheConfig {
  ttl: number;
  keyPrefix: string;
  vary?: string[];
  skipCache?: (req: Request) => boolean;
  generateKey?: (req: Request) => string;
}

// Default cache configurations for different route patterns
const cacheConfigs: Record<string, CacheConfig> = {
  '/api/translation': {
    ttl: 3600, // 1 hour
    keyPrefix: 'translation',
    vary: ['Accept-Language'],
  },
  '/api/plant': {
    ttl: 1800, // 30 minutes  
    keyPrefix: 'plant',
    skipCache: (req) => req.method !== 'GET',
  },
  '/api/auth/me': {
    ttl: 300, // 5 minutes
    keyPrefix: 'user_profile',
    vary: ['Authorization'],
  },
  '/api/auth/status': {
    ttl: 1800, // 30 minutes
    keyPrefix: 'status',
  },
};

/**
 * Generate smart cache key based on request
 */
const generateSmartCacheKey = (req: Request, config: CacheConfig): string => {
  if (config.generateKey) {
    return `${config.keyPrefix}:${config.generateKey(req)}`;
  }

  let keyData = `${req.method}:${req.path}`;
  
  // Add query parameters
  if (Object.keys(req.query).length > 0) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('&');
    keyData += `?${sortedQuery}`;
  }
  
  // Add varying headers
  if (config.vary) {
    config.vary.forEach(header => {
      const value = req.get(header);
      if (value) keyData += `:${header}:${value}`;
    });
  }
  
  // Add user ID for user-specific caches
  if (req.user?.userId && config.keyPrefix.includes('user')) {
    keyData += `:user:${req.user.userId}`;
  }
  
  const hash = crypto.createHash('md5').update(keyData).digest('hex');
  return `${config.keyPrefix}:${hash}`;
};

/**
 * Cache middleware for GET requests
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = options.keyGenerator
        ? options.keyGenerator(req)
        : `cache:${req.method}:${req.originalUrl}`;

      // Try to get from cache
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        logger.debug(`Cache hit for ${cacheKey}`);
        return res.json({
          ...cachedData,
          cached: true,
          cacheKey,
        });
      }

      // If not in cache, intercept the response
      const originalSend = res.json;
      res.json = function (data: unknown) {
        // Cache the response
        const ttl = options.ttl || 300; // 5 minutes default
        redisService.set(cacheKey, data, ttl).catch((error) => {
          logger.error(`Failed to cache response for ${cacheKey}:`, error);
        });

        // Add cache info to response
        if (typeof data === 'object' && data !== null) {
          (data as Record<string, unknown>).cached = false;
          (data as Record<string, unknown>).cacheKey = cacheKey;
        }

        // Call original send
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next(); // Continue without caching
    }
  };
};

/**
 * Cache invalidation middleware
 */
export const invalidateCacheMiddleware = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original response methods
    const originalSend = res.json;
    const originalEnd = res.end;

    // Intercept successful responses
    res.json = function (data: unknown) {
      // Invalidate cache patterns after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach((pattern) => {
          redisService.deletePattern(pattern).catch((error) => {
            logger.error(`Failed to invalidate cache pattern ${pattern}:`, error);
          });
        });
      }

      return originalSend.call(this, data);
    };

    res.end = function (data?: unknown) {
      // Invalidate cache patterns after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach((pattern) => {
          redisService.deletePattern(pattern).catch((error) => {
            logger.error(`Failed to invalidate cache pattern ${pattern}:`, error);
          });
        });
      }

      return originalEnd.call(this, data, 'utf8');
    };

    next();
  };
};

/**
 * User profile cache invalidation
 */
export const invalidateUserCache = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.userId || req.params.userId || req.params.id;

  if (userId) {
    return invalidateCacheMiddleware([`user:profile:${userId}`, `ai:weekly-tips:${userId}:*`])(
      req,
      res,
      next,
    );
  }

  next();
};

/**
 * AI response cache invalidation
 */
export const invalidateAICache = (req: Request, res: Response, next: NextFunction) => {
  return invalidateCacheMiddleware(['ai:response:*', 'ai:diagnosis:*'])(req, res, next);
};

/**
 * Registration options cache invalidation
 */
export const invalidateRegistrationCache = (req: Request, res: Response, next: NextFunction) => {
  return invalidateCacheMiddleware(['registration:options'])(req, res, next);
};
