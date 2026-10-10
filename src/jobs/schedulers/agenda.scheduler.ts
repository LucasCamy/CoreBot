import { Container } from '../../core/container.js';
import { QUEUE_NAMES } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { BotEmbed } from '../../utils/embed.builder.js';
import { formatInTimezone } from '../../utils/time.js';
import { isDiscordChannelError } from '../../utils/discord-error.js';

export class AgendaScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting Agenda Scheduler worker...');

    // Register BullMQ worker to process reminders
    QueueManager.registerWorker(
      QUEUE_NAMES.AGENDA_REMINDERS,
      async (job) => {
        if (!this.container.client.isReady()) {
          logger.warn(
            { jobId: job.id },
            'Discord client is not ready (gateway disconnected). Rescheduling agenda reminder...',
          );
          throw new Error('Discord client gateway is not ready. Worker job will be retried.');
        }

        const { eventId, minutesBefore } = job.data as { eventId: string; minutesBefore: number };
        await this.sendReminder(eventId, minutesBefore);
      },
      { concurrency: 2 },
    );

    // Run check immediately, then every 60 seconds
    await this.checkUpcomingEvents();
    this.timer = setInterval(() => {
      this.checkUpcomingEvents().catch((err) => {
        logger.error({ error: err }, 'Error in scheduled agenda check');
      });
    }, 60 * 1000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkUpcomingEvents(): Promise<void> {
    const agendaRepo = this.container.agendaRepository;
    const now = new Date();
    // Look ahead 2 hours for active scheduled events
    const lookahead = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const activeEvents = await agendaRepo.findActiveEventsForReminders(
      new Date(now.getTime() - 10 * 60 * 1000), // Grace 10 min past start
      lookahead,
    );

    for (const event of activeEvents) {
      const msUntilStart = event.startsAt.getTime() - now.getTime();
      const minutesUntilStart = Math.round(msUntilStart / (60 * 1000));

      // Mark completed if start time was more than 30 mins ago and no endsAt, or if endsAt has passed
      if (
        (event.endsAt && now > event.endsAt) ||
        (!event.endsAt && msUntilStart < -30 * 60 * 1000)
      ) {
        await agendaRepo.markCompleted(event.id);
        continue;
      }

      // Check each configured reminder threshold
      for (const threshold of event.reminderMinutesBefore) {
        // If we are within window (threshold +/- 1.5 minutes) and not yet sent
        if (
          minutesUntilStart <= threshold &&
          minutesUntilStart >= threshold - 2 &&
          !event.sentReminders.includes(threshold)
        ) {
          const queue = QueueManager.getQueue(QUEUE_NAMES.AGENDA_REMINDERS);
          await queue.add(
            `reminder-${event.id}-${threshold}`,
            { eventId: event.id, minutesBefore: threshold },
            { jobId: `${event.id}-${threshold}` },
          );
        }
      }
    }
  }

  private async sendReminder(eventId: string, minutesBefore: number): Promise<void> {
    const agendaRepo = this.container.agendaRepository;
    const event = await agendaRepo.findById(eventId);

    if (!event || event.status !== 'SCHEDULED' || event.sentReminders.includes(minutesBefore)) {
      return;
    }

    const guildConfig = await this.container.guildRepository.findByGuildId(event.guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';
    const formattedDate = formatInTimezone(event.startsAt, tz, 'DD/MM/YYYY [às] HH:mm');

    const reminderTitle =
      minutesBefore === 0
        ? `🔔 O evento começou agora!`
        : `⏰ Lembrete: Começa em ${minutesBefore} minuto(s)!`;

    const embed = BotEmbed.info(
      reminderTitle,
      `**${event.title}**\n\n${event.description || 'Sem descrição.'}\n\n📅 **Horário:** ${formattedDate} (${tz})\n👤 **Criado por:** <@${event.createdByUserId}>`,
    );

    const sent = await this.container.notificationService.sendToChannel({
      guildId: event.guildId,
      module: 'agenda',
      eventType: 'reminder',
      channelId: event.reminderChannelId,
      embeds: [embed],
      deduplicationKey: `agenda-reminder-${event.id}-${minutesBefore}`,
    });

    if (sent) {
      await agendaRepo.markReminderSent(event.id, minutesBefore);
      logger.info({ eventId: event.id, minutesBefore }, 'Event reminder dispatched and recorded');
    } else {
      try {
        const channel = await this.container.client.channels.fetch(event.reminderChannelId);
        if (!channel) {
          logger.warn(
            { guildId: event.guildId, channelId: event.reminderChannelId, eventId: event.id },
            'Reminder channel was deleted. Marking reminder as sent to prevent worker retries.',
          );
          await agendaRepo.markReminderSent(event.id, minutesBefore);
        }
      } catch (chErr) {
        const parsed = isDiscordChannelError(chErr);
        if (parsed.isChannelError) {
          logger.warn(
            {
              guildId: event.guildId,
              channelId: event.reminderChannelId,
              eventId: event.id,
              errorCode: parsed.code,
            },
            'Reminder channel is missing or inaccessible (DiscordAPIError). Marking reminder as sent to avoid queue stalls.',
          );
          await agendaRepo.markReminderSent(event.id, minutesBefore);
        }
      }
    }
  }
}
