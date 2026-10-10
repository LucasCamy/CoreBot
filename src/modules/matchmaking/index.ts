import { IModule } from '../../types/index.js';
import { JogarCommand } from './commands/jogar.command.js';
import { LobbyButtonHandler } from './buttons/lobby.buttons.js';
import { Container } from '../../core/container.js';

let schedulerInstance: { stop(): void } | null = null;

export const MatchmakingModule: IModule = {
  name: 'matchmaking',
  description: 'Painel de Jogatina & Lobbies dinâmicos com threads automáticas',
  commands: [JogarCommand],
  buttonHandlers: [LobbyButtonHandler],

  async init(container: Container): Promise<void> {
    if (container.matchmakingScheduler) {
      await container.matchmakingScheduler.start();
      schedulerInstance = container.matchmakingScheduler;
    }
  },

  async shutdown(): Promise<void> {
    if (schedulerInstance) {
      schedulerInstance.stop();
      schedulerInstance = null;
    }
  },
};
