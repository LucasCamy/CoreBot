import { IModule } from '../../types/index.js';
import { ClipCommand } from './commands/clip.command.js';
import { ClipVoteButtonHandler } from './buttons/clip-vote.button.js';
import { Container } from '../../core/container.js';

let schedulerInstance: { stop(): void } | null = null;

export const ClipsModule: IModule = {
  name: 'clips',
  description: 'Catálogo de clipes da comunidade, votações e Clipe do Mês',
  commands: [ClipCommand],
  buttonHandlers: [ClipVoteButtonHandler],

  async init(container: Container): Promise<void> {
    if (container.clipsScheduler) {
      await container.clipsScheduler.start();
      schedulerInstance = container.clipsScheduler;
    }
  },

  async shutdown(): Promise<void> {
    if (schedulerInstance) {
      schedulerInstance.stop();
      schedulerInstance = null;
    }
  },
};
