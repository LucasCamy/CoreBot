import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCommand } from '../../src/modules/moderation/commands/clear.command.js';
import { purgeMessagesSchema } from '../../src/modules/moderation/schemas/clear.schema.js';
import { ClearService } from '../../src/modules/moderation/services/clear.service.js';
import { Container } from '../../src/core/container.js';
import { GuildMember, PermissionFlagsBits, PermissionsBitField, TextChannel } from 'discord.js';

describe('Moderation Module (/limpar)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Slash Command Definition', () => {
    it('should be configured as adminOnly with subcommands mensagens and canal', () => {
      expect(clearCommand.adminOnly).toBe(true);
      const json = clearCommand.data.toJSON();
      expect(json.name).toBe('limpar');

      const subcommandNames = json.options?.map((opt) => opt.name);
      expect(subcommandNames).toContain('mensagens');
      expect(subcommandNames).toContain('canal');
    });
  });

  describe('Schema Validation', () => {
    it('should accept valid quantities between 1 and 100', () => {
      const minVal = purgeMessagesSchema.safeParse({ quantidade: 1 });
      const maxVal = purgeMessagesSchema.safeParse({ quantidade: 100 });
      const withFilters = purgeMessagesSchema.safeParse({
        quantidade: 50,
        usuarioId: '123456',
        apenasBots: true,
        apenasAnexos: false,
      });

      expect(minVal.success).toBe(true);
      expect(maxVal.success).toBe(true);
      expect(withFilters.success).toBe(true);
    });

    it('should reject invalid quantities (0, > 100, negative or float)', () => {
      expect(purgeMessagesSchema.safeParse({ quantidade: 0 }).success).toBe(false);
      expect(purgeMessagesSchema.safeParse({ quantidade: 101 }).success).toBe(false);
      expect(purgeMessagesSchema.safeParse({ quantidade: -5 }).success).toBe(false);
      expect(purgeMessagesSchema.safeParse({ quantidade: 10.5 }).success).toBe(false);
    });
  });

  describe('ClearService - purgeMessages', () => {
    const mockContainer = {
      prisma: {
        systemMessageConfig: { updateMany: vi.fn() },
        voiceNotificationConfig: { updateMany: vi.fn() },
        webhookConfig: { updateMany: vi.fn() },
        notepadList: { updateMany: vi.fn() },
        countdown: { updateMany: vi.fn() },
        streamerConfig: { updateMany: vi.fn() },
      },
    } as unknown as Container;

    const service = new ClearService(mockContainer);

    it('should fail if bot lacks ManageMessages permission', async () => {
      const mockPerms = new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
      ]); // Missing ManageMessages

      const mockChannel = {
        permissionsFor: vi.fn().mockReturnValue(mockPerms),
      } as unknown as TextChannel;

      const mockBotMember = {} as unknown as GuildMember;

      const res = await service.purgeMessages(mockChannel, { quantidade: 10 }, mockBotMember);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Gerenciar Mensagens');
    });

    it('should delete messages matching user filter', async () => {
      const mockPerms = new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ]);

      const messages = new Map([
        ['msg-1', { id: 'msg-1', author: { id: 'user-1', bot: false }, attachments: new Map() }],
        ['msg-2', { id: 'msg-2', author: { id: 'user-2', bot: false }, attachments: new Map() }],
        ['msg-3', { id: 'msg-3', author: { id: 'user-1', bot: false }, attachments: new Map() }],
      ]);

      const mockChannel = {
        guild: { id: 'guild-1' },
        id: 'chan-1',
        permissionsFor: vi.fn().mockReturnValue(mockPerms),
        messages: {
          fetch: vi.fn().mockResolvedValue(messages),
        },
        bulkDelete: vi.fn().mockResolvedValue(
          new Map([
            ['msg-1', {}],
            ['msg-3', {}],
          ]),
        ),
      } as unknown as TextChannel;

      const mockBotMember = {} as unknown as GuildMember;

      const res = await service.purgeMessages(
        mockChannel,
        { quantidade: 10, usuarioId: 'user-1' },
        mockBotMember,
      );

      expect(res.success).toBe(true);
      expect(res.deletedCount).toBe(2);
      expect(mockChannel.bulkDelete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'msg-1' }),
          expect.objectContaining({ id: 'msg-3' }),
        ]),
        true,
      );
    });
  });

  describe('ClearService - nukeChannel', () => {
    const mockPrisma = {
      systemMessageConfig: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      voiceNotificationConfig: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      webhookConfig: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      notepadList: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      countdown: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      streamerConfig: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };

    const mockContainer = {
      prisma: mockPrisma,
    } as unknown as Container;

    const service = new ClearService(mockContainer);

    it('should fail if bot lacks ManageChannels permission', async () => {
      const mockPerms = new PermissionsBitField([]); // Missing ManageChannels

      const mockChannel = {
        permissionsFor: vi.fn().mockReturnValue(mockPerms),
      } as unknown as TextChannel;

      const mockMember = { id: 'admin-1', user: { tag: 'Admin#0001' } } as unknown as GuildMember;
      const mockBotMember = {} as unknown as GuildMember;

      const res = await service.nukeChannel(mockChannel, mockMember, mockBotMember);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Gerenciar Canais');
    });

    it('should clone, update db references and delete original channel on nuke', async () => {
      const mockPerms = new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ManageChannels,
      ]);

      const mockClonedChannel = {
        id: 'new-chan-id',
        setPosition: vi.fn().mockResolvedValue({}),
        send: vi.fn().mockResolvedValue({}),
      };

      const mockChannel = {
        guild: { id: 'guild-1' },
        id: 'old-chan-id',
        name: 'geral',
        topic: 'Canal geral',
        nsfw: false,
        position: 3,
        parentId: 'cat-1',
        rateLimitPerUser: 5,
        permissionOverwrites: { cache: new Map() },
        deletable: true,
        clone: vi.fn().mockResolvedValue(mockClonedChannel),
        delete: vi.fn().mockResolvedValue({}),
        permissionsFor: vi.fn().mockReturnValue(mockPerms),
      } as unknown as TextChannel;

      const mockMember = { id: 'admin-1', user: { tag: 'Admin#0001' } } as unknown as GuildMember;
      const mockBotMember = {} as unknown as GuildMember;

      const res = await service.nukeChannel(
        mockChannel,
        mockMember,
        mockBotMember,
        'Limpeza anual',
      );

      expect(res.success).toBe(true);
      expect(res.newChannelId).toBe('new-chan-id');
      expect(mockChannel.clone).toHaveBeenCalled();
      expect(mockClonedChannel.setPosition).toHaveBeenCalledWith(3);
      expect(mockPrisma.systemMessageConfig.updateMany).toHaveBeenCalledWith({
        where: { guildId: 'guild-1', welcomeChannelId: 'old-chan-id' },
        data: { welcomeChannelId: 'new-chan-id' },
      });
      expect(mockChannel.delete).toHaveBeenCalled();
      expect(mockClonedChannel.send).toHaveBeenCalled();
    });
  });
});
