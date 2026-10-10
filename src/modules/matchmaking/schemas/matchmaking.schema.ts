import { z } from 'zod';

export const createLobbySchema = z.object({
  gameName: z.string().min(2, 'O nome do jogo deve ter pelo menos 2 caracteres').max(64),
  timeString: z.string().min(2, 'Horário inválido'),
  maxPlayers: z.number().int().min(2).max(100).optional().nullable(),
});

export type CreateLobbyInput = z.infer<typeof createLobbySchema>;
