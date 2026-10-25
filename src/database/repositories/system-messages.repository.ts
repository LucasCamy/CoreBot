import { PrismaClient, SystemMessageConfig } from '@prisma/client';

export interface UpsertSystemMessageConfigDto {
  welcomeEnabled?: boolean;
  welcomeChannelId?: string | null;
  welcomeMessage?: string;
  welcomeUseEmbed?: boolean;
  welcomeColor?: string | null;
  boostEnabled?: boolean;
  boostChannelId?: string | null;
  boostMessage?: string;
  boostUseEmbed?: boolean;
  boostColor?: string | null;
}

export class SystemMessagesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async getConfig(guildId: string): Promise<SystemMessageConfig | null> {
    return this.prisma.systemMessageConfig.findUnique({
      where: { guildId },
    });
  }

  public async upsertConfig(
    guildId: string,
    data: UpsertSystemMessageConfigDto,
  ): Promise<SystemMessageConfig> {
    await this.prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId },
      update: {},
    });

    return this.prisma.systemMessageConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        ...data,
      },
      update: {
        ...data,
      },
    });
  }
}
