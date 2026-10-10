import { IModule } from '../../types/index.js';
import { listCommand } from './commands/list.command.js';
import {
  listJoinButtonHandler,
  listLeaveButtonHandler,
  listViewButtonHandler,
} from './buttons/list.buttons.js';

export const AttendeeListsModule: IModule = {
  name: 'attendee-lists',
  description: 'Listas dinâmicas de presença com botões interativos e exportação CSV',
  commands: [listCommand],
  buttonHandlers: [listJoinButtonHandler, listLeaveButtonHandler, listViewButtonHandler],
};
