import { z } from 'zod';

const VALID_CLIP_DOMAINS = [
  'medal.tv',
  'youtube.com',
  'youtu.be',
  'twitch.tv',
  'streamable.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'clips.twitch.tv',
  'discord.com',
];

export const createClipSchema = z.object({
  title: z.string().min(3, 'O título deve ter no mínimo 3 caracteres').max(100),
  url: z
    .string()
    .url('Link inválido')
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return (
            VALID_CLIP_DOMAINS.some((domain) => parsed.hostname.includes(domain)) ||
            parsed.pathname.match(/\.(mp4|webm|mov)$/i) !== null
          );
        } catch {
          return false;
        }
      },
      {
        message:
          'O link deve ser de uma plataforma suportada (Medal, YouTube, Twitch, Streamable, TikTok, Twitter/X) ou arquivo de vídeo direto (.mp4, .webm).',
      },
    ),
  game: z.string().max(50).optional().nullable(),
});

export type CreateClipInput = z.infer<typeof createClipSchema>;
