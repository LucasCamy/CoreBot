import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

class RedisManager {
  private static client: Redis | null = null;

  public static getClient(): Redis {
    if (!RedisManager.client) {
      RedisManager.client = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // Required by BullMQ
        retryStrategy: (times) => {
          const delay = Math.min(times * 1000, 15000);
          logger.warn({ attempt: times, delayMs: delay }, 'Reconnecting to Redis...');
          return delay;
        },
      });

      RedisManager.client.on('connect', () => {
        logger.info('Connected to Redis server successfully');
      });

      RedisManager.client.on('error', (err) => {
        logger.error({ err: err.message }, 'Redis connection error encountered');
      });
    }

    return RedisManager.client;
  }

  public static async close(): Promise<void> {
    if (RedisManager.client) {
      await RedisManager.client.quit();
      RedisManager.client = null;
      logger.info('Redis connection closed cleanly');
    }
  }

  public static async ping(): Promise<boolean> {
    try {
      const client = RedisManager.getClient();
      const res = await client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }
}

export const getRedisClient = RedisManager.getClient;
export { RedisManager };
