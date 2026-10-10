import { Events, VoiceState } from 'discord.js';
import { IEvent } from '../../../types/index.js';
import { Container } from '../../../core/container.js';
import { VoiceNotificationService } from '../services/voice-notify.service.js';

let serviceInstance: VoiceNotificationService | null = null;

export const voiceStateUpdateEvent: IEvent<Events.VoiceStateUpdate> = {
  name: Events.VoiceStateUpdate,
  execute: async (container: Container, oldState: VoiceState, newState: VoiceState) => {
    if (!serviceInstance) {
      serviceInstance = new VoiceNotificationService(container);
    }
    await serviceInstance.handleVoiceStateUpdate(oldState, newState);
  },
};
