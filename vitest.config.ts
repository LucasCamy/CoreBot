import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      BOT_TOKEN: 'mock-bot-token-for-tests',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_ALLOWED_GUILD_IDS: '123456789012345678',
      DATABASE_URL: 'postgresql://mock:mock@localhost:5432/mock',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      PORT: '3000',
      ADMIN_DASHBOARD_USER: 'admin',
      ADMIN_DASHBOARD_PASS: 'admin123',
      WEBHOOK_SECRET: 'test-secret',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@core': path.resolve(__dirname, './src/core'),
      '@discord': path.resolve(__dirname, './src/discord'),
      '@database': path.resolve(__dirname, './src/database'),
      '@jobs': path.resolve(__dirname, './src/jobs'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@customTypes': path.resolve(__dirname, './src/types'),
    },
  },
});
