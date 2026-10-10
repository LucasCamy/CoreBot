import { z } from 'zod';

export const createEventSchema = z.object({
  guildId: z.string().min(1),
  title: z.string().min(2, 'O título deve ter pelo menos 2 caracteres').max(100),
  description: z.string().max(1000).optional().nullable(),
  dateStr: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Formato de data inválido. Use DD/MM/AAAA'),
  timeStr: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido. Use HH:MM'),
  reminderChannelId: z.string().min(1),
  reminderMinutesBefore: z.array(z.number().int().positive()).default([60, 30, 10, 5]),
  createdByUserId: z.string().min(1),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
