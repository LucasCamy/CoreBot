import { Container } from '../../core/container.js';
import { QUEUE_NAMES } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { nowInTimezone } from '../../utils/time.js';

export class BirthdayScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting Birthday Scheduler worker...');

    // Register BullMQ worker to process birthday announcement
    QueueManager.registerWorker(
      QUEUE_NAMES.BIRTHDAY_GREETINGS,
      async (job) => {
        const { birthdayConfigId } = job.data as { birthdayConfigId: string };
        await this.sendBirthdayGreeting(birthdayConfigId);
      },
      { concurrency: 2 },
    );

    // Run check immediately on startup and then every 30 minutes
    await this.checkBirthdays();
    this.timer = setInterval(
      () => {
        this.checkBirthdays().catch((err) => {
          logger.error({ error: err }, 'Error checking birthdays in scheduler');
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

  public async checkBirthdays(): Promise<void> {
    const birthdayRepo = this.container.birthdayRepository;
    const allActive = await birthdayRepo.listAllActive();

    for (const bday of allActive) {
      const guildConfig = await this.container.guildRepository.findByGuildId(bday.guildId);
      const tz = guildConfig?.timezone || 'America/Sao_Paulo';
      const today = nowInTimezone(tz);

      const bdayMonth = bday.birthDate.getUTCMonth();
      const bdayDay = bday.birthDate.getUTCDate();

      const currentYear = today.year();
      const currentMonth = today.month(); // 0-indexed
      const currentDay = today.date();
      const currentHour = today.hour();

      // Send announcement between 08:00 and 22:00 in guild's local time if it matches today
      if (
        bdayMonth === currentMonth &&
        bdayDay === currentDay &&
        currentHour >= 8 &&
        bday.lastAnnouncedYear !== currentYear
      ) {
        const queue = QueueManager.getQueue(QUEUE_NAMES.BIRTHDAY_GREETINGS);
        await queue.add(
          `bday-${bday.id}-${currentYear}`,
          { birthdayConfigId: bday.id },
          { jobId: `bday-${bday.id}-${currentYear}` },
        );
      }
    }
  }

  public async sendBirthdayGreeting(birthdayConfigId: string): Promise<void> {
    const birthdayRepo = this.container.birthdayRepository;
    const bday = await this.container.prisma.birthdayConfig.findUnique({
      where: { id: birthdayConfigId },
    });

    if (!bday || !bday.enabled) return;

    const guildConfig = await this.container.guildRepository.findByGuildId(bday.guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';
    const nowTz = nowInTimezone(tz);
    const currentYear = nowTz.year();

    if (bday.lastAnnouncedYear === currentYear) {
      return;
    }

    const birthYear = bday.birthDate.getUTCFullYear();
    const age = currentYear - birthYear;
    const dateFormatted = `${String(bday.birthDate.getUTCDate()).padStart(2, '0')}/${String(bday.birthDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const defaultMsg =
      '🎉 Hoje é aniversário de {userMention}! Desejamos muitas felicidades e parabéns pelos seus {idade} anos! 🎂🥳';
    const template = bday.customMessage || defaultMsg;

    const rendered = this.container.templateService.renderMessage(
      template,
      {
        user: `<@${bday.userId}>`,
        userMention: `<@${bday.userId}>`,
        username: `<@${bday.userId}>`,
        idade: age > 0 ? age : '🎉',
        data: dateFormatted,
      },
      {
        useEmbed: true,
        embedTitle: '🎂 Feliz Aniversário!',
        embedColor: '#FF73FA',
      },
    );

    const sent = await this.container.notificationService.sendToChannel({
      guildId: bday.guildId,
      module: 'birthdays',
      eventType: 'greeting',
      channelId: bday.announcementChannelId,
      content: rendered.content,
      embeds: rendered.embeds,
      deduplicationKey: `birthday-${bday.id}-${currentYear}`,
    });

    if (sent) {
      await birthdayRepo.markAnnounced(bday.id, currentYear);
      logger.info(
        { birthdayId: bday.id, userId: bday.userId },
        'Birthday greeting sent successfully',
      );
    }
  }
}
