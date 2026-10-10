import { Container } from '../../../core/container.js';
import { BirthdayConfig } from '@prisma/client';
import { nowInTimezone } from '../../../utils/time.js';

export class BirthdayService {
  constructor(private readonly container: Container) {}

  public async setBirthday(params: {
    guildId: string;
    userId: string;
    dateStr: string;
    announcementChannelId: string;
    customMessage?: string | null;
  }): Promise<{ success: boolean; config?: BirthdayConfig; error?: string }> {
    const [d, m, y] = params.dateStr.split('/').map(Number);
    const birthDate = new Date(Date.UTC(y, m - 1, d));

    if (isNaN(birthDate.getTime())) {
      return { success: false, error: 'Data de aniversário inválida.' };
    }

    if (birthDate.getTime() > Date.now()) {
      return { success: false, error: 'A data de nascimento não pode estar no futuro.' };
    }

    const config = await this.container.birthdayRepository.upsert({
      guildId: params.guildId,
      userId: params.userId,
      birthDate,
      announcementChannelId: params.announcementChannelId,
      customMessage: params.customMessage,
      enabled: true,
    });

    return { success: true, config };
  }

  public async triggerTestGreeting(guildId: string, userId: string): Promise<boolean> {
    const bday = await this.container.birthdayRepository.findByUser(guildId, userId);
    if (!bday) return false;

    const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';
    const nowTz = nowInTimezone(tz);

    const birthYear = bday.birthDate.getUTCFullYear();
    const age = nowTz.year() - birthYear;
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
        embedTitle: '🎂 [TESTE] Feliz Aniversário!',
        embedColor: '#FF73FA',
      },
    );

    const sent = await this.container.notificationService.sendToChannel({
      guildId: bday.guildId,
      module: 'birthdays',
      eventType: 'test_greeting',
      channelId: bday.announcementChannelId,
      content: rendered.content,
      embeds: rendered.embeds,
    });

    return !!sent;
  }
}
