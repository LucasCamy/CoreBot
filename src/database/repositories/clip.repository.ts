import { PrismaClient, CommunityClip, ClipVote } from '@prisma/client';

export type ClipWithVotes = CommunityClip & { votes: ClipVote[] };

export interface CreateClipDTO {
  guildId: string;
  title: string;
  url: string;
  game?: string | null;
  submitterId: string;
  channelId: string;
  messageId?: string | null;
}

export class ClipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async createClip(data: CreateClipDTO): Promise<CommunityClip> {
    return this.prisma.communityClip.create({
      data: {
        guildId: data.guildId,
        title: data.title,
        url: data.url,
        game: data.game ?? null,
        submitterId: data.submitterId,
        channelId: data.channelId,
        messageId: data.messageId ?? null,
        upvotes: 0,
        cringes: 0,
      },
    });
  }

  public async findClipById(id: string): Promise<ClipWithVotes | null> {
    return this.prisma.communityClip.findUnique({
      where: { id },
      include: { votes: true },
    });
  }

  public async updateMessageId(id: string, messageId: string): Promise<CommunityClip> {
    return this.prisma.communityClip.update({
      where: { id },
      data: { messageId },
    });
  }

  public async vote(
    clipId: string,
    userId: string,
    voteType: 'UPVOTE' | 'CRINGE',
  ): Promise<{ clip: CommunityClip; action: 'added' | 'removed' | 'changed' }> {
    return this.prisma.$transaction(async (tx) => {
      const existingVote = await tx.clipVote.findUnique({
        where: {
          clipId_userId: { clipId, userId },
        },
      });

      if (!existingVote) {
        await tx.clipVote.create({
          data: { clipId, userId, voteType },
        });

        const clip = await tx.communityClip.update({
          where: { id: clipId },
          data: {
            upvotes: voteType === 'UPVOTE' ? { increment: 1 } : undefined,
            cringes: voteType === 'CRINGE' ? { increment: 1 } : undefined,
          },
        });

        return { clip, action: 'added' };
      }

      if (existingVote.voteType === voteType) {
        // Toggle vote off if clicking same button again
        await tx.clipVote.delete({
          where: { id: existingVote.id },
        });

        const clip = await tx.communityClip.update({
          where: { id: clipId },
          data: {
            upvotes: voteType === 'UPVOTE' ? { decrement: 1 } : undefined,
            cringes: voteType === 'CRINGE' ? { decrement: 1 } : undefined,
          },
        });

        return { clip, action: 'removed' };
      }

      // Switch vote from UPVOTE to CRINGE or vice versa
      await tx.clipVote.update({
        where: { id: existingVote.id },
        data: { voteType },
      });

      const clip = await tx.communityClip.update({
        where: { id: clipId },
        data: {
          upvotes: voteType === 'UPVOTE' ? { increment: 1 } : { decrement: 1 },
          cringes: voteType === 'CRINGE' ? { increment: 1 } : { decrement: 1 },
        },
      });

      return { clip, action: 'changed' };
    });
  }

  public async findTopClips(
    guildId: string,
    game?: string | null,
    limit = 5,
  ): Promise<CommunityClip[]> {
    return this.prisma.communityClip.findMany({
      where: {
        guildId,
        ...(game ? { game: { contains: game, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  public async findTopClipOfMonth(
    guildId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CommunityClip | null> {
    const clips = await this.prisma.communityClip.findMany({
      where: {
        guildId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'asc' }],
      take: 1,
    });

    return clips[0] || null;
  }
}
