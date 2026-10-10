import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';

export const voiceHubCommand: ICommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('voice-hub')
    .setDescription('Gerencia hubs de canais de voz temporários dinâmicos')
    // Subcommand: configurar
    .addSubcommand((sub) =>
      sub
        .setName('configurar')
        .setDescription('Configura um canal gatilho para gerar salas temporárias')
        .addChannelOption((opt) =>
          opt
            .setName('canal_gerador')
            .setDescription('Canal de voz gatilho (onde os usuários entram para criar a sala)')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('categoria')
            .setDescription('Categoria onde as salas temporárias serão criadas')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('modelo_nome')
            .setDescription(
              'Modelo do nome da sala (placeholders: {user}, {username}). Padrão: 🔊 Sala de {user}',
            ),
        )
        .addIntegerOption((opt) =>
          opt.setName('limite_padrao').setDescription('Limite padrão de usuários na sala (0 a 99)'),
        )
        .addIntegerOption((opt) =>
          opt.setName('bitrate').setDescription('Bitrate do canal em bps (ex: 64000, 96000)'),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('privado')
            .setDescription('Criar salas como privadas por padrão? (Padrão: false)'),
        ),
    )
    // Subcommand: listar
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista os hubs de voz dinâmicos configurados'),
    )
    // Subcommand: remover
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove a configuração de um hub de voz')
        .addChannelOption((opt) =>
          opt
            .setName('canal_gerador')
            .setDescription('Canal gatilho a ser desvinculado')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId } = ctx;
    const voiceHubRepo = container.voiceHubRepository;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'configurar') {
      const hubChannel = interaction.options.getChannel('canal_gerador', true);
      const category = interaction.options.getChannel('categoria', true);
      const isPrivate = interaction.options.getBoolean('privado') ?? false;
      const defaultNaming = isPrivate ? '🔒 Privada de {user}' : '🔊 Sala de {user}';
      const namingTemplate = interaction.options.getString('modelo_nome') || defaultNaming;
      const defaultUserLimit = interaction.options.getInteger('limite_padrao');
      const bitrate = interaction.options.getInteger('bitrate');

      await voiceHubRepo.upsertHub({
        guildId,
        hubChannelId: hubChannel.id,
        targetCategoryId: category.id,
        namingTemplate,
        defaultUserLimit,
        bitrate,
        isPrivate,
      });

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Voice Hub Configurado!',
            `🎙️ **Canal Gatilho:** <#${hubChannel.id}>\n📁 **Categoria de Destino:** <#${category.id}>\n🏷️ **Modelo do Nome:** \`${namingTemplate}\`\n🔒 **Modo:** ${isPrivate ? 'Privado por Padrão (Trancado)' : 'Público por Padrão (Aberto)'}\n👥 **Limite Padrão:** ${defaultUserLimit ? `${defaultUserLimit} membros` : 'Sem limite'}\n🔊 **Bitrate:** ${bitrate ? `${bitrate / 1000} kbps` : 'Padrão'}`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'listar') {
      const hubs = await voiceHubRepo.listHubs(guildId);
      const activeChannels = await voiceHubRepo.listActiveChannels(guildId);

      if (hubs.length === 0) {
        await interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhum Hub Configurado',
              'Não há canais de voz dinâmicos configurados no servidor.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const hubsDesc = hubs
        .map(
          (h, i) =>
            `**${i + 1}.** Gatilho: <#${h.hubChannelId}> ➡️ Categoria: <#${h.targetCategoryId}>\n🏷️ Formato: \`${h.namingTemplate}\` | Modo: **${h.isPrivate ? '🔒 Privado' : '🔊 Público'}**`,
        )
        .join('\n\n');

      const embed = BotEmbed.info(
        'Hubs de Voz Dinâmicos',
        `${hubsDesc}\n\n📊 **Canais Ativos no Momento:** ${activeChannels.length} sala(s)`,
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === 'remover') {
      const hubChannel = interaction.options.getChannel('canal_gerador', true);
      const deleted = await voiceHubRepo.deleteHub(guildId, hubChannel.id);

      if (!deleted) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrado', 'Este canal de voz não é um hub registrado.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Removido',
            `O hub do canal <#${hubChannel.id}> foi removido com sucesso.`,
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
