import { IModule } from '../../types/index.js';
import { serverCommand } from './commands/server.command.js';
import { Container } from '../../core/container.js';
import { GameMonitorService } from './services/game-monitor.service.js';

let serviceInstance: GameMonitorService | null = null;

export const GameMonitorModule: IModule = {
  name: 'game-monitor',
  description:
    'Monitoramento contínuo de servidores de jogos (Minecraft, Source Engine e TCP) com BullMQ',
  commands: [serverCommand],
  init: async (container: Container) => {
    serviceInstance = new GameMonitorService(container);
    await serviceInstance.startScheduler();
  },
  shutdown: async () => {
    if (serviceInstance) {
      serviceInstance.stopScheduler();
      serviceInstance = null;
    }
  },
};
