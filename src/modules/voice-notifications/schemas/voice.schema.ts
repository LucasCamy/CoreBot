import { z } from 'zod';

export const voiceRuleEventTypeSchema = z.enum(['ALL', 'JOIN', 'LEAVE', 'MOVE']);

export const voiceConfigSchema = z.object({
  guildId: z.string().min(1),
  voiceChannelId: z.string().min(1),
  targetChannelId: z.string().min(1),
  eventType: voiceRuleEventTypeSchema.default('ALL'),
  enabled: z.boolean().default(true),
  joinMessage: z.string().min(1).default('👋 {userMention} entrou no canal {channelMention}!'),
  leaveMessage: z.string().min(1).default('🚪 {userMention} saiu do canal {channelMention}.'),
  moveMessage: z
    .string()
    .optional()
    .default('🔀 {userMention} mudou do canal {channelMention} para outro canal.'),
  mentionUser: z.boolean().default(true),
  useEmbed: z.boolean().default(false),
  embedColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor hex inválida (ex: #5865F2)')
    .optional()
    .default('#5865F2'),
  cooldownSeconds: z.number().int().min(0).max(3600).default(10),
});

export type VoiceConfigInput = z.infer<typeof voiceConfigSchema>;
export type VoiceRuleEventType = z.infer<typeof voiceRuleEventTypeSchema>;
