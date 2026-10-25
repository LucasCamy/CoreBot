import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { SystemMessagesService } from '../services/system-messages.service.js';

export const systemMessagesCommand: ICommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('mensagens-sistema')
    .setDescription('Configura mensagens automáticas do sistema (boas-vindas e impulsos/boosts)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // Subcommand: boas-vindas
    .addSubcommand((sub) =>
      sub
        .setName('boas-vindas')
        .setDescription('Configura a mensagem de boas-vindas para novos membros')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal de texto onde a mensagem de boas-vindas será enviada')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addBooleanOption((opt) =>
          opt.setName('ativo').setDescription('Ativar ou desativar mensagem de boas-vindas'),
        )
        .addStringOption((opt) =>
          opt
            .setName('mensagem')
            .setDescription('Texto da mensagem ({user}, {userMention}, {server}, {memberCount})'),
        )
        .addBooleanOption((opt) =>
          opt.setName('usar_embed').setDescription('Enviar em formato embed estilizado?'),
        )
        .addStringOption((opt) =>
          opt.setName('cor').setDescription('Cor hex do embed (ex: #5865F2)'),
        ),
    )
    // Subcommand: boost
    .addSubcommand((sub) =>
      sub
        .setName('boost')
        .setDescription('Configura a mensagem quando alguém impulsionar o servidor')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal de texto onde a mensagem de boost será enviada')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addBooleanOption((opt) =>
          opt.setName('ativo').setDescription('Ativar ou desativar mensagem de boost'),
        )
        .addStringOption((opt) =>
          opt
            .setName('mensagem')
            .setDescription(
              'Texto da mensagem ({user}, {userMention}, {server}, {boostCount}, {memberCount})',
            ),
        )
        .addBooleanOption((opt) =>
          opt.setName('usar_embed').setDescription('Enviar em formato embed estilizado?'),
        )
        .addStringOption((opt) =>
          opt.setName('cor').setDescription('Cor hex do embed (ex: #F47FFF)'),
        ),
    )
    // Subcommand: painel
    .addSubcommand((sub) =>
      sub
        .setName('painel')
        .setDescription('Exibe as configurações atuais das mensagens do sistema'),
    )
    // Subcommand: testar
    .addSubcommand((sub) =>
      sub
        .setName('testar')
        .setDescription(
          'Dispara uma mensagem de teste para simular o resultado no canal configurado',
        )
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setDescription('Tipo de mensagem para testar')
            .setRequired(true)
            .addChoices(
              { name: '👋 Boas-vindas (Novo Membro)', value: 'boas-vindas' },
              { name: '🚀 Impulso (Server Boost)', value: 'boost' },
            ),
        ),
    ),

  async execute(ctx: CommandContext): Promise<void> {
    const { interaction, container, guild, member } = ctx;
    await interaction.deferReply({ ephemeral: true });

    const service = new SystemMessagesService(container);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'boas-vindas') {
      const channel = interaction.options.getChannel('canal');
      const ativo = interaction.options.getBoolean('ativo');
      const mensagem = interaction.options.getString('mensagem');
      const usarEmbed = interaction.options.getBoolean('usar_embed');
      const cor = interaction.options.getString('cor');

      if (
        channel === null &&
        ativo === null &&
        mensagem === null &&
        usarEmbed === null &&
        cor === null
      ) {
        await interaction.editReply({
          embeds: [
            BotEmbed.warning(
              'Nenhum Parâmetro Informado',
              'Por favor, forneça ao menos um dos parâmetros (`canal`, `ativo`, `mensagem`, `usar_embed` ou `cor`) para atualizar as boas-vindas.',
            ),
          ],
        });
        return;
      }

      try {
        const updateData: {
          welcomeEnabled?: boolean;
          welcomeChannelId?: string;
          welcomeMessage?: string;
          welcomeUseEmbed?: boolean;
          welcomeColor?: string;
        } = {};

        if (ativo !== null) updateData.welcomeEnabled = ativo;
        if (channel !== null) updateData.welcomeChannelId = channel.id;
        if (mensagem !== null) updateData.welcomeMessage = mensagem;
        if (usarEmbed !== null) updateData.welcomeUseEmbed = usarEmbed;
        if (cor !== null) updateData.welcomeColor = cor;

        const updated = await service.updateWelcomeConfig(guild.id, updateData);

        const embed = BotEmbed.success(
          'Configuração de Boas-Vindas Atualizada',
          'As configurações de boas-vindas foram salvas com sucesso!',
        ).addFields(
          {
            name: 'Status',
            value: updated.welcomeEnabled ? '🟢 Ativado' : '🔴 Desativado',
            inline: true,
          },
          {
            name: 'Canal',
            value: updated.welcomeChannelId ? `<#${updated.welcomeChannelId}>` : '*(Não definido)*',
            inline: true,
          },
          {
            name: 'Formato',
            value: updated.welcomeUseEmbed
              ? `Embed (${updated.welcomeColor || '#5865F2'})`
              : 'Texto simples',
            inline: true,
          },
          {
            name: 'Mensagem',
            value: updated.welcomeMessage,
            inline: false,
          },
        );

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({
          embeds: [
            BotEmbed.error(
              'Erro ao Atualizar Boas-Vindas',
              error instanceof Error ? error.message : 'Parâmetros inválidos.',
            ),
          ],
        });
      }
      return;
    }

    if (subcommand === 'boost') {
      const channel = interaction.options.getChannel('canal');
      const ativo = interaction.options.getBoolean('ativo');
      const mensagem = interaction.options.getString('mensagem');
      const usarEmbed = interaction.options.getBoolean('usar_embed');
      const cor = interaction.options.getString('cor');

      if (
        channel === null &&
        ativo === null &&
        mensagem === null &&
        usarEmbed === null &&
        cor === null
      ) {
        await interaction.editReply({
          embeds: [
            BotEmbed.warning(
              'Nenhum Parâmetro Informado',
              'Por favor, forneça ao menos um dos parâmetros (`canal`, `ativo`, `mensagem`, `usar_embed` ou `cor`) para atualizar a mensagem de boost.',
            ),
          ],
        });
        return;
      }

      try {
        const updateData: {
          boostEnabled?: boolean;
          boostChannelId?: string;
          boostMessage?: string;
          boostUseEmbed?: boolean;
          boostColor?: string;
        } = {};

        if (ativo !== null) updateData.boostEnabled = ativo;
        if (channel !== null) updateData.boostChannelId = channel.id;
        if (mensagem !== null) updateData.boostMessage = mensagem;
        if (usarEmbed !== null) updateData.boostUseEmbed = usarEmbed;
        if (cor !== null) updateData.boostColor = cor;

        const updated = await service.updateBoostConfig(guild.id, updateData);

        const embed = BotEmbed.success(
          'Configuração de Impulsos (Boost) Atualizada',
          'As configurações de mensagem de boost foram salvas com sucesso!',
        ).addFields(
          {
            name: 'Status',
            value: updated.boostEnabled ? '🟢 Ativado' : '🔴 Desativado',
            inline: true,
          },
          {
            name: 'Canal',
            value: updated.boostChannelId ? `<#${updated.boostChannelId}>` : '*(Não definido)*',
            inline: true,
          },
          {
            name: 'Formato',
            value: updated.boostUseEmbed
              ? `Embed (${updated.boostColor || '#F47FFF'})`
              : 'Texto simples',
            inline: true,
          },
          {
            name: 'Mensagem',
            value: updated.boostMessage,
            inline: false,
          },
        );

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({
          embeds: [
            BotEmbed.error(
              'Erro ao Atualizar Mensagem de Boost',
              error instanceof Error ? error.message : 'Parâmetros inválidos.',
            ),
          ],
        });
      }
      return;
    }

    if (subcommand === 'painel') {
      const config = await service.getConfig(guild.id);

      const welcomeChannelStr = config?.welcomeChannelId
        ? `<#${config.welcomeChannelId}>`
        : '*(Não definido)*';
      const welcomeStatusStr = config?.welcomeEnabled ? '🟢 Ativado' : '🔴 Desativado';
      const welcomeFormatStr =
        (config?.welcomeUseEmbed ?? true)
          ? `Embed (${config?.welcomeColor || '#5865F2'})`
          : 'Texto simples';
      const welcomeMsgStr =
        config?.welcomeMessage ||
        '👋 Seja bem-vindo(a) ao **{server}**, {userMention}! Agora somos **{memberCount}** membros.';

      const boostChannelStr = config?.boostChannelId
        ? `<#${config.boostChannelId}>`
        : '*(Não definido)*';
      const boostStatusStr = config?.boostEnabled ? '🟢 Ativado' : '🔴 Desativado';
      const boostFormatStr =
        (config?.boostUseEmbed ?? true)
          ? `Embed (${config?.boostColor || '#F47FFF'})`
          : 'Texto simples';
      const boostMsgStr =
        config?.boostMessage ||
        '🚀 **{userMention}** acabou de impulsionar o servidor! Muito obrigado pelo apoio! O **{server}** agora conta com **{boostCount}** impulsos. 🎉';

      const embed = BotEmbed.info(
        'Mensagens do Sistema do Servidor',
        'Substitua as mensagens padrão do Discord por mensagens personalizadas do bot com menções e embeds.',
      ).addFields(
        {
          name: '👋 Boas-Vindas',
          value: `**Status:** ${welcomeStatusStr}\n**Canal:** ${welcomeChannelStr}\n**Formato:** ${welcomeFormatStr}\n**Mensagem:**\n> ${welcomeMsgStr}`,
          inline: false,
        },
        {
          name: '🚀 Impulsos (Server Boost)',
          value: `**Status:** ${boostStatusStr}\n**Canal:** ${boostChannelStr}\n**Formato:** ${boostFormatStr}\n**Mensagem:**\n> ${boostMsgStr}`,
          inline: false,
        },
        {
          name: '🏷️ Variáveis Dinâmicas Disponíveis',
          value:
            '`{user}`: Nome exibido do membro\n' +
            '`{userMention}`: Menção ao membro (<@id>)\n' +
            '`{username}`: Nome de usuário (tag)\n' +
            '`{server}`: Nome do servidor\n' +
            '`{memberCount}`: Total de membros no servidor\n' +
            '`{boostCount}`: Total de impulsos do servidor\n' +
            '`{boostTier}`: Nível de boost do servidor (0, 1, 2, 3)',
          inline: false,
        },
      );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'testar') {
      const tipo = interaction.options.getString('tipo', true) as 'boas-vindas' | 'boost';
      const result = await service.sendTestMessage(guild, member, tipo);

      if (result.success && result.channelId) {
        await interaction.editReply({
          embeds: [
            BotEmbed.success(
              'Simulação Concluída!',
              `A mensagem de teste de **${tipo}** foi enviada com sucesso no canal <#${result.channelId}>.`,
            ),
          ],
        });
      } else {
        await interaction.editReply({
          embeds: [
            BotEmbed.error(
              'Falha na Simulação',
              result.error || 'Não foi possível enviar a mensagem de teste.',
            ),
          ],
        });
      }
      return;
    }
  },
};
