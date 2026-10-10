import { Events, VoiceState } from 'discord.js';
import { IEvent } from '../../../types/index.js';
import { Container } from '../../../core/container.js';
import { logger } from '../../../utils/logger.js';
import { nowInTimezone } from '../../../utils/time.js';
import { SocialAnalyticsService } from '../services/social-analytics.service.js';

interface SessionData {
  channelId: string;
  joinedAt: Date;
}

const MIN_SESSION_DURATION_SECONDS = 30; // Debounce threshold: ignore sessions under 30s
const SIX_HOURS_MS = 6 * 60 * 60 * 1000; // 6-hour cooldown for late-night goodbyes

const activeSessions = new Map<string, SessionData>();
const lateNightCooldowns = new Map<string, number>();

// Clean up expired cooldowns periodically
setInterval(
  () => {
    const now = Date.now();
    for (const [key, ts] of lateNightCooldowns.entries()) {
      if (now - ts > SIX_HOURS_MS) {
        lateNightCooldowns.delete(key);
      }
    }
  },
  60 * 60 * 1000,
).unref();

export const VoiceActivityEvent: IEvent<Events.VoiceStateUpdate> = {
  name: Events.VoiceStateUpdate,

  async execute(container: Container, oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;

    if (!member || !guild || member.user.bot) return;

    const guildId = guild.id;
    const userId = member.id;
    const sessionKey = `${guildId}:${userId}`;

    // 1. User Joined a Voice Channel
    if (!oldState.channelId && newState.channelId) {
      activeSessions.set(sessionKey, {
        channelId: newState.channelId,
        joinedAt: new Date(),
      });
      return;
    }

    // 2. User Switched to Another Channel
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const existing = activeSessions.get(sessionKey);
      const joinedAt = existing?.joinedAt || new Date(Date.now() - 60 * 1000);
      const now = new Date();
      const durationSeconds = Math.round((now.getTime() - joinedAt.getTime()) / 1000);

      if (durationSeconds >= MIN_SESSION_DURATION_SECONDS) {
        await container.socialAnalyticsRepository.logVoiceActivity({
          guildId,
          userId,
          channelId: oldState.channelId,
          joinedAt,
          leftAt: now,
          durationSeconds,
        });
      } else {
        logger.debug(
          { guildId, userId, durationSeconds },
          'Ignored short voice session below 30s threshold on channel switch',
        );
      }

      // Start new session in the new channel
      activeSessions.set(sessionKey, {
        channelId: newState.channelId,
        joinedAt: now,
      });
      return;
    }

    // 3. User Disconnected from Voice
    if (oldState.channelId && !newState.channelId) {
      const session = activeSessions.get(sessionKey);
      activeSessions.delete(sessionKey);

      const now = new Date();
      const joinedAt = session?.joinedAt || new Date(Date.now() - 60 * 1000);
      const durationSeconds = Math.round((now.getTime() - joinedAt.getTime()) / 1000);

      if (durationSeconds >= MIN_SESSION_DURATION_SECONDS) {
        await container.socialAnalyticsRepository.logVoiceActivity({
          guildId,
          userId,
          channelId: oldState.channelId,
          joinedAt,
          leftAt: now,
          durationSeconds,
        });
      } else {
        logger.debug(
          { guildId, userId, durationSeconds },
          'Ignored short voice session below 30s threshold on disconnect',
        );
      }

      // Check for Late Night Goodbye (01:00 to 06:00 in guild's timezone)
      try {
        const guildConfig = await container.guildRepository.findByGuildId(guildId);
        const tz = guildConfig?.timezone || 'America/Sao_Paulo';
        const currentHour = nowInTimezone(tz).hour();

        if (currentHour >= 1 && currentHour < 6) {
          const cooldownKey = `${guildId}:${userId}`;
          const lastGoodbye = lateNightCooldowns.get(cooldownKey) || 0;

          if (Date.now() - lastGoodbye < SIX_HOURS_MS) {
            logger.debug(
              { guildId, userId },
              'Late-night voice goodbye skipped due to 6-hour user cooldown',
            );
            return;
          }

          lateNightCooldowns.set(cooldownKey, Date.now());

          const phrases = SocialAnalyticsService.LATE_NIGHT_GOODBYES;
          const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
          const displayName = member.displayName || member.user.username;
          const goodbyeMessage = randomPhrase.replace('{user}', displayName);

          // Attempt to post in the voice channel's chat or first accessible text channel
          let targetChannel = oldState.channel;

          if (
            targetChannel &&
            targetChannel.isTextBased() &&
            guild.members.me &&
            targetChannel.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
          ) {
            await targetChannel.send(goodbyeMessage);
          } else {
            const fallback = guild.channels.cache.find(
              (c) =>
                c.isTextBased() &&
                guild.members.me &&
                c.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel']),
            );
            if (fallback && fallback.isTextBased()) {
              await fallback.send(goodbyeMessage);
            }
          }
        }
      } catch (err) {
        logger.error({ error: err, guildId, userId }, 'Error processing late-night voice goodbye');
      }
    }
  },
};
