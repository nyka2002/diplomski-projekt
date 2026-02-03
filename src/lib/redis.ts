/**
 * Redis Client
 *
 * Provides two clients:
 * 1. ioredis - For persistent connections (worker, BullMQ)
 * 2. Upstash REST - For serverless environments (Vercel)
 */

import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { env } from './env';

// ============================================
// ioredis Client (for persistent connections)
// ============================================

let redis: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  redis.on('error', (error) => {
    console.error('Redis connection error:', error.message);
  });

  redis.on('connect', () => {
    console.log('✅ Redis (ioredis) connected successfully');
  });

  redis.connect().catch((error) => {
    console.warn('⚠️  Redis unavailable:', error.message);
    redis = null;
  });
} else {
  console.warn(
    '⚠️  REDIS_URL not configured - caching disabled. Set REDIS_URL in .env.local'
  );
}

export default redis;

// ============================================
// Upstash REST Client (for serverless)
// ============================================

let upstashRedis: UpstashRedis | null = null;

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (upstashUrl && upstashToken) {
  upstashRedis = new UpstashRedis({
    url: upstashUrl,
    token: upstashToken,
  });
  console.log('✅ Upstash Redis client initialized');
}

export { upstashRedis };

// ============================================
// Unified Cache Interface
// ============================================

/**
 * Cache interface that works with either ioredis or Upstash
 * Prefers Upstash in serverless, falls back to ioredis
 */
export const cache = {
  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (upstashRedis) {
        return await upstashRedis.get<T>(key);
      }
      if (redis) {
        const value = await redis.get(key);
        return value ? JSON.parse(value) : null;
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  /**
   * Set a value in cache with optional TTL (seconds)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      if (upstashRedis) {
        if (ttlSeconds) {
          await upstashRedis.setex(key, ttlSeconds, JSON.stringify(value));
        } else {
          await upstashRedis.set(key, JSON.stringify(value));
        }
        return true;
      }
      if (redis) {
        if (ttlSeconds) {
          await redis.setex(key, ttlSeconds, JSON.stringify(value));
        } else {
          await redis.set(key, JSON.stringify(value));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  },

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      if (upstashRedis) {
        await upstashRedis.del(key);
        return true;
      }
      if (redis) {
        await redis.del(key);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Cache del error:', error);
      return false;
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (upstashRedis) {
        const result = await upstashRedis.exists(key);
        return result === 1;
      }
      if (redis) {
        const result = await redis.exists(key);
        return result === 1;
      }
      return false;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  },

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number | null> {
    try {
      if (upstashRedis) {
        return await upstashRedis.incr(key);
      }
      if (redis) {
        return await redis.incr(key);
      }
      return null;
    } catch (error) {
      console.error('Cache incr error:', error);
      return null;
    }
  },

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (upstashRedis) {
        await upstashRedis.expire(key, seconds);
        return true;
      }
      if (redis) {
        await redis.expire(key, seconds);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  },

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return upstashRedis !== null || redis !== null;
  },

  /**
   * Get which client is being used
   */
  getClientType(): 'upstash' | 'ioredis' | 'none' {
    if (upstashRedis) return 'upstash';
    if (redis) return 'ioredis';
    return 'none';
  },
};
