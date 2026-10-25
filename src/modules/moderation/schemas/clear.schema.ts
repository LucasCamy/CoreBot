import { z } from 'zod';

export const purgeMessagesSchema = z.object({
  quantidade: z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .min(1, 'A quantidade mínima de mensagens para apagar é 1')
    .max(100, 'A quantidade máxima por comando é 100 mensagens'),
  usuarioId: z.string().optional(),
  apenasBots: z.boolean().optional(),
  apenasAnexos: z.boolean().optional(),
});

export type PurgeMessagesInput = z.infer<typeof purgeMessagesSchema>;
