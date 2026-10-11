import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
  ColorResolvable,
} from 'discord.js';
import { Container } from '../../../core/container.js';
import { NotepadListWithItems } from '../../../database/repositories/notepad.repository.js';
import { logger } from '../../../utils/logger.js';

export class NotepadService {
  constructor(private readonly container: Container) {}

  /**
   * Builds the Discord Embed and ActionRow components for a Notepad List
   */
  public renderList(list: NotepadListWithItems): {
    embeds: [EmbedBuilder];
    components: [ActionRowBuilder<ButtonBuilder>, ActionRowBuilder<ButtonBuilder>];
  } {
    const totalItems = list.items.length;
    const completedItems = list.items.filter((i) => i.isCompleted).length;
    const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    // Build progress bar
    const totalBars = 10;
    const filledBars = Math.round((percent / 100) * totalBars);
    const progressBar = '🟩'.repeat(filledBars) + '⬜'.repeat(totalBars - filledBars);

    let descriptionLines: string[] = [];

    if (list.description) {
      descriptionLines.push(`*${list.description}*\n`);
    }

    const modeBadge = list.isCollaborative
      ? '👥 **Modo:** Colaborativo (Qualquer membro pode editar e marcar)'
      : `🔒 **Modo:** Pessoal (Apenas o autor <@${list.ownerId}> pode editar)`;
    descriptionLines.push(modeBadge);

    if (totalItems > 0) {
      descriptionLines.push(
        `📊 **Progresso:** [${progressBar}] **${percent}%** (${completedItems}/${totalItems})\n`,
      );
    } else {
      descriptionLines.push('📊 **Progresso:** [⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜] **0%** (0 itens)\n');
    }

    descriptionLines.push('──────────────────────────────');

    if (totalItems === 0) {
      descriptionLines.push(
        '\n*Nenhum item na lista ainda. Clique em "➕ Adicionar" abaixo para começar!*',
      );
    } else {
      // Display up to 25 items cleanly
      const displayItems = list.items.slice(0, 25);
      displayItems.forEach((item, idx) => {
        const itemNumber = idx + 1;
        if (item.isCompleted) {
          const completedBy = item.completedByUserId ? ` • <@${item.completedByUserId}>` : '';
          descriptionLines.push(`✅ ~~**${itemNumber}.** ${item.content}~~${completedBy}`);
        } else {
          descriptionLines.push(`⬜ **${itemNumber}.** ${item.content}`);
        }
      });

      if (totalItems > 25) {
        descriptionLines.push(`\n*... e mais ${totalItems - 25} item(ns).*`);
      }
    }

    descriptionLines.push('──────────────────────────────');

    const embed = new EmbedBuilder()
      .setTitle(`📝 ${list.title}`)
      .setDescription(descriptionLines.join('\n').slice(0, 4000))
      .setColor((list.color || '#5865F2') as ColorResolvable)
      .setFooter({
        text: `ID: ${list.id} • Criado por @${list.ownerId}`,
      })
      .setTimestamp(list.updatedAt);

    // Row 1: Item Actions
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`notepad_btn_add_${list.id}`)
        .setLabel('Adicionar')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`notepad_btn_toggle_${list.id}`)
        .setLabel('Concluir / Desmarcar')
        .setEmoji('🔘')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(totalItems === 0),
      new ButtonBuilder()
        .setCustomId(`notepad_btn_edit_${list.id}`)
        .setLabel('Editar Item')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalItems === 0),
      new ButtonBuilder()
        .setCustomId(`notepad_btn_delitem_${list.id}`)
        .setLabel('Excluir Item')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalItems === 0),
    );

    // Row 2: List Management
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`notepad_btn_clear_${list.id}`)
        .setLabel('Limpar Concluídos')
        .setEmoji('🧹')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(completedItems === 0),
      new ButtonBuilder()
        .setCustomId(`notepad_btn_custom_${list.id}`)
        .setLabel('Personalizar')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`notepad_btn_mode_${list.id}`)
        .setLabel(list.isCollaborative ? 'Tornar Privado' : 'Tornar Público')
        .setEmoji(list.isCollaborative ? '🔒' : '👥')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`notepad_btn_dellist_${list.id}`)
        .setLabel('Apagar Lista')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    return {
      embeds: [embed],
      components: [row1, row2],
    };
  }

  /**
   * Refreshes the list message in Discord channel
   */
  public async refreshListMessage(listId: string, channel?: TextChannel): Promise<boolean> {
    try {
      const list = await this.container.notepadRepository.findById(listId);
      if (!list || !list.messageId) return false;

      let targetChannel = channel;
      if (!targetChannel) {
        const fetched = await this.container.client.channels
          .fetch(list.channelId)
          .catch(() => null);
        if (fetched && fetched.isTextBased() && 'messages' in fetched) {
          targetChannel = fetched as TextChannel;
        }
      }

      if (!targetChannel) return false;

      const message = await targetChannel.messages.fetch(list.messageId).catch(() => null);
      if (!message) return false;

      const rendered = this.renderList(list);
      await message.edit({
        embeds: rendered.embeds,
        components: rendered.components,
      });

      return true;
    } catch (error) {
      logger.error({ listId, error }, 'Failed to refresh notepad list message');
      return false;
    }
  }
}
