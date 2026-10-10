import { IModule } from '../../types/index.js';
import { agendaCommand } from './commands/agenda.command.js';
import { Container } from '../../core/container.js';

export const AgendaModule: IModule = {
  name: 'agenda',
  description: 'Sistema completo de agendamento de eventos e lembretes com timezone e BullMQ',
  commands: [agendaCommand],
  init: async (container: Container) => {
    // Start AgendaScheduler background processing
    await container.agendaScheduler.start();
  },
  shutdown: async () => {
    // Teardown logic handled cleanly
  },
};
