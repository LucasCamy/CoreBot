import { SlashCommandBuilder } from 'discord.js';
import { ICommand, CommandContext } from '../../../types/index.js';
import { MatchmakingService } from '../services/matchmaking.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { buildLobbyActionRow } from '../buttons/lobby.buttons.js';
import { createLobbySchema } from '../schemas/matchmaking.schema.js';

export const JogarCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('jogar')
    .setDescription('Organiza sessões de jogatina e lobbies dinâmicos')
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria um novo lobby para jogatina')
        .addStringOption((opt) =>
          opt
            .setName('jogo')
            .setDescription('Nome do jogo (ex: Valorant, Helldivers, LoL, CS2)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('horario')
            .setDescription('Horário de início (ex: 21:00, 20:30, 22h, 15/10 21:00)')
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('vagas')
            .setDescription('Limite máximo de vagas de jogadores (opcional)')
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista os lobbies de jogatina ativos no servidor'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancelar')
        .setDescription('Cancela um lobby de jogatina criado por você')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('ID do lobby (visível no rodapé do painel)')
            .setRequired(true),
        ),
    ),

  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.interaction.options.getSubcommand();
    const service = new MatchmakingService(ctx.container);

    if (sub === 'criar') {
      const gameName = ctx.interaction.options.getString('jogo', true);
      const timeStr = ctx.interaction.options.getString('horario', true);
      const maxPlayers = ctx.interaction.options.getInteger('vagas', false);

      const validation = createLobbySchema.safeParse({
        gameName,
        timeString: timeStr,
        maxPlayers,
      });

      if (!validation.success) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.error('Dados Inválidos', validation.error.errors[0].message)],
          ephemeral: true,
        });
        return;
      }

      const guildConfig = await ctx.container.guildRepository.findByGuildId(ctx.guildId);
      const tz = guildConfig?.timezone || 'America/Sao_Paulo';
      const startsAt = service.parseLobbyTime(timeStr, tz);

      const lobby = await service.createLobby({
        guildId: ctx.guildId,
        gameName,
        startsAt,
        maxPlayers,
        channelId: ctx.interaction.channelId,
        creatorId: ctx.member.id,
      });

      const embed = service.buildLobbyEmbed(lobby);
      const row = buildLobbyActionRow(lobby.id, false);

      const message = await ctx.interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      await service.updateLobbyMessage(lobby.id, message.id);
      return;
    }

    if (sub === 'listar') {
      const lobbies = await ctx.container.matchmakingRepository.findLobbiesByGuild(
        ctx.guildId,
        'OPEN',
      );

      if (lobbies.length === 0) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhum Lobby Ativo',
              'Não há nenhum lobby de jogatina aberto no momento. Use `/jogar criar` para abrir uma mesa!',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const description = lobbies
        .map((l) => {
          const timestamp = Math.floor(l.startsAt.getTime() / 1000);
          const confirmed = l.participants.filter((p) => p.status === 'CONFIRMED').length;
          const slots = l.maxPlayers ? `${confirmed}/${l.maxPlayers}` : `${confirmed}`;
          return `🎮 **${l.gameName}** (<t:${timestamp}:R>)\n• Criador: <@${l.creatorId}>\n• Vagas: ${slots}\n• ID: \`${l.id.slice(0, 8)}\`\n`;
        })
        .join('\n');

      await ctx.interaction.reply({
        embeds: [
          BotEmbed.info('🕹️ Lobbies de Jogatina Abertos', description).setFooter({
            text: 'Use os botões na mensagem original do lobby para entrar ou sair.',
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'cancelar') {
      const lobbyIdPrefix = ctx.interaction.options.getString('id', true).trim();
      const lobbies = await ctx.container.matchmakingRepository.findLobbiesByGuild(ctx.guildId);
      const lobby = lobbies.find((l) => l.id.startsWith(lobbyIdPrefix));

      if (!lobby) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.error('Erro', 'Lobby não encontrado com este ID.')],
          ephemeral: true,
        });
        return;
      }

      if (lobby.creatorId !== ctx.member.id) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error('Permissão Negada', 'Apenas quem criou o lobby pode cancelá-lo.'),
          ],
          ephemeral: true,
        });
        return;
      }

      await ctx.container.matchmakingRepository.updateLobbyStatus(lobby.id, 'CANCELLED');

      // Update message if exists
      if (lobby.messageId) {
        const channel = ctx.guild.channels.cache.get(lobby.channelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(lobby.messageId).catch(() => null);
          if (message) {
            const updated = await service.getLobby(lobby.id);
            if (updated) {
              const embed = service.buildLobbyEmbed(updated);
              await message.edit({ embeds: [embed], components: [] }).catch(() => null);
            }
          }
        }
      }

      await ctx.interaction.reply({
        embeds: [
          BotEmbed.success('Lobby Cancelado', `O lobby de **${lobby.gameName}** foi cancelado.`),
        ],
        ephemeral: true,
      });
      return;
    }
  },
};
