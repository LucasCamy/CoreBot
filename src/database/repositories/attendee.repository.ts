import { Attendee, AttendeeList, PrismaClient } from '@prisma/client';

export interface CreateAttendeeListDto {
  guildId: string;
  title: string;
  description?: string | null;
  channelId: string;
  messageId?: string | null;
  maxSlots?: number | null;
  closesAt?: Date | null;
  createdByUserId: string;
}

export type AttendeeListWithAttendees = AttendeeList & { attendees: Attendee[] };

export class AttendeeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async createList(dto: CreateAttendeeListDto): Promise<AttendeeList> {
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.attendeeList.create({
      data: {
        guildId: dto.guildId,
        title: dto.title,
        description: dto.description,
        channelId: dto.channelId,
        messageId: dto.messageId,
        maxSlots: dto.maxSlots,
        closesAt: dto.closesAt,
        status: 'OPEN',
        createdByUserId: dto.createdByUserId,
      },
    });
  }

  public async findListById(id: string): Promise<AttendeeListWithAttendees | null> {
    return this.prisma.attendeeList.findUnique({
      where: { id },
      include: {
        attendees: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }

  public async findListByMessageId(messageId: string): Promise<AttendeeListWithAttendees | null> {
    return this.prisma.attendeeList.findFirst({
      where: { messageId },
      include: {
        attendees: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }

  public async updateList(
    id: string,
    data: Partial<
      Omit<AttendeeList, 'id' | 'guildId' | 'createdByUserId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<AttendeeList> {
    return this.prisma.attendeeList.update({
      where: { id },
      data,
    });
  }

  public async deleteList(id: string): Promise<AttendeeList> {
    return this.prisma.attendeeList.delete({
      where: { id },
    });
  }

  public async addAttendee(
    listId: string,
    userId: string,
    username: string,
    status: string = 'CONFIRMED',
  ): Promise<Attendee> {
    return this.prisma.attendee.upsert({
      where: {
        listId_userId: { listId, userId },
      },
      create: {
        listId,
        userId,
        username,
        status,
      },
      update: {
        username,
        status,
      },
    });
  }

  public async removeAttendee(listId: string, userId: string): Promise<Attendee | null> {
    const existing = await this.prisma.attendee.findUnique({
      where: {
        listId_userId: { listId, userId },
      },
    });

    if (!existing) return null;

    return this.prisma.attendee.delete({
      where: {
        listId_userId: { listId, userId },
      },
    });
  }

  public async listAttendees(listId: string): Promise<Attendee[]> {
    return this.prisma.attendee.findMany({
      where: { listId },
      orderBy: { joinedAt: 'asc' },
    });
  }
}
