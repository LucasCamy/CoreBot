import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import { IEvent } from '../../../types/index.js';
import { Container } from '../../../core/container.js';
import { CustomRoleService } from '../services/custom-role.service.js';

let serviceInstance: CustomRoleService | null = null;

export const customRoleMemberRemoveEvent: IEvent<Events.GuildMemberRemove> = {
  name: Events.GuildMemberRemove,
  execute: async (container: Container, member: GuildMember | PartialGuildMember) => {
    if (!serviceInstance) {
      serviceInstance = new CustomRoleService(container);
    }
    await serviceInstance.cleanupMemberRole(member.guild, member.id);
  },
};
