import { IModule } from '../../types/index.js';
import { meuCargoCommand } from './commands/meucargo.command.js';
import { customRoleMemberRemoveEvent } from './events/member-remove.event.js';

export const CustomRolesModule: IModule = {
  name: 'custom-roles',
  description:
    'Criação e gerenciamento de cargos estéticos personalizados por usuários com hierarquia segura',
  commands: [meuCargoCommand],
  events: [customRoleMemberRemoveEvent],
};
