import { IModule } from '../../types/index.js';
import { TribunalCommand } from './commands/tribunal.command.js';
import { TribunalVoteButtonHandler } from './buttons/tribunal-vote.button.js';
import { Container } from '../../core/container.js';

let schedulerInstance: { stop(): void } | null = null;

export const TribunalModule: IModule = {
  name: 'tribunal',
  description: 'Tribunal do Servidor: votações relâmpago, julgamentos e castigos de apelido',
  commands: [TribunalCommand],
  buttonHandlers: [TribunalVoteButtonHandler],

  async init(container: Container): Promise<void> {
    if (container.tribunalScheduler) {
      await container.tribunalScheduler.start();
      schedulerInstance = container.tribunalScheduler;
    }
  },

  async shutdown(): Promise<void> {
    if (schedulerInstance) {
      schedulerInstance.stop();
      schedulerInstance = null;
    }
  },
};
