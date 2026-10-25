import { Events, GuildMember } from 'discord.js';
import { IEvent } from '../../../types/index.js';
import { Container } from '../../../core/container.js';
import { SystemMessagesService } from '../services/system-messages.service.js';

let serviceInstance: SystemMessagesService | null = null;

export const guildMemberUpdateEvent: IEvent<Events.GuildMemberUpdate> = {
  name: Events.GuildMemberUpdate,
  execute: async (container: Container, oldMember: GuildMember, newMember: GuildMember) => {
    if (!serviceInstance) {
      serviceInstance = new SystemMessagesService(container);
    }
    await serviceInstance.handleBoost(oldMember, newMember);
  },
};
