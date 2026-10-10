import { describe, it, expect } from 'vitest';
import { GuildGuard } from '../../src/discord/guards/guild.guard.js';
import { env } from '../../src/config/env.js';

describe('GuildGuard', () => {
  it('should authorize guild IDs present in DISCORD_ALLOWED_GUILD_IDS', () => {
    const allowedId = env.DISCORD_ALLOWED_GUILD_IDS[0];
    expect(GuildGuard.isAllowed(allowedId)).toBe(true);
  });

  it('should deny unauthorized guild IDs', () => {
    const unauthorizedGuildId = '999999999999999999';
    expect(GuildGuard.isAllowed(unauthorizedGuildId)).toBe(false);
  });

  it('should return false for null or undefined guild IDs', () => {
    expect(GuildGuard.isAllowed(null)).toBe(false);
    expect(GuildGuard.isAllowed(undefined)).toBe(false);
    expect(GuildGuard.isAllowed('')).toBe(false);
  });
});
