import { IModule } from '../../types/index.js';
import { StreamCommand } from './commands/stream.command.js';
import { Container } from '../../core/container.js';

export const StreamNotifierModule: IModule = {
  name: 'stream-notifier',
  description: 'Monitoramento automatizado de lives da Twitch com alertas nos canais do servidor',
  commands: [StreamCommand],

  async init(container: Container): Promise<void> {
    await container.twitchScheduler.start();
  },
};
