import {
  ChannelType,
  Client,
  EmbedBuilder,
  Message,
  MessageCreateOptions,
  PermissionsBitField,
  TextChannel,
  User,
} from 'discord.js';
import { NotificationLogRepository } from '../database/repositories/notification-log.repository.js';
import { logger } from '../utils/logger.js';
import { isDiscordChannelError } from '../utils/discord-error.js';

export interface SendChannelNotificationDto {
  guildId: string;
  module: string;
  eventType: string;
  channelId: string;
  content?: string;
  embeds?: EmbedBuilder[];
  components?: MessageCreateOptions['components'];
  files?: MessageCreateOptions['files'];
  deduplicationKey?: string;
}

export interface SendDirectMessageDto {
  guildId: string;
  module: string;
  eventType: string;
  userId: string;
  content?: string;
  embeds?: EmbedBuilder[];
  deduplicationKey?: string;
}

export class NotificationService {
  private deduplicationCache = new Map<string, number>();
  private readonly DEDUP_TTL_MS = 5000; // 5 seconds default TTL

  constructor(
    private readonly client: Client,
    private readonly logRepository: NotificationLogRepository,
  ) {
    // Periodically clean deduplication cache
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.deduplicationCache.entries()) {
        if (now - timestamp > this.DEDUP_TTL_MS) {
          this.deduplicationCache.delete(key);
        }
      }
    }, 30000).unref();
  }

  /**
   * Check if an event was already recently dispatched to avoid duplicates
   */
  private isDuplicate(key?: string): boolean {
    if (!key) return false;
    const lastSeen = this.deduplicationCache.get(key);
    const now = Date.now();

    if (lastSeen && now - lastSeen < this.DEDUP_TTL_MS) {
      return true;
    }

    this.deduplicationCache.set(key, now);
    return false;
  }

  /**
   * Safe execution with exponential backoff retry for transient network / rate-limit failures
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    initialDelayMs = 500,
  ): Promise<T> {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          throw error;
        }
        const delay = initialDelayMs * Math.pow(2, attempts - 1);
        logger.warn(
          { attempt: attempts, nextDelayMs: delay, error },
          'Notification dispatch failed, retrying after backoff...',
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Unreachable executeWithRetry condition');
  }

  /**
   * Send notification to a text-based Discord guild channel
   */
  public async sendToChannel(dto: SendChannelNotificationDto): Promise<Message | null> {
    const {
      guildId,
      module,
      eventType,
      channelId,
      content,
      embeds,
      components,
      files,
      deduplicationKey,
    } = dto;

    if (this.isDuplicate(deduplicationKey)) {
      logger.info(
        { deduplicationKey, module, eventType },
        'Notification suppressed: duplicate event detected.',
      );
      return null;
    }

    if (typeof this.client.isReady === 'function' && !this.client.isReady()) {
      logger.warn(
        { guildId, channelId, module, eventType },
        'Discord gateway client is not ready. Postponing notification delivery...',
      );
      throw new Error('Discord gateway is not ready (client disconnected/reconnecting).');
    }

    try {
      let channel = null;
      try {
        channel = await this.client.channels.fetch(channelId);
      } catch (fetchErr) {
        const channelErr = isDiscordChannelError(fetchErr);
        if (channelErr.isChannelError) {
          const errorMsg = `Channel ${channelId} missing or inaccessible (DiscordAPIError code: ${channelErr.code})`;
          logger.warn(
            { channelId, guildId, module, eventType, errorCode: channelErr.code },
            errorMsg,
          );
          await this.logRepository.create({
            guildId,
            module,
            eventType,
            targetChannelId: channelId,
            success: false,
            error: errorMsg,
          });
          return null;
        }
        throw fetchErr;
      }

      if (!channel || !channel.isTextBased()) {
        const errorMsg = `Channel ${channelId} not found or is not a text channel`;
        logger.warn({ channelId, guildId }, errorMsg);
        await this.logRepository.create({
          guildId,
          module,
          eventType,
          targetChannelId: channelId,
          success: false,
          error: errorMsg,
        });
        return null;
      }

      // Check bot permissions in target guild channel
      if (
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement
      ) {
        const textChannel = channel as TextChannel;
        const guild = textChannel.guild;
        const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));

        if (botMember) {
          const permissions = textChannel.permissionsFor(botMember);
          if (!permissions.has(PermissionsBitField.Flags.ViewChannel)) {
            const errorMsg = `Bot lacks 'ViewChannel' permission in channel ${channel.name} (${channelId})`;
            await this.logRepository.create({
              guildId,
              module,
              eventType,
              targetChannelId: channelId,
              success: false,
              error: errorMsg,
            });
            logger.warn({ channelId, guildId }, errorMsg);
            return null;
          }

          if (!permissions.has(PermissionsBitField.Flags.SendMessages)) {
            const errorMsg = `Bot lacks 'SendMessages' permission in channel ${channel.name} (${channelId})`;
            await this.logRepository.create({
              guildId,
              module,
              eventType,
              targetChannelId: channelId,
              success: false,
              error: errorMsg,
            });
            logger.warn({ channelId, guildId }, errorMsg);
            return null;
          }

          if (
            embeds &&
            embeds.length > 0 &&
            !permissions.has(PermissionsBitField.Flags.EmbedLinks)
          ) {
            const errorMsg = `Bot lacks 'EmbedLinks' permission in channel ${channel.name} (${channelId})`;
            await this.logRepository.create({
              guildId,
              module,
              eventType,
              targetChannelId: channelId,
              success: false,
              error: errorMsg,
            });
            logger.warn({ channelId, guildId }, errorMsg);
            return null;
          }
        }
      }

      const messageOptions: MessageCreateOptions = {};
      if (content) messageOptions.content = content;
      if (embeds && embeds.length > 0) messageOptions.embeds = embeds;
      if (components && components.length > 0) messageOptions.components = components;
      if (files && files.length > 0) messageOptions.files = files;

      const sentMessage = await this.executeWithRetry(async () => {
        return (channel as TextChannel).send(messageOptions);
      });

      // Log success
      await this.logRepository.create({
        guildId,
        module,
        eventType,
        targetChannelId: channelId,
        success: true,
      });

      return sentMessage;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(
        { error: err, guildId, channelId, module, eventType },
        'Failed to deliver channel notification',
      );

      await this.logRepository.create({
        guildId,
        module,
        eventType,
        targetChannelId: channelId,
        success: false,
        error: errorMessage,
      });

      return null;
    }
  }

  /**
   * Send direct message to a Discord user
   */
  public async sendDirectMessage(dto: SendDirectMessageDto): Promise<Message | null> {
    const { guildId, module, eventType, userId, content, embeds, deduplicationKey } = dto;

    if (this.isDuplicate(deduplicationKey)) {
      logger.info({ deduplicationKey, userId }, 'DM suppressed: duplicate detected');
      return null;
    }

    try {
      const user: User | null = await this.client.users.fetch(userId).catch(() => null);
      if (!user) {
        const errorMsg = `Discord user ${userId} not found`;
        await this.logRepository.create({
          guildId,
          module,
          eventType,
          targetUserId: userId,
          success: false,
          error: errorMsg,
        });
        return null;
      }

      const messageOptions: MessageCreateOptions = {};
      if (content) messageOptions.content = content;
      if (embeds && embeds.length > 0) messageOptions.embeds = embeds;

      const sentMessage = await this.executeWithRetry(async () => {
        return user.send(messageOptions);
      });

      await this.logRepository.create({
        guildId,
        module,
        eventType,
        targetUserId: userId,
        success: true,
      });

      return sentMessage;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ error: err, guildId, userId, module }, 'Failed to deliver direct message');

      await this.logRepository.create({
        guildId,
        module,
        eventType,
        targetUserId: userId,
        success: false,
        error: errorMessage,
      });

      return null;
    }
  }
}
