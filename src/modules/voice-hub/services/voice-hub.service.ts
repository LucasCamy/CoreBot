import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  GuildMember,
  PermissionFlagsBits,
  VoiceChannel,
  VoiceState,
} from 'discord.js';
import { Container } from '../../../core/container.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { logger } from '../../../utils/logger.js';
import { PermissionGuard } from '../../../discord/guards/permission.guard.js';

export class VoiceHubService {
  // Concurrency guard to prevent race conditions during rapid channel switching
  private static creatingUsers = new Set<string>();

  constructor(private readonly container: Container) {}

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guild = newState.guild;
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // 1. Check if user joined a Temp Voice Hub trigger channel
    if (newChannelId && newChannelId !== oldChannelId) {
      const hubConfig = await this.container.voiceHubRepository.findHubByChannel(
        guild.id,
        newChannelId,
      );
      if (hubConfig) {
        await this.createDynamicVoiceChannel(
          hubConfig.guildId,
          hubConfig.targetCategoryId,
          member,
          hubConfig.namingTemplate,
          hubConfig.isPrivate,
          hubConfig.defaultUserLimit,
          hubConfig.bitrate,
        );
      }
    }

    // 2. Check if user left a previously active dynamic voice channel
    if (oldChannelId && oldChannelId !== newChannelId) {
      await this.handleUserLeftChannel(guild.id, oldChannelId, member);
    }
  }

  private async createDynamicVoiceChannel(
    guildId: string,
    targetCategoryId: string,
    member: GuildMember,
    namingTemplate: string,
    isPrivate: boolean,
    defaultUserLimit?: number | null,
    bitrate?: number | null,
  ): Promise<void> {
    if (VoiceHubService.creatingUsers.has(member.id)) {
      return;
    }

    VoiceHubService.creatingUsers.add(member.id);

    try {
      const guild = member.guild;
      const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));

      if (
        !botMember ||
        !botMember.permissions.has(PermissionFlagsBits.ManageChannels) ||
        !botMember.permissions.has(PermissionFlagsBits.MoveMembers)
      ) {
        logger.error(
          { guildId },
          'Bot lacks ManageChannels or MoveMembers permissions to create dynamic voice channel',
        );
        return;
      }

      let template = namingTemplate;
      if (isPrivate) {
        if (template === '🔊 Sala de {user}') {
          template = '🔒 Privada de {user}';
        } else if (!template.startsWith('🔒')) {
          template = template.replace(/^🔊\s*/, '🔒 ');
          if (!template.startsWith('🔒')) {
            template = `🔒 ${template}`;
          }
        }
      }

      const channelName = template
        .replace(/\{user\}/g, member.displayName)
        .replace(/\{username\}/g, member.user.username);

      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: isPrivate ? [PermissionFlagsBits.Connect] : [],
          allow: isPrivate
            ? [PermissionFlagsBits.ViewChannel]
            : [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.Stream,
            PermissionFlagsBits.UseVAD,
          ],
          deny: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers],
        },
        {
          id: botMember.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
          ],
        },
      ];

      // Create new dynamic voice channel under target category
      const newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: targetCategoryId,
        userLimit: defaultUserLimit || 0,
        bitrate: bitrate || undefined,
        permissionOverwrites,
      });

      // Compensatory Transaction (Saga pattern): Persist in database with automatic rollback
      try {
        await this.container.voiceHubRepository.createActiveChannel(
          guildId,
          newChannel.id,
          member.id,
          isPrivate,
          [],
        );
      } catch (dbError) {
        logger.error(
          {
            error: dbError instanceof Error ? dbError.message : String(dbError),
            guildId,
            channelId: newChannel.id,
            memberId: member.id,
          },
          'Database persistence failed for active voice channel. Executing compensating rollback (deleting orphan channel)...',
        );

        await newChannel
          .delete('VoiceHub Compensating Rollback: database failed to persist active channel')
          .catch((delErr) => {
            logger.error(
              {
                delError: delErr instanceof Error ? delErr.message : String(delErr),
                channelId: newChannel.id,
              },
              'Compensating rollback failed: could not delete orphan Discord voice channel',
            );
          });

        throw dbError;
      }

      // Move member into new channel
      await member.voice.setChannel(newChannel.id).catch((err) => {
        logger.warn(
          { error: err.message, memberId: member.id },
          'Failed to move member into dynamic voice channel',
        );
      });

      // Send Control Panel ActionRows in the voice channel's text chat
      await this.sendControlPanel(newChannel, member, isPrivate);

      logger.info(
        { guildId, channelId: newChannel.id, ownerId: member.id, isPrivate },
        'Created dynamic voice channel successfully',
      );
    } catch (error) {
      logger.error(
        { error, guildId, memberId: member.id },
        'Failed to create dynamic voice channel',
      );
    } finally {
      VoiceHubService.creatingUsers.delete(member.id);
    }
  }

  public async handleUserLeftChannel(
    guildId: string,
    channelId: string,
    member: GuildMember,
  ): Promise<void> {
    try {
      const activeRecord = await this.container.voiceHubRepository.findActiveChannel(channelId);
      if (!activeRecord) return;

      const guild =
        this.container.client.guilds.cache.get(guildId) ||
        (await this.container.client.guilds.fetch(guildId).catch(() => null));
      if (!guild) return;

      const channel = (await guild.channels
        .fetch(channelId)
        .catch(() => null)) as VoiceChannel | null;

      // If channel is missing or has 0 members left, delete it immediately
      if (!channel || channel.members.size === 0) {
        if (channel) {
          await channel.delete('Temp Voice Hub: all members left channel').catch(() => null);
        }
        await this.container.voiceHubRepository.deleteActiveChannel(channelId);
        logger.info({ guildId, channelId }, 'Cleaned up and deleted empty dynamic voice channel');
        return;
      }

      // If the owner left but others remain, transfer leadership automatically
      if (member.id === activeRecord.ownerId) {
        const remainingMembers = Array.from(channel.members.values()).filter((m) => !m.user.bot);
        const nextOwner = remainingMembers[0];

        if (nextOwner) {
          await this.container.voiceHubRepository.updateActiveChannelOwner(channelId, nextOwner.id);

          await channel.permissionOverwrites.edit(nextOwner.id, {
            Connect: true,
            Speak: true,
            Stream: true,
            UseVAD: true,
          });

          await channel.send({
            embeds: [
              BotEmbed.info(
                '👑 Nova Liderança da Sala',
                `O criador da sala saiu. A liderança foi transferida automaticamente para <@${nextOwner.id}>!`,
              ),
            ],
          });

          logger.info(
            { guildId, channelId, oldOwnerId: member.id, newOwnerId: nextOwner.id },
            'Ownership of dynamic voice channel automatically transferred',
          );
        }
      }
    } catch (error) {
      logger.error(
        { error, channelId, guildId },
        'Error while processing member departure from dynamic voice channel',
      );
    }
  }

  public async sendControlPanel(
    channel: VoiceChannel,
    owner: GuildMember,
    isLocked: boolean = false,
  ): Promise<void> {
    const embed = BotEmbed.info(
      'Painel de Controle da Sala',
      `👑 **Dono da Sala:** <@${owner.id}>\n🔒 **Status:** ${isLocked ? 'Trancada (Privada)' : 'Destrancada (Pública)'}\n\nUtilize os botões abaixo para gerenciar a sua sala de voz temporária em tempo real:`,
    );

    // Row 1: Trancar/Destrancar, Convidar Amigo, Expulsar
    const lockBtn = new ButtonBuilder()
      .setCustomId(`voice_hub_toggle_lock:${channel.id}`)
      .setLabel('Trancar / Destrancar')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔒');

    const inviteBtn = new ButtonBuilder()
      .setCustomId(`voice_hub_btn_invite:${channel.id}`)
      .setLabel('Convidar Amigo')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕');

    const kickBtn = new ButtonBuilder()
      .setCustomId(`voice_hub_btn_kick:${channel.id}`)
      .setLabel('Expulsar')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚫');

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(lockBtn, inviteBtn, kickBtn);

    // Row 2: Limite, Renomear, Passar Liderança
    const limitBtn = new ButtonBuilder()
      .setCustomId(`voice_hub_set_limit:${channel.id}`)
      .setLabel('Limite')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👥');

    const renameBtn = new ButtonBuilder()
      .setCustomId(`voice_hub_btn_rename:${channel.id}`)
      .setLabel('Renomear')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️');

    const transferBtn = new ButtonBuilder()
      .setCustomId(`voice_hub_transfer_owner:${channel.id}`)
      .setLabel('Passar Liderança')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👑');

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      limitBtn,
      renameBtn,
      transferBtn,
    );

    await channel.send({ embeds: [embed], components: [row1, row2] }).catch((err) => {
      logger.warn(
        { channelId: channel.id, error: err.message },
        'Could not send control panel in voice text chat',
      );
    });
  }

  public async isChannelOwnerOrAdmin(channelId: string, member: GuildMember): Promise<boolean> {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    const isBotAdmin = await PermissionGuard.isAdmin(member, this.container);
    if (isBotAdmin) return true;

    const activeRecord = await this.container.voiceHubRepository.findActiveChannel(channelId);
    return activeRecord?.ownerId === member.id;
  }
}
