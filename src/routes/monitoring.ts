import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import redisService from '../services/redisService';
import mongoose from 'mongoose';
import logger, { logUserActivity } from '../utils/logger';
import { 
  getAnalyticsSummary, 
  getDetailedAnalytics, 
  clearAnalytics, 
  checkAlerts 
} from '../middleware/analytics';

const router = express.Router();

/**
 * GET /api/monitoring/status - System status overview
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const status = {
    system: {
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: 'unknown',
    },
  };

  // Check Redis status
  try {
    const isReady = redisService.isReady();
    status.services.redis = isReady ? 'connected' : 'disconnected';
  } catch (error) {
    status.services.redis = 'disconnected';
  }

  return sendSuccess(res, status, 'System status retrieved successfully');
}));

/**
 * GET /api/monitoring/performance - Performance metrics
 */
router.get('/performance', asyncHandler(async (req: Request, res: Response) => {
  const metrics = {
    process: {
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
    },
    eventLoop: {
      // Note: In a real production environment, you'd use more sophisticated monitoring
      lag: 'N/A', // Would need @nodejs/pprof or similar for real metrics
    },
    cache: {
      status: 'unknown',
      hitRate: 'N/A',
    },
    requests: {
      total: 'N/A', // Would track this with a counter in production
      errors: 'N/A',
      avgResponseTime: 'N/A',
    },
  };

  // Try to get cache stats
  try {
    const stats = await redisService.getStats();
    metrics.cache.status = 'connected';
    metrics.cache.hitRate = `${stats.keyCount} keys`;
  } catch (error) {
    metrics.cache.status = 'disconnected';
  }

  return sendSuccess(res, metrics, 'Performance metrics retrieved successfully');
}));

/**
 * GET /api/monitoring/health - Detailed health check
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unknown', responseTime: 0 },
      redis: { status: 'unknown', responseTime: 0 },
      memory: { status: 'healthy', usage: 0 },
      disk: { status: 'unknown', usage: 'N/A' },
    },
  };

  // Database health check
  const dbStart = Date.now();
  try {
    if (mongoose.connection.readyState === 1) {
      // Simple connection check instead of admin ping
      const collections = await mongoose.connection.db?.listCollections().toArray();
      health.checks.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
      };
    } else {
      health.checks.database = { status: 'unhealthy', responseTime: 0 };
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.database = { status: 'unhealthy', responseTime: Date.now() - dbStart };
    health.status = 'degraded';
  }

  // Redis health check
  const redisStart = Date.now();
  try {
    const isReady = redisService.isReady();
    health.checks.redis = {
      status: isReady ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - redisStart,
    };
    if (!isReady) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.redis = { status: 'unhealthy', responseTime: Date.now() - redisStart };
    health.status = 'degraded';
  }

  // Memory health check
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  health.checks.memory = {
    status: memUsagePercent > 90 ? 'critical' : memUsagePercent > 75 ? 'warning' : 'healthy',
    usage: Math.round(memUsagePercent),
  };

  if (health.checks.memory.status === 'critical') {
    health.status = 'critical';
  } else if (health.checks.memory.status === 'warning' && health.status === 'healthy') {
    health.status = 'warning';
  }

  return sendSuccess(res, health, 'Detailed health check completed');
}));

/**
 * POST /api/monitoring/cache/clear - Clear application cache (admin only)
 */
router.post('/cache/clear', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // Note: In production, you'd want admin role checking here
  
  try {
    // Clear all cache keys with common prefixes
    const patterns = ['translation:*', 'plant:*', 'user_profile:*', 'status:*'];
    let clearedCount = 0;

    for (const pattern of patterns) {
      const keys = await redisService.getKeys(pattern);
      if (keys.length > 0) {
        // Delete keys individually since we don't have a bulk delete method
        for (const key of keys) {
          await redisService.delete(key);
        }
        clearedCount += keys.length;
      }
    }

    logger.info('Cache cleared by admin', {
      requestId: req.requestId,
      userId: req.user?.userId,
      clearedCount,
    });

    return sendSuccess(res, { clearedCount }, 'Cache cleared successfully');
  } catch (error) {
    logger.error('Cache clear failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw new Error('Failed to clear cache');
  }
}));

/**
 * GET /api/monitoring/analytics - Request analytics and performance data
 */
