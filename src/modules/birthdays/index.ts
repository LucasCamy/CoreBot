import { IModule } from '../../types/index.js';
import { birthdayCommand } from './commands/birthday.command.js';
import { Container } from '../../core/container.js';

export const BirthdayModule: IModule = {
  name: 'birthdays',
  description: 'Módulo de comemoração de aniversários automático com fuso horário e BullMQ',
  commands: [birthdayCommand],
  init: async (container: Container) => {
    // Start background birthday scheduler
    await container.birthdayScheduler.start();
  },
};
