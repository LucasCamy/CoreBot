import { SlashCommandBuilder } from 'discord.js';
import { ICommand, CommandContext } from '../../../types/index.js';
import { QuoteService } from '../services/quote.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { buildQuotePaginationRow } from '../buttons/quote-pagination.button.js';

export const QuoteCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('perola')
    .setDescription('Exibe e consulta pérolas memoráveis registradas pelos membros')
    .addSubcommand((sub) =>
      sub.setName('aleatoria').setDescription('Exibe uma pérola aleatória do servidor'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('autor')
        .setDescription('Exibe uma pérola de um autor específico')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Membro que proferiu a pérola').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista pérolas cadastradas com paginação interativa')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Filtrar pérolas por autor (opcional)')
            .setRequired(false),
        ),
    ),

  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.interaction.options.getSubcommand();
    const quoteService = new QuoteService(ctx.container);

    if (sub === 'aleatoria') {
      const quote = await quoteService.getRandomQuote(ctx.guildId);
      if (!quote) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhuma Pérola Encontrada',
              'Ainda não há nenhuma pérola salva neste servidor. Use o menu de contexto (Apps > Salvar Pérola) em qualquer mensagem para registrar uma!',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const embed = quoteService.buildQuoteEmbed(quote);
      await ctx.interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'autor') {
      const targetUser = ctx.interaction.options.getUser('usuario', true);
      const quote = await quoteService.getRandomQuote(ctx.guildId, targetUser.id);

      if (!quote) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhuma Pérola',
              `Nenhuma pérola registrada para o autor <@${targetUser.id}>.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const embed = quoteService.buildQuoteEmbed(quote);
      await ctx.interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'listar') {
      const targetUser = ctx.interaction.options.getUser('usuario', false);
      const authorId = targetUser?.id;

      const result = await quoteService.getPaginatedQuotes(ctx.guildId, authorId, 1, 5);

      if (result.total === 0) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhuma Pérola Encontrada',
              targetUser
                ? `Nenhuma pérola registrada para <@${targetUser.id}>.`
                : 'Ainda não há nenhuma pérola cadastrada no servidor.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const authorName = targetUser ? targetUser.displayName : undefined;
      const embed = quoteService.buildQuoteListEmbed(
        result.quotes,
        result.total,
        result.currentPage,
        result.totalPages,
        authorName,
      );

      const row = buildQuotePaginationRow(result.currentPage, result.totalPages, authorId);

      await ctx.interaction.reply({
        embeds: [embed],
        components: [row],
      });
      return;
    }
  },
};