router.get('/analytics', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logUserActivity('viewed_analytics', req.user?.userId || 'unknown', {
    requestId: req.requestId,
  });

  const analytics = getAnalyticsSummary();
  const alerts = checkAlerts();

  return sendSuccess(res, {
    ...analytics,
    alerts,
  }, 'Analytics data retrieved successfully');
}));

/**
 * GET /api/monitoring/analytics/detailed - Detailed analytics for specific time range
 */
router.get('/analytics/detailed', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { startTime, endTime, limit } = req.query;
  
  const start = startTime ? parseInt(startTime as string) : undefined;
  const end = endTime ? parseInt(endTime as string) : undefined;
  
  const analytics = getDetailedAnalytics(start, end);
  
  // Limit results if requested
  if (limit) {
    const limitNum = parseInt(limit as string);
    analytics.entries = analytics.entries.slice(-limitNum);
  }

  logUserActivity('viewed_detailed_analytics', req.user?.userId || 'unknown', {
    requestId: req.requestId,
    timeRange: { start, end },
    resultCount: analytics.entries.length,
  });

  return sendSuccess(res, analytics, 'Detailed analytics retrieved successfully');
}));

/**
 * POST /api/monitoring/analytics/clear - Clear analytics data (admin only)
 */
router.post('/analytics/clear', authenticate, asyncHandler(async (req: Request, res: Response) => {
  clearAnalytics();
  
  logUserActivity('cleared_analytics', req.user?.userId || 'unknown', {
    requestId: req.requestId,
    level: 'admin',
  });

  return sendSuccess(res, { cleared: true }, 'Analytics data cleared successfully');
}));

/**
 * GET /api/monitoring/alerts - Current system alerts
 */
router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const alerts = checkAlerts();
  
  return sendSuccess(res, { alerts, count: alerts.length }, 'System alerts retrieved successfully');
}));

/**
 * GET /api/monitoring/dashboard - Comprehensive admin dashboard data
 */
router.get('/dashboard', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logUserActivity('viewed_admin_dashboard', req.user?.userId || 'unknown', {
    requestId: req.requestId,
  });

  // Gather all dashboard data
  const [
    systemStatus,
    analytics,
    alerts,
    cacheStats
  ] = await Promise.allSettled([
    // System status
    Promise.resolve({
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
      },
      services: {
        database: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
        redis: redisService.isReady() ? 'healthy' : 'unhealthy',
      },
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    }),
    
    // Analytics summary
    Promise.resolve(getAnalyticsSummary()),
    
    // Current alerts
    Promise.resolve(checkAlerts()),
    
    // Cache statistics
    redisService.getStats().catch(() => ({ 
      keyCount: 0, 
      memoryUsage: 'N/A', 
      status: 'unavailable' 
    })),
  ]);

  const dashboard = {
    timestamp: new Date().toISOString(),
    system: systemStatus.status === 'fulfilled' ? systemStatus.value : { error: 'Failed to load' },
    analytics: analytics.status === 'fulfilled' ? analytics.value : { error: 'Failed to load' },
    alerts: {
      active: alerts.status === 'fulfilled' ? alerts.value : [],
      count: alerts.status === 'fulfilled' ? alerts.value.length : 0,
    },
    cache: cacheStats.status === 'fulfilled' ? cacheStats.value : { error: 'Failed to load' },
    summary: {
      overallHealth: 
        (systemStatus.status === 'fulfilled' && 
         systemStatus.value.services.database === 'healthy' && 
         systemStatus.value.services.redis === 'healthy') ? 'healthy' : 'degraded',
      criticalAlerts: alerts.status === 'fulfilled' 
        ? alerts.value.filter(alert => alert.severity === 'critical').length 
        : 0,
      requestsLastHour: analytics.status === 'fulfilled' 
        ? analytics.value.summary.recentRequests 
        : 0,
    },
  };

  return sendSuccess(res, dashboard, 'Admin dashboard data retrieved successfully');
}));

/**
 * GET /api/monitoring/logs - Recent application logs (admin only)
 */
router.get('/logs', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // Note: In production, you'd want admin role checking here
  
  const { level = 'info', limit = 100 } = req.query;
  
  // This is a simplified version - in production you'd read from log files or log aggregation service
  const logs = {
    message: 'Log retrieval not fully implemented in this demo',
    note: 'In production, this would integrate with your logging infrastructure',
    parameters: {
      level,
      limit,
      requestId: req.requestId,
    },
  };

  return sendSuccess(res, logs, 'Logs endpoint accessed (demo mode)');
}));

export default router;
