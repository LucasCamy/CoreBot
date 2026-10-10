import { EmbedBuilder, TextChannel } from 'discord.js';
import { Container } from '../../../core/container.js';
import { MonitoredServer } from '@prisma/client';
import { queryServer, ServerQueryResult } from './query.protocols.js';
import { BOT_COLORS } from '../../../config/constants.js';
import { logger } from '../../../utils/logger.js';
import { QueueManager } from '../../../jobs/queue.js';

export const GAME_MONITOR_QUEUE = 'game-server-monitor-queue';

export class GameMonitorService {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly container: Container) {}

  public buildServerEmbed(server: MonitoredServer, query: ServerQueryResult): EmbedBuilder {
    const isOnline = query.online;
    const color = isOnline ? BOT_COLORS.SUCCESS : BOT_COLORS.DANGER;
    const statusText = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';

    let gameIcon = '🎮';
    if (server.gameType === 'minecraft') gameIcon = '⛏️';
    else if (server.gameType === 'source') gameIcon = '🔫';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${gameIcon} ${server.name} — Status do Servidor`)
      .addFields(
        { name: 'Status', value: statusText, inline: true },
        { name: 'Endereço', value: `\`${server.host}:${server.port}\``, inline: true },
        { name: 'Latência (Ping)', value: isOnline ? `⚡ ${query.pingMs}ms` : '—', inline: true },
      )
      .setFooter({ text: `ID: ${server.id} | Atualizado automaticamente` })
      .setTimestamp();

    if (isOnline) {
      if (typeof query.playersOnline === 'number') {
        const maxStr = typeof query.playersMax === 'number' ? ` / ${query.playersMax}` : '';
        embed.addFields({
          name: 'Jogadores Online',
          value: `👥 **${query.playersOnline}${maxStr}**`,
          inline: true,
        });
      }

      if (query.version) {
        embed.addFields({ name: 'Versão', value: `📦 ${query.version}`, inline: true });
      }

      if (query.mapName) {
        embed.addFields({ name: 'Mapa Atual', value: `🗺️ ${query.mapName}`, inline: true });
      }

      if (query.motd) {
        embed.setDescription(`> *${query.motd}*`);
      }

      if (query.playerNames && query.playerNames.length > 0) {
        embed.addFields({
          name: 'Lista de Jogadores',
          value:
            query.playerNames.slice(0, 15).join(', ') +
            (query.playerNames.length > 15 ? '...' : ''),
          inline: false,
        });
      }
    } else if (query.error) {
      embed.setDescription(`⚠️ **Motivo:** ${query.error}`);
    }

    return embed;
  }

  public async updateServerDisplay(serverId: string): Promise<void> {
    const serverRepo = this.container.gameServerRepository;
    const server = await serverRepo.findById(serverId);
    if (!server || !server.isActive) return;

    try {
      const queryResult = await queryServer(
        server.gameType,
        server.host,
        server.port,
        server.queryPort,
      );

      const embed = this.buildServerEmbed(server, queryResult);
      const channel = await this.container.client.channels
        .fetch(server.displayChannelId)
        .catch(() => null);

      if (!channel || !channel.isTextBased()) {
        logger.warn(
          { channelId: server.displayChannelId, serverId: server.id },
          'Display channel not found for monitored server',
        );
        return;
      }

      const textChannel = channel as TextChannel;
      let existingMessage = null;

      if (server.messageId) {
        existingMessage = await textChannel.messages.fetch(server.messageId).catch(() => null);
      }

      if (existingMessage) {
        await existingMessage.edit({ embeds: [embed] });
        await serverRepo.updateStatusAndMessage(
          server.id,
          queryResult.online ? 'ONLINE' : 'OFFLINE',
        );
      } else {
        const sent = await this.container.notificationService.sendToChannel({
          guildId: server.guildId,
          module: 'game-monitor',
          eventType: 'server_status_post',
          channelId: server.displayChannelId,
          embeds: [embed],
        });

        if (sent) {
          await serverRepo.updateStatusAndMessage(
            server.id,
            queryResult.online ? 'ONLINE' : 'OFFLINE',
            sent.id,
          );
        }
      }
    } catch (error) {
      logger.error({ error, serverId: server.id }, 'Failed to update game server display');
    }
  }

  public async startScheduler(): Promise<void> {
    logger.info('Starting Game Server Monitor BullMQ worker and polling scheduler...');

    // Register BullMQ worker
    QueueManager.registerWorker(
      GAME_MONITOR_QUEUE,
      async (job) => {
        const { serverId } = job.data as { serverId: string };
        await this.updateServerDisplay(serverId);
      },
      { concurrency: 3 },
    );

    // Initial check
    await this.pollAllActiveServers();

    // Recurrent check every 60 seconds
    this.timer = setInterval(() => {
      this.pollAllActiveServers().catch((err) => {
        logger.error({ error: err }, 'Error polling game servers');
      });
    }, 60 * 1000);
  }

  public stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async pollAllActiveServers(): Promise<void> {
    const servers = await this.container.gameServerRepository.listAllActive();
    const queue = QueueManager.getQueue(GAME_MONITOR_QUEUE);

    for (const server of servers) {
      await queue.add(
        `check-${server.id}`,
        { serverId: server.id },
        { jobId: `check-${server.id}-${Math.floor(Date.now() / (server.intervalSeconds * 1000))}` },
      );
    }
  }
}
