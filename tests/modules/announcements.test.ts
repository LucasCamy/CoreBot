import { describe, it, expect, vi } from 'vitest';
import { AnnounceService } from '../../src/modules/announcements/services/announce.service.js';
import { announceCommand } from '../../src/modules/announcements/commands/announce.command.js';
import { ChannelType, Guild, PermissionFlagsBits, PermissionsBitField } from 'discord.js';

describe('Announcements Module', () => {
  describe('Slash Command Definition', () => {
    it('should be configured as adminOnly and have correct subcommands', () => {
      expect(announceCommand.adminOnly).toBe(true);
      const json = announceCommand.data.toJSON();
      expect(json.name).toBe('anunciar');

      const subcommandNames = json.options?.map((opt) => opt.name);
      expect(subcommandNames).toContain('mensagem');
      expect(subcommandNames).toContain('embed');
      expect(subcommandNames).toContain('modal');
      expect(subcommandNames).toContain('editar');
    });
  });

  describe('AnnounceService', () => {
    const service = new AnnounceService();

    it('should reject plain message if content is empty', async () => {
      const mockGuild = {} as unknown as Guild;
      const res = await service.sendPlainMessage(mockGuild, 'channel-1', '   ');
      expect(res.success).toBe(false);
      expect(res.error).toContain('conteúdo da mensagem não pode estar vazio');
    });

    it('should validate text channel type and bot permissions', async () => {
      const mockChannel = {
        type: ChannelType.GuildVoice, // Invalid channel type for text
        permissionsFor: vi.fn(),
      };

      const mockGuild = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      } as unknown as Guild;

      const res = await service.sendPlainMessage(mockGuild, 'voice-chan', 'Olá mundo');
      expect(res.success).toBe(false);
      expect(res.error).toContain('canal selecionado deve ser um canal de texto ou avisos');
    });

    it('should reject if bot lacks SendMessages permission in target channel', async () => {
      const mockPerms = new PermissionsBitField([PermissionFlagsBits.ViewChannel]); // Missing SendMessages

      const mockChannel = {
        type: ChannelType.GuildText,
        permissionsFor: vi.fn().mockReturnValue(mockPerms),
      };

      const mockGuild = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
        members: {
          me: { id: 'bot-1' },
          fetchMe: vi.fn(),
        },
      } as unknown as Guild;

      const res = await service.sendPlainMessage(mockGuild, 'text-chan', 'Regras do servidor');
      expect(res.success).toBe(false);
      expect(res.error).toContain('não possui permissão para enviar mensagens');
    });

    it('should successfully send plain text message to channel with permissions', async () => {
      const mockPerms = new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ]);

      const mockChannel = {
        type: ChannelType.GuildText,
        permissionsFor: vi.fn().mockReturnValue(mockPerms),
        send: vi.fn().mockResolvedValue({ id: 'msg-123' }),
      };

      const mockGuild = {
        id: 'guild-1',
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
        members: {
          me: { id: 'bot-1' },
        },
      } as unknown as Guild;

      const res = await service.sendPlainMessage(mockGuild, 'text-chan', 'Aviso importante!');
      expect(res.success).toBe(true);
      expect(res.data?.messageId).toBe('msg-123');
      expect(mockChannel.send).toHaveBeenCalledWith({ content: 'Aviso importante!' });
    });

    it('should successfully send stylized embed with custom color and title', async () => {
      const mockPerms = new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ]);

      const mockChannel = {
        type: ChannelType.GuildText,
        permissionsFor: vi.fn().mockReturnValue(mockPerms),
        send: vi.fn().mockResolvedValue({ id: 'msg-embed-456' }),
      };

      const mockGuild = {
        id: 'guild-1',
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
        members: {
          me: { id: 'bot-1' },
        },
      } as unknown as Guild;

      const res = await service.sendEmbedMessage(mockGuild, 'text-chan', {
        title: '📜 Regras Oficiais',
        description: '1. Respeite os membros\n2. Sem spam',
        color: '#5865F2',
      });

      expect(res.success).toBe(true);
      expect(res.data?.messageId).toBe('msg-embed-456');
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });

    it('should prevent editing messages that were not sent by the bot', async () => {
      const mockPerms = new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ]);

      const mockOtherUserMessage = {
        id: 'msg-user',
        author: { id: 'user-999' }, // Not the bot
        embeds: [],
      };

      const mockChannel = {
        type: ChannelType.GuildText,
        permissionsFor: vi.fn().mockReturnValue(mockPerms),
        messages: {
          fetch: vi.fn().mockResolvedValue(mockOtherUserMessage),
        },
      };

      const mockGuild = {
        id: 'guild-1',
        client: { user: { id: 'bot-1' } },
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
        members: {
          me: { id: 'bot-1' },
        },
      } as unknown as Guild;

      const res = await service.editMessage(mockGuild, 'text-chan', 'msg-user', {
        content: 'Tentativa de edição de mensagem de outro usuário',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Você só pode editar mensagens que foram enviadas pelo próprio bot');
    });
  });
});
