import { VoiceState } from 'discord.js';
import { Container } from '../../../core/container.js';
import { VoiceNotificationConfig } from '@prisma/client';
import { formatInTimezone } from '../../../utils/time.js';
import { logger } from '../../../utils/logger.js';

export class VoiceNotificationService {
  // Key: `${ruleId}:${userId}` -> timestamp
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
      // User Moved (triggers exit rule on old channel if configured, and enter/move on new channel)
      await this.processTransition(guildId, oldChannelId, member, 'leave');
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
    const configs = await voiceRepo.findByChannel(guildId, voiceChannelId);

    if (!configs || configs.length === 0) return;

    const transitionType = type.toUpperCase();
    const applicableRules = configs.filter(
      (cfg) => cfg.enabled && (cfg.eventType === 'ALL' || cfg.eventType === transitionType),
    );

    const now = Date.now();
    for (const config of applicableRules) {
      // Cooldown check per rule and member
      const cooldownKey = `${config.id}:${member.id}`;
      const lastTimestamp = this.cooldownMap.get(cooldownKey);
      const cooldownMs = config.cooldownSeconds * 1000;

      if (lastTimestamp && now - lastTimestamp < cooldownMs) {
        logger.debug(
          { cooldownKey, ruleId: config.id },
          'Voice notification skipped due to active cooldown',
        );
        continue;
      }

      this.cooldownMap.set(cooldownKey, now);
      await this.dispatchNotification(config, member, voiceChannelId, type);
    }
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
      deduplicationKey: `voice-${config.id}-${type}-${voiceChannelId}-${member.id}-${Math.floor(Date.now() / 3000)}`,
    });
  }
}
