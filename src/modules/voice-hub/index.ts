import { IModule } from '../../types/index.js';
import { voiceHubCommand } from './commands/voice-hub.command.js';
import { salaCommand } from './commands/sala.command.js';
import { voiceHubStateEvent } from './events/voice-hub.event.js';
import {
  voiceHubToggleLockButton,
  voiceHubInviteButton,
  voiceHubKickButton,
  voiceHubSetLimitButton,
  voiceHubRenameButton,
  voiceHubTransferOwnerButton,
  voiceHubLimitModalHandler,
  voiceHubRenameModalHandler,
  voiceHubSelectInviteHandler,
  voiceHubSelectKickHandler,
  voiceHubSelectOwnerHandler,
} from './handlers/voice-hub.interactive.js';

export const VoiceHubModule: IModule = {
  name: 'voice-hub',
  description:
    'Gerenciamento de hubs de canais de voz dinâmicos e temporários com suporte a salas públicas/privadas e whitelist',
  commands: [voiceHubCommand, salaCommand],
  events: [voiceHubStateEvent],
  buttonHandlers: [
    voiceHubToggleLockButton,
    voiceHubInviteButton,
    voiceHubKickButton,
    voiceHubSetLimitButton,
    voiceHubRenameButton,
    voiceHubTransferOwnerButton,
  ],
  modalHandlers: [voiceHubLimitModalHandler, voiceHubRenameModalHandler],
  selectMenuHandlers: [
    voiceHubSelectInviteHandler,
    voiceHubSelectKickHandler,
    voiceHubSelectOwnerHandler,
  ],
};
