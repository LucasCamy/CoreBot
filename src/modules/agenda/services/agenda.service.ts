import { Container } from '../../../core/container.js';
import { parseInTimezone, formatInTimezone } from '../../../utils/time.js';
import { ScheduledEvent } from '@prisma/client';
import { BotEmbed } from '../../../utils/embed.builder.js';

export class AgendaService {
  constructor(private readonly container: Container) {}

  public async createEvent(params: {
    guildId: string;
    title: string;
    description?: string | null;
    dateStr: string;
    timeStr: string;
    reminderChannelId: string;
    reminderMinutesBefore?: number[];
    createdByUserId: string;
  }): Promise<{ success: boolean; event?: ScheduledEvent; error?: string }> {
    const guildConfig = await this.container.guildRepository.findByGuildId(params.guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';

    const fullDateStr = `${params.dateStr} ${params.timeStr}`;
    const startsAt = parseInTimezone(fullDateStr, 'DD/MM/YYYY HH:mm', tz);

    if (isNaN(startsAt.getTime())) {
      return { success: false, error: 'Data ou hora inválida.' };
    }

    if (startsAt.getTime() <= Date.now()) {
      return { success: false, error: 'A data do evento deve estar no futuro.' };
    }

    const event = await this.container.agendaRepository.create({
      guildId: params.guildId,
      title: params.title,
      description: params.description,
      startsAt,
      reminderChannelId: params.reminderChannelId,
      reminderMinutesBefore: params.reminderMinutesBefore ?? [60, 30, 10, 5],
      createdByUserId: params.createdByUserId,
    });

    return { success: true, event };
  }

  public async getEventFormatted(
    guildId: string,
    eventId: string,
  ): Promise<{ event: ScheduledEvent; timezone: string } | null> {
    const event = await this.container.agendaRepository.findById(eventId);
    if (!event || event.guildId !== guildId) return null;

    const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';

    return { event, timezone: tz };
  }

  public async triggerManualReminder(guildId: string, eventId: string): Promise<boolean> {
    const event = await this.container.agendaRepository.findById(eventId);
    if (!event || event.guildId !== guildId) return false;

    const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';
    const formattedDate = formatInTimezone(event.startsAt, tz, 'DD/MM/YYYY [às] HH:mm');

    const embed = BotEmbed.info(
      '🔔 Lembrete de Evento!',
      `**${event.title}**\n\n${event.description || 'Sem descrição.'}\n\n📅 **Data/Hora:** ${formattedDate} (${tz})\n👤 **Criado por:** <@${event.createdByUserId}>`,
    );

    const sent = await this.container.notificationService.sendToChannel({
      guildId: event.guildId,
      module: 'agenda',
      eventType: 'manual_reminder',
      channelId: event.reminderChannelId,
      embeds: [embed],
    });

    return !!sent;
  }
}
