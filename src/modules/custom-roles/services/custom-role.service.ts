import { ColorResolvable, Guild, GuildMember, PermissionFlagsBits, Role } from 'discord.js';
import { Container } from '../../../core/container.js';
import { UserCustomRole } from '@prisma/client';
import { logger } from '../../../utils/logger.js';
import {
  createCustomRoleSchema,
  updateColorSchema,
  updateNameSchema,
} from '../schemas/custom-role.schema.js';

export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class CustomRoleService {
  constructor(private readonly container: Container) {}

  /**
   * Check if member is allowed to have custom roles based on guild configuration
   */
  public async canManageCustomRole(
    member: GuildMember,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.container.customRoleRepository.getConfig(member.guild.id);

    if (config && !config.enabled) {
      return {
        allowed: false,
        reason: 'O sistema de cargos personalizados está desativado neste servidor.',
      };
    }

    // Server owner and Discord Administrators always have access
    if (
      member.guild.ownerId === member.id ||
      member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return { allowed: true };
    }

    // If allowedRoleIds is configured, check if member holds any of the permitted roles
    if (config && config.allowedRoleIds.length > 0) {
      const memberRoleIds = member.roles.cache.map((r) => r.id);
      const hasAllowedRole = config.allowedRoleIds.some((allowedId) =>
        memberRoleIds.includes(allowedId),
      );

      if (!hasAllowedRole) {
        return {
          allowed: false,
          reason:
            'Você não possui nenhum dos cargos necessários para criar ou gerenciar um cargo personalizado.',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Creates a brand new custom role for the member
   */
  public async createRole(
    member: GuildMember,
    rawName: string,
    rawColor: string,
  ): Promise<ServiceResult<UserCustomRole>> {
    const guild = member.guild;
    const repo = this.container.customRoleRepository;

    // 1. Permission check
    const permission = await this.canManageCustomRole(member);
    if (!permission.allowed) {
      return { success: false, error: permission.reason };
    }

    // 2. Validate maximum 1 custom role per user
    const existing = await repo.findByUser(guild.id, member.id);
    if (existing) {
      return {
        success: false,
        error: `Você já possui um cargo personalizado (<@&${existing.roleId}>). Utilize \`/meucargo cor\` ou \`/meucargo nome\` para alterá-lo, ou \`/meucargo remover\` para excluí-lo.`,
      };
    }

    // 3. Validate name and color with Zod
    const validation = createCustomRoleSchema.safeParse({ name: rawName, color: rawColor });
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message };
    }

    const { name, color } = validation.data;

    // 4. Verify bot permissions in guild
    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      logger.error({ guildId: guild.id }, 'Bot lacks ManageRoles permission to create custom role');
      return {
        success: false,
        error: 'O bot não possui a permissão de "Gerenciar Cargos" no servidor.',
      };
    }

    try {
      const colorInt = parseInt(color.replace('#', ''), 16) as ColorResolvable;

      // 5. Create role in Discord with EXATAMENTE 0 permissions (permissions: 0n)
      const newRole: Role = await guild.roles.create({
        name,
        color: colorInt,
        permissions: 0n, // Strict requirement: zero permissions
        mentionable: false,
        reason: `CoreBot: Cargo personalizado criado por ${member.user.tag} (${member.id})`,
      });

      // 6. Assign role to member
      await member.roles.add(newRole).catch((err) => {
        logger.warn(
          { error: err.message, memberId: member.id, roleId: newRole.id },
          'Failed to assign role to member',
        );
      });

      // 7. Position role right below anchorRoleId if configured
      const config = await repo.getConfig(guild.id);
      if (config && config.anchorRoleId) {
        await this.positionRoleBelowAnchor(guild, newRole, config.anchorRoleId, botMember);
      }

      // 8. Persist in database
      const saved = await repo.createCustomRole({
        guildId: guild.id,
        userId: member.id,
        roleId: newRole.id,
        name,
        color,
      });

      logger.info(
        { guildId: guild.id, userId: member.id, roleId: newRole.id, name, color },
        'Custom role created and assigned successfully',
      );

      return { success: true, data: saved };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        { error: msg, guildId: guild.id, userId: member.id },
        'Error during custom role creation',
      );
      return { success: false, error: `Falha ao criar o cargo no Discord: ${msg}` };
    }
  }

  /**
   * Updates custom role color
   */
  public async updateColor(
    member: GuildMember,
    rawColor: string,
  ): Promise<ServiceResult<UserCustomRole>> {
    const guild = member.guild;
    const repo = this.container.customRoleRepository;

    const permission = await this.canManageCustomRole(member);
    if (!permission.allowed) {
      return { success: false, error: permission.reason };
    }

    const validation = updateColorSchema.safeParse({ color: rawColor });
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message };
    }

    const { color } = validation.data;
    const existing = await repo.findByUser(guild.id, member.id);
    if (!existing) {
      return {
        success: false,
        error: 'Você não possui um cargo personalizado cadastrado. Use `/meucargo criar` primeiro.',
      };
    }

    try {
      const role = await guild.roles.fetch(existing.roleId).catch(() => null);
      if (role) {
        const colorInt = parseInt(color.replace('#', ''), 16) as ColorResolvable;
        await role.setColor(colorInt, `CoreBot: Cor atualizada por ${member.user.tag}`);
      }

      const updated = await repo.updateCustomRole(existing.id, { color });
      logger.info(
        { guildId: guild.id, userId: member.id, roleId: existing.roleId, color },
        'Custom role color updated',
      );
      return { success: true, data: updated };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        { error: msg, guildId: guild.id, userId: member.id },
        'Failed to update custom role color',
      );
      return { success: false, error: `Falha ao atualizar cor: ${msg}` };
    }
  }

  /**
   * Updates custom role name
   */
  public async updateName(
    member: GuildMember,
    rawName: string,
  ): Promise<ServiceResult<UserCustomRole>> {
    const guild = member.guild;
    const repo = this.container.customRoleRepository;

    const permission = await this.canManageCustomRole(member);
    if (!permission.allowed) {
      return { success: false, error: permission.reason };
    }

    const validation = updateNameSchema.safeParse({ name: rawName });
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message };
    }

    const { name } = validation.data;
    const existing = await repo.findByUser(guild.id, member.id);
    if (!existing) {
      return {
        success: false,
        error: 'Você não possui um cargo personalizado cadastrado. Use `/meucargo criar` primeiro.',
      };
    }

    try {
      const role = await guild.roles.fetch(existing.roleId).catch(() => null);
      if (role) {
        await role.setName(name, `CoreBot: Nome atualizado por ${member.user.tag}`);
      }

      const updated = await repo.updateCustomRole(existing.id, { name });
      logger.info(
        { guildId: guild.id, userId: member.id, roleId: existing.roleId, name },
        'Custom role name updated',
      );
      return { success: true, data: updated };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        { error: msg, guildId: guild.id, userId: member.id },
        'Failed to update custom role name',
      );
      return { success: false, error: `Falha ao atualizar nome: ${msg}` };
    }
  }

  /**
   * Deletes user's custom role
   */
  public async deleteRole(guild: Guild, userId: string): Promise<ServiceResult<null>> {
    const repo = this.container.customRoleRepository;
    const existing = await repo.findByUser(guild.id, userId);

    if (!existing) {
      return {
        success: false,
        error: 'Você não possui nenhum cargo personalizado cadastrado para remover.',
      };
    }

    try {
      const role = await guild.roles.fetch(existing.roleId).catch(() => null);
      if (role) {
        await role.delete('CoreBot: Cargo personalizado deletado pelo usuário').catch((err) => {
          logger.warn(
            { error: err.message, roleId: existing.roleId },
            'Could not delete role in Discord (might already be deleted)',
          );
        });
      }

      await repo.deleteCustomRole(guild.id, userId);
      logger.info(
        { guildId: guild.id, userId, roleId: existing.roleId },
        'Custom role deleted successfully',
      );
      return { success: true, data: null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg, guildId: guild.id, userId }, 'Failed to delete custom role');
      return { success: false, error: `Erro ao remover cargo: ${msg}` };
    }
  }

  /**
   * Cleanup triggered when a member leaves the server (guildMemberRemove)
   */
  public async cleanupMemberRole(guild: Guild, userId: string): Promise<void> {
    const repo = this.container.customRoleRepository;
    const existing = await repo.findByUser(guild.id, userId);
    if (!existing) return;

    try {
      const role = await guild.roles.fetch(existing.roleId).catch(() => null);
      if (role) {
        await role.delete(
          'CoreBot: Membro saiu do servidor, cargo personalizado excluído automaticamente',
        );
      }

      await repo.deleteCustomRole(guild.id, userId);
      logger.info(
        { guildId: guild.id, userId, roleId: existing.roleId },
        'Cleaned up custom role after member left the guild',
      );
    } catch (error) {
      logger.error(
        { error, guildId: guild.id, userId },
        'Error cleaning up custom role on member leave',
      );
    }
  }

  /**
   * Positions role directly below anchorRoleId
   */
  private async positionRoleBelowAnchor(
    guild: Guild,
    role: Role,
    anchorRoleId: string,
    botMember: GuildMember,
  ): Promise<void> {
    try {
      const anchorRole = await guild.roles.fetch(anchorRoleId).catch(() => null);
      if (!anchorRole) {
        logger.warn({ anchorRoleId }, 'Configured anchorRole not found in Discord guild');
        return;
      }

      const botHighestPosition = botMember.roles.highest.position;
      if (anchorRole.position >= botHighestPosition) {
        logger.warn(
          { anchorPosition: anchorRole.position, botPosition: botHighestPosition },
          'Anchor role is above or equal to bot highest role; cannot position above bot hierarchy',
        );
        return;
      }

      // Desired position is directly below the anchor role
      const targetPosition = Math.max(1, anchorRole.position - 1);
      await role.setPosition(targetPosition, {
        relative: false,
        reason: 'CoreBot: Posicionamento hierárquico abaixo do cargo âncora',
      });

      logger.debug(
        { roleId: role.id, anchorRoleId, targetPosition },
        'Positioned custom role below anchor role',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        { error: msg, roleId: role.id },
        'Could not adjust custom role hierarchy position',
      );
    }
  }
}
