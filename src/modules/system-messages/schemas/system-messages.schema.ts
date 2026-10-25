import { z } from 'zod';

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor hex inválida (deve ser no formato #RRGGBB, ex: #5865F2)')
  .optional()
  .nullable();

export const updateWelcomeConfigSchema = z.object({
  welcomeEnabled: z.boolean().optional(),
  welcomeChannelId: z.string().min(1).nullable().optional(),
  welcomeMessage: z.string().min(1).max(2000).optional(),
  welcomeUseEmbed: z.boolean().optional(),
  welcomeColor: hexColorSchema,
});

export const updateBoostConfigSchema = z.object({
  boostEnabled: z.boolean().optional(),
  boostChannelId: z.string().min(1).nullable().optional(),
  boostMessage: z.string().min(1).max(2000).optional(),
  boostUseEmbed: z.boolean().optional(),
  boostColor: hexColorSchema,
});

export type UpdateWelcomeConfigInput = z.infer<typeof updateWelcomeConfigSchema>;
export type UpdateBoostConfigInput = z.infer<typeof updateBoostConfigSchema>;
