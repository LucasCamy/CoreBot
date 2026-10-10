import { PrismaClient, ScheduledEvent } from '@prisma/client';

export interface CreateEventDto {
  guildId: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  reminderChannelId: string;
  reminderMinutesBefore?: number[];
  repeatRule?: string | null;
  createdByUserId: string;
}

export class AgendaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(dto: CreateEventDto): Promise<ScheduledEvent> {
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.scheduledEvent.create({
      data: {
        guildId: dto.guildId,
        title: dto.title,
        description: dto.description,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        reminderChannelId: dto.reminderChannelId,
        reminderMinutesBefore: dto.reminderMinutesBefore ?? [60, 30, 10, 5],
        repeatRule: dto.repeatRule,
        createdByUserId: dto.createdByUserId,
        status: 'SCHEDULED',
        sentReminders: [],
      },
    });
  }

  public async findById(id: string): Promise<ScheduledEvent | null> {
    return this.prisma.scheduledEvent.findUnique({
      where: { id },
    });
  }

  public async listUpcoming(guildId: string, limit = 10): Promise<ScheduledEvent[]> {
    return this.prisma.scheduledEvent.findMany({
      where: {
        guildId,
        status: 'SCHEDULED',
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
  }

  public async update(
    id: string,
    data: Partial<
      Omit<ScheduledEvent, 'id' | 'guildId' | 'createdByUserId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<ScheduledEvent> {
    return this.prisma.scheduledEvent.update({
      where: { id },
      data,
    });
  }

  public async cancel(id: string): Promise<ScheduledEvent> {
    return this.prisma.scheduledEvent.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  public async markCompleted(id: string): Promise<ScheduledEvent> {
    return this.prisma.scheduledEvent.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }

  public async markReminderSent(id: string, minutes: number): Promise<ScheduledEvent> {
    const event = await this.findById(id);
    if (!event) throw new Error(`Event ${id} not found`);

    const updatedSentReminders = Array.from(new Set([...event.sentReminders, minutes]));

    return this.prisma.scheduledEvent.update({
      where: { id },
      data: {
        sentReminders: updatedSentReminders,
      },
    });
  }

  public async findActiveEventsForReminders(from: Date, to: Date): Promise<ScheduledEvent[]> {
    return this.prisma.scheduledEvent.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: {
          gte: from,
          lte: to,
        },
      },
    });
  }
}
