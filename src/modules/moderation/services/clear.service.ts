import { GuildMember, NewsChannel, PermissionFlagsBits, TextChannel } from 'discord.js';
import { Container } from '../../../core/container.js';
import { logger } from '../../../utils/logger.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { PurgeMessagesInput, purgeMessagesSchema } from '../schemas/clear.schema.js';

export interface PurgeResult {
  success: boolean;
  deletedCount: number;
  filteredOld: number;
  error?: string;
}

export interface NukeResult {
  success: boolean;
  newChannelId?: string;
  error?: string;
}

export class ClearService {
  constructor(private readonly container: Container) {}

  public async purgeMessages(
    channel: TextChannel | NewsChannel,
    input: PurgeMessagesInput,
    botMember: GuildMember,
  ): Promise<PurgeResult> {
    try {
      const validated = purgeMessagesSchema.parse(input);

      // Check bot permissions
      const permissions = channel.permissionsFor(botMember);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
        return {
          success: false,
          deletedCount: 0,
          filteredOld: 0,
          error: 'O bot não possui permissão para visualizar este canal.',
        };
      }

      if (!permissions?.has(PermissionFlagsBits.ReadMessageHistory)) {
        return {
          success: false,
          deletedCount: 0,
          filteredOld: 0,
          error: 'O bot não possui permissão para ler o histórico de mensagens deste canal.',
        };
      }

      if (!permissions?.has(PermissionFlagsBits.ManageMessages)) {
        return {
          success: false,
          deletedCount: 0,
          filteredOld: 0,
          error:
            'O bot não possui a permissão de **Gerenciar Mensagens** (`ManageMessages`) neste canal.',
        };
      }

      // Determine fetch limit (if filtering, fetch up to 100 messages to find matches)
      const isFiltered = Boolean(
        validated.usuarioId || validated.apenasBots || validated.apenasAnexos,
      );
      const fetchLimit = isFiltered ? 100 : validated.quantidade;

      const fetchedMessages = await channel.messages.fetch({ limit: fetchLimit });
      if (!fetchedMessages || fetchedMessages.size === 0) {
        return {
          success: true,
          deletedCount: 0,
          filteredOld: 0,
          error: 'Nenhuma mensagem recente encontrada no canal.',
        };
      }

      let targetMessages = Array.from(fetchedMessages.values());

      if (validated.usuarioId) {
        targetMessages = targetMessages.filter((msg) => msg.author.id === validated.usuarioId);
      }

      if (validated.apenasBots) {
        targetMessages = targetMessages.filter((msg) => msg.author.bot);
      }

      if (validated.apenasAnexos) {
        targetMessages = targetMessages.filter((msg) => msg.attachments.size > 0);
      }

      // Slice up to the requested quantity
      const messagesToDelete = targetMessages.slice(0, validated.quantidade);

      if (messagesToDelete.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          filteredOld: 0,
          error: 'Nenhuma mensagem correspondente aos filtros fornecidos foi encontrada.',
        };
      }

      // Bulk delete with filterOld: true (skips messages > 14 days old without throwing)
      const deletedCollection = await channel.bulkDelete(messagesToDelete, true);
      const deletedCount = deletedCollection.size;
      const filteredOld = messagesToDelete.length - deletedCount;

      logger.info(
        {
          guildId: channel.guild.id,
          channelId: channel.id,
          requested: validated.quantidade,
          deletedCount,
          filteredOld,
        },
        'Purged messages in channel',
      );

