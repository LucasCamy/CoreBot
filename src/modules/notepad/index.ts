import { IModule } from '../../types/index.js';
import { notasCommand } from './commands/notas.command.js';
import {
  notepadAddButton,
  notepadToggleButton,
  notepadEditButton,
  notepadDeleteItemButton,
  notepadClearDoneButton,
  notepadCustomizeButton,
  notepadToggleModeButton,
  notepadDeleteListButton,
  notepadAddModalHandler,
  notepadEditModalHandler,
  notepadCustomizeModalHandler,
  notepadToggleSelectHandler,
  notepadDeleteSelectHandler,
  notepadEditPickSelectHandler,
} from './handlers/notepad.interactive.js';

export const NotepadModule: IModule = {
  name: 'notepad',
  description: 'Sistema dinâmico e interativo de bloco de notas, listas e checklists colaborativos',
  commands: [notasCommand],
  buttonHandlers: [
    notepadAddButton,
    notepadToggleButton,
    notepadEditButton,
    notepadDeleteItemButton,
    notepadClearDoneButton,
    notepadCustomizeButton,
    notepadToggleModeButton,
    notepadDeleteListButton,
  ],
  modalHandlers: [
    notepadAddModalHandler,
    notepadEditModalHandler,
    notepadCustomizeModalHandler,
  ],
  selectMenuHandlers: [
    notepadToggleSelectHandler,
    notepadDeleteSelectHandler,
    notepadEditPickSelectHandler,
  ],
};
