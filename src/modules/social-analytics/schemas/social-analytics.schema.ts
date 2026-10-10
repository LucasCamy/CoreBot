import { z } from 'zod';

export const createCountdownSchema = z.object({
  title: z
    .string()
    .min(2, 'O título da contagem regressiva deve ter pelo menos 2 caracteres')
    .max(80, 'O título não pode ultrapassar 80 caracteres'),
  dateString: z.string().min(5, 'Data inválida (ex: DD/MM/AAAA ou DD/MM/AAAA HH:mm)'),
});

export type CreateCountdownInput = z.infer<typeof createCountdownSchema>;
