import { IModule } from '../../types/index.js';
import { systemMessagesCommand } from './commands/system-messages.command.js';
import { guildMemberAddEvent } from './events/guild-member-add.event.js';
import { guildMemberUpdateEvent } from './events/guild-member-update.event.js';

export const SystemMessagesModule: IModule = {
  name: 'system-messages',
  description: 'Substituição das mensagens de sistema do servidor (boas-vindas e server boost)',
  commands: [systemMessagesCommand],
  events: [guildMemberAddEvent, guildMemberUpdateEvent],
};
