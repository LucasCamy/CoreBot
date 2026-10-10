import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required and cannot be empty'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required and cannot be empty'),
  DISCORD_ALLOWED_GUILD_IDS: z
    .string()
    .min(1, 'DISCORD_ALLOWED_GUILD_IDS is required')
    .transform((val) =>
      val
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required and cannot be empty'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z
    .string()
    .default('6379')
    .transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional().default(''),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  TIMEZONE: z.string().default('America/Sao_Paulo'),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),
  ADMIN_DASHBOARD_USER: z.string().default('admin'),
  ADMIN_DASHBOARD_PASS: z.string().default('changeme'),
  WEBHOOK_SECRET: z.string().default('corebot-super-secure-webhook-secret'),
  TWITCH_CLIENT_ID: z.string().optional().default(''),
  TWITCH_CLIENT_SECRET: z.string().optional().default(''),
});

export type EnvConfig = z.infer<typeof envSchema>;

let validatedEnv: EnvConfig;

try {
  validatedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors
      .map((err) => `  - [${err.path.join('.')}] ${err.message}`)
      .join('\n');
    // Using console.error here during early bootstrap before logger is initialized
    console.error(
      `\n❌ [STARTUP ERROR] Invalid environment configuration detected:\n${formattedErrors}\n\nPlease check your .env file before starting CoreBot.\n`,
    );
  } else {
    console.error('❌ [STARTUP ERROR] Failed to parse environment variables:', error);
  }
  process.exit(1);
}

export const env = validatedEnv;
