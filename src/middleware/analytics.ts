import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import redisService from '../services/redisService';

// Global analytics counters
let requestCounter = 0;
let errorCounter = 0;
let responseTimes: number[] = [];
const analyticsWindow = 5 * 60 * 1000; // 5 minutes

// Request analytics interface
interface RequestAnalytics {
  timestamp: number;
  method: string;
  url: string;
  statusCode?: number;
  responseTime: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  error?: string;
}

// Analytics storage
const analytics: RequestAnalytics[] = [];
const maxAnalyticsEntries = 10000; // Keep last 10k requests in memory

/**
 * Enhanced analytics middleware
 */
export const analyticsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  requestCounter++;

  // Store original json method
  const originalJson = res.json;
  
  res.json = function(body: any) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Track response times for average calculation
    responseTimes.push(responseTime);
    if (responseTimes.length > 1000) {
      responseTimes = responseTimes.slice(-500); // Keep last 500
    }

    // Track errors
    if (res.statusCode >= 400) {
      errorCounter++;
    }

    // Create analytics entry
    const analyticsEntry: RequestAnalytics = {
      timestamp: startTime,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userId: req.user?.userId,
      ...(res.statusCode >= 400 && { error: body?.error?.message || 'Unknown error' }),
    };

    // Store in memory (circular buffer)
    analytics.push(analyticsEntry);
    if (analytics.length > maxAnalyticsEntries) {
      analytics.shift(); // Remove oldest entry
    }

    // Log detailed analytics for errors and slow requests
    if (res.statusCode >= 400 || responseTime > 2000) {
      logger.warn('Request requires attention', {
        requestId: req.requestId,
        ...analyticsEntry,
        level: res.statusCode >= 400 ? 'error' : 'performance',
      });
    }

    // Store analytics in Redis for persistence (async, don't block response)
    storeAnalyticsAsync(analyticsEntry).catch(error => {
      logger.error('Failed to store analytics in Redis', { error: error.message });
    });

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Store analytics data in Redis (async)
 */
const storeAnalyticsAsync = async (entry: RequestAnalytics): Promise<void> => {
  try {
    const key = `analytics:${new Date().toISOString().split('T')[0]}`; // Daily key
    const value = JSON.stringify(entry);
    
    // Store as list entry with TTL of 7 days
    await redisService.set(`${key}:${Date.now()}`, value, 7 * 24 * 60 * 60);
  } catch (error) {
    // Silently fail - analytics shouldn't break the app
  }
};

/**
 * Get current analytics summary
 */
export const getAnalyticsSummary = () => {
  const now = Date.now();
  const windowStart = now - analyticsWindow;
  
  // Filter recent requests
  const recentRequests = analytics.filter(entry => entry.timestamp >= windowStart);
  const recentErrors = recentRequests.filter(entry => entry.statusCode && entry.statusCode >= 400);
  
  // Calculate averages
  const avgResponseTime = responseTimes.length > 0 
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  // Top endpoints
  const endpointCounts = recentRequests.reduce((acc, req) => {
    const endpoint = `${req.method} ${req.url.split('?')[0]}`;
    acc[endpoint] = (acc[endpoint] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topEndpoints = Object.entries(endpointCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }));

  // Error distribution
  const errorTypes = recentErrors.reduce((acc, req) => {
    const status = req.statusCode?.toString() || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Response time percentiles
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

  return {
    summary: {
      totalRequests: requestCounter,
      totalErrors: errorCounter,
      recentRequests: recentRequests.length,
      recentErrors: recentErrors.length,
      errorRate: recentRequests.length > 0 
        ? Math.round((recentErrors.length / recentRequests.length) * 100 * 100) / 100
        : 0,
      avgResponseTime,
    },
    performance: {
      responseTime: {
        average: avgResponseTime,
        p50,
        p95,
        p99,
      },
    },
    traffic: {
      topEndpoints,
      errorDistribution: errorTypes,
    },
    timeWindow: {
      windowMinutes: analyticsWindow / (60 * 1000),
      from: new Date(windowStart).toISOString(),
      to: new Date(now).toISOString(),
    },
  };
};

/**
 * Get detailed analytics for specific time range
 */
export const getDetailedAnalytics = (startTime?: number, endTime?: number) => {
  const start = startTime || (Date.now() - analyticsWindow);
  const end = endTime || Date.now();
  
  const filtered = analytics.filter(entry => 
    entry.timestamp >= start && entry.timestamp <= end
  );

  return {
    entries: filtered,
    count: filtered.length,
    timeRange: {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    },
  };
};

/**
 * Clear analytics data (for testing/admin purposes)
 */
export const clearAnalytics = () => {
  analytics.length = 0;
  responseTimes.length = 0;
  requestCounter = 0;
  errorCounter = 0;
  logger.info('Analytics data cleared');
};

/**
 * Real-time alerts for critical issues
 */
export const checkAlerts = () => {
  const summary = getAnalyticsSummary();
  const alerts = [];

  // High error rate alert
  if (summary.summary.errorRate > 10) {
    alerts.push({
      type: 'high_error_rate',
      severity: 'critical',
      message: `Error rate is ${summary.summary.errorRate}% (>${10}%)`,
      value: summary.summary.errorRate,
    });
  }

  // High response time alert
  if (summary.performance.responseTime.p95 > 5000) {
    alerts.push({
      type: 'high_response_time',
      severity: 'warning',
      message: `95th percentile response time is ${summary.performance.responseTime.p95}ms (>5000ms)`,
      value: summary.performance.responseTime.p95,
    });
  }

  // High traffic alert
  if (summary.summary.recentRequests > 1000) {
    alerts.push({
      type: 'high_traffic',
      severity: 'info',
      message: `High traffic detected: ${summary.summary.recentRequests} requests in last 5 minutes`,
      value: summary.summary.recentRequests,
    });
  }

  return alerts;
};
