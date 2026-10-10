import { PrismaClient, TribunalCase, TribunalVote } from '@prisma/client';

export type TribunalWithVotes = TribunalCase & { votes: TribunalVote[] };

export interface CreateTribunalCaseDTO {
  guildId: string;
  defendantId: string;
  originalNickname?: string | null;
  punishmentNickname: string;
  reason: string;
  durationHours: number;
  channelId: string;
  messageId?: string | null;
  endsAt: Date;
}

export class TribunalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async createCase(data: CreateTribunalCaseDTO): Promise<TribunalCase> {
    return this.prisma.tribunalCase.create({
      data: {
        guildId: data.guildId,
        defendantId: data.defendantId,
        originalNickname: data.originalNickname ?? null,
        punishmentNickname: data.punishmentNickname,
        reason: data.reason,
        durationHours: data.durationHours,
        channelId: data.channelId,
        messageId: data.messageId ?? null,
        endsAt: data.endsAt,
        status: 'VOTING',
        votesYes: 0,
        votesNo: 0,
      },
    });
  }

  public async findCaseById(id: string): Promise<TribunalWithVotes | null> {
    return this.prisma.tribunalCase.findUnique({
      where: { id },
      include: { votes: true },
    });
  }

  public async updateMessageId(id: string, messageId: string): Promise<TribunalCase> {
    return this.prisma.tribunalCase.update({
      where: { id },
      data: { messageId },
    });
  }

  public async vote(
    caseId: string,
    userId: string,
    vote: 'YES' | 'NO',
  ): Promise<{ tribunalCase: TribunalCase; duplicate: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const existingVote = await tx.tribunalVote.findUnique({
        where: {
          caseId_userId: { caseId, userId },
        },
      });

      if (existingVote) {
        const c = await tx.tribunalCase.findUniqueOrThrow({ where: { id: caseId } });
        return { tribunalCase: c, duplicate: true };
      }

      await tx.tribunalVote.create({
        data: { caseId, userId, vote },
      });

      const updatedCase = await tx.tribunalCase.update({
        where: { id: caseId },
        data: {
          votesYes: vote === 'YES' ? { increment: 1 } : undefined,
          votesNo: vote === 'NO' ? { increment: 1 } : undefined,
        },
      });

      return { tribunalCase: updatedCase, duplicate: false };
    });
  }

  public async findVotingCasesDue(maxDate: Date): Promise<TribunalCase[]> {
    return this.prisma.tribunalCase.findMany({
      where: {
        status: 'VOTING',
        endsAt: { lte: maxDate },
      },
    });
  }

  public async findPunishmentsDue(maxDate: Date): Promise<TribunalCase[]> {
    return this.prisma.tribunalCase.findMany({
      where: {
        status: 'GUILTY',
        punishmentEndsAt: { not: null, lte: maxDate },
      },
    });
  }

  public async updateVerdict(
    id: string,
    status: 'GUILTY' | 'INNOCENT',
    originalNickname: string | null,
    punishmentEndsAt: Date | null,
  ): Promise<TribunalCase> {
    return this.prisma.tribunalCase.update({
      where: { id },
      data: {
        status,
        originalNickname,
        punishmentEndsAt,
      },
    });
  }

  public async markExpired(id: string): Promise<TribunalCase> {
    return this.prisma.tribunalCase.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
  }
}
