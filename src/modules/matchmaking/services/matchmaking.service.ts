import { EmbedBuilder } from 'discord.js';
import { Container } from '../../../core/container.js';
import {
  LobbyWithParticipants,
  CreateLobbyDTO,
} from '../../../database/repositories/matchmaking.repository.js';
import { BOT_COLORS } from '../../../config/constants.js';
import { parseDateTime, nowInTimezone } from '../../../utils/time.js';
import { logger } from '../../../utils/logger.js';
import { buildLobbyActionRow } from '../buttons/lobby.buttons.js';

export class MatchmakingService {
  constructor(private readonly container: Container) {}

  public parseLobbyTime(timeStr: string, timezone: string): Date {
    const trimmed = timeStr.trim();
    const now = nowInTimezone(timezone);

    // If HH:mm or HHhMM
    const timeMatch = trimmed.match(/^(\d{1,2})[:h](\d{2})?$/i);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

      let target = now.hour(hour).minute(minute).second(0).millisecond(0);
      // If time has passed today by more than 5 minutes, schedule for tomorrow
      if (target.isBefore(now.subtract(5, 'minute'))) {
        target = target.add(1, 'day');
      }
      return target.toDate();
    }

    // Try full date parser DD/MM/YYYY HH:mm or DD/MM HH:mm
    const parsed = parseDateTime(trimmed, timezone);
    if (parsed) {
      return parsed;
    }

    // Fallback: default to 1 hour from now
    return now.add(1, 'hour').toDate();
  }

  public async createLobby(data: CreateLobbyDTO): Promise<LobbyWithParticipants> {
    const lobby = await this.container.matchmakingRepository.createLobby(data);
    // Add creator as confirmed participant automatically
    await this.container.matchmakingRepository.upsertParticipant(
      lobby.id,
      data.creatorId,
      'Criador',
      'CONFIRMED',
    );
    const refreshed = await this.container.matchmakingRepository.findLobbyById(lobby.id);
    if (!refreshed) {
      throw new Error(`Failed to retrieve newly created lobby: ${lobby.id}`);
    }
    return refreshed;
  }

  public async getLobby(id: string): Promise<LobbyWithParticipants | null> {
    return this.container.matchmakingRepository.findLobbyById(id);
  }

  public async updateLobbyMessage(id: string, messageId: string): Promise<void> {
    await this.container.matchmakingRepository.updateLobbyMessage(id, messageId);
  }

  public async confirmParticipant(
    lobbyId: string,
    userId: string,
    username: string,
  ): Promise<{ success: boolean; message?: string }> {
    const lobby = await this.container.matchmakingRepository.findLobbyById(lobbyId);
    if (!lobby) return { success: false, message: 'Lobby não encontrado' };

    const confirmedCount = lobby.participants.filter(
      (p) => p.status === 'CONFIRMED' && p.userId !== userId,
    ).length;

    if (lobby.maxPlayers && confirmedCount >= lobby.maxPlayers) {
      return { success: false, message: 'O lobby já atingiu o número máximo de vagas!' };
    }

    await this.container.matchmakingRepository.upsertParticipant(
      lobbyId,
      userId,
      username,
      'CONFIRMED',
    );
    return { success: true };
  }

  public async maybeParticipant(lobbyId: string, userId: string, username: string): Promise<void> {
    await this.container.matchmakingRepository.upsertParticipant(
      lobbyId,
      userId,
      username,
      'MAYBE',
    );
  }

  public async leaveParticipant(lobbyId: string, userId: string): Promise<void> {
    await this.container.matchmakingRepository.removeParticipant(lobbyId, userId);
  }

  public buildLobbyEmbed(lobby: LobbyWithParticipants): EmbedBuilder {
    const confirmed = lobby.participants.filter((p) => p.status === 'CONFIRMED');
    const maybe = lobby.participants.filter((p) => p.status === 'MAYBE');

    const totalSlotsStr = lobby.maxPlayers
      ? `${confirmed.length}/${lobby.maxPlayers}`
      : `${confirmed.length}`;

    let statusText = '🟢 Aberto para inscrições';
    let color: number = BOT_COLORS.SUCCESS;

    if (lobby.status === 'READY') {
      statusText = '🔥 MESA PRONTA! Partida Iniciada!';
      color = BOT_COLORS.INFO;
    } else if (lobby.status === 'CANCELLED') {
      statusText = '❌ Cancelado';
      color = BOT_COLORS.DANGER;
    }

    const timestamp = Math.floor(lobby.startsAt.getTime() / 1000);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🎮 Painel de Jogatina: ${lobby.gameName}`)
      .setDescription(
        `**Status:** ${statusText}\n` +
          `**Horário Marcado:** <t:${timestamp}:F> (<t:${timestamp}:R>)\n` +
          `**Organizador:** <@${lobby.creatorId}>\n` +
          `**Vagas:** ${totalSlotsStr}`,
      )
      .setFooter({ text: `Lobby ID: ${lobby.id.slice(0, 8)} • CoreBot Matchmaking` });

    const confirmedList =
      confirmed.length > 0
        ? confirmed.map((p) => `• <@${p.userId}>`).join('\n')
        : '*Nenhum confirmado ainda.*';

    const maybeList =
      maybe.length > 0 ? maybe.map((p) => `• <@${p.userId}> *(Talvez)*`).join('\n') : '*Nenhum.*';

    embed.addFields(
      { name: `✅ Confirmados (${confirmed.length})`, value: confirmedList, inline: true },
      { name: `⏳ Talvez (${maybe.length})`, value: maybeList, inline: true },
    );

    return embed;
  }

  public async triggerLobbyReady(lobby: LobbyWithParticipants): Promise<void> {
    if (lobby.status === 'READY') return;

    logger.info({ lobbyId: lobby.id, gameName: lobby.gameName }, 'Triggering lobby ready state');
    await this.container.matchmakingRepository.updateLobbyStatus(lobby.id, 'READY');

    const guild = await this.container.client.guilds.fetch(lobby.guildId).catch(() => null);
    if (!guild) return;

    const channel = guild.channels.cache.get(lobby.channelId);
    if (!channel || !channel.isTextBased()) return;

    if (lobby.messageId) {
      const message = await channel.messages.fetch(lobby.messageId).catch(() => null);
      if (message) {
        const refreshed = await this.container.matchmakingRepository.findLobbyById(lobby.id);
        if (refreshed) {
          const embed = this.buildLobbyEmbed(refreshed);
          const row = buildLobbyActionRow(lobby.id, true);
          await message.edit({ embeds: [embed], components: [row] }).catch(() => null);

          // Create a thread on the lobby message
          const confirmed = refreshed.participants.filter((p) => p.status === 'CONFIRMED');
          const mentions =
            confirmed.length > 0
              ? confirmed.map((p) => `<@${p.userId}>`).join(' ')
              : `<@${lobby.creatorId}>`;

          try {
            const thread = await message.startThread({
              name: `🎮 ${lobby.gameName} - Mesa Pronta!`,
              autoArchiveDuration: 60,
            });

            await thread.send(
              `🔔 **Mesa pronta para ${lobby.gameName}!**\n${mentions}\nTodos para o canal de voz ou conectados no jogo! Bora jogar!`,
            );
          } catch (threadError) {
            logger.warn(
              { error: threadError, lobbyId: lobby.id },
              'Could not create lobby thread, sending direct message in channel',
            );
            await channel.send(
              `🔔 **Mesa pronta para ${lobby.gameName}!**\n${mentions}\nTodos para o canal de voz ou conectados no jogo! Bora jogar!`,
            );
          }
        }
      }
    }
  }
}
