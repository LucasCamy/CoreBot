import { IModule } from '../../types/index.js';
import { CountdownCommand } from './commands/countdown.command.js';
import { WrappedCommand } from './commands/wrapped.command.js';
import { VoiceActivityEvent } from './events/voice-activity.event.js';
import { Container } from '../../core/container.js';

let schedulerInstance: { stop(): void } | null = null;

export const SocialAnalyticsModule: IModule = {
  name: 'social-analytics',
  description: 'Wrapped de chamadas, despedidas noturnas e contagens regressivas comunitárias',
  commands: [CountdownCommand, WrappedCommand],
  events: [VoiceActivityEvent],

  async init(container: Container): Promise<void> {
    if (container.socialAnalyticsScheduler) {
      await container.socialAnalyticsScheduler.start();
      schedulerInstance = container.socialAnalyticsScheduler;
    }
  },

  async shutdown(): Promise<void> {
    if (schedulerInstance) {
      schedulerInstance.stop();
      schedulerInstance = null;
    }
  },
};
