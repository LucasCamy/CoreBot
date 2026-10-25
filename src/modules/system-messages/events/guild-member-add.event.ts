import { Events, GuildMember } from 'discord.js';
import { IEvent } from '../../../types/index.js';
import { Container } from '../../../core/container.js';
import { SystemMessagesService } from '../services/system-messages.service.js';

let serviceInstance: SystemMessagesService | null = null;

export const guildMemberAddEvent: IEvent<Events.GuildMemberAdd> = {
  name: Events.GuildMemberAdd,
  execute: async (container: Container, member: GuildMember) => {
    if (!serviceInstance) {
      serviceInstance = new SystemMessagesService(container);
    }
    await serviceInstance.handleWelcome(member);
  },
};
