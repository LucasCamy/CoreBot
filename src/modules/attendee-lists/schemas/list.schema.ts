import { z } from 'zod';

export const createListSchema = z.object({
  guildId: z.string().min(1),
  title: z.string().min(2, 'O título da lista deve ter pelo menos 2 caracteres').max(100),
  description: z.string().max(1000).optional().nullable(),
  channelId: z.string().min(1),
  maxSlots: z.number().int().positive().optional().nullable(),
  createdByUserId: z.string().min(1),
});

export type CreateListInput = z.infer<typeof createListSchema>;
