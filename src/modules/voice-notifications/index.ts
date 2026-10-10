import { IModule } from '../../types/index.js';
import { voiceNotifyCommand } from './commands/voice-notify.command.js';
import { voiceStateUpdateEvent } from './events/voice-state.event.js';

export const VoiceNotificationModule: IModule = {
  name: 'voice-notifications',
  description: 'Notificações automáticas de entrada e saída em canais de voz',
  commands: [voiceNotifyCommand],
  events: [voiceStateUpdateEvent],
};
