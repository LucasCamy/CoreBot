import { describe, it, expect, vi } from 'vitest';
import { systemMessagesCommand } from '../../src/modules/system-messages/commands/system-messages.command.js';
import {
  updateWelcomeConfigSchema,
  updateBoostConfigSchema,
} from '../../src/modules/system-messages/schemas/system-messages.schema.js';
import { SystemMessagesService } from '../../src/modules/system-messages/services/system-messages.service.js';
import { Container } from '../../src/core/container.js';
import { GuildMember, Guild, TextChannel } from 'discord.js';
import { GuildGuard } from '../../src/discord/guards/guild.guard.js';

describe('System Messages Module', () => {
  describe('Slash Command Definition', () => {
    it('should be configured as adminOnly and have correct subcommands', () => {
      expect(systemMessagesCommand.adminOnly).toBe(true);
      const json = systemMessagesCommand.data.toJSON();
      expect(json.name).toBe('mensagens-sistema');

      const subcommandNames = json.options?.map((opt) => opt.name);
      expect(subcommandNames).toContain('boas-vindas');
      expect(subcommandNames).toContain('boost');
      expect(subcommandNames).toContain('painel');
      expect(subcommandNames).toContain('testar');
    });
  });

  describe('Schema Validation', () => {
    it('should accept valid welcome configs', () => {
      const res = updateWelcomeConfigSchema.safeParse({
        welcomeEnabled: true,
        welcomeChannelId: '1234567890',
        welcomeMessage: 'Bem-vindo ao {server}, {userMention}!',
        welcomeUseEmbed: true,
        welcomeColor: '#5865F2',
      });
      expect(res.success).toBe(true);
    });

    it('should reject invalid hex color', () => {
      const res = updateWelcomeConfigSchema.safeParse({
        welcomeColor: 'not-a-color',
      });
      expect(res.success).toBe(false);
    });

    it('should accept valid boost configs', () => {
      const res = updateBoostConfigSchema.safeParse({
        boostEnabled: true,
        boostChannelId: '9876543210',
        boostMessage: '🚀 {userMention} impulsionou o servidor!',
        boostUseEmbed: true,
        boostColor: '#F47FFF',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('SystemMessagesService', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const mockRepo = {
      getConfig: vi.fn(),
      upsertConfig: vi.fn(),
    };

    const mockTemplateService = {
      renderText: vi.fn((str) => str),
      renderMessage: vi.fn(() => ({
        content: 'Rendered content',
        embeds: [{ setThumbnail: vi.fn().mockReturnThis(), setFooter: vi.fn().mockReturnThis() }],
      })),
    };

    const mockNotificationService = {
      sendToChannel: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    const mockContainer = {
      systemMessagesRepository: mockRepo,
      templateService: mockTemplateService,
      notificationService: mockNotificationService,
    } as unknown as Container;

    const service = new SystemMessagesService(mockContainer);

    it('should skip handleWelcome if guild is not allowed', async () => {
      vi.spyOn(GuildGuard, 'isAllowed').mockReturnValue(false);

      const mockMember = {
        guild: { id: 'unauthorized-guild' },
      } as unknown as GuildMember;

      await service.handleWelcome(mockMember);
      expect(mockRepo.getConfig).not.toHaveBeenCalled();
    });

    it('should dispatch welcome message when member joins and welcome is enabled', async () => {
      vi.spyOn(GuildGuard, 'isAllowed').mockReturnValue(true);

      mockRepo.getConfig.mockResolvedValue({
        welcomeEnabled: true,
        welcomeChannelId: 'chan-welcome',
        welcomeMessage: 'Bem-vindo {userMention}!',
        welcomeUseEmbed: true,
        welcomeColor: '#5865F2',
      });

      const mockTextChannel = Object.create(TextChannel.prototype);
      mockTextChannel.id = 'chan-welcome';

      const mockMember = {
        id: 'user-1',
        displayName: 'JohnDoe',
        user: {
          username: 'johndoe',
          displayAvatarURL: vi.fn().mockReturnValue('https://avatar.url'),
        },
        guild: {
          id: 'guild-allowed',
          name: 'Uganda Server',
          memberCount: 42,
          iconURL: vi.fn().mockReturnValue('https://icon.url'),
          channels: {
            fetch: vi.fn().mockResolvedValue(mockTextChannel),
          },
        },
      } as unknown as GuildMember;

      await service.handleWelcome(mockMember);

      expect(mockNotificationService.sendToChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-allowed',
          channelId: 'chan-welcome',
          module: 'system-messages',
          eventType: 'WELCOME',
        }),
      );
    });

    it('should ignore boost event if user was not boosting and still is not boosting', async () => {
      vi.spyOn(GuildGuard, 'isAllowed').mockReturnValue(true);

      const oldMember = {
        premiumSince: null,
        guild: { id: 'guild-allowed' },
      } as unknown as GuildMember;

      const newMember = {
        premiumSince: null,
        guild: { id: 'guild-allowed' },
      } as unknown as GuildMember;

      await service.handleBoost(oldMember, newMember);
      expect(mockNotificationService.sendToChannel).not.toHaveBeenCalled();
    });

    it('should dispatch boost message when member starts boosting', async () => {
      vi.spyOn(GuildGuard, 'isAllowed').mockReturnValue(true);
      mockNotificationService.sendToChannel.mockClear();

      mockRepo.getConfig.mockResolvedValue({
        boostEnabled: true,
        boostChannelId: 'chan-boost',
        boostMessage: '🚀 {userMention} deu boost!',
        boostUseEmbed: true,
        boostColor: '#F47FFF',
      });

      const mockTextChannel = Object.create(TextChannel.prototype);
      mockTextChannel.id = 'chan-boost';

      const oldMember = {
        premiumSince: null,
        guild: { id: 'guild-allowed' },
      } as unknown as GuildMember;

      const boostDate = new Date();
      const newMember = {
        id: 'booster-1',
        displayName: 'SuperBooster',
        premiumSince: boostDate,
        user: {
          username: 'superbooster',
          displayAvatarURL: vi.fn().mockReturnValue('https://avatar.url'),
        },
        guild: {
          id: 'guild-allowed',
          name: 'Uganda Server',
          memberCount: 50,
          premiumSubscriptionCount: 5,
          premiumTier: 1,
          iconURL: vi.fn().mockReturnValue('https://icon.url'),
          channels: {
            fetch: vi.fn().mockResolvedValue(mockTextChannel),
          },
        },
      } as unknown as GuildMember;

      await service.handleBoost(oldMember, newMember);

      expect(mockNotificationService.sendToChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-allowed',
          channelId: 'chan-boost',
          module: 'system-messages',
          eventType: 'BOOST',
        }),
      );
    });

    it('should send test message successfully', async () => {
      mockRepo.getConfig.mockResolvedValue({
        welcomeEnabled: true,
        welcomeChannelId: 'chan-test',
        welcomeMessage: 'Bem-vindo {userMention}!',
        welcomeUseEmbed: true,
      });

      const mockTextChannel = Object.create(TextChannel.prototype);
      mockTextChannel.id = 'chan-test';

      const mockGuild = {
        id: 'guild-allowed',
        name: 'Uganda Server',
        memberCount: 42,
        premiumSubscriptionCount: 2,
        premiumTier: 1,
        iconURL: vi.fn(),
        channels: {
          fetch: vi.fn().mockResolvedValue(mockTextChannel),
        },
      } as unknown as Guild;

      const mockMember = {
        id: 'tester-1',
        displayName: 'Tester',
        user: {
          username: 'tester',
          displayAvatarURL: vi.fn().mockReturnValue('https://avatar.url'),
        },
      } as unknown as GuildMember;

      const res = await service.sendTestMessage(mockGuild, mockMember, 'boas-vindas');
      expect(res.success).toBe(true);
      expect(res.channelId).toBe('chan-test');
    });

    it('should fail test message if channel is not configured', async () => {
      mockRepo.getConfig.mockResolvedValue({
        welcomeChannelId: null,
      });

      const mockGuild = {
        id: 'guild-allowed',
      } as unknown as Guild;

      const mockMember = {} as unknown as GuildMember;

      const res = await service.sendTestMessage(mockGuild, mockMember, 'boas-vindas');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Nenhum canal de texto configurado');
    });
  });
});
