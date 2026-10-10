import { PrismaClient, VoiceActivityLog, Countdown } from '@prisma/client';

export class SocialAnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async logVoiceActivity(data: {
    guildId: string;
    userId: string;
    channelId: string;
    joinedAt: Date;
    leftAt: Date;
    durationSeconds: number;
  }): Promise<VoiceActivityLog> {
    return this.prisma.voiceActivityLog.create({
      data: {
        guildId: data.guildId,
        userId: data.userId,
        channelId: data.channelId,
        joinedAt: data.joinedAt,
        leftAt: data.leftAt,
        durationSeconds: data.durationSeconds,
      },
    });
  }

  public async getTopVoiceUsers(
    guildId: string,
    startDate: Date,
    endDate: Date,
    limit = 5,
  ): Promise<{ userId: string; totalSeconds: number }[]> {
    const logs = await this.prisma.voiceActivityLog.groupBy({
      by: ['userId'],
      where: {
        guildId,
        joinedAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        durationSeconds: true,
      },
      orderBy: {
        _sum: {
          durationSeconds: 'desc',
        },
      },
      take: limit,
    });

    return logs.map((log) => ({
      userId: log.userId,
      totalSeconds: log._sum.durationSeconds || 0,
    }));
  }

  public async getPeakVoiceHour(
    guildId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ hour: number; totalSessions: number } | null> {
    const logs = await this.prisma.voiceActivityLog.findMany({
      where: {
        guildId,
        joinedAt: { gte: startDate, lte: endDate },
      },
      select: { joinedAt: true },
    });

    if (logs.length === 0) return null;

    const hourCounts = new Map<number, number>();
    for (const log of logs) {
      const hour = log.joinedAt.getUTCHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    let peakHour = 0;
    let maxCount = 0;
    for (const [hour, count] of hourCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    }

    return { hour: peakHour, totalSessions: maxCount };
  }

  public async getTopVoicePair(
    guildId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ userA: string; userB: string; count: number } | null> {
    const logs = await this.prisma.voiceActivityLog.findMany({
      where: {
        guildId,
        joinedAt: { gte: startDate, lte: endDate },
      },
      orderBy: { joinedAt: 'asc' },
    });

    if (logs.length < 2) return null;

    // Pair interactions: count when two different users were in the same channel with overlapping time
    const pairOverlapCounts = new Map<string, number>();

    for (let i = 0; i < logs.length; i++) {
      for (let j = i + 1; j < logs.length; j++) {
        const a = logs[i];
        const b = logs[j];

        if (a.channelId !== b.channelId || a.userId === b.userId) continue;

        const maxJoin = Math.max(a.joinedAt.getTime(), b.joinedAt.getTime());
        const minLeave = Math.min(a.leftAt.getTime(), b.leftAt.getTime());

        // Overlap of at least 60 seconds
        if (minLeave - maxJoin >= 60 * 1000) {
          const sorted = [a.userId, b.userId].sort();
          const key = `${sorted[0]}|${sorted[1]}`;
          pairOverlapCounts.set(key, (pairOverlapCounts.get(key) || 0) + 1);
        }
      }
    }

    if (pairOverlapCounts.size === 0) return null;

    let bestPair = '';
    let maxOverlap = 0;
    for (const [key, count] of pairOverlapCounts.entries()) {
      if (count > maxOverlap) {
        maxOverlap = count;
        bestPair = key;
      }
    }

    const [userA, userB] = bestPair.split('|');
    return { userA, userB, count: maxOverlap };
  }

  // Countdowns
  public async createCountdown(data: {
    guildId: string;
    title: string;
    targetDate: Date;
    channelId: string;
  }): Promise<Countdown> {
    return this.prisma.countdown.create({
      data: {
        guildId: data.guildId,
        title: data.title,
        targetDate: data.targetDate,
        channelId: data.channelId,
      },
    });
  }

  public async findCountdownsByGuild(guildId: string): Promise<Countdown[]> {
    return this.prisma.countdown.findMany({
      where: { guildId },
      orderBy: { targetDate: 'asc' },
    });
  }

  public async findActiveCountdowns(): Promise<Countdown[]> {
    return this.prisma.countdown.findMany({
      orderBy: { targetDate: 'asc' },
    });
  }

  public async deleteCountdown(id: string): Promise<void> {
    await this.prisma.countdown.delete({ where: { id } }).catch(() => null);
  }
}
