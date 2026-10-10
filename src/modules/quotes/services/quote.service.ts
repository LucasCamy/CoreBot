import { Quote } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';
import { Container } from '../../../core/container.js';
import { CreateQuoteInput, createQuoteSchema } from '../schemas/quote.schema.js';
import { BOT_COLORS, BOT_EMOJIS } from '../../../config/constants.js';

export class QuoteService {
  constructor(private readonly container: Container) {}

  public async saveQuote(input: CreateQuoteInput): Promise<Quote> {
    const validated = createQuoteSchema.parse(input);
    return this.container.quoteRepository.create(validated);
  }

  public async getRandomQuote(guildId: string, authorId?: string): Promise<Quote | null> {
    return this.container.quoteRepository.getRandom(guildId, authorId);
  }

  public async getQuotesByAuthor(guildId: string, authorId: string): Promise<Quote[]> {
    return this.container.quoteRepository.findByAuthor(guildId, authorId);
  }

  public async getPaginatedQuotes(
    guildId: string,
    authorId?: string,
    page = 1,
    pageSize = 5,
  ): Promise<{ quotes: Quote[]; total: number; totalPages: number; currentPage: number }> {
    return this.container.quoteRepository.findPaginated(guildId, authorId, page, pageSize);
  }

  public buildQuoteEmbed(quote: Quote): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(BOT_COLORS.PRIMARY)
      .setTitle(`${BOT_EMOJIS.QUOTE} Pérola Registrada`)
      .setDescription(`>>> *"${quote.content}"*`)
      .addFields(
        { name: '👤 Autor', value: `<@${quote.authorId}> (${quote.authorName})`, inline: true },
        { name: '💾 Salvo por', value: `<@${quote.savedById}>`, inline: true },
        {
          name: '📅 Data',
          value: `<t:${Math.floor(quote.createdAt.getTime() / 1000)}:f>`,
          inline: true,
        },
      )
      .setFooter({ text: `ID: ${quote.id.slice(0, 8)} • CoreBot Quotes` });
  }

  public buildQuoteListEmbed(
    quotes: Quote[],
    total: number,
    currentPage: number,
    totalPages: number,
    authorFilterName?: string,
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.INFO)
      .setTitle(
        authorFilterName
          ? `📚 Pérolas de ${authorFilterName} (${total} registradas)`
          : `📚 Catálogo de Pérolas (${total} registradas)`,
      )
      .setFooter({ text: `Página ${currentPage} de ${totalPages} • CoreBot Quotes` });

    if (quotes.length === 0) {
      embed.setDescription('*Nenhuma pérola encontrada.*');
      return embed;
    }

    const description = quotes
      .map((q, idx) => {
        const num = (currentPage - 1) * 5 + idx + 1;
        const time = `<t:${Math.floor(q.createdAt.getTime() / 1000)}:d>`;
        return `**#${num}** *"${q.content}"*\n— <@${q.authorId}> em ${time} *(salvo por <@${q.savedById}>)*\n`;
      })
      .join('\n');

    embed.setDescription(description);
    return embed;
  }
}
