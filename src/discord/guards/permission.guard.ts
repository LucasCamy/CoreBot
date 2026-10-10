import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { Container } from '../../core/container.js';

export class PermissionGuard {
  /**
   * Check if member has administrative authority in the guild
   */
  public static async isAdmin(member: GuildMember, container: Container): Promise<boolean> {
    // Server owner and users with native Administrator permission are always authorized
    if (member.guild.ownerId === member.id) return true;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

    // Check configured roles in GuildConfig
    const config = await container.guildRepository.findByGuildId(member.guild.id);
    if (!config || !config.adminRoleIds || config.adminRoleIds.length === 0) {
      return false;
    }

    const memberRoleIds = member.roles.cache.map((role) => role.id);
    return config.adminRoleIds.some((roleId) => memberRoleIds.includes(roleId));
  }
}
