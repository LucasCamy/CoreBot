import { describe, it, expect, vi } from 'vitest';
import { GuildCacheService } from '../../src/core/cache/guild-cache.service.js';
import { GuildConfig } from '@prisma/client';

describe('GuildCacheService', () => {
  const mockConfig: GuildConfig = {
    guildId: '123456789012345678',
    timezone: 'America/Sao_Paulo',
    botEnabled: true,
    adminRoleIds: ['role1'],
    backupChannelId: '999888777',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should store and retrieve config from cache', () => {
    const cache = new GuildCacheService(60_000);
    cache.set(mockConfig.guildId, mockConfig);

    const cached = cache.get(mockConfig.guildId);
    expect(cached).toEqual(mockConfig);
    expect(cache.size()).toBe(1);
  });

  it('should return null for non-existing guildId', () => {
    const cache = new GuildCacheService(60_000);
    expect(cache.get('non-existing')).toBeNull();
  });

  it('should invalidate specific guildId', () => {
    const cache = new GuildCacheService(60_000);
    cache.set(mockConfig.guildId, mockConfig);
    expect(cache.get(mockConfig.guildId)).not.toBeNull();

    cache.invalidate(mockConfig.guildId);
    expect(cache.get(mockConfig.guildId)).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('should clear all entries', () => {
    const cache = new GuildCacheService(60_000);
    cache.set('guild1', mockConfig);
    cache.set('guild2', { ...mockConfig, guildId: 'guild2' });
    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('should expire entries after TTL', async () => {
    // 20ms TTL
    const cache = new GuildCacheService(20);
    cache.set(mockConfig.guildId, mockConfig);

    expect(cache.get(mockConfig.guildId)).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(cache.get(mockConfig.guildId)).toBeNull();
  });

  it('should use getOrSet to fetch and cache if not present', async () => {
    const cache = new GuildCacheService(60_000);
    const fetcher = vi.fn().mockResolvedValue(mockConfig);

    // First call: executes fetcher
    const firstResult = await cache.getOrSet(mockConfig.guildId, fetcher);
    expect(firstResult).toEqual(mockConfig);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second call: retrieves from cache without calling fetcher
    const secondResult = await cache.getOrSet(mockConfig.guildId, fetcher);
    expect(secondResult).toEqual(mockConfig);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
