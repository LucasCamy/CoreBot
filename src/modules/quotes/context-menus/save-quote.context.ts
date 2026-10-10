import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
} from 'discord.js';
import { IContextMenuCommand, ContextMenuContext } from '../../../types/index.js';
import { QuoteService } from '../services/quote.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { logger } from '../../../utils/logger.js';

export const SaveQuoteContextMenu: IContextMenuCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Salvar Pérola')
    .setType(ApplicationCommandType.Message),

  async execute(ctx: ContextMenuContext): Promise<void> {
    const interaction = ctx.interaction as MessageContextMenuCommandInteraction;
    const targetMessage = interaction.targetMessage;

    if (!targetMessage) {
      await interaction.reply({
        embeds: [BotEmbed.error('Erro', 'Mensagem de destino não encontrada.')],
        ephemeral: true,
      });
      return;
    }

    const content = targetMessage.content?.trim();
    if (!content) {
      await interaction.reply({
        embeds: [
          BotEmbed.warning(
            'Mensagem Vazia',
            'Apenas mensagens com conteúdo de texto podem ser salvas como pérola.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (targetMessage.author.bot) {
      await interaction.reply({
        embeds: [BotEmbed.warning('Aviso', 'Mensagens de bots não podem ser salvas como pérolas.')],
        ephemeral: true,
      });
      return;
    }

    try {
      const quoteService = new QuoteService(ctx.container);
      const quote = await quoteService.saveQuote({
        guildId: ctx.guildId,
        authorId: targetMessage.author.id,
        authorName: targetMessage.author.displayName || targetMessage.author.username,
        content,
        savedById: ctx.member.id,
        channelId: targetMessage.channelId,
      });

      logger.info(
        {
          quoteId: quote.id,
          authorId: targetMessage.author.id,
          savedById: ctx.member.id,
          guildId: ctx.guildId,
        },
        'Quote saved via context menu',
      );

      const embed = quoteService.buildQuoteEmbed(quote);
      await interaction.reply({
        content: `✨ Pérola de <@${targetMessage.author.id}> salva no banco de dados!`,
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      logger.error({ error, guildId: ctx.guildId }, 'Failed to save quote via context menu');
      await interaction.reply({
        embeds: [BotEmbed.error('Erro ao Salvar', 'Não foi possível salvar esta pérola no banco.')],
        ephemeral: true,
      });
    }
  },
};
