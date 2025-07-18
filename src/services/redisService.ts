import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

interface CacheConfig {
  defaultTTL: number;
  aiResponseTTL: number;
  userProfileTTL: number;
  registrationOptionsTTL: number;
}

type UserProfile = {
  farmerType: string;
  location: string;
  farmingScale: string;
};

interface CacheItem<T = unknown> {
  value: T;
  expireTime: number;
}

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private config: CacheConfig;
  private memoryCache: Map<string, CacheItem> = new Map();
  private useMemoryCache: boolean = false;

  constructor() {
    this.config = {
      defaultTTL: 300, // 5 minutes
      aiResponseTTL: 1800, // 30 minutes for AI responses
      userProfileTTL: 600, // 10 minutes for user profiles
      registrationOptionsTTL: 3600, // 1 hour for registration options
    };

    // Create Redis client
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.error('Redis connection failed after 3 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 500);
        },
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client?.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client?.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready');
    });

    this.client?.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client?.on('end', () => {
      this.isConnected = false;
      logger.info('Redis client disconnected');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      if (!this.isConnected && this.client) {
        await this.client.connect();
      }
    } catch (error) {
      logger.warn('Failed to connect to Redis, using in-memory cache:', error);
      this.useMemoryCache = true;
      this.isConnected = true; // Mark as connected to use memory cache
      logger.info('Switched to in-memory cache mode');
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        await this.client.disconnect();
      }
    } catch (error) {
      logger.error('Failed to disconnect from Redis:', error);
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        return null;
      }

      if (this.useMemoryCache) {
        const item = this.memoryCache.get(key);
        if (!item) {
          logger.debug(`Memory cache miss for key: ${key}`);
          return null;
        }

        // Check if item has expired
        if (Date.now() > item.expireTime) {
          this.memoryCache.delete(key);
          logger.debug(`Memory cache expired for key: ${key}`);
          return null;
        }

        if (item.value === undefined) return null;
        return item.value as T;
      }

      if (!this.client) {
        logger.warn('Redis client not available');
        return null;
      }

      const data = await this.client.get(key);
      if (data) {
        logger.debug(`Redis cache hit for key: ${key}`);
        return JSON.parse(data);
      }

      logger.debug(`Redis cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      const expireTime = ttl || this.config.defaultTTL;

      if (this.useMemoryCache) {
        const expireTimeMs = Date.now() + expireTime * 1000;
        this.memoryCache.set(key, { value, expireTime: expireTimeMs });
        logger.debug(`Memory cache set for key: ${key} with TTL: ${expireTime}s`);
        return;
      }

      if (!this.client) {
        logger.warn('Redis client not available');
        return;
      }

      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, expireTime, serializedValue);
      logger.debug(`Redis cache set for key: ${key} with TTL: ${expireTime}s`);
    } catch (error) {
      logger.error(`Error setting cache for key ${key}:`, error);
    }
  }

  /**
   * Delete data from cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      if (this.useMemoryCache) {
        this.memoryCache.delete(key);
        logger.debug(`Memory cache deleted for key: ${key}`);
        return;
      }

      if (!this.client) {
        logger.warn('Redis client not available');
        return;
      }

      await this.client.del(key);
      logger.debug(`Redis cache deleted for key: ${key}`);
    } catch (error) {
      logger.error(`Error deleting cache for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      if (this.useMemoryCache) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const keysToDelete: string[] = [];

        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach((key) => this.memoryCache.delete(key));
        logger.debug(`Memory cache deleted for pattern: ${pattern} (${keysToDelete.length} keys)`);
        return;
      }

      if (!this.client) {
        logger.warn('Redis client not available');
        return;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug(`Redis cache deleted for pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      if (this.useMemoryCache) {
        const item = this.memoryCache.get(key);
        if (!item) {
          return false;
        }

        // Check if item has expired
        if (Date.now() > item.expireTime) {
          this.memoryCache.delete(key);
          return false;
        }

        return true;
      }

      if (!this.client) {
        logger.warn('Redis client not available');
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking cache existence for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    isConnected: boolean;
    keyCount: number;
    memoryUsage: string;
    config: CacheConfig;
    cacheType: 'redis' | 'memory';
  }> {
    try {
      if (!this.isConnected) {
        return {
          isConnected: false,
          keyCount: 0,
          memoryUsage: '0B',
          config: this.config,
          cacheType: 'memory',
        };
      }

      if (this.useMemoryCache) {
        // Clean up expired items first
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, item] of this.memoryCache.entries()) {
          if (now > item.expireTime) {
            expiredKeys.push(key);
          }
        }

        expiredKeys.forEach((key) => this.memoryCache.delete(key));

        // Calculate approximate memory usage
        const memoryUsageBytes = JSON.stringify(Array.from(this.memoryCache.entries())).length;
        const memoryUsage =
          memoryUsageBytes > 1024 * 1024
            ? `${(memoryUsageBytes / 1024 / 1024).toFixed(2)}MB`
            : memoryUsageBytes > 1024
              ? `${(memoryUsageBytes / 1024).toFixed(2)}KB`
              : `${memoryUsageBytes}B`;

        return {
          isConnected: true,
          keyCount: this.memoryCache.size,
          memoryUsage,
          config: this.config,
          cacheType: 'memory',
        };
      }

      if (!this.client) {
        logger.warn('Redis client not available');
        return {
          isConnected: false,
          keyCount: 0,
          memoryUsage: '0B',
          config: this.config,
          cacheType: 'memory',
        };
      }

      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();

      // Extract memory usage from info string
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : '0B';

      return {
        isConnected: true,
        keyCount,
        memoryUsage,
        config: this.config,
        cacheType: 'redis',
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        isConnected: false,
        keyCount: 0,
        memoryUsage: '0B',
        config: this.config,
        cacheType: 'memory',
      };
    }
  }

  /**
   * Clear all cache
   */
  async flushAll(): Promise<void> {
    try {
      if (!this.isConnected) {
        logger.warn('Cache not connected, skipping cache flush');
        return;
      }

      if (this.useMemoryCache) {
        this.memoryCache.clear();
        logger.info('All memory cache cleared');
        return;
      }

      if (!this.client) {
        logger.warn('Redis client not available');
        return;
      }

      await this.client.flushAll();
      logger.info('All Redis cache cleared');
    } catch (error) {
      logger.error('Error flushing cache:', error);
    }
  }

  /**
   * Get keys matching pattern
   */
  async getKeys(pattern: string): Promise<string[]> {
    try {
      if (!this.isConnected) {
        return [];
      }

      if (this.useMemoryCache) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(this.memoryCache.keys()).filter((key) => regex.test(key));
      }

      if (!this.client) {
        logger.warn('Redis client not available');
        return [];
      }

      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Error getting keys for pattern ${pattern}:`, error);
      return [];
    }
  }

  // Cache key generators
  generateUserProfileKey(userId: string): string {
    return `user:profile:${userId}`;
  }

  generateAIResponseKey(question: string, userProfile?: UserProfile): string {
    const profileHash = userProfile ? JSON.stringify(userProfile) : 'anonymous';
    const hash = Buffer.from(question + profileHash)
      .toString('base64')
      .slice(0, 32);
    return `ai:response:${hash}`;
  }

  generateRegistrationOptionsKey(): string {
    return 'registration:options';
  }

  generateWeeklyTipsKey(userId: string): string {
    const currentWeek = new Date().getFullYear() + '-' + Math.ceil(new Date().getDate() / 7);
    return `ai:weekly-tips:${userId}:${currentWeek}`;
  }

  generateDiagnosisKey(description: string, cropType?: string): string {
    const key = description + (cropType || '');
    const hash = Buffer.from(key).toString('base64').slice(0, 32);
    return `ai:diagnosis:${hash}`;
  }

  // TTL getters
  getAIResponseTTL(): number {
    return this.config.aiResponseTTL;
  }

  getUserProfileTTL(): number {
    return this.config.userProfileTTL;
  }

  getRegistrationOptionsTTL(): number {
    return this.config.registrationOptionsTTL;
  }
}

export default new RedisService();
