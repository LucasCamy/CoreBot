import { PrismaClient, WebhookConfig } from '@prisma/client';

export class WebhookRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async getOrCreate(guildId: string): Promise<WebhookConfig> {
    await this.prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId },
      update: {},
    });

    return this.prisma.webhookConfig.upsert({
      where: { guildId },
      create: { guildId },
      update: {},
    });
  }

  public async findByGuild(guildId: string): Promise<WebhookConfig | null> {
    return this.prisma.webhookConfig.findUnique({
      where: { guildId },
    });
  }

  public async update(
    guildId: string,
    data: { deployChannelId?: string | null; alertsChannelId?: string | null },
  ): Promise<WebhookConfig> {
    await this.prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId },
      update: {},
    });

    return this.prisma.webhookConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        deployChannelId: data.deployChannelId,
        alertsChannelId: data.alertsChannelId,
      },
      update: data,
    });
  }

  public async findFirstWithChannels(): Promise<WebhookConfig | null> {
    return this.prisma.webhookConfig.findFirst({
      where: {
        OR: [{ deployChannelId: { not: null } }, { alertsChannelId: { not: null } }],
      },
    });
  }
}
