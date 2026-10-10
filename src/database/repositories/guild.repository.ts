import { GuildConfig, PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { GuildCacheService } from '../../core/cache/guild-cache.service.js';

export class GuildRepository {
  private readonly cache: GuildCacheService;

  constructor(
    private readonly prisma: PrismaClient,
    cache?: GuildCacheService,
  ) {
    this.cache = cache ?? new GuildCacheService();
  }

  public getCacheService(): GuildCacheService {
    return this.cache;
  }

  public async findByGuildId(guildId: string): Promise<GuildConfig | null> {
    const cached = this.cache.get(guildId);
    if (cached) {
      return cached;
    }

    const config = await this.prisma.guildConfig.findUnique({
      where: { guildId },
    });

    if (config) {
      this.cache.set(guildId, config);
    }

    return config;
  }

  public async getOrCreate(guildId: string): Promise<GuildConfig> {
    const existing = await this.findByGuildId(guildId);
    if (existing) {
      return existing;
    }

    const created = await this.prisma.guildConfig.create({
      data: {
        guildId,
        timezone: env.TIMEZONE,
        botEnabled: true,
        adminRoleIds: [],
        backupChannelId: null,
      },
    });

    this.cache.set(guildId, created);
    return created;
  }

  public async update(
    guildId: string,
    data: Partial<Omit<GuildConfig, 'guildId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<GuildConfig> {
    const updated = await this.prisma.guildConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        timezone: data.timezone ?? env.TIMEZONE,
        botEnabled: data.botEnabled ?? true,
        adminRoleIds: data.adminRoleIds ?? [],
        backupChannelId: data.backupChannelId ?? null,
      },
      update: data,
    });

    this.cache.set(guildId, updated);
    return updated;
  }

  public async setTimezone(guildId: string, timezone: string): Promise<GuildConfig> {
    return this.update(guildId, { timezone });
  }

  public async setBotEnabled(guildId: string, botEnabled: boolean): Promise<GuildConfig> {
    return this.update(guildId, { botEnabled });
  }

  public async setAdminRoles(guildId: string, adminRoleIds: string[]): Promise<GuildConfig> {
    return this.update(guildId, { adminRoleIds });
  }

  public async setBackupChannel(
    guildId: string,
    backupChannelId: string | null,
  ): Promise<GuildConfig> {
    return this.update(guildId, { backupChannelId });
  }

  public invalidateCache(guildId: string): void {
    this.cache.invalidate(guildId);
  }
}
