import { ChannelType, SlashCommandBuilder, TextChannel } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { GameMonitorService } from '../services/game-monitor.service.js';
import { queryServer } from '../services/query.protocols.js';

export const serverCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Monitora status, jogadores e latência de servidores de jogos em tempo real')
    // Subcommand: cadastrar
    .addSubcommand((sub) =>
      sub
        .setName('cadastrar')
        .setDescription('Cadastra um novo servidor para monitoramento contínuo')
        .addStringOption((opt) =>
          opt.setName('nome').setDescription('Nome de exibição do servidor').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setDescription('Tipo do servidor/protocolo')
            .setRequired(true)
            .addChoices(
              { name: 'Minecraft (Java SLP)', value: 'minecraft' },
              { name: 'Valve Source Engine (A2S_INFO)', value: 'source' },
              { name: 'Conexão TCP Genérica', value: 'generic_tcp' },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName('host')
            .setDescription('Endereço IP ou hostname do servidor')
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt.setName('porta').setDescription('Porta do servidor').setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal_exibicao')
            .setDescription('Canal de texto onde a mensagem de status fixa será atualizada')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('porta_query')
            .setDescription('Porta de query UDP/TCP alternativa (opcional)'),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('intervalo')
            .setDescription('Intervalo de atualização em segundos (mínimo 30, padrão 60)'),
        ),
    )
    // Subcommand: listar
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista todos os servidores monitorados neste servidor Discord'),
    )
    // Subcommand: remover
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove o monitoramento de um servidor e apaga sua mensagem fixa')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID do servidor monitorado').setRequired(true),
        ),
    )
    // Subcommand: status
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Realiza uma checagem de status imediata de um servidor cadastrado')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID do servidor monitorado').setRequired(true),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId } = ctx;
    const serverRepo = container.gameServerRepository;
    const monitorService = new GameMonitorService(container);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'cadastrar') {
      const name = interaction.options.getString('nome', true);
      const gameType = interaction.options.getString('tipo', true);
      const host = interaction.options.getString('host', true);
      const port = interaction.options.getInteger('porta', true);
      const channel = interaction.options.getChannel('canal_exibicao', true);
      const queryPort = interaction.options.getInteger('porta_query');
      const interval = Math.max(interaction.options.getInteger('intervalo') || 60, 30);

      await interaction.deferReply({ ephemeral: true });

      // Save to database
      const created = await serverRepo.create({
        guildId,
        name,
        gameType,
        host,
        port,
        queryPort,
        displayChannelId: channel.id,
        intervalSeconds: interval,
      });

      // Trigger initial query and post first embed
      await monitorService.updateServerDisplay(created.id);

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Servidor Cadastrado para Monitoramento!',
            `🎮 **Nome:** ${name}\n📦 **Tipo:** \`${gameType}\`\n🌐 **Endereço:** \`${host}:${port}\`\n📢 **Canal de Exibição:** <#${channel.id}>\n⏱️ **Intervalo:** ${interval}s\n🆔 **ID:** \`${created.id}\``,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'listar') {
      const servers = await serverRepo.listByGuild(guildId);

      if (servers.length === 0) {
        await interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhum Servidor Monitorado',
              'Cadastre um servidor com `/server cadastrar`.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const desc = servers
        .map(
          (s, i) =>
            `**${i + 1}. ${s.name}** (\`${s.gameType}\`)\n🌐 \`${s.host}:${s.port}\` | Status: **${s.lastStatus || 'DESCONHECIDO'}** | Canal: <#${s.displayChannelId}>\n🆔 \`${s.id}\``,
        )
        .join('\n\n');

      await interaction.reply({
        embeds: [BotEmbed.info('Servidores de Jogos Monitorados', desc)],
      });
      return;
    }

    if (subcommand === 'remover') {
      const serverId = interaction.options.getString('id', true);
      const server = await serverRepo.findById(serverId);

      if (!server || server.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrado', 'Servidor de jogo não encontrado.')],
          ephemeral: true,
        });
        return;
      }

      // Try to delete the fixed Discord message if it exists
      if (server.messageId) {
        try {
          const ch = await container.client.channels
            .fetch(server.displayChannelId)
            .catch(() => null);
          if (ch && ch.isTextBased()) {
            const msg = await (ch as TextChannel).messages
              .fetch(server.messageId)
              .catch(() => null);
            if (msg) await msg.delete().catch(() => null);
          }
        } catch {
          // Ignore message deletion failure
        }
      }

      await serverRepo.delete(serverId);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Removido',
            `O monitoramento de **${server.name}** foi encerrado e sua mensagem foi removida.`,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'status') {
      const serverId = interaction.options.getString('id', true);
      const server = await serverRepo.findById(serverId);

      if (!server || server.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrado', 'Servidor não encontrado.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const queryResult = await queryServer(
        server.gameType,
        server.host,
        server.port,
        server.queryPort,
      );

      const embed = monitorService.buildServerEmbed(server, queryResult);
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
