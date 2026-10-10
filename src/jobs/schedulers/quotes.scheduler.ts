import { EmbedBuilder } from 'discord.js';
import { Container } from '../../core/container.js';
import { QUEUE_NAMES, BOT_COLORS } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { nowInTimezone } from '../../utils/time.js';
import { GuildGuard } from '../../discord/guards/guild.guard.js';

export class QuotesScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastAnnouncedWeekByGuild: Map<string, string> = new Map();

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting Quotes Weekly Scheduler worker...');

    QueueManager.registerWorker(
      QUEUE_NAMES.QUOTES_WEEKLY,
      async (job) => {
        const { guildId } = job.data as { guildId: string };
        await this.sendWeeklyQuote(guildId);
      },
      { concurrency: 1 },
    );

    await this.checkWeeklyQuotes();
    // Check every 15 minutes
    this.timer = setInterval(
      () => {
        this.checkWeeklyQuotes().catch((err) => {
          logger.error({ error: err }, 'Error checking weekly quotes in scheduler');
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

  public async checkWeeklyQuotes(): Promise<void> {
    const allowedGuilds = GuildGuard.getAllowedGuildIds();

    for (const guildId of allowedGuilds) {
      const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
      if (!guildConfig || !guildConfig.botEnabled) continue;

      const tz = guildConfig.timezone || 'America/Sao_Paulo';
      const today = nowInTimezone(tz);

      // Sunday is 0, hour 20 (8 PM)
      const isSunday = today.day() === 0;
      const isHour20 = today.hour() >= 20;

      if (!isSunday || !isHour20) continue;

      const weekKey = `${today.year()}-W${today.diff(today.startOf('year'), 'week') + 1}`;
      if (this.lastAnnouncedWeekByGuild.get(guildId) === weekKey) {
        continue;
      }

      this.lastAnnouncedWeekByGuild.set(guildId, weekKey);

      const queue = QueueManager.getQueue(QUEUE_NAMES.QUOTES_WEEKLY);
      await queue.add(
        `weekly-quote-${guildId}-${weekKey}`,
        { guildId },
        { jobId: `weekly-quote-${guildId}-${weekKey}` },
      );
    }
  }

  private async sendWeeklyQuote(guildId: string): Promise<void> {
    const quote = await this.container.quoteRepository.getRandom(guildId);
    if (!quote) return;

    const guild = await this.container.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    // Determine target channel (use quote.channelId or first available text channel)
    let channel = guild.channels.cache.get(quote.channelId);
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
      .setTitle('🏆 Pérola da Semana!')
      .setDescription(`>>> *"${quote.content}"*`)
      .addFields(
        { name: '👤 Autor', value: `<@${quote.authorId}>`, inline: true },
        { name: '💾 Resgatada por', value: `<@${quote.savedById}>`, inline: true },
        {
          name: '📅 Registrada em',
          value: `<t:${Math.floor(quote.createdAt.getTime() / 1000)}:d>`,
          inline: true,
        },
      )
      .setFooter({ text: 'Sorteada automaticamente todo domingo às 20h • CoreBot' });

    await this.container.notificationService.sendToChannel({
      guildId,
      module: 'quotes',
      eventType: 'weekly_quote',
      channelId: channel.id,
      embeds: [embed],
    });

    logger.info({ guildId, quoteId: quote.id }, 'Weekly quote published successfully');
  }
}
