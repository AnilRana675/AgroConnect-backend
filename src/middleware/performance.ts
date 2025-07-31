import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import logger from '../utils/logger';

/**
 * Compression middleware with smart filtering
 */
export const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,

  // Compression level (1-9, 6 is default balance of speed vs compression)
  level: 6,

  // Custom filter function
  filter: (req: Request, res: Response) => {
    // Don't compress if the client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Always compress JSON responses
    if (res.get('Content-Type')?.includes('application/json')) {
      return true;
    }

    // Use compression's default filter for other content types
    return compression.filter(req, res);
  },

  // Memory level (1-9, affects memory usage vs speed)
  memLevel: 8,
});

/**
 * Cache control headers middleware
 */
export const cacheControlMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Default cache settings
  let cacheControl = 'no-cache';
  let maxAge = 0;

  // Static assets (if serving any)
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    cacheControl = 'public, max-age=31536000'; // 1 year
    maxAge = 31536000;
  }
  // API responses that can be cached
  else if (
    req.path.includes('/api/translation/languages') ||
    req.path.includes('/api/auth/status')
  ) {
    cacheControl = 'public, max-age=300'; // 5 minutes
    maxAge = 300;
  }
  // User-specific data
  else if (req.path.includes('/api/auth/me') || req.path.includes('/api/users/')) {
    cacheControl = 'private, max-age=60'; // 1 minute, private cache only
    maxAge = 60;
  }
  // Default for API responses
  else if (req.path.startsWith('/api/')) {
    cacheControl = 'no-cache, no-store, must-revalidate';
    maxAge = 0;
  }

  // Set cache headers
  res.set({
    'Cache-Control': cacheControl,
    Expires: new Date(Date.now() + maxAge * 1000).toUTCString(),
    Vary: 'Accept-Encoding, Authorization',
  });

  next();
};

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Store original method
  const originalJson = res.json;

  // Override res.json to capture response time
  res.json = function (body?: any) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Log slow requests (> 1 second)
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        contentLength: JSON.stringify(body).length,
      });
    }

    // Add performance headers
    res.set({
      'X-Response-Time': `${responseTime}ms`,
      'X-Powered-By': 'AgroConnect API',
    });

    // Log performance metrics
    logger.http('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Call original method
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Request size limiting middleware
 */
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction) => {
  // Skip for file uploads or specific routes
  if (req.path.includes('/upload') || req.path.includes('/plant/analyze')) {
    return next();
  }

  const contentLength = parseInt(req.get('content-length') || '0');

  // Limit regular API requests to 10MB
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    logger.warn('Request size limit exceeded', {
      requestId: req.requestId,
      contentLength,
      maxSize,
      url: req.url,
    });

    return res.status(413).json({
      success: false,
      error: {
        message: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        statusCode: 413,
        maxSize: `${maxSize / (1024 * 1024)}MB`,
      },
    });
  }

  next();
};

/**
 * Health check optimization
 */
export const healthCheckCache = new Map<string, { data: any; timestamp: number }>();

export const optimizedHealthCheck = (req: Request, res: Response) => {
  const cacheKey = 'health-status';
  const cached = healthCheckCache.get(cacheKey);
  const now = Date.now();

  // Use cached response if it's fresher than 30 seconds
  if (cached && now - cached.timestamp < 30000) {
    return res.json(cached.data);
  }

  // Generate fresh health data
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  };

  // Cache the result
  healthCheckCache.set(cacheKey, {
    data: healthData,
    timestamp: now,
  });

  res.json(healthData);
};
