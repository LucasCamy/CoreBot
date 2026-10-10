import { BirthdayConfig, PrismaClient } from '@prisma/client';

export interface UpsertBirthdayDto {
  guildId: string;
  userId: string;
  birthDate: Date;
  announcementChannelId: string;
  customMessage?: string | null;
  enabled?: boolean;
}

export class BirthdayRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async upsert(dto: UpsertBirthdayDto): Promise<BirthdayConfig> {
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.birthdayConfig.upsert({
      where: {
        guildId_userId: {
          guildId: dto.guildId,
          userId: dto.userId,
        },
      },
      create: {
        guildId: dto.guildId,
        userId: dto.userId,
        birthDate: dto.birthDate,
        announcementChannelId: dto.announcementChannelId,
        customMessage: dto.customMessage,
        enabled: dto.enabled ?? true,
      },
      update: {
        birthDate: dto.birthDate,
        announcementChannelId: dto.announcementChannelId,
        customMessage: dto.customMessage,
        enabled: dto.enabled,
      },
    });
  }

  public async findByUser(guildId: string, userId: string): Promise<BirthdayConfig | null> {
    return this.prisma.birthdayConfig.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });
  }

  public async delete(guildId: string, userId: string): Promise<BirthdayConfig | null> {
    const existing = await this.findByUser(guildId, userId);
    if (!existing) return null;

    return this.prisma.birthdayConfig.delete({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });
  }

  public async listByGuild(guildId: string): Promise<BirthdayConfig[]> {
    return this.prisma.birthdayConfig.findMany({
      where: { guildId },
      orderBy: { birthDate: 'asc' },
    });
  }

  public async listAllActive(): Promise<BirthdayConfig[]> {
    return this.prisma.birthdayConfig.findMany({
      where: { enabled: true },
    });
  }

  public async markAnnounced(id: string, year: number): Promise<BirthdayConfig> {
    return this.prisma.birthdayConfig.update({
      where: { id },
      data: { lastAnnouncedYear: year },
    });
  }
}
