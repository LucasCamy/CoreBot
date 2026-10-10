import { StreamerConfig, PrismaClient } from '@prisma/client';

export class StreamerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findByGuildAndLogin(
    guildId: string,
    streamerLogin: string,
  ): Promise<StreamerConfig | null> {
    return this.prisma.streamerConfig.findUnique({
      where: {
        guildId_streamerLogin: {
          guildId,
          streamerLogin: streamerLogin.toLowerCase(),
        },
      },
    });
  }

  public async listByGuild(guildId: string): Promise<StreamerConfig[]> {
    return this.prisma.streamerConfig.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async listAll(): Promise<StreamerConfig[]> {
    return this.prisma.streamerConfig.findMany({
      orderBy: { streamerLogin: 'asc' },
    });
  }

  public async create(data: {
    guildId: string;
    streamerLogin: string;
    channelId: string;
    discordUserId?: string | null;
  }): Promise<StreamerConfig> {
    return this.prisma.streamerConfig.create({
      data: {
        guildId: data.guildId,
        streamerLogin: data.streamerLogin.toLowerCase(),
        channelId: data.channelId,
        discordUserId: data.discordUserId ?? null,
      },
    });
  }

  public async updateStreamStatus(
    id: string,
    isLive: boolean,
    lastStreamId?: string | null,
  ): Promise<StreamerConfig> {
    return this.prisma.streamerConfig.update({
      where: { id },
      data: {
        isLive,
        ...(lastStreamId !== undefined ? { lastStreamId } : {}),
      },
    });
  }

  public async delete(guildId: string, streamerLogin: string): Promise<boolean> {
    const existing = await this.findByGuildAndLogin(guildId, streamerLogin);
    if (!existing) return false;

    await this.prisma.streamerConfig.delete({
      where: { id: existing.id },
    });
    return true;
  }
}
