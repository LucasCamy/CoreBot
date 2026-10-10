import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { IButtonHandler, ButtonContext } from '../../../types/index.js';
import { QuoteService } from '../services/quote.service.js';

export function buildQuotePaginationRow(
  currentPage: number,
  totalPages: number,
  authorId?: string,
): ActionRowBuilder<ButtonBuilder> {
  const authorKey = authorId || 'all';

  const prevBtn = new ButtonBuilder()
    .setCustomId(`quote_page:prev:${currentPage}:${authorKey}`)
    .setLabel('◀️ Anterior')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage <= 1);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`quote_page:next:${currentPage}:${authorKey}`)
    .setLabel('Próximo ▶️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);
}

export const QuotePaginationButtonHandler: IButtonHandler = {
  customIdPrefix: 'quote_page',

  async execute(ctx: ButtonContext): Promise<void> {
    const parts = ctx.interaction.customId.split(':');
    // Format: quote_page:action:page:authorKey
    const action = parts[1];
    const pageNum = parseInt(parts[2], 10) || 1;
    const authorKey = parts[3];
    const authorId = authorKey === 'all' ? undefined : authorKey;

    const newPage = action === 'next' ? pageNum + 1 : pageNum - 1;

    const quoteService = new QuoteService(ctx.container);
    const result = await quoteService.getPaginatedQuotes(ctx.guildId, authorId, newPage, 5);

    let authorName: string | undefined;
    if (authorId) {
      const member = await ctx.guild.members.fetch(authorId).catch(() => null);
      authorName = member ? member.displayName : `<@${authorId}>`;
    }

    const embed = quoteService.buildQuoteListEmbed(
      result.quotes,
      result.total,
      result.currentPage,
      result.totalPages,
      authorName,
    );

    const row = buildQuotePaginationRow(result.currentPage, result.totalPages, authorId);

    await ctx.interaction.update({
      embeds: [embed],
      components: [row],
    });
  },
};
