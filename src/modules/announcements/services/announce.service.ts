import {
  ChannelType,
  ColorResolvable,
  EmbedBuilder,
  Guild,
  Message,
  PermissionFlagsBits,
  TextChannel,
  NewsChannel,
} from 'discord.js';
import { logger } from '../../../utils/logger.js';

export interface SendEmbedOptions {
  title?: string;
  description: string;
  color?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  footer?: string;
}

export interface EditMessageOptions {
  content?: string;
  title?: string;
  description?: string;
  color?: string;
}

export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class AnnounceService {
  /**
   * Helper: Validates channel and verifies bot permissions to post in it
   */
  public async getValidTextChannel(
    guild: Guild,
    channelId: string,
  ): Promise<{ channel?: TextChannel | NewsChannel; error?: string }> {
    if (!guild || !guild.channels?.fetch) {
      return { error: 'O canal especificado não foi encontrado.' };
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      return { error: 'O canal especificado não foi encontrado.' };
    }

    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement
    ) {
      return { error: 'O canal selecionado deve ser um canal de texto ou avisos.' };
    }

    const textChannel = channel as TextChannel | NewsChannel;
    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));

    if (!botMember) {
      return { error: 'Não foi possível verificar as permissões do bot.' };
    }

    const perms = textChannel.permissionsFor(botMember);
    if (!perms || !perms.has(PermissionFlagsBits.ViewChannel)) {
      return { error: 'O bot não possui permissão para visualizar o canal selecionado.' };
    }

    if (!perms.has(PermissionFlagsBits.SendMessages)) {
      return { error: 'O bot não possui permissão para enviar mensagens no canal selecionado.' };
    }

    return { channel: textChannel };
  }

  /**
   * Sends a plain text message as the bot
   */
  public async sendPlainMessage(
    guild: Guild,
    channelId: string,
    content: string,
  ): Promise<ServiceResult<{ messageId: string }>> {
    if (!content || content.trim().length === 0) {
      return { success: false, error: 'O conteúdo da mensagem não pode estar vazio.' };
    }

    if (content.length > 2000) {
      return { success: false, error: 'O texto excede o limite máximo de 2000 caracteres do Discord.' };
    }

    const { channel, error } = await this.getValidTextChannel(guild, channelId);
    if (!channel || error) {
      return { success: false, error };
    }

    try {
      const msg = await channel.send({ content });
      logger.info(
        { guildId: guild.id, channelId, messageId: msg.id },
        'Bot sent announcement plain message',
      );
      return { success: true, data: { messageId: msg.id } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg, guildId: guild.id, channelId }, 'Failed to send plain message');
      return { success: false, error: `Falha ao enviar mensagem: ${msg}` };
    }
  }

  /**
   * Sends an embed message as the bot
   */
  public async sendEmbedMessage(
    guild: Guild,
    channelId: string,
    opts: SendEmbedOptions,
  ): Promise<ServiceResult<{ messageId: string }>> {
    const { channel, error } = await this.getValidTextChannel(guild, channelId);
    if (!channel || error) {
      return { success: false, error };
    }

    if (!opts.description || opts.description.trim().length === 0) {
      return { success: false, error: 'A descrição/conteúdo do anúncio não pode estar vazia.' };
    }

    if (opts.description.length > 4096) {
      return { success: false, error: 'A descrição excede o limite de 4096 caracteres do Discord.' };
    }

    try {
      const embed = new EmbedBuilder().setDescription(opts.description);

      if (opts.title) {
        embed.setTitle(opts.title.slice(0, 256));
      }

      // Resolve color
      let colorInt: ColorResolvable = '#FF5733';
      if (opts.color) {
        const hex = opts.color.startsWith('#') ? opts.color : `#${opts.color}`;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          colorInt = parseInt(hex.replace('#', ''), 16) as ColorResolvable;
        }
      }
      embed.setColor(colorInt);

      if (opts.imageUrl && /^https?:\/\/.+/i.test(opts.imageUrl)) {
        embed.setImage(opts.imageUrl);
      }

      if (opts.thumbnailUrl && /^https?:\/\/.+/i.test(opts.thumbnailUrl)) {
        embed.setThumbnail(opts.thumbnailUrl);
      }

      if (opts.footer) {
        embed.setFooter({ text: opts.footer.slice(0, 2048) });
      }

      const msg = await channel.send({ embeds: [embed] });
      logger.info(
        { guildId: guild.id, channelId, messageId: msg.id },
        'Bot sent announcement embed message',
      );
      return { success: true, data: { messageId: msg.id } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg, guildId: guild.id, channelId }, 'Failed to send embed message');
      return { success: false, error: `Falha ao enviar embed: ${msg}` };
    }
  }

  /**
   * Edits a message previously sent by the bot
   */
  public async editMessage(
    guild: Guild,
    channelId: string,
    messageId: string,
    opts: EditMessageOptions,
  ): Promise<ServiceResult<null>> {
    const { channel, error } = await this.getValidTextChannel(guild, channelId);
    if (!channel || error) {
      return { success: false, error };
    }

    let targetMessage: Message;
    try {
      targetMessage = await channel.messages.fetch(messageId);
    } catch {
      return {
        success: false,
        error: `Não foi possível encontrar a mensagem com ID \`${messageId}\` no canal <#${channelId}>.`,
      };
    }

    const botUser = guild.client.user;
    if (targetMessage.author.id !== botUser.id) {
      return {
        success: false,
        error: 'Você só pode editar mensagens que foram enviadas pelo próprio bot.',
      };
    }

    try {
      // If message has an existing embed and title or description was provided
      if (targetMessage.embeds.length > 0 && (opts.title || opts.description || opts.color)) {
        const oldEmbed = targetMessage.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed);

        if (opts.title) {
          newEmbed.setTitle(opts.title.slice(0, 256));
        }

        if (opts.description) {
          newEmbed.setDescription(opts.description.slice(0, 4096));
        }

        if (opts.color) {
          const hex = opts.color.startsWith('#') ? opts.color : `#${opts.color}`;
          if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            newEmbed.setColor(parseInt(hex.replace('#', ''), 16) as ColorResolvable);
          }
        }

        await targetMessage.edit({ embeds: [newEmbed] });
      } else if (opts.content) {
        await targetMessage.edit({ content: opts.content.slice(0, 2000) });
      } else {
        return { success: false, error: 'Nenhum novo conteúdo fornecido para edição.' };
      }

      logger.info(
        { guildId: guild.id, channelId, messageId },
        'Bot announcement message edited successfully',
      );
      return { success: true, data: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg, guildId: guild.id, channelId, messageId }, 'Failed to edit message');
      return { success: false, error: `Falha ao editar a mensagem: ${msg}` };
    }
  }
}
