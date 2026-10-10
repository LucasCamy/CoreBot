import { NotificationLog, PrismaClient } from '@prisma/client';

export interface CreateNotificationLogDto {
  guildId: string;
  module: string;
  eventType: string;
  targetChannelId?: string | null;
  targetUserId?: string | null;
  success: boolean;
  error?: string | null;
}

export class NotificationLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(dto: CreateNotificationLogDto): Promise<NotificationLog> {
    // Ensure guild exists
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.notificationLog.create({
      data: {
        guildId: dto.guildId,
        module: dto.module,
        eventType: dto.eventType,
        targetChannelId: dto.targetChannelId,
        targetUserId: dto.targetUserId,
        success: dto.success,
        error: dto.error,
      },
    });
  }

  public async listRecent(guildId: string, limit = 20): Promise<NotificationLog[]> {
    return this.prisma.notificationLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
