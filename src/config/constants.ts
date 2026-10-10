export const BOT_COLORS = {
  PRIMARY: 0x5865f2,
  SUCCESS: 0x57f287,
  WARNING: 0xfee75c,
  DANGER: 0xed4245,
  INFO: 0x3498db,
  DARK: 0x2b2d31,
} as const;

export const BOT_EMOJIS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  VOICE: '🎙️',
  CALENDAR: '📅',
  LIST: '📋',
  CAKE: '🎂',
  SHIELD: '🛡️',
  GEAR: '⚙️',
  CLOCK: '⏰',
  QUOTE: '💬',
  GAME: '🎮',
  CLIP: '🎬',
  TRIBUNAL: '⚖️',
  SOUND: '🔊',
  FIRE: '🔥',
  SKULL: '💀',
} as const;

export const REQUIRED_BOT_CHANNEL_PERMISSIONS = [
  'ViewChannel',
  'SendMessages',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
] as const;

export const QUEUE_NAMES = {
  AGENDA_REMINDERS: 'agenda-reminders-queue',
  BIRTHDAY_GREETINGS: 'birthday-greetings-queue',
  DISCORD_NOTIFICATIONS: 'discord-notifications-queue',
  QUOTES_WEEKLY: 'quotes-weekly-queue',
  MATCHMAKING_REMINDERS: 'matchmaking-reminders-queue',
  CLIPS_MONTHLY: 'clips-monthly-queue',
  TRIBUNAL_EXPIRATION: 'tribunal-expiration-queue',
  SOCIAL_WRAPPED: 'social-wrapped-queue',
  COUNTDOWN_DAILY: 'countdown-daily-queue',
  SYSTEM_CLEANUP: 'system-cleanup-queue',
  DATABASE_BACKUP: 'database-backup-queue',
  TWITCH_POLLING: 'twitch-polling-queue',
} as const;
