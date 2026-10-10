import { z } from 'zod';

export const setBirthdaySchema = z.object({
  guildId: z.string().min(1),
  userId: z.string().min(1),
  dateStr: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Formato inválido. Use DD/MM/AAAA (ex: 15/05/1998)'),
  announcementChannelId: z.string().min(1),
  customMessage: z.string().max(500).optional().nullable(),
});

export type SetBirthdayInput = z.infer<typeof setBirthdaySchema>;
