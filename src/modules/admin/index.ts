import { IModule } from '../../types/index.js';
import { botCommand } from './commands/bot.command.js';
import { Container } from '../../core/container.js';

export const AdminModule: IModule = {
  name: 'admin',
  description:
    'Módulo de administração do sistema, auditoria de permissões, healthcheck, limpeza e backups',
  commands: [botCommand],
  init: async (container: Container) => {
    await container.cleanupScheduler.start();
    await container.backupScheduler.start();
  },
};
