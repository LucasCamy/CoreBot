import { PrismaClient, NotepadList, NotepadItem } from '@prisma/client';

export type NotepadListWithItems = NotepadList & { items: NotepadItem[] };

export interface CreateNotepadListDto {
  guildId: string;
  channelId: string;
  messageId?: string;
  title: string;
  description?: string | null;
  color?: string;
  isCollaborative?: boolean;
  ownerId: string;
}

export interface UpdateNotepadListDto {
  title?: string;
  description?: string | null;
  color?: string;
  isCollaborative?: boolean;
  messageId?: string;
}

export class NotepadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async createList(dto: CreateNotepadListDto): Promise<NotepadListWithItems> {
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.notepadList.create({
      data: {
        guildId: dto.guildId,
        channelId: dto.channelId,
        messageId: dto.messageId,
        title: dto.title,
        description: dto.description,
        color: dto.color ?? '#5865F2',
        isCollaborative: dto.isCollaborative ?? true,
        ownerId: dto.ownerId,
      },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  public async findById(id: string): Promise<NotepadListWithItems | null> {
    return this.prisma.notepadList.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  public async findByMessageId(messageId: string): Promise<NotepadListWithItems | null> {
    const list = await this.prisma.notepadList.findFirst({
      where: { messageId },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    });
    return list;
  }

  public async listByGuild(guildId: string): Promise<NotepadListWithItems[]> {
    return this.prisma.notepadList.findMany({
      where: { guildId },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async listByUser(guildId: string, userId: string): Promise<NotepadListWithItems[]> {
    return this.prisma.notepadList.findMany({
      where: { guildId, ownerId: userId },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async updateList(id: string, dto: UpdateNotepadListDto): Promise<NotepadListWithItems> {
    return this.prisma.notepadList.update({
      where: { id },
      data: dto,
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  public async deleteList(id: string, guildId: string): Promise<NotepadList | null> {
    const existing = await this.findById(id);
    if (!existing || existing.guildId !== guildId) return null;

    return this.prisma.notepadList.delete({
      where: { id },
    });
  }

  public async addItem(listId: string, content: string, userId: string): Promise<NotepadItem> {
    const count = await this.prisma.notepadItem.count({
      where: { listId },
    });

    return this.prisma.notepadItem.create({
      data: {
        listId,
        content,
        addedByUserId: userId,
        position: count,
      },
    });
  }

  public async findItemById(itemId: string): Promise<NotepadItem | null> {
    return this.prisma.notepadItem.findUnique({
      where: { id: itemId },
    });
  }

  public async toggleItem(itemId: string, completedByUserId: string): Promise<NotepadItem | null> {
    const item = await this.findItemById(itemId);
    if (!item) return null;

    const nextStatus = !item.isCompleted;

    return this.prisma.notepadItem.update({
      where: { id: itemId },
      data: {
        isCompleted: nextStatus,
        completedByUserId: nextStatus ? completedByUserId : null,
      },
    });
  }

  public async updateItemContent(itemId: string, content: string): Promise<NotepadItem | null> {
    return this.prisma.notepadItem.update({
      where: { id: itemId },
      data: { content },
    });
  }

  public async deleteItem(itemId: string): Promise<NotepadItem | null> {
    return this.prisma.notepadItem.delete({
      where: { id: itemId },
    });
  }

  public async clearCompleted(listId: string): Promise<number> {
    const res = await this.prisma.notepadItem.deleteMany({
      where: {
        listId,
        isCompleted: true,
      },
    });
    return res.count;
  }
}
