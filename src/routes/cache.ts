import express from 'express';
import redisService from '../services/redisService';
import logger from '../utils/logger';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/cache/status - Get cache status and statistics
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await redisService.getStats();

    res.json({
      success: true,
      cache: {
        enabled: redisService.isReady(),
        provider: 'Redis',
        status: stats.isConnected ? 'connected' : 'disconnected',
        statistics: stats,
        endpoints: {
          '/api/cache/status': 'Get cache status',
          '/api/cache/stats': 'Get detailed cache statistics',
          '/api/cache/clear': 'Clear all cache (requires authentication)',
          '/api/cache/clear/:pattern': 'Clear cache by pattern (requires authentication)',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting cache status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache status',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/cache/stats - Get detailed cache statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await redisService.getStats();

    res.json({
      success: true,
      statistics: {
        connection: {
          isConnected: stats.isConnected,
          status: stats.isConnected ? 'healthy' : 'disconnected',
        },
        performance: {
          keyCount: stats.keyCount,
          memoryUsage: stats.memoryUsage,
        },
        configuration: {
          ttl: stats.config,
          keyPrefixes: {
            userProfiles: 'user:profile:*',
            aiResponses: 'ai:response:*',
            weeklyTips: 'ai:weekly-tips:*',
            diagnosis: 'ai:diagnosis:*',
            registrationOptions: 'registration:options',
          },
        },
        cacheTypes: {
          userProfiles: {
            ttl: stats.config.userProfileTTL,
            description: 'Cached user profile data',
          },
          aiResponses: {
            ttl: stats.config.aiResponseTTL,
            description: 'Cached AI farming advice responses',
          },
          registrationOptions: {
            ttl: stats.config.registrationOptionsTTL,
            description: 'Cached registration form options',
          },
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/cache/clear - Clear all cache (requires authentication)
 */
router.delete('/clear', authenticate, async (req, res) => {
  try {
    if (!redisService.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Cache service is not available',
        timestamp: new Date().toISOString(),
      });
    }

    await redisService.flushAll();

    logger.info(`Cache cleared by user: ${req.user?.email}`);

    res.json({
      success: true,
      message: 'All cache cleared successfully',
      clearedBy: req.user?.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/cache/clear/:pattern - Clear cache by pattern (requires authentication)
 */
router.delete('/clear/:pattern', authenticate, async (req, res) => {
  try {
    const { pattern } = req.params;

    if (!redisService.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Cache service is not available',
        timestamp: new Date().toISOString(),
      });
    }

    // Decode the pattern (in case it's URL encoded)
    const decodedPattern = decodeURIComponent(pattern);

    // Validate pattern to prevent accidental clearing of critical data
    const allowedPatterns = [
      'user:profile:*',
      'ai:response:*',
      'ai:weekly-tips:*',
      'ai:diagnosis:*',
      'registration:options',
      'cache:*',
    ];

    const isAllowed = allowedPatterns.some((allowed) =>
      decodedPattern.startsWith(allowed.replace('*', '')),
    );

    if (!isAllowed) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cache pattern. Allowed patterns: ' + allowedPatterns.join(', '),
        timestamp: new Date().toISOString(),
      });
    }

    await redisService.deletePattern(decodedPattern);

    logger.info(`Cache pattern "${decodedPattern}" cleared by user: ${req.user?.email}`);

    res.json({
      success: true,
      message: `Cache pattern "${decodedPattern}" cleared successfully`,
      pattern: decodedPattern,
      clearedBy: req.user?.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error clearing cache pattern:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache pattern',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/cache/keys/:pattern - Get keys matching pattern (requires authentication)
 */
router.get('/keys/:pattern', authenticate, async (req, res) => {
  try {
    const { pattern } = req.params;

    if (!redisService.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Cache service is not available',
        timestamp: new Date().toISOString(),
      });
    }

    const decodedPattern = decodeURIComponent(pattern);

    // This is a simplified implementation - in production, you might want to use SCAN for large datasets
    const keys = await redisService.getKeys(decodedPattern);

    res.json({
      success: true,
      pattern: decodedPattern,
      keys: keys,
      count: keys.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting cache keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache keys',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/cache/warm - Warm up cache with common data (requires authentication)
 */
router.post('/warm', authenticate, async (req, res) => {
  try {
    if (!redisService.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Cache service is not available',
        timestamp: new Date().toISOString(),
      });
    }

    // Warm up registration options
    const registrationOptions = {
      agricultureTypes: [
        'Organic Farming',
        'Conventional Farming',
        'Sustainable Agriculture',
        'Permaculture',
        'Hydroponics',
        'Livestock Farming',
        'Dairy Farming',
        'Poultry Farming',
        'Aquaculture',
        'Mixed Farming',
      ],
      economicScales: [
        'Small Scale (Less than 2 hectares)',
        'Medium Scale (2-10 hectares)',
        'Large Scale (10-50 hectares)',
        'Commercial Scale (50+ hectares)',
        'Subsistence Farming',
        'Semi-Commercial',
      ],
      states: [
        'Province 1',
        'Province 2',
        'Bagmati Province',
        'Gandaki Province',
        'Lumbini Province',
        'Karnali Province',
        'Sudurpashchim Province',
      ],
    };

    await redisService.set(
      redisService.generateRegistrationOptionsKey(),
      { message: 'Registration options retrieved successfully', options: registrationOptions },
      redisService.getRegistrationOptionsTTL(),
    );

    logger.info(`Cache warmed up by user: ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Cache warmed up successfully',
      warmedUp: ['registration options'],
      warmedBy: req.user?.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error warming up cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to warm up cache',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
