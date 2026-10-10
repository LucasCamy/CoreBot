import { PrismaClient, GameLobby, LobbyParticipant } from '@prisma/client';

export type LobbyWithParticipants = GameLobby & { participants: LobbyParticipant[] };

export interface CreateLobbyDTO {
  guildId: string;
  gameName: string;
  startsAt: Date;
  maxPlayers?: number | null;
  channelId: string;
  messageId?: string | null;
  creatorId: string;
}

export class MatchmakingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async createLobby(data: CreateLobbyDTO): Promise<GameLobby> {
    return this.prisma.gameLobby.create({
      data: {
        guildId: data.guildId,
        gameName: data.gameName,
        startsAt: data.startsAt,
        maxPlayers: data.maxPlayers ?? null,
        channelId: data.channelId,
        messageId: data.messageId ?? null,
        creatorId: data.creatorId,
        status: 'OPEN',
      },
    });
  }

  public async findLobbyById(id: string): Promise<LobbyWithParticipants | null> {
    return this.prisma.gameLobby.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }

  public async findLobbiesByGuild(
    guildId: string,
    status?: string,
  ): Promise<LobbyWithParticipants[]> {
    return this.prisma.gameLobby.findMany({
      where: {
        guildId,
        ...(status ? { status } : {}),
      },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  public async updateLobbyMessage(id: string, messageId: string): Promise<GameLobby> {
    return this.prisma.gameLobby.update({
      where: { id },
      data: { messageId },
    });
  }

  public async updateLobbyStatus(id: string, status: string): Promise<GameLobby> {
    return this.prisma.gameLobby.update({
      where: { id },
      data: { status },
    });
  }

  public async upsertParticipant(
    lobbyId: string,
    userId: string,
    username: string,
    status: string,
  ): Promise<LobbyParticipant> {
    return this.prisma.lobbyParticipant.upsert({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
      create: {
        lobbyId,
        userId,
        username,
        status,
      },
      update: {
        status,
        username,
      },
    });
  }

  public async removeParticipant(lobbyId: string, userId: string): Promise<void> {
    await this.prisma.lobbyParticipant
      .delete({
        where: {
          lobbyId_userId: {
            lobbyId,
            userId,
          },
        },
      })
      .catch(() => null);
  }

  public async findDueOpenLobbies(maxDate: Date): Promise<LobbyWithParticipants[]> {
    return this.prisma.gameLobby.findMany({
      where: {
        status: 'OPEN',
        startsAt: { lte: maxDate },
      },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }
}
