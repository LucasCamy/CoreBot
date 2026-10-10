import { IModule } from '../../types/index.js';
import { TocarCommand } from './commands/tocar.command.js';
import { SonsCommand } from './commands/sons.command.js';

export const SoundboardModule: IModule = {
  name: 'soundboard',
  description: 'Soundboard dinâmico em canais de voz com arquivos locais e locks de reprodução',
  commands: [TocarCommand, SonsCommand],
};
