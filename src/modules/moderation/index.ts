import { IModule } from '../../types/index.js';
import { clearCommand } from './commands/clear.command.js';

export const ModerationModule: IModule = {
  name: 'moderation',
  description: 'Módulo de moderação e limpeza de mensagens e canais',
  commands: [clearCommand],
};
