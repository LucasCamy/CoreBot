import { describe, it, expect, vi } from 'vitest';
import { voiceConfigSchema } from '../../src/modules/voice-notifications/schemas/voice.schema.js';
import { VoiceNotificationService } from '../../src/modules/voice-notifications/services/voice-notify.service.js';
import { Container } from '../../src/core/container.js';
import { VoiceState } from 'discord.js';

describe('Voice Notifications Module - Multi-Rule Support', () => {
  describe('Schema Validation', () => {
    it('should accept valid voice notification configs with different event types', () => {
      const validJoin = voiceConfigSchema.safeParse({
        guildId: 'guild-1',
        voiceChannelId: 'voice-1',
        targetChannelId: 'text-1',
        eventType: 'JOIN',
      });
      expect(validJoin.success).toBe(true);

      const validLeave = voiceConfigSchema.safeParse({
        guildId: 'guild-1',
        voiceChannelId: 'voice-1',
        targetChannelId: 'text-2',
        eventType: 'LEAVE',
      });
      expect(validLeave.success).toBe(true);

      const validAll = voiceConfigSchema.safeParse({
        guildId: 'guild-1',
        voiceChannelId: 'voice-1',
        targetChannelId: 'text-1',
        eventType: 'ALL',
      });
      expect(validAll.success).toBe(true);
    });

    it('should reject invalid event types', () => {
      const invalid = voiceConfigSchema.safeParse({
        guildId: 'guild-1',
        voiceChannelId: 'voice-1',
        targetChannelId: 'text-1',
        eventType: 'INVALID_TYPE',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('VoiceNotificationService Multi-Rule Routing', () => {
    it('should trigger multiple rules for entry and leave to different channels', async () => {
      const mockVoiceRepo = {
        findByChannel: vi.fn(),
      };
      const mockGuildRepo = {
        findByGuildId: vi.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }),
      };
      const mockTemplateService = {
        renderMessage: vi.fn().mockReturnValue({ content: 'Test message', embeds: [] }),
      };
      const mockNotificationService = {
        sendToChannel: vi.fn().mockResolvedValue({ success: true }),
      };

      const container = {
        voiceRepository: mockVoiceRepo,
        guildRepository: mockGuildRepo,
        templateService: mockTemplateService,
        notificationService: mockNotificationService,
      } as unknown as Container;

      const service = new VoiceNotificationService(container);

      // Two rules for the same voice channel: one for JOIN to text-1, one for LEAVE to text-2
      const rules = [
        {
          id: 'rule-join',
          guildId: 'guild-1',
          voiceChannelId: 'voice-general',
          targetChannelId: 'text-chat-general',
          eventType: 'JOIN',
          enabled: true,
          joinMessage: 'Entrou no canal!',
          leaveMessage: 'Saiu do canal!',
          mentionUser: true,
          useEmbed: false,
          cooldownSeconds: 0,
        },
        {
          id: 'rule-leave',
          guildId: 'guild-1',
          voiceChannelId: 'voice-general',
          targetChannelId: 'text-logs-audit',
          eventType: 'LEAVE',
          enabled: true,
          joinMessage: 'Entrou!',
          leaveMessage: 'Saiu!',
          mentionUser: false,
          useEmbed: true,
          cooldownSeconds: 0,
        },
      ];

      mockVoiceRepo.findByChannel.mockResolvedValue(rules);

      const mockMember = {
        id: 'user-1',
        displayName: 'Lucas',
        user: { bot: false, username: 'lucas' },
        guild: {
          id: 'guild-1',
          name: 'Core Guild',
          channels: {
            cache: new Map([['voice-general', { name: 'Geral Voice' }]]),
          },
        },
      };

      // 1. Simulate user joining voice-general
      const oldStateJoin = { channelId: null, member: mockMember, guild: mockMember.guild } as unknown as VoiceState;
      const newStateJoin = { channelId: 'voice-general', member: mockMember, guild: mockMember.guild } as unknown as VoiceState;

      await service.handleVoiceStateUpdate(oldStateJoin, newStateJoin);

      // Only the JOIN rule should be dispatched
      expect(mockNotificationService.sendToChannel).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.sendToChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'text-chat-general',
          eventType: 'voice_join',
        }),
      );

      mockNotificationService.sendToChannel.mockClear();

      // 2. Simulate user leaving voice-general
      const oldStateLeave = { channelId: 'voice-general', member: mockMember, guild: mockMember.guild } as unknown as VoiceState;
      const newStateLeave = { channelId: null, member: mockMember, guild: mockMember.guild } as unknown as VoiceState;

      await service.handleVoiceStateUpdate(oldStateLeave, newStateLeave);

      // Only the LEAVE rule should be dispatched
      expect(mockNotificationService.sendToChannel).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.sendToChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'text-logs-audit',
          eventType: 'voice_leave',
        }),
      );
    });
  });
});
