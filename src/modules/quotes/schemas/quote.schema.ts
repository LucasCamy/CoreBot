import { z } from 'zod';

export const createQuoteSchema = z.object({
  guildId: z.string().min(1, 'Guild ID é obrigatório'),
  authorId: z.string().min(1, 'Author ID é obrigatório'),
  authorName: z.string().min(1, 'Nome do autor é obrigatório'),
  content: z.string().min(1, 'Conteúdo da citação não pode ser vazio').max(2000),
  savedById: z.string().min(1, 'ID de quem salvou é obrigatório'),
  channelId: z.string().min(1, 'Channel ID é obrigatório'),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
