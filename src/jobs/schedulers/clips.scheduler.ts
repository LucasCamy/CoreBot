import { EmbedBuilder } from 'discord.js';
import { Container } from '../../core/container.js';
import { QUEUE_NAMES, BOT_COLORS } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { nowInTimezone } from '../../utils/time.js';
import { GuildGuard } from '../../discord/guards/guild.guard.js';

export class ClipsScheduler {
  private timer: NodeJS.Timeout | null = null;
  private announcedMonthByGuild: Map<string, string> = new Map();

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting Clips Monthly Scheduler worker...');

    QueueManager.registerWorker(
      QUEUE_NAMES.CLIPS_MONTHLY,
      async (job) => {
        const { guildId } = job.data as { guildId: string };
        await this.announceClipOfMonth(guildId);
      },
      { concurrency: 1 },
    );

    await this.checkMonthlyClip();
    // Check every 30 minutes
    this.timer = setInterval(
      () => {
        this.checkMonthlyClip().catch((err) => {
          logger.error({ error: err }, 'Error in ClipsScheduler check');
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

  public async checkMonthlyClip(): Promise<void> {
    const allowedGuilds = GuildGuard.getAllowedGuildIds();

    for (const guildId of allowedGuilds) {
      const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
      if (!guildConfig || !guildConfig.botEnabled) continue;

      const tz = guildConfig.timezone || 'America/Sao_Paulo';
      const today = nowInTimezone(tz);

      // Check if it's the 1st of the month, hour >= 10
      if (today.date() !== 1 || today.hour() < 10) continue;

      const monthKey = `${today.year()}-${today.month() + 1}`;
      if (this.announcedMonthByGuild.get(guildId) === monthKey) continue;

      this.announcedMonthByGuild.set(guildId, monthKey);

      const queue = QueueManager.getQueue(QUEUE_NAMES.CLIPS_MONTHLY);
      await queue.add(
        `clip-month-${guildId}-${monthKey}`,
        { guildId },
        { jobId: `clip-month-${guildId}-${monthKey}` },
      );
    }
  }

  private async announceClipOfMonth(guildId: string): Promise<void> {
    const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';
    const today = nowInTimezone(tz);

    // Get previous month bounds
    const lastMonthStart = today.subtract(1, 'month').startOf('month').toDate();
    const lastMonthEnd = today.subtract(1, 'month').endOf('month').toDate();

    const topClip = await this.container.clipRepository.findTopClipOfMonth(
      guildId,
      lastMonthStart,
      lastMonthEnd,
    );

    if (!topClip || topClip.upvotes === 0) return;

    const guild = await this.container.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    let channel = guild.channels.cache.get(topClip.channelId);
    if (!channel || !channel.isTextBased()) {
      channel = guild.channels.cache.find(
        (c) =>
          c.isTextBased() &&
          c.permissionsFor(guild.members.me || '')?.has(['ViewChannel', 'SendMessages']),
      );
    }

    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.WARNING)
      .setTitle('🌟 CLIPE DO MÊS!')
      .setDescription(
        `🏆 Parabéns a <@${topClip.submitterId}> pelo clipe mais votado do mês passado!\n\n` +
          `🎬 **[${topClip.title}](${topClip.url})**\n` +
          `🎮 Jogo: ${topClip.game || 'Geral'}\n` +
          `🔥 Total de Upvotes: **${topClip.upvotes}** votos`,
      )
      .setFooter({ text: 'Eleito pela comunidade no CoreBot Clips' });

    await this.container.notificationService.sendToChannel({
      guildId,
      module: 'clips',
      eventType: 'clip_of_the_month',
      channelId: channel.id,
      embeds: [embed],
    });

    logger.info({ guildId, clipId: topClip.id }, 'Clip of the month announced');
  }
}
