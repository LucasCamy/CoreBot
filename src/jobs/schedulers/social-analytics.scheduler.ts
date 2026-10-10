import { Container } from '../../core/container.js';
import { QUEUE_NAMES } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { nowInTimezone } from '../../utils/time.js';
import { GuildGuard } from '../../discord/guards/guild.guard.js';
import { SocialAnalyticsService } from '../../modules/social-analytics/services/social-analytics.service.js';

export class SocialAnalyticsScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastCountdownDayByGuild = new Map<string, string>();
  private lastWrappedMonthByGuild = new Map<string, string>();

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting Social Analytics & Wrapped Scheduler worker...');

    // 1. Worker for Daily Countdowns
    QueueManager.registerWorker(
      QUEUE_NAMES.COUNTDOWN_DAILY,
      async (job) => {
        const { guildId } = job.data as { guildId: string };
        await this.broadcastCountdowns(guildId);
      },
      { concurrency: 1 },
    );

    // 2. Worker for Monthly Wrapped
    QueueManager.registerWorker(
      QUEUE_NAMES.SOCIAL_WRAPPED,
      async (job) => {
        const { guildId } = job.data as { guildId: string };
        await this.broadcastMonthlyWrapped(guildId);
      },
      { concurrency: 1 },
    );

    await this.checkSchedules();
    // Run checks every 15 minutes
    this.timer = setInterval(
      () => {
        this.checkSchedules().catch((err) => {
          logger.error({ error: err }, 'Error in SocialAnalyticsScheduler check');
        });
      },
      15 * 60 * 1000,
    );
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkSchedules(): Promise<void> {
    const allowedGuilds = GuildGuard.getAllowedGuildIds();

    for (const guildId of allowedGuilds) {
      const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
      if (!guildConfig || !guildConfig.botEnabled) continue;

      const tz = guildConfig.timezone || 'America/Sao_Paulo';
      const today = nowInTimezone(tz);

      // 1. Daily Countdowns at 09:00
      if (today.hour() >= 9) {
        const dayKey = today.format('YYYY-MM-DD');
        if (this.lastCountdownDayByGuild.get(guildId) !== dayKey) {
          this.lastCountdownDayByGuild.set(guildId, dayKey);
          const queue = QueueManager.getQueue(QUEUE_NAMES.COUNTDOWN_DAILY);
          await queue.add(
            `countdowns-${guildId}-${dayKey}`,
            { guildId },
            { jobId: `countdowns-${guildId}-${dayKey}` },
          );
        }
      }

      // 2. Monthly Wrapped on 1st of month at 10:00
      if (today.date() === 1 && today.hour() >= 10) {
        const monthKey = `${today.year()}-${today.month() + 1}`;
        if (this.lastWrappedMonthByGuild.get(guildId) !== monthKey) {
          this.lastWrappedMonthByGuild.set(guildId, monthKey);
          const queue = QueueManager.getQueue(QUEUE_NAMES.SOCIAL_WRAPPED);
          await queue.add(
            `wrapped-${guildId}-${monthKey}`,
            { guildId },
            { jobId: `wrapped-${guildId}-${monthKey}` },
          );
        }
      }
    }
  }

  private async broadcastCountdowns(guildId: string): Promise<void> {
    const countdowns =
      await this.container.socialAnalyticsRepository.findCountdownsByGuild(guildId);
    if (countdowns.length === 0) return;

    const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';

    const service = new SocialAnalyticsService(this.container);
    const embed = service.buildCountdownEmbed(countdowns, tz);

    // Group by channel
    const channelsMap = new Map<string, string[]>();
    for (const c of countdowns) {
      const list = channelsMap.get(c.channelId) || [];
      list.push(c.id);
      channelsMap.set(c.channelId, list);
    }

    for (const channelId of channelsMap.keys()) {
      await this.container.notificationService.sendToChannel({
        guildId,
        module: 'social-analytics',
        eventType: 'daily_countdowns',
        channelId,
        embeds: [embed],
      });
    }

    logger.info({ guildId, totalCountdowns: countdowns.length }, 'Daily countdowns announced');
  }

  private async broadcastMonthlyWrapped(guildId: string): Promise<void> {
    const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';
    const today = nowInTimezone(tz);

    const lastMonthStart = today.subtract(1, 'month').startOf('month').toDate();
    const lastMonthEnd = today.subtract(1, 'month').endOf('month').toDate();
    const periodLabel = today.subtract(1, 'month').format('MMMM [de] YYYY');

    const guild = await this.container.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const service = new SocialAnalyticsService(this.container);
    const data = await service.getWrappedData(guildId, lastMonthStart, lastMonthEnd);

    // If no one had call time, skip
    if (data.topUsers.length === 0 && !data.peakHour) return;

    const embed = service.buildWrappedEmbed(guild.name, data, periodLabel);

    // Pick a public text channel
    const channel = guild.channels.cache.find(
      (c) =>
        c.isTextBased() &&
        guild.members.me &&
        c.permissionsFor(guild.members.me).has(['ViewChannel', 'SendMessages']),
    );

    if (!channel || !channel.isTextBased()) return;

    await this.container.notificationService.sendToChannel({
      guildId,
      module: 'social-analytics',
      eventType: 'monthly_wrapped',
      channelId: channel.id,
      embeds: [embed],
    });

    logger.info({ guildId, period: periodLabel }, 'Monthly Wrapped announced to server');
  }
}
