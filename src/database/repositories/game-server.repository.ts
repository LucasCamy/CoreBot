import { MonitoredServer, PrismaClient } from '@prisma/client';

export interface CreateMonitoredServerDto {
  guildId: string;
  name: string;
  gameType: string;
  host: string;
  port: number;
  queryPort?: number | null;
  displayChannelId: string;
  messageId?: string | null;
  intervalSeconds?: number;
}

export class GameServerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(dto: CreateMonitoredServerDto): Promise<MonitoredServer> {
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.monitoredServer.create({
      data: {
        guildId: dto.guildId,
        name: dto.name,
        gameType: dto.gameType,
        host: dto.host,
        port: dto.port,
        queryPort: dto.queryPort,
        displayChannelId: dto.displayChannelId,
        messageId: dto.messageId,
        intervalSeconds: dto.intervalSeconds ?? 60,
        isActive: true,
      },
    });
  }

  public async findById(id: string): Promise<MonitoredServer | null> {
    return this.prisma.monitoredServer.findUnique({
      where: { id },
    });
  }

  public async listByGuild(guildId: string): Promise<MonitoredServer[]> {
    return this.prisma.monitoredServer.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async listAllActive(): Promise<MonitoredServer[]> {
    return this.prisma.monitoredServer.findMany({
      where: { isActive: true },
    });
  }

  public async update(
    id: string,
    data: Partial<Omit<MonitoredServer, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MonitoredServer> {
    return this.prisma.monitoredServer.update({
      where: { id },
      data,
    });
  }

  public async updateStatusAndMessage(
    id: string,
    lastStatus: string,
    messageId?: string,
  ): Promise<MonitoredServer> {
    return this.prisma.monitoredServer.update({
      where: { id },
      data: {
        lastStatus,
        ...(messageId ? { messageId } : {}),
      },
    });
  }

  public async delete(id: string): Promise<MonitoredServer | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    return this.prisma.monitoredServer.delete({
      where: { id },
    });
  }
}
