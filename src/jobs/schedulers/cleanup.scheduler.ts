import { Container } from '../../core/container.js';
import { QUEUE_NAMES } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { nowInTimezone } from '../../utils/time.js';
import { GuildGuard } from '../../discord/guards/guild.guard.js';

export class CleanupScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastExecutedWeek: string | null = null;

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting System Cleanup Scheduler worker...');

    // Pre-initialize queue for Bull-Board visibility
    QueueManager.getQueue(QUEUE_NAMES.SYSTEM_CLEANUP);

    QueueManager.registerWorker(
      QUEUE_NAMES.SYSTEM_CLEANUP,
      async (job) => {
        logger.info({ jobId: job.id }, 'Executing automated system maintenance cleanup');
        await this.runCleanup();
      },
      { concurrency: 1 },
    );

    // Initial check on startup
    await this.checkCleanupSchedule();

    // Check every 30 minutes
    this.timer = setInterval(
      () => {
        this.checkCleanupSchedule().catch((err) => {
          logger.error({ error: err }, 'Error in system cleanup schedule check');
        });
      },
      30 * 60 * 1000,
    );
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkCleanupSchedule(): Promise<void> {
    const allowedGuilds = GuildGuard.getAllowedGuildIds();
    const primaryGuildId = allowedGuilds[0];
    if (!primaryGuildId) return;

    const guildConfig = await this.container.guildRepository.findByGuildId(primaryGuildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';
    const now = nowInTimezone(tz);

    // Sunday is day 0; 03:00 AM
    const isSunday = now.day() === 0;
    const isAfter3AM = now.hour() >= 3;

    if (!isSunday || !isAfter3AM) {
      return;
    }

    const currentWeekKey = now.format('YYYY-MM-DD');
    if (this.lastExecutedWeek === currentWeekKey) {
      return;
    }

    this.lastExecutedWeek = currentWeekKey;
    const queue = QueueManager.getQueue(QUEUE_NAMES.SYSTEM_CLEANUP);
    await queue.add(
      `cleanup-${currentWeekKey}`,
      { week: currentWeekKey, triggeredAt: now.toISOString() },
      { jobId: `cleanup-${currentWeekKey}` },
    );
  }

  /**
   * Executes database purge of stale logs:
   * 1. NotificationLog older than 14 days
   * 2. VoiceActivityLog older than 90 days
   */
  public async runCleanup(): Promise<{ deletedNotifications: number; deletedVoiceLogs: number }> {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    try {
      // 1. Purge NotificationLog > 14 days
      const notifResult = await this.container.prisma.notificationLog.deleteMany({
        where: {
          createdAt: {
            lt: fourteenDaysAgo,
          },
        },
      });

      // 2. Purge raw VoiceActivityLog > 90 days
      const voiceResult = await this.container.prisma.voiceActivityLog.deleteMany({
        where: {
          joinedAt: {
            lt: ninetyDaysAgo,
          },
        },
      });

      logger.info(
        {
          deletedNotifications: notifResult.count,
          deletedVoiceLogs: voiceResult.count,
          fourteenDaysAgo: fourteenDaysAgo.toISOString(),
          ninetyDaysAgo: ninetyDaysAgo.toISOString(),
        },
        'System cleanup routine successfully purged expired logs from PostgreSQL',
      );

      return {
        deletedNotifications: notifResult.count,
        deletedVoiceLogs: voiceResult.count,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { error: err.message, stack: err.stack },
        'Failed to execute system cleanup query',
      );
      throw err;
    }
  }
}
