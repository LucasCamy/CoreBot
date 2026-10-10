import { PrismaClient, Quote } from '@prisma/client';

export interface CreateQuoteDTO {
  guildId: string;
  authorId: string;
  authorName: string;
  content: string;
  savedById: string;
  channelId: string;
}

export class QuoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: CreateQuoteDTO): Promise<Quote> {
    return this.prisma.quote.create({
      data: {
        guildId: data.guildId,
        authorId: data.authorId,
        authorName: data.authorName,
        content: data.content,
        savedById: data.savedById,
        channelId: data.channelId,
      },
    });
  }

  public async findById(id: string): Promise<Quote | null> {
    return this.prisma.quote.findUnique({
      where: { id },
    });
  }

  public async getRandom(guildId: string, authorId?: string): Promise<Quote | null> {
    const where: { guildId: string; authorId?: string } = { guildId };
    if (authorId) {
      where.authorId = authorId;
    }

    const count = await this.prisma.quote.count({ where });
    if (count === 0) return null;

    const skip = Math.floor(Math.random() * count);
    const quotes = await this.prisma.quote.findMany({
      where,
      skip,
      take: 1,
    });

    return quotes[0] || null;
  }

  public async findByAuthor(guildId: string, authorId: string): Promise<Quote[]> {
    return this.prisma.quote.findMany({
      where: { guildId, authorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findPaginated(
    guildId: string,
    authorId?: string,
    page = 1,
    pageSize = 5,
  ): Promise<{ quotes: Quote[]; total: number; totalPages: number; currentPage: number }> {
    const where: { guildId: string; authorId?: string } = { guildId };
    if (authorId) {
      where.authorId = authorId;
    }

    const total = await this.prisma.quote.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const quotes = await this.prisma.quote.findMany({
      where,
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    });

    return { quotes, total, totalPages, currentPage };
  }
}
