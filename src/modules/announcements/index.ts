import { IModule } from '../../types/index.js';
import { announceCommand } from './commands/announce.command.js';
import { announceModalHandler } from './modals/announce.modal.js';

export const AnnouncementsModule: IModule = {
  name: 'announcements',
  description: 'Envio de comunicados, mensagens e regras formatadas como o bot',
  commands: [announceCommand],
  modalHandlers: [announceModalHandler],
};
