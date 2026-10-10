import { GuildConfig } from '@prisma/client';
import { logger } from '../../utils/logger.js';

interface CacheEntry {
  data: GuildConfig;
  expiresAt: number;
}

export class GuildCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs: number;

  /**
   * @param defaultTtlMs TTL in milliseconds (default: 5 minutes = 300,000 ms)
   */
  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Retrieve cached GuildConfig or execute fallback supplier and cache result.
   */
  public async getOrSet(
    guildId: string,
    fetcher: () => Promise<GuildConfig | null>,
    ttlMs: number = this.defaultTtlMs,
  ): Promise<GuildConfig | null> {
    const cached = this.get(guildId);
    if (cached) {
      return cached;
    }

    const fresh = await fetcher();
    if (fresh) {
      this.set(guildId, fresh, ttlMs);
    }
    return fresh;
  }

  /**
   * Get cached GuildConfig if present and not expired.
   */
  public get(guildId: string): GuildConfig | null {
    const entry = this.cache.get(guildId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(guildId);
      logger.debug({ guildId }, 'GuildConfig cache entry expired and evicted');
      return null;
    }

    return entry.data;
  }

  /**
   * Set GuildConfig in cache with TTL.
   */
  public set(guildId: string, config: GuildConfig, ttlMs: number = this.defaultTtlMs): void {
    this.cache.set(guildId, {
      data: config,
      expiresAt: Date.now() + ttlMs,
    });
    logger.debug({ guildId, ttlMs }, 'GuildConfig cached in L1 memory');
  }

  /**
   * Actively invalidate cache for a specific guild.
   */
  public invalidate(guildId: string): void {
    const removed = this.cache.delete(guildId);
    if (removed) {
      logger.debug({ guildId }, 'GuildConfig cache invalidated');
    }
  }

  /**
   * Clear all cached guild configurations.
   */
  public clear(): void {
    this.cache.clear();
    logger.debug('GuildConfig L1 cache cleared');
  }

  /**
   * Returns current count of cached entries.
   */
  public size(): number {
    return this.cache.size;
  }
}
