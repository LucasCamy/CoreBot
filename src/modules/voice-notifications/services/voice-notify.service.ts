import { VoiceState } from 'discord.js';
import { Container } from '../../../core/container.js';
import { VoiceNotificationConfig } from '@prisma/client';
import { formatInTimezone } from '../../../utils/time.js';
import { logger } from '../../../utils/logger.js';

export class VoiceNotificationService {
  // Key: `${channelId}:${userId}` -> timestamp
  private cooldownMap: Map<string, number> = new Map();

  constructor(private readonly container: Container) {}

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild.id;
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // Ignore self-mute/deaf without channel switch
    if (oldChannelId === newChannelId) return;

    // Detect type of transition
    if (!oldChannelId && newChannelId) {
      // User Joined
      await this.processTransition(guildId, newChannelId, member, 'join');
    } else if (oldChannelId && !newChannelId) {
      // User Left
      await this.processTransition(guildId, oldChannelId, member, 'leave');
    } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      // User Moved
      await this.processTransition(guildId, newChannelId, member, 'move', oldChannelId);
    }
  }

  private async processTransition(
    guildId: string,
    voiceChannelId: string,
    member: NonNullable<VoiceState['member']>,
    type: 'join' | 'leave' | 'move',
    _previousChannelId?: string,
  ): Promise<void> {
    const voiceRepo = this.container.voiceRepository;
    const config = await voiceRepo.findByChannel(guildId, voiceChannelId);

    if (!config || !config.enabled) return;

    // Cooldown check
    const cooldownKey = `${voiceChannelId}:${member.id}`;
    const now = Date.now();
    const lastTimestamp = this.cooldownMap.get(cooldownKey);
    const cooldownMs = config.cooldownSeconds * 1000;

    if (lastTimestamp && now - lastTimestamp < cooldownMs) {
      logger.debug({ cooldownKey }, 'Voice notification skipped due to active cooldown');
      return;
    }

    this.cooldownMap.set(cooldownKey, now);

    await this.dispatchNotification(config, member, voiceChannelId, type);
  }

  public async dispatchNotification(
    config: VoiceNotificationConfig,
    member: NonNullable<VoiceState['member']>,
    voiceChannelId: string,
    type: 'join' | 'leave' | 'move',
  ): Promise<void> {
    let rawMessage: string | null = null;
    let titlePrefix = '🎙️ Notificação de Voz';

    if (type === 'join') {
      rawMessage = config.joinMessage;
      titlePrefix = '👋 Entrada em Canal de Voz';
    } else if (type === 'leave') {
      rawMessage = config.leaveMessage;
      titlePrefix = '🚪 Saída de Canal de Voz';
    } else if (type === 'move') {
      rawMessage = config.moveMessage || config.joinMessage;
      titlePrefix = '🔀 Troca de Canal de Voz';
    }

    if (!rawMessage) return;

    const guildConfig = await this.container.guildRepository.findByGuildId(config.guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';

    const voiceChannel = member.guild.channels.cache.get(voiceChannelId);
    const channelName = voiceChannel?.name || 'Canal de Voz';

    const context = {
      user: member.displayName,
      userMention: config.mentionUser ? `<@${member.id}>` : member.displayName,
      username: member.user.username,
      channel: channelName,
      channelMention: `<#${voiceChannelId}>`,
      server: member.guild.name,
      time: formatInTimezone(new Date(), tz, 'HH:mm:ss'),
      date: formatInTimezone(new Date(), tz, 'DD/MM/YYYY'),
    };

    const rendered = this.container.templateService.renderMessage(rawMessage, context, {
      useEmbed: config.useEmbed,
      embedTitle: titlePrefix,
      embedColor: config.embedColor || '#5865F2',
      fallbackText: `${member.displayName} alterou o estado de voz no canal ${channelName}.`,
    });

    await this.container.notificationService.sendToChannel({
      guildId: config.guildId,
      module: 'voice-notifications',
      eventType: `voice_${type}`,
      channelId: config.targetChannelId,
      content: rendered.content,
      embeds: rendered.embeds,
      deduplicationKey: `voice-${type}-${voiceChannelId}-${member.id}-${Math.floor(Date.now() / 3000)}`,
    });
  }
}
