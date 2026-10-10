import { ActiveVoiceChannel, PrismaClient, VoiceHubConfig } from '@prisma/client';

export interface UpsertVoiceHubDto {
  guildId: string;
  hubChannelId: string;
  targetCategoryId: string;
  defaultUserLimit?: number | null;
  bitrate?: number | null;
  namingTemplate?: string;
  isPrivate?: boolean;
}

export class VoiceHubRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async upsertHub(dto: UpsertVoiceHubDto): Promise<VoiceHubConfig> {
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.voiceHubConfig.upsert({
      where: {
        guildId_hubChannelId: {
          guildId: dto.guildId,
          hubChannelId: dto.hubChannelId,
        },
      },
      create: {
        guildId: dto.guildId,
        hubChannelId: dto.hubChannelId,
        targetCategoryId: dto.targetCategoryId,
        defaultUserLimit: dto.defaultUserLimit,
        bitrate: dto.bitrate,
        namingTemplate: dto.namingTemplate ?? '🔊 Sala de {user}',
        isPrivate: dto.isPrivate ?? false,
      },
      update: {
        targetCategoryId: dto.targetCategoryId,
        defaultUserLimit: dto.defaultUserLimit,
        bitrate: dto.bitrate,
        namingTemplate: dto.namingTemplate,
        isPrivate: dto.isPrivate ?? false,
      },
    });
  }

  public async findHubByChannel(
    guildId: string,
    hubChannelId: string,
  ): Promise<VoiceHubConfig | null> {
    return this.prisma.voiceHubConfig.findUnique({
      where: {
        guildId_hubChannelId: {
          guildId,
          hubChannelId,
        },
      },
    });
  }

  public async listHubs(guildId: string): Promise<VoiceHubConfig[]> {
    return this.prisma.voiceHubConfig.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async deleteHub(guildId: string, hubChannelId: string): Promise<VoiceHubConfig | null> {
    const existing = await this.findHubByChannel(guildId, hubChannelId);
    if (!existing) return null;

    return this.prisma.voiceHubConfig.delete({
      where: {
        guildId_hubChannelId: {
          guildId,
          hubChannelId,
        },
      },
    });
  }

  public async createActiveChannel(
    guildId: string,
    channelId: string,
    ownerId: string,
    isLocked: boolean = false,
    whitelistedUserIds: string[] = [],
  ): Promise<ActiveVoiceChannel> {
    return this.prisma.activeVoiceChannel.create({
      data: {
        guildId,
        channelId,
        ownerId,
        isLocked,
        whitelistedUserIds,
      },
    });
  }

  public async findActiveChannel(channelId: string): Promise<ActiveVoiceChannel | null> {
    return this.prisma.activeVoiceChannel.findUnique({
      where: { channelId },
    });
  }

  public async setChannelLock(channelId: string, isLocked: boolean): Promise<ActiveVoiceChannel> {
    return this.prisma.activeVoiceChannel.update({
      where: { channelId },
      data: { isLocked },
    });
  }

  public async addWhitelistedUser(channelId: string, userId: string): Promise<ActiveVoiceChannel> {
    const active = await this.findActiveChannel(channelId);
    if (!active) {
      throw new Error(`Active voice channel ${channelId} not found`);
    }

    const currentList = new Set(active.whitelistedUserIds);
    currentList.add(userId);

    return this.prisma.activeVoiceChannel.update({
      where: { channelId },
      data: { whitelistedUserIds: Array.from(currentList) },
    });
  }

  public async removeWhitelistedUser(
    channelId: string,
    userId: string,
  ): Promise<ActiveVoiceChannel> {
    const active = await this.findActiveChannel(channelId);
    if (!active) {
      throw new Error(`Active voice channel ${channelId} not found`);
    }

    return this.prisma.activeVoiceChannel.update({
      where: { channelId },
      data: {
        whitelistedUserIds: active.whitelistedUserIds.filter((id) => id !== userId),
      },
    });
  }

  public async updateActiveChannelOwner(
    channelId: string,
    ownerId: string,
  ): Promise<ActiveVoiceChannel> {
    return this.prisma.activeVoiceChannel.update({
      where: { channelId },
      data: { ownerId },
    });
  }

  public async deleteActiveChannel(channelId: string): Promise<ActiveVoiceChannel | null> {
    const existing = await this.findActiveChannel(channelId);
    if (!existing) return null;

    return this.prisma.activeVoiceChannel.delete({
      where: { channelId },
    });
  }

  public async listActiveChannels(guildId: string): Promise<ActiveVoiceChannel[]> {
    return this.prisma.activeVoiceChannel.findMany({
      where: { guildId },
    });
  }
}
