import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { IButtonHandler, ButtonContext } from '../../../types/index.js';
import { MatchmakingService } from '../services/matchmaking.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';

export function buildLobbyActionRow(
  lobbyId: string,
  isClosed = false,
): ActionRowBuilder<ButtonBuilder> {
  const confirmBtn = new ButtonBuilder()
    .setCustomId(`lobby:confirm:${lobbyId}`)
    .setLabel('🎮 Bora / Confirmar')
    .setStyle(ButtonStyle.Success)
    .setDisabled(isClosed);

  const maybeBtn = new ButtonBuilder()
    .setCustomId(`lobby:maybe:${lobbyId}`)
    .setLabel('⏳ Chego tarde / Talvez')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(isClosed);

  const leaveBtn = new ButtonBuilder()
    .setCustomId(`lobby:leave:${lobbyId}`)
    .setLabel('❌ Sair')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(isClosed);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, maybeBtn, leaveBtn);
}

export const LobbyButtonHandler: IButtonHandler = {
  customIdPrefix: 'lobby:',

  async execute(ctx: ButtonContext): Promise<void> {
    const parts = ctx.interaction.customId.split(':');
    const action = parts[1];
    const lobbyId = parts[2];

    const service = new MatchmakingService(ctx.container);
    const lobby = await service.getLobby(lobbyId);

    if (!lobby) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Lobby Não Encontrado', 'Este lobby não existe mais no sistema.')],
        ephemeral: true,
      });
      return;
    }

    if (lobby.status !== 'OPEN') {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.warning(
            'Lobby Fechado',
            'Este lobby já foi finalizado ou a mesa já está pronta!',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const userId = ctx.member.id;
    const username = ctx.member.displayName;

    if (action === 'confirm') {
      const res = await service.confirmParticipant(lobbyId, userId, username);
      if (!res.success) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.warning('Vagas Esgotadas', res.message)],
          ephemeral: true,
        });
        return;
      }
    } else if (action === 'maybe') {
      await service.maybeParticipant(lobbyId, userId, username);
    } else if (action === 'leave') {
      await service.leaveParticipant(lobbyId, userId);
    }

    // Refresh lobby state
    const updatedLobby = await service.getLobby(lobbyId);
    if (!updatedLobby) return;

    const embed = service.buildLobbyEmbed(updatedLobby);
    const row = buildLobbyActionRow(lobbyId, updatedLobby.status !== 'OPEN');

    await ctx.interaction.update({
      embeds: [embed],
      components: [row],
    });

    // Check if max slots reached now
    if (
      updatedLobby.maxPlayers &&
      updatedLobby.participants.filter((p) => p.status === 'CONFIRMED').length >=
        updatedLobby.maxPlayers &&
      updatedLobby.status === 'OPEN'
    ) {
      await service.triggerLobbyReady(updatedLobby);
    }
  },
};
