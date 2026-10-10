import { Events, VoiceState } from 'discord.js';
import { IEvent } from '../../../types/index.js';
import { Container } from '../../../core/container.js';
import { VoiceHubService } from '../services/voice-hub.service.js';

let serviceInstance: VoiceHubService | null = null;

export const voiceHubStateEvent: IEvent<Events.VoiceStateUpdate> = {
  name: Events.VoiceStateUpdate,
  execute: async (container: Container, oldState: VoiceState, newState: VoiceState) => {
    if (!serviceInstance) {
      serviceInstance = new VoiceHubService(container);
    }
    await serviceInstance.handleVoiceStateUpdate(oldState, newState);
  },
};
