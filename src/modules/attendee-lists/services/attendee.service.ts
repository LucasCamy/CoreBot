import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { Container } from '../../../core/container.js';
import { AttendeeListWithAttendees } from '../../../database/repositories/attendee.repository.js';
import { BOT_COLORS, BOT_EMOJIS } from '../../../config/constants.js';
import { formatInTimezone } from '../../../utils/time.js';
import { logger } from '../../../utils/logger.js';

export class AttendeeListService {
  constructor(private readonly container: Container) {}

  /**
   * Builds the official UI Embed for an Attendee List
   */
  public buildListEmbed(list: AttendeeListWithAttendees, _tz = 'America/Sao_Paulo'): EmbedBuilder {
    const isClosed = list.status === 'CLOSED';
    const isCancelled = list.status === 'CANCELLED';
    const count = list.attendees.length;
    const max = list.maxSlots ? list.maxSlots : '∞';
    const isFull = typeof list.maxSlots === 'number' && count >= list.maxSlots;

    let statusText = '🟢 Aberta para Inscrições';
    let embedColor: number = BOT_COLORS.PRIMARY;

    if (isClosed) {
      statusText = '🔴 Inscrições Encerradas';
      embedColor = BOT_COLORS.DANGER;
    } else if (isCancelled) {
      statusText = '⚫ Lista Cancelada';
      embedColor = BOT_COLORS.DARK;
    } else if (isFull) {
      statusText = '🟡 Vagas Esgotadas (Lotada)';
      embedColor = BOT_COLORS.WARNING;
    }

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`📋 ${list.title}`)
      .setDescription(list.description || 'Clique nos botões abaixo para participar da lista.')
      .addFields(
        { name: 'Status', value: statusText, inline: true },
        { name: 'Vagas', value: `${count} / ${max}`, inline: true },
        { name: 'Organizador', value: `<@${list.createdByUserId}>`, inline: true },
      )
      .setFooter({ text: `ID da Lista: ${list.id}` })
      .setTimestamp(list.createdAt);

    if (count > 0) {
      const namesList = list.attendees
        .map((att, i) => `**${i + 1}.** ${att.username} (<@${att.userId}>)`)
        .join('\n');

      const truncated =
        namesList.length > 1000
          ? `${namesList.substring(0, 990)}...\n*(e mais participantes)*`
          : namesList;

      embed.addFields({ name: 'Participantes Confirmados', value: truncated, inline: false });
    } else {
      embed.addFields({
        name: 'Participantes Confirmados',
        value: '_Nenhum participante ainda._',
        inline: false,
      });
    }

    return embed;
  }

  /**
   * Builds ActionRow with interactive buttons
   */
  public buildListButtons(listId: string, isClosed: boolean): ActionRowBuilder<ButtonBuilder> {
    const joinBtn = new ButtonBuilder()
      .setCustomId(`list_join:${listId}`)
      .setLabel('Entrar na lista')
      .setStyle(ButtonStyle.Success)
      .setEmoji(BOT_EMOJIS.SUCCESS)
      .setDisabled(isClosed);

    const leaveBtn = new ButtonBuilder()
      .setCustomId(`list_leave:${listId}`)
      .setLabel('Sair da lista')
      .setStyle(ButtonStyle.Danger)
      .setEmoji(BOT_EMOJIS.ERROR)
      .setDisabled(isClosed);

    const viewBtn = new ButtonBuilder()
      .setCustomId(`list_view:${listId}`)
      .setLabel('Ver participantes')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(BOT_EMOJIS.LIST);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(joinBtn, leaveBtn, viewBtn);
  }

  /**
   * Synchronize and edit the Discord list message after attendees change
   */
  public async syncMessage(list: AttendeeListWithAttendees): Promise<void> {
    if (!list.messageId) return;

    try {
      const channel = await this.container.client.channels.fetch(list.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const message = await (channel as TextChannel).messages
        .fetch(list.messageId)
        .catch(() => null);
      if (!message) return;

      const guildConfig = await this.container.guildRepository.findByGuildId(list.guildId);
      const tz = guildConfig?.timezone || 'America/Sao_Paulo';

      const embed = this.buildListEmbed(list, tz);
      const components = [this.buildListButtons(list.id, list.status !== 'OPEN')];

      await message.edit({ embeds: [embed], components });
    } catch (error) {
      logger.error({ listId: list.id, error }, 'Failed to sync list message in Discord');
    }
  }

  /**
   * Generates CSV format string from attendee list
   */
  public generateCsv(list: AttendeeListWithAttendees, tz = 'America/Sao_Paulo'): string {
    const headers = ['Posicao', 'ID_Usuario', 'Nome_Usuario', 'Status', 'Data_Inscricao'];
    const rows = list.attendees.map((att, index) => {
      const dateFormatted = formatInTimezone(att.joinedAt, tz, 'DD/MM/YYYY HH:mm:ss');
      // Escape potential commas
      const cleanName = `"${att.username.replace(/"/g, '""')}"`;
      return [index + 1, att.userId, cleanName, att.status, `"${dateFormatted}"`].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