      return {
        success: true,
        deletedCount,
        filteredOld,
      };
    } catch (error) {
      logger.error(
        { guildId: channel?.guild?.id, channelId: channel?.id, error },
        'Failed to purge messages',
      );
      return {
        success: false,
        deletedCount: 0,
        filteredOld: 0,
        error: error instanceof Error ? error.message : 'Erro ao apagar mensagens.',
      };
    }
  }

  public async nukeChannel(
    channel: TextChannel | NewsChannel,
    member: GuildMember,
    botMember: GuildMember,
    reason?: string,
  ): Promise<NukeResult> {
    try {
      // Check bot permissions
      const permissions = channel.permissionsFor(botMember);
      if (!permissions?.has(PermissionFlagsBits.ManageChannels)) {
        return {
          success: false,
          error:
            'O bot não possui a permissão de **Gerenciar Canais** (`ManageChannels`) necessária para recriar o canal.',
        };
      }

      if (!channel.deletable || typeof channel.clone !== 'function') {
        return {
          success: false,
          error: 'Este canal não pode ser clonado ou excluído pelo bot (restrição do Discord).',
        };
      }

      const originalPosition = channel.position;
      const originalParentId = channel.parentId;
      const originalTopic = channel.topic;
      const originalNsfw = channel.nsfw;
      const originalRateLimit = channel.rateLimitPerUser;

      // 1. Clone the channel preserving all settings and permissions
      const auditReason = `Canal limpo (nuke) por ${member.user.tag} (${member.id})${
        reason ? ` | Motivo: ${reason}` : ''
      }`;

      const clonedChannel = await channel.clone({
        name: channel.name,
        topic: originalTopic ?? undefined,
        nsfw: originalNsfw,
        parent: originalParentId ?? undefined,
        permissionOverwrites: channel.permissionOverwrites.cache,
        rateLimitPerUser: originalRateLimit ?? undefined,
        reason: auditReason,
      });

      // 2. Preserve original position in channel hierarchy
      await clonedChannel.setPosition(originalPosition).catch(() => null);

      // 3. Update database references pointing to old channel
      await this.updateChannelReferences(channel.guild.id, channel.id, clonedChannel.id);

      // 4. Delete the old channel
      await channel.delete(auditReason);

      // 5. Announce the fresh clean channel
      const embed = BotEmbed.success(
        'Canal Limpo com Sucesso! 💣',
        `Este canal teve todo o seu histórico limpo e foi recriado por <@${member.id}>.\nTodas as permissões, tópicos e configurações foram mantidos intactos.`,
      );

      if (reason) {
        embed.addFields({ name: 'Motivo', value: reason });
      }

      await clonedChannel.send({ embeds: [embed] }).catch(() => null);

      logger.info(
        {
          guildId: channel.guild.id,
          oldChannelId: channel.id,
          newChannelId: clonedChannel.id,
          userId: member.id,
        },
        'Nuked and recreated channel successfully',
      );

      return {
        success: true,
        newChannelId: clonedChannel.id,
      };
    } catch (error) {
      logger.error(
        { guildId: channel?.guild?.id, channelId: channel?.id, error },
        'Failed to nuke channel',
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao recriar canal.',
      };
    }
  }

  private async updateChannelReferences(
    guildId: string,
    oldChannelId: string,
    newChannelId: string,
  ): Promise<void> {
    try {
      const prisma = this.container.prisma;
      await Promise.allSettled([
        prisma.systemMessageConfig.updateMany({
          where: { guildId, welcomeChannelId: oldChannelId },
          data: { welcomeChannelId: newChannelId },
        }),
        prisma.systemMessageConfig.updateMany({
          where: { guildId, boostChannelId: oldChannelId },
          data: { boostChannelId: newChannelId },
        }),
        prisma.voiceNotificationConfig.updateMany({
          where: { guildId, targetChannelId: oldChannelId },
          data: { targetChannelId: newChannelId },
        }),
        prisma.webhookConfig.updateMany({
          where: { guildId, deployChannelId: oldChannelId },
          data: { deployChannelId: newChannelId },
        }),
        prisma.webhookConfig.updateMany({
          where: { guildId, alertsChannelId: oldChannelId },
          data: { alertsChannelId: newChannelId },
        }),
        prisma.notepadList.updateMany({
          where: { guildId, channelId: oldChannelId },
          data: { channelId: newChannelId },
        }),
        prisma.countdown.updateMany({
          where: { guildId, channelId: oldChannelId },
          data: { channelId: newChannelId },
        }),
        prisma.streamerConfig.updateMany({
          where: { guildId, channelId: oldChannelId },
          data: { channelId: newChannelId },
        }),
      ]);
    } catch (err) {
      logger.warn(
        { guildId, oldChannelId, newChannelId, err },
        'Failed to update some channel db references',
      );
    }
  }
}
