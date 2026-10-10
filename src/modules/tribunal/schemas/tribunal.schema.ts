import { z } from 'zod';

export const createTribunalCaseSchema = z.object({
  punishmentNickname: z
    .string()
    .min(1, 'O apelido deve ter pelo menos 1 caractere')
    .max(32, 'O apelido não pode ultrapassar 32 caracteres'),
  reason: z
    .string()
    .min(5, 'O motivo deve conter no mínimo 5 caracteres')
    .max(500, 'O motivo não pode ultrapassar 500 caracteres'),
  durationHours: z
    .number()
    .int()
    .min(1, 'A duração mínima é de 1 hora')
    .max(168, 'A duração máxima é de 168 horas (7 dias)'),
});

export type CreateTribunalCaseInput = z.infer<typeof createTribunalCaseSchema>;
