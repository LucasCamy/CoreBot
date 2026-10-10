import { EmbedBuilder } from 'discord.js';
import { Container } from '../../core/container.js';
import { QUEUE_NAMES } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { TwitchService } from '../../modules/stream-notifier/services/twitch.service.js';
import { isDiscordChannelError } from '../../utils/discord-error.js';

export class TwitchScheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly twitchService: TwitchService;

  constructor(private readonly container: Container) {
    this.twitchService = new TwitchService();
  }

  public async start(): Promise<void> {
    logger.info('Starting Twitch Stream Polling Scheduler worker...');

    // Pre-initialize queue for Bull-Board
    QueueManager.getQueue(QUEUE_NAMES.TWITCH_POLLING);

    QueueManager.registerWorker(
      QUEUE_NAMES.TWITCH_POLLING,
      async (job) => {
        if (!this.container.client.isReady()) {
          logger.warn(
            { jobId: job.id },
            'Discord client is not ready (gateway disconnected). Rescheduling Twitch polling cycle...',
          );
          throw new Error('Discord client gateway is not ready. Worker job will be retried.');
        }

        logger.debug({ jobId: job.id }, 'Executing Twitch streams polling cycle');
        await this.pollStreams();
      },
      { concurrency: 1 },
    );

    // Initial run
    await this.triggerPoll();

    // Run polling every 2 minutes
    this.timer = setInterval(
      () => {
        this.triggerPoll().catch((err) => {
          logger.error({ error: err }, 'Error triggering Twitch poll job');
        });
      },
      2 * 60 * 1000,
    );
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async triggerPoll(): Promise<void> {
    const queue = QueueManager.getQueue(QUEUE_NAMES.TWITCH_POLLING);
    await queue.add('poll-twitch-streams', {}, { jobId: `poll-twitch-${Date.now()}` });
  }

  public async pollStreams(): Promise<void> {
    if (!this.container.client.isReady()) {
      throw new Error(
        'Discord client is not ready (gateway disconnected). Skipping stream polling cycle.',
      );
    }

    const streamerRepo = this.container.streamerRepository;
    const allConfigs = await streamerRepo.listAll();

    if (allConfigs.length === 0) {
      return;
    }

    const uniqueLogins = Array.from(new Set(allConfigs.map((c) => c.streamerLogin.toLowerCase())));
    const liveStreamsMap = await this.twitchService.fetchLiveStreams(uniqueLogins);

    for (const config of allConfigs) {
      const liveStream = liveStreamsMap.get(config.streamerLogin.toLowerCase());

      if (liveStream) {
        // Stream is currently LIVE
        const isNewStream = !config.isLive || config.lastStreamId !== liveStream.id;

        if (isNewStream) {
          try {
            const channel = await this.container.client.channels.fetch(config.channelId);
            if (channel && channel.isTextBased() && 'send' in channel) {
              const streamUrl = `https://twitch.tv/${liveStream.userLogin}`;

              const embed = new EmbedBuilder()
                .setColor(0x9146ff) // Twitch Purple
                .setTitle(`🔴 ${liveStream.userName} está AO VIVO na Twitch!`)
                .setURL(streamUrl)
                .setDescription(
                  `**${liveStream.title}**\n\n🎮 **Categoria:** \`${liveStream.gameName}\`\n👥 **Espectadores:** \`${liveStream.viewerCount}\`\n🔗 **Assista agora:** [twitch.tv/${liveStream.userLogin}](${streamUrl})`,
                )
                .setImage(`${liveStream.thumbnailUrl}?t=${Date.now()}`)
                .setTimestamp(new Date(liveStream.startedAt))
                .setFooter({ text: 'Twitch Live Notification • CoreBot' });

              const content = config.discordUserId
                ? `📢 Ei <@${config.discordUserId}>, sua live começou!`
                : `📢 **${liveStream.userName}** acabou de entrar ao vivo!`;

              await channel.send({ content, embeds: [embed] });
              logger.info(
                {
                  streamer: liveStream.userLogin,
                  streamId: liveStream.id,
                  channelId: config.channelId,
                },
                'Sent Twitch live announcement',
              );
            } else {
              logger.warn(
                {
                  guildId: config.guildId,
                  channelId: config.channelId,
                  streamer: config.streamerLogin,
                },
                'Twitch target channel is not a text-based channel. Deleting invalid streamer config.',
              );
              await streamerRepo.delete(config.guildId, config.streamerLogin);
              continue;
            }
          } catch (notifErr) {
            const channelErr = isDiscordChannelError(notifErr);
            if (channelErr.isChannelError) {
              logger.warn(
                {
                  guildId: config.guildId,
                  channelId: config.channelId,
                  streamer: config.streamerLogin,
                  errorCode: channelErr.code,
                },
                'Twitch announcement channel missing or inaccessible (DiscordAPIError). Deleting invalid streamer config.',
              );
              await streamerRepo.delete(config.guildId, config.streamerLogin);
              continue;
            }

            logger.error(
              { error: notifErr, streamer: config.streamerLogin, channelId: config.channelId },
              'Failed to send Twitch live notification to channel',
            );
          }

          // Update record with live status and current stream ID
          await streamerRepo.updateStreamStatus(config.id, true, liveStream.id);
        }
      } else {
        // Stream is OFFLINE
        if (config.isLive) {
          logger.info({ streamer: config.streamerLogin }, 'Stream went offline');
          await streamerRepo.updateStreamStatus(config.id, false);
        }
      }
    }
  }
}
