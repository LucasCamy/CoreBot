import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class GuildGuard {
  private static allowedGuildSet: Set<string> = new Set(env.DISCORD_ALLOWED_GUILD_IDS);

  /**
   * Check if a given guild ID is allowed to use this bot
   */
  public static isAllowed(guildId: string | null | undefined): boolean {
    if (!guildId) return false;
    const allowed = this.allowedGuildSet.has(guildId);
    if (!allowed) {
      logger.warn(
        { guildId, allowedGuilds: Array.from(this.allowedGuildSet) },
        'Access denied: Interaction or event received from unauthorized guild.',
      );
    }
    return allowed;
  }

  /**
   * Returns list of authorized guild IDs
   */
  public static getAllowedGuildIds(): string[] {
    return Array.from(this.allowedGuildSet);
  }
}
